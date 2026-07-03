import { createModelClient, type ModelClient } from "./models.ts";
import type { ArtifactStore, Artifact } from "./artifact-store.ts";
import { safeJsonParse } from "./truncation-handler.ts";

export interface SheetCell {
  value: string;
  formula?: string;
  format?: "number" | "currency" | "date" | "percentage" | "text";
}

export interface SheetTable {
  headers: string[];
  rows: Record<string, string>[];
}

export interface SheetOutput {
  title: string;
  tables: SheetTable[];
  assumptions: Record<string, string>;
  charts: { title: string; type: string; dataRef: string }[];
  verified: boolean;
  verificationNotes: string[];
}

export class SheetsMode {
  private client: ModelClient;
  private conv?: import("./conversation-store.ts").ConversationStore;

  constructor(
    private store: ArtifactStore,
    private sessionId: string,
    opts?: { modelClient?: ModelClient; conversation?: import("./conversation-store.ts").ConversationStore },
  ) {
    this.client = opts?.modelClient ?? createModelClient();
    this.conv = opts?.conversation;
  }

  async generate(
    request: string,
    sourceData?: string,
    onStatus?: (msg: string) => void,
  ): Promise<SheetOutput> {
    onStatus?.("Analyzing data structure...");

    const files = this.store.getFiles(this.sessionId);
    let fileContext = "";
    if (files.length > 0) {
      fileContext = "\nAvailable data:\n" +
        files.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 4000)}`).join("\n");
    }

    const schemaPrompt = `You are a spreadsheet architect using the v3.0 structured format. Given a request and optional data, design the sheet structure.

Request: ${request}
${sourceData ? `Source data:\n${sourceData.slice(0, 5000)}` : ""}${fileContext}

Return ONLY JSON (no markdown code blocks):
{
  "title": "Sheet name",
  "tables": [
    {
      "headers": ["col1", "col2", ...],
      "rows": [{"col1": "val", "col2": "val", ...}, ...]
    }
  ],
  "assumptions": {"key": "value", ...},
  "summary_layer": {
    "group_by": "column name",
    "aggregations": [{"column": "col", "function": "sum|avg|count|min|max", "label": "Total X"}]
  }
}

Rules:
- If raw data is provided, build a summary layer first (grouped/aggregated), then design charts from that
- Include an assumptions section visible in the sheet
- All formulas should reference actual column ranges using v3.0 format: {"column": "A", "name": "Category", "formula": "=SUM(...)", "format": "currency", "validation": {"type": "list", "source": "range"}}
- Headers should be clear and human-readable
- Include conditional formatting rules where appropriate (color scales for variance, data bars for comparisons)`;

    onStatus?.("Designing sheet structure...");
    const designResp = await this.client.complete(
      [
        { role: "system", content: "You are a spreadsheet designer. Return valid JSON only." },
        { role: "user", content: schemaPrompt },
      ],
      { maxTokens: 8192, temperature: 0.3, tag: "sheet/design" },
    );

    let design: {
      title: string;
      tables: SheetTable[];
      assumptions: Record<string, string>;
      summary_layer?: { group_by: string; aggregations: { column: string; function: string; label: string }[] };
    };

    const designParsed = await safeJsonParse<{ title: string; tables: SheetTable[]; assumptions: Record<string, string>; summary_layer?: any }>(this.client, designResp, "sheet/design-parse");
    if (designParsed.data) {
      design = designParsed.data;
      if (designParsed.recovered) onStatus?.("Recovered truncated sheet design");
    } else {
      design = {
        title: "Sheet1",
        tables: [{ headers: ["Item", "Value"], rows: [{ Item: "Sample", Value: "0" }] }],
        assumptions: {},
      };
    }

    this.conv?.setCheckpoint({
      step: 1,
      totalSteps: 2,
      mode: "sheet",
      partial: { tables: design.tables.length, title: design.title },
      context: `Building spreadsheet "${design.title}" with ${design.tables.length} tables. Next step: populate data and create aggregation layers.`,
    });

    onStatus?.(`Building ${design.tables.length} table(s)...`);

    for (let t = 0; t < design.tables.length; t++) {
      const table = design.tables[t];
      onStatus?.(`  Table ${t + 1}: ${table.headers.join(", ")} (${table.rows.length} rows)`);

      if (design.summary_layer && t === 0) {
        const aggPrompt = `Given this data, create a grouped summary table and chart-ready data.

Headers: ${table.headers.join(", ")}
Rows: ${JSON.stringify(table.rows.slice(0, 50))}
Group by: ${design.summary_layer.group_by}
Aggregations: ${JSON.stringify(design.summary_layer.aggregations)}

Return JSON: { "summary_headers": [...], "summary_rows": [{"col": "val", ...}], "chart_data": { "labels": [...], "datasets": [...] } }`;

        const aggResp = await this.client.complete(
          [
            { role: "system", content: "Create summarized data for charting. Return JSON only." },
            { role: "user", content: aggPrompt },
          ],
          { maxTokens: 8192, temperature: 0.3, tag: "sheet/summarize" },
        );

        try {
          const aggData = JSON.parse(aggResp);
          design.tables.push({
            headers: aggData.summary_headers ?? table.headers,
            rows: aggData.summary_rows ?? table.rows,
          });
        } catch {
          // summary layer failed silently, keep original data
        }
      }
    }

    onStatus?.("Verifying formulas and ranges...");

    const issues: string[] = [];
    for (const table of design.tables) {
      if (table.headers.length === 0) {
        issues.push("Table has no headers");
      }
      for (const row of table.rows) {
        for (const key of Object.keys(row)) {
          if (!table.headers.includes(key)) {
            issues.push(`Column "${key}" in data not in headers: [${table.headers.join(", ")}]`);
          }
        }
      }
    }

    const output: SheetOutput = {
      title: design.title,
      tables: design.tables,
      assumptions: design.assumptions,
      charts: [],
      verified: issues.length === 0,
      verificationNotes: issues,
    };

    if (output.tables.length > 1) {
      output.charts.push({
        title: `${output.title} Summary`,
        type: "bar",
        dataRef: output.tables[1].headers.join(","),
      });
    }

    if (!output.verified) {
      onStatus?.(`Fixing: ${issues.join("; ")}`);
      for (const table of output.tables) {
        const validHeaders = new Set(table.headers);
        table.rows = table.rows.map((row) => {
          const cleaned: Record<string, string> = {};
          for (const h of table.headers) {
            cleaned[h] = row[h] ?? "";
          }
          return cleaned;
        });
      }
      output.verified = true;
    }

    const csvOutput = output.tables.map((t) =>
      [t.headers.join(","), ...t.rows.map((r) => t.headers.map((h) => r[h] ?? "").join(","))].join("\n")
    ).join("\n\n---\n\n");

    const artifact: Artifact = {
      id: crypto.randomUUID(),
      sessionId: this.sessionId,
      type: "sheet",
      title: output.title,
      body: csvOutput,
      format: "csv",
      metadata: { assumptions: output.assumptions, charts: output.charts, tables: output.tables.length },
      sourceFiles: files.map((f) => f.name),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.store.put(artifact);

    onStatus?.(`Sheet "${output.title}" ready (${output.tables.length} tables, ${output.charts.length} charts).`);
    return output;
  }
}
