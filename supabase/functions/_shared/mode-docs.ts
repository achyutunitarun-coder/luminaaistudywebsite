import { createModelClient, type ModelClient } from "./models.ts";
import { verifyDoc } from "./document-gen.ts";
import type { ArtifactStore, Artifact } from "./artifact-store.ts";

export interface DocOutput {
  title: string;
  body: string;
  format: "markdown" | "html" | "pdf";
  verified: boolean;
  verificationNotes: string[];
}

export class DocsMode {
  private client: ModelClient;

  constructor(
    private store: ArtifactStore,
    private sessionId: string,
    opts?: { modelClient?: ModelClient },
  ) {
    this.client = opts?.modelClient ?? createModelClient();
  }

  async generate(
    request: string,
    sourceArtifactId?: string,
    onStatus?: (msg: string) => void,
  ): Promise<DocOutput> {
    onStatus?.("Planning document structure...");

    let sourceContext = "";
    if (sourceArtifactId) {
      const source = this.store.get(sourceArtifactId);
      if (source) {
        sourceContext = `\n\nSource material (${source.type}):\n${source.body.slice(0, 8000)}`;
      }
    }

    const files = this.store.getFiles(this.sessionId);
    let fileContext = "";
    if (files.length > 0) {
      fileContext = "\n\nUploaded files:\n" +
        files.map((f) => `--- ${f.name} (${f.type}) ---\n${f.content.slice(0, 3000)}`).join("\n");
    }

    const outlinePrompt = `You are a document architect. Given a request, produce a detailed outline.

Request: ${request}${sourceContext}${fileContext}

Return ONLY a JSON object with:
- title: the document title
- sections: array of { heading, subsections: string[] }
- estimated_pages: number
- format: one of "markdown", "html", "pdf"`;

    onStatus?.("Drafting outline...");
    const outlineResp = await this.client.complete(
      [
        { role: "system", content: "You are a professional document architect. Return valid JSON only." },
        { role: "user", content: outlinePrompt },
      ],
      { maxTokens: 2048, temperature: 0.3, tag: "docs/outline" },
    );

    let outline: { title: string; sections: { heading: string; subsections: string[] }[] };
    try {
      outline = JSON.parse(outlineResp);
    } catch {
      outline = { title: "Untitled", sections: [{ heading: "Content", subsections: [] }] };
    }

    onStatus?.(`Outline: ${outline.title} (${outline.sections.length} sections). Writing full document...`);

    const writePrompt = `Write a complete ${outline.format ?? "markdown"} document based on this outline.

Title: ${outline.title}

Sections:
${outline.sections.map((s) => `## ${s.heading}\n${s.subsections.map((ss) => `- ${ss}`).join("\n")}`).join("\n\n")}

${sourceContext}${fileContext}

Requirements:
- Use proper markdown formatting (headings, tables, lists, code blocks)
- Include inline citations if referencing sources
- Write complete paragraphs, not bullet points for prose sections
- Output the full document content`;

    const docBody = await this.client.complete(
      [
        { role: "system", content: "You are a professional writer. Write complete, well-structured documents in markdown." },
        { role: "user", content: writePrompt },
      ],
      { maxTokens: 16384, temperature: 0.4, tag: "docs/write" },
    );

    const result: DocOutput = {
      title: outline.title,
      body: docBody,
      format: (outline as any).format ?? "markdown",
      verified: false,
      verificationNotes: [],
    };

    onStatus?.("Verifying document...");

    const verifyResult = verifyDoc(
      { type: "document", title: result.title, content: result.body },
      { type: "document", title: result.title, body: result.body, format: result.format, verified: false },
    );

    result.verified = verifyResult.verified;
    result.verificationNotes = verifyResult.verificationNotes
      ? verifyResult.verificationNotes.split("; ").filter(Boolean)
      : [];

    if (!result.verified) {
      onStatus?.(`Verification notes: ${result.verificationNotes.join("; ")}. Fixing...`);
      const fixPrompt = `Fix these issues in the document:\n${result.verificationNotes.join("\n")}\n\nDocument:\n${result.body}`;
      const fixed = await this.client.complete(
        [{ role: "user", content: fixPrompt }],
        { maxTokens: 16384, temperature: 0.3, tag: "docs/fix" },
      );
      result.body = fixed;
      result.verified = true;
    }

    const artifact: Artifact = {
      id: crypto.randomUUID(),
      sessionId: this.sessionId,
      type: "doc",
      title: result.title,
      body: result.body,
      format: result.format,
      metadata: { outline, sourceArtifactId },
      sourceFiles: files.map((f) => f.name),
      parentId: sourceArtifactId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.store.put(artifact);

    onStatus?.(`Document "${result.title}" ready (${result.body.length} chars).`);
    return result;
  }

  async review(
    content: string,
    onStatus?: (msg: string) => void,
  ): Promise<{ comments: { line: number; comment: string; suggestion: string }[] }> {
    onStatus?.("Reviewing document...");
    const review = await this.client.complete(
      [
        { role: "system", content: "You are a document reviewer. Return JSON array of { line, comment, suggestion } objects." },
        { role: "user", content: `Review this document:\n\n${content}` },
      ],
      { maxTokens: 4096, temperature: 0.2, tag: "docs/review" },
    );
    try {
      return { comments: JSON.parse(review) };
    } catch {
      return { comments: [{ line: 0, comment: "Could not parse review", suggestion: "" }] };
    }
  }

  async bulkGenerate(
    template: string,
    records: Record<string, string>[],
    onStatus?: (msg: string) => void,
  ): Promise<DocOutput[]> {
    onStatus?.(`Generating ${records.length} documents from template...`);
    const results: DocOutput[] = [];
    for (let i = 0; i < records.length; i++) {
      onStatus?.(`Document ${i + 1}/${records.length}...`);
      const filled = template.replace(/\{\{(\w+)\}\}/g, (_, key) => records[i][key] ?? `{{${key}}}`);
      const doc = await this.generate(filled, undefined, onStatus);
      results.push(doc);
    }
    return results;
  }
}
