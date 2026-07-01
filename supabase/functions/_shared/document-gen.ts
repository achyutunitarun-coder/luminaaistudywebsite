// ═══════════════════════════════════════════════════════════════════
// Lumina Computer — Document Generation Tools
//
// Generates slides, documents, spreadsheets, and other artifacts.
// Self-verifies each artifact against the original request before
// returning it as done.
//
// Use cases:
//   - Slides: Markdown-based slide decks (convertible to PPTX)
//   - Docs: Markdown documents (convertible to DOCX)  
//   - Sheets: CSV/TSV data (convertible to XLSX)
//   - Code: FILE: blocks (handled by parser)
// ═══════════════════════════════════════════════════════════════════

import type { Tool, ToolSchema } from "./computer-agent.ts";

// ── Types ───────────────────────────────────────────────────────────

export type DocType = "slides" | "document" | "spreadsheet" | "code";

export interface DocRequest {
  type: DocType;
  title: string;
  content: string;
  format?: "markdown" | "html" | "csv";
}

export interface DocResult {
  type: DocType;
  title: string;
  body: string;
  format: string;
  verified: boolean;
  verificationNotes?: string;
}

// ── Tools ───────────────────────────────────────────────────────────

export const SLIDES_TOOL_SCHEMA: ToolSchema = {
  name: "generate_slides",
  description: "Generate a slide deck from markdown content. Each ## heading becomes a slide. Supports images, charts (via mermaid/ASCII), speaker notes (after ---), and presenter notes.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Deck title" },
      content: { type: "string", description: "Markdown content. Each ## is a slide. Use --- for speaker notes after a slide." },
    },
    required: ["title", "content"],
  },
};

export const DOCUMENT_TOOL_SCHEMA: ToolSchema = {
  name: "generate_document",
  description: "Generate a formatted document (report, essay, guide) with headings, tables, lists, and code blocks.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Document title" },
      content: { type: "string", description: "Full document body in markdown" },
    },
    required: ["title", "content"],
  },
};

export const SPREADSHEET_TOOL_SCHEMA: ToolSchema = {
  name: "generate_spreadsheet",
  description: "Generate a spreadsheet with data rows. First row is headers. Supports formulas with =SUM, =AVG, etc.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Sheet name" },
      content: { type: "string", description: "CSV/TSV data. First row = headers. Use =FORMULA() for computed cells." },
    },
    required: ["title", "content"],
  },
};

// ── Self-Verification ───────────────────────────────────────────────

export function verifyDoc(request: DocRequest, result: DocResult): DocResult {
  const issues: string[] = [];

  // Check title is present and reasonable
  if (!result.title || result.title.trim().length < 3) {
    issues.push("Title is missing or too short");
  }

  // Check body has actual content
  if (!result.body || result.body.trim().length < 50) {
    issues.push("Document body is too thin (< 50 chars)");
  }

  // Check for placeholder content
  if (/lorem ipsum|todo|coming soon|placeholder|item \d/i.test(result.body)) {
    issues.push("Contains placeholder content (lorem ipsum, todo, etc)");
  }

  // Check for truncation
  if (/\.\.\.\s*$/.test(result.body.trim()) || /rest unchanged|to be continued/i.test(result.body)) {
    issues.push("Output appears truncated (ends with '...' or contains 'rest unchanged')");
  }

  // For slides: check each slide has content
  if (request.type === "slides") {
    const slides = result.body.split(/\n##\s+/).filter(Boolean);
    if (slides.length < 2) {
      issues.push("Slide deck has fewer than 2 slides");
    }
    for (let i = 0; i < slides.length; i++) {
      const lines = slides[i].split("\n").filter((l) => l.trim() && !l.startsWith("---") && !l.startsWith("#"));
      if (lines.length < 1) {
        issues.push(`Slide ${i + 1} appears empty`);
      }
    }
  }

  // For spreadsheets: check data has at least 2 rows
  if (request.type === "spreadsheet") {
    const rows = result.body.trim().split("\n").filter(Boolean);
    if (rows.length < 2) {
      issues.push("Spreadsheet has fewer than 2 rows (header + 1 data row)");
    }
  }

  result.verified = issues.length === 0;
  result.verificationNotes = issues.length > 0 ? issues.join("; ") : "All checks passed";
  return result;
}

// ── Tool Factory ────────────────────────────────────────────────────

export function createSlidesTool(): Tool {
  return {
    schema: SLIDES_TOOL_SCHEMA,
    async execute(args: Record<string, any>): Promise<string> {
      const request: DocRequest = {
        type: "slides",
        title: args.title ?? "Untitled Deck",
        content: args.content ?? "",
      };
      const result: DocResult = {
        type: "slides",
        title: request.title,
        body: request.content,
        format: "markdown",
        verified: false,
      };
      const verified = verifyDoc(request, result);
      if (!verified.verified) {
        return `Slides generated but verification found issues:\n${verified.verificationNotes}\n\n---\n\n${verified.body}`;
      }
      return `Slides generated successfully.\n\n${verified.body}`;
    },
  };
}

export function createDocumentTool(): Tool {
  return {
    schema: DOCUMENT_TOOL_SCHEMA,
    async execute(args: Record<string, any>): Promise<string> {
      const request: DocRequest = {
        type: "document",
        title: args.title ?? "Untitled Document",
        content: args.content ?? "",
      };
      const result: DocResult = {
        type: "document",
        title: request.title,
        body: request.content,
        format: "markdown",
        verified: false,
      };
      const verified = verifyDoc(request, result);
      if (!verified.verified) {
        return `Document generated but verification found issues:\n${verified.verificationNotes}\n\n---\n\n${verified.body}`;
      }
      return `Document generated successfully.\n\n${verified.body}`;
    },
  };
}

export function createSpreadsheetTool(): Tool {
  return {
    schema: SPREADSHEET_TOOL_SCHEMA,
    async execute(args: Record<string, any>): Promise<string> {
      const request: DocRequest = {
        type: "spreadsheet",
        title: args.title ?? "Sheet1",
        content: args.content ?? "",
      };
      const result: DocResult = {
        type: "spreadsheet",
        title: request.title,
        body: request.content,
        format: "csv",
        verified: false,
      };
      const verified = verifyDoc(request, result);
      if (!verified.verified) {
        return `Spreadsheet generated but verification found issues:\n${verified.verificationNotes}\n\n---\n\n${verified.body}`;
      }
      return `Spreadsheet generated successfully.\n\n${verified.body}`;
    },
  };
}
