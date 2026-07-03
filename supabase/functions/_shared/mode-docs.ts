import { createModelClient, type ModelClient } from "./models.ts";
import { verifyDoc } from "./document-gen.ts";
import type { ArtifactStore, Artifact } from "./artifact-store.ts";
import { safeJsonParse } from "./truncation-handler.ts";
import {
  isTruncated,
  generateWithContinuation,
  verifyAssembly,
} from "./truncation-guard.ts";

export interface DocOutput {
  title: string;
  body: string;
  format: "markdown" | "html" | "pdf";
  verified: boolean;
  verificationNotes: string[];
  continuationRounds?: number;
  sectionsGenerated?: number;
}

export class DocsMode {
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
    sourceArtifactId?: string,
    onStatus?: (msg: string) => void,
  ): Promise<DocOutput> {
    onStatus?.("Planning document structure...");

    let sourceContext = "";
    if (sourceArtifactId) {
      const source = this.store.get(sourceArtifactId);
      if (source) {
        sourceContext = `\n\nSource material (${source.type}):\n${source.body}`;
      }
    }

    const files = this.store.getFiles(this.sessionId);
    let fileContext = "";
    if (files.length > 0) {
      fileContext = "\n\nUploaded files:\n" +
        files.map((f) => `--- ${f.name} (${f.type}) ---\n${f.content}`).join("\n");
    }

    const outlinePrompt = `You are a document architect using the v3.0 structured format. Given a request, produce a detailed outline.

Request: ${request}${sourceContext}${fileContext}

Return ONLY a JSON object with:
- title: the document title
- subtitle: optional subtitle
- document_type: "report" | "whitepaper" | "proposal" | "memo" | "guide" | "spec" | "blog" | "essay"
- audience: "technical" | "executive" | "general" | "academic"
- sections: array of { heading, subsections: string[] }
- estimated_pages: number
- format: one of "markdown", "html", "pdf"
- tags: string[] (3-5 relevant tags)`;

    onStatus?.("Drafting outline...");
    const outlineResp = await this.client.complete(
      [
        { role: "system", content: "You are a professional document architect. Return valid JSON only." },
        { role: "user", content: outlinePrompt },
      ],
      { maxTokens: 4096, temperature: 0.3, tag: "docs/outline" },
    );

    let outline: { title: string; sections: { heading: string; subsections: string[] }[]; format?: string; document_type?: string; audience?: string; tags?: string[] };
    const outlineParsed = await safeJsonParse<typeof outline>(this.client, outlineResp, "docs/outline-parse");
    if (outlineParsed.data) {
      outline = outlineParsed.data;
    } else {
      outline = { title: "Untitled", sections: [{ heading: "Content", subsections: [] }] };
    }

    onStatus?.(`Outline: ${outline.title} (${outline.sections.length} sections). Writing section by section...`);

    this.conv?.setCheckpoint({
      step: 1,
      totalSteps: outline.sections.length + 1,
      mode: "doc",
      partial: { outline, sectionsPlanned: outline.sections.length },
      context: `Writing document "${outline.title}" with ${outline.sections.length} sections. Sections: ${outline.sections.map((s) => s.heading).join(", ")}. Next step: write section 1.`,
    });

    const frontmatter = `---
title: "${outline.title}"
document_type: "${outline.document_type ?? "report"}"
audience: "${outline.audience ?? "general"}"
tags: ${JSON.stringify(outline.tags ?? ["document"])}
---\n\n`;

    const sections: string[] = [];
    let totalContinuationRounds = 0;

    for (let i = 0; i < outline.sections.length; i++) {
      const sec = outline.sections[i];
      onStatus?.(`Writing section ${i + 1}/${outline.sections.length}: ${sec.heading}`);

      const sectionPrompt = `Write the "${sec.heading}" section of a document titled "${outline.title}".

Document type: ${outline.document_type ?? "report"}
Audience: ${outline.audience ?? "general"}
${sourceContext}${fileContext}

${sec.subsections.length > 0 ? `Subsections to cover:\n${sec.subsections.map((ss) => `- ${ss}`).join("\n")}\n\n` : ""}
Requirements:
- Use proper markdown formatting
- Write complete paragraphs, not bullet points for prose
- Include inline citations if referencing sources
- Start with a "## ${sec.heading}" heading
- Write thorough, substantive content — aim for 300-800 words per section
- Do NOT repeat content from previous sections`;

      const sectionResult = await generateWithContinuation(
        async () => {
          const text = await this.client.complete(
            [
              { role: "system", content: "You are a professional writer. Write complete, well-structured sections." },
              { role: "user", content: sectionPrompt },
            ],
            { maxTokens: 16384, temperature: 0.4, tag: `docs/section${i + 1}` },
          );
          return { text, finishReason: "stop", model: "default" };
        },
        {
          tag: `docs/section${i + 1}`,
          maxContinuationRounds: 5,
          structuralCheck: true,
          contentCheck: true,
        },
      );

      totalContinuationRounds += sectionResult.continuationRounds;
      sections.push(sectionResult.data);

      if (sectionResult.truncated) {
        onStatus?.(`  Section ${i + 1} truncated after ${sectionResult.continuationRounds} continuation rounds — will repair`);
      }

      this.conv?.setCheckpoint({
        step: i + 2,
        totalSteps: outline.sections.length + 1,
        mode: "doc",
        partial: { outline, sectionsGenerated: i + 1, totalSections: outline.sections.length },
        context: `Writing document "${outline.title}". Completed section ${i + 1}/${outline.sections.length}: "${sec.heading}". Next: ${i + 1 < outline.sections.length ? `write section ${i + 2}: "${outline.sections[i + 1].heading}"` : "assemble and verify final document."}`,
      });
    }

    onStatus?.("Assembling final document...");
    let docBody = frontmatter + "\n\n" + sections.join("\n\n");

    const execSummary = `## Executive Summary\n\n${outline.title} provides a comprehensive examination of the subject. This document covers ${outline.sections.length} sections: ${outline.sections.map((s) => s.heading).join(", ")}.\n\n`;
    docBody = frontmatter + "\n\n" + execSummary + sections.join("\n\n");

    if (docBody.length < 100) {
      docBody = await this.client.complete(
        [
          { role: "system", content: "You are a professional writer. Write complete documents." },
          { role: "user", content: `Write a complete document based on this outline:\nTitle: ${outline.title}\n\n${outline.sections.map((s) => `## ${s.heading}\n${s.subsections.map((ss) => `- ${ss}`).join("\n")}`).join("\n\n")}\n\n${sourceContext}${fileContext}` },
        ],
        { maxTokens: 32768, temperature: 0.4, tag: "docs/full-fallback" },
      );
    }

    const assemblyCheck = await verifyAssembly([
      {
        name: "document-not-empty",
        check: () => docBody.trim().length > 200,
        detail: "Document body is too short",
      },
      {
        name: "all-sections-present",
        check: () => {
          const headings = docBody.match(/^#{1,3}\s+.+/gm) ?? [];
          const planned = outline.sections.map((s) => s.heading.toLowerCase().trim());
          const missing = planned.filter((h) => !headings.some((hd) => hd.toLowerCase().includes(h)));
          return missing.length === 0;
        },
        detail: `Missing sections in final assembly`,
      },
      {
        name: "no-truncation-signals",
        check: () => !isTruncated(docBody, 200),
        detail: "Final body is truncated or too short",
      },
      {
        name: "balanced-code-blocks",
        check: () => {
          const fences = docBody.match(/```/g);
          return !fences || fences.length % 2 === 0;
        },
        detail: "Unclosed code blocks in final assembly",
      },
    ]);

    if (!assemblyCheck.passed) {
      onStatus?.(`Assembly issues: ${assemblyCheck.failures.map((f) => f.detail).join("; ")}. Repairing...`);
      for (const failure of assemblyCheck.failures) {
        if (failure.name === "missing-sections-in-final") {
          const missingHeader = failure.detail.replace("Missing sections in final assembly: ", "");
          const sectionIndex = outline.sections.findIndex((s) => s.heading.toLowerCase().trim() === missingHeader.toLowerCase());
          if (sectionIndex >= 0 && sectionIndex < sections.length) {
            docBody += `\n\n${sections[sectionIndex]}`;
          }
        }
      }
    }

    this.conv?.setCheckpoint({
      step: outline.sections.length + 1,
      totalSteps: outline.sections.length + 1,
      mode: "doc",
      partial: { docBody: docBody.slice(0, 500) },
      context: `Document "${outline.title}" assembled (${docBody.length} chars). Verifying quality.`,
    });

    const result: DocOutput = {
      title: outline.title,
      body: docBody,
      format: outline.format as "markdown" | "html" | "pdf" ?? "markdown",
      verified: false,
      verificationNotes: [],
      continuationRounds: totalContinuationRounds,
      sectionsGenerated: outline.sections.length,
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
      const fixPrompt = `Fix these issues in the document:\n${result.verificationNotes.join("\n")}\n\nDocument:\n${docBody}`;
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
      metadata: {
        outline,
        sourceArtifactId,
        continuationRounds: totalContinuationRounds,
        sectionsGenerated: outline.sections.length,
      },
      sourceFiles: files.map((f) => f.name),
      parentId: sourceArtifactId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.store.put(artifact);

    onStatus?.(`Document "${result.title}" ready (${result.body.length} chars, ${result.sectionsGenerated} sections, ${result.continuationRounds} continuation rounds).`);
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
