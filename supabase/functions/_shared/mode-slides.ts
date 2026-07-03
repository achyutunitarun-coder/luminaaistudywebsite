import { createModelClient, type ModelClient } from "./models.ts";
import type { ArtifactStore, Artifact } from "./artifact-store.ts";
import { verifyDoc } from "./document-gen.ts";
import { safeJsonParse } from "./truncation-handler.ts";
import {
  isTruncated,
  detectTruncation,
  generateWithContinuation,
  verifyAssembly,
  spliceContinuation,
} from "./truncation-guard.ts";

export interface SlideContent {
  heading: string;
  body: string;
  notes?: string;
  visual?: { type: "chart" | "image" | "diagram"; description: string };
}

export interface SlideDeck {
  title: string;
  slides: SlideContent[];
  outline: string[];
}

export interface SlidesOutput {
  title: string;
  outline: string[];
  slides: SlideContent[];
  format: "markdown" | "pptx";
  verified: boolean;
  verificationNotes: string[];
  continuationRounds?: number;
}

export class SlidesMode {
  private client: ModelClient;
  private visionClient: ModelClient;
  private conv?: import("./conversation-store.ts").ConversationStore;

  constructor(
    private store: ArtifactStore,
    private sessionId: string,
    opts?: { modelClient?: ModelClient; visionClient?: ModelClient; conversation?: import("./conversation-store.ts").ConversationStore },
  ) {
    this.client = opts?.modelClient ?? createModelClient();
    this.visionClient = opts?.visionClient ?? createModelClient();
    this.conv = opts?.conversation;
  }

  async generate(
    request: string,
    sourceArtifactId?: string,
    adaptive?: boolean,
    onStatus?: (msg: string) => void,
  ): Promise<SlidesOutput> {
    onStatus?.("Designing slide deck structure...");

    let sourceContext = "";
    if (sourceArtifactId) {
      const source = this.store.get(sourceArtifactId);
      if (source) {
        sourceContext = `\nSource material (${source.type}): ${source.title}\n${source.body}`;
      }
    }

    const files = this.store.getFiles(this.sessionId);
    let fileContext = "";
    if (files.length > 0) {
      fileContext = "\nUploaded files:\n" +
        files.map((f) => `- ${f.name} (${f.type}, ${f.size} bytes)`).join("\n");
    }

    const outlinePrompt = `You are a presentation architect using the v3.0 structured format. Design the narrative structure first.

Request: ${request}${sourceContext}${fileContext}
${adaptive ? "\nInclude live data/research from web where relevant." : ""}

Return ONLY valid JSON (no markdown code blocks):
{
  "metadata": {
    "title": "Deck title",
    "subtitle": "Optional subtitle",
    "theme": "dark_modern",
    "slide_count": number,
    "target_audience": "description",
    "narrative_arc": ["hook", "problem", "solution", "evidence", "close"]
  },
  "outline": [
    { "slide_number": 1, "type": "title|section|content|data|quote|comparison|timeline|process|closing", "title": "slide title", "layout": "hero_split|single_column|two_column|three_column|metrics_grid", "speaker_notes": "notes for this slide" }
  ]
}

Aim for 5-12 slides. Each outline entry should have a clear, specific title. Choose appropriate slide types and layouts based on content.`;

    onStatus?.("Creating outline...");
    const outlineResp = await this.client.complete(
      [
        { role: "system", content: "You are a presentation architect using the v3.0 structured JSON schema. Return valid JSON only. Design the narrative arc first, then individual slides. Output raw JSON without markdown code blocks." },
        { role: "user", content: outlinePrompt },
      ],
      { maxTokens: 4096, temperature: 0.3, tag: "slides/outline" },
    );

    let deck: { metadata: { title: string; subtitle?: string; theme: string; slide_count: number; target_audience: string; narrative_arc: string[] }; outline: { slide_number: number; type: string; title: string; layout: string; speaker_notes: string }[] };
    const parsed = await safeJsonParse<typeof deck>(this.client, outlineResp, "slides/outline-parse");
    if (parsed.data) {
      deck = parsed.data;
      if (parsed.recovered) onStatus?.("Recovered truncated outline");
    } else {
      try {
        const title = outlineResp.match(/"title"\s*:\s*"([^"]+)"/)?.[1] ?? "Presentation";
        deck = { metadata: { title, theme: "dark_modern", slide_count: 5, target_audience: "general", narrative_arc: ["hook", "problem", "solution", "evidence", "close"] }, outline: ["Introduction", "Main Content", "Conclusion"].map((t, i) => ({ slide_number: i + 1, type: i === 0 ? "title" : i === 2 ? "closing" : "content", title: t, layout: "single_column", speaker_notes: "" })) };
      } catch {
        deck = { metadata: { title: "Presentation", theme: "dark_modern", slide_count: 3, target_audience: "general", narrative_arc: ["hook", "problem", "solution"] }, outline: ["Introduction", "Main Content", "Conclusion"].map((t, i) => ({ slide_number: i + 1, type: i === 0 ? "title" : i === 2 ? "closing" : "content", title: t, layout: "single_column", speaker_notes: "" })) };
      }
    }

    onStatus?.(`Outline ready — ${deck.outline.length} slides. Writing slide content...`);
    onStatus?.(`Slides: ${deck.outline.map((s, i) => `\n  ${i + 1}. [${s.type}] ${s.title}`).join("")}`);
    onStatus?.("---EDITABLE OUTLINE ABOVE--- Confirm or modify structure, then generation will proceed.");

    const slides: SlideContent[] = [];
    let totalContinuationRounds = 0;

    for (let i = 0; i < deck.outline.length; i++) {
      onStatus?.(`Writing slide ${i + 1}/${deck.outline.length}: ${deck.outline[i].title}`);

      const slideInfo = deck.outline[i];
      const slidePrompt = `Write content for slide ${i + 1} of the deck "${deck.metadata.title}".

Slide title: ${slideInfo.title}
Slide type: ${slideInfo.type}
Layout: ${slideInfo.layout}
Narrative arc position: ${deck.metadata.narrative_arc[Math.min(i, deck.metadata.narrative_arc.length - 1)]}
${sourceContext}${fileContext}

Return JSON:
{
  "heading": "${slideInfo.title}",
  "body": "slide content in markdown (concise, bullet points, max 150 words)",
  "notes": "speaker notes for this slide",
  "visual": { "type": "chart|image|diagram", "description": "what visual should appear here" }
}

Rules:
- Body should be concise, scannable bullet points
- Include specific data/numbers where possible
- Speaker notes should be conversational, 2-3 sentences
- Each slide should have a clear takeaway`;

      const slideResult = await generateWithContinuation(
        async () => {
          const text = await this.client.complete(
            [
              { role: "system", content: "You are a presentation content writer. Write concise, impactful slide content. Return JSON." },
              { role: "user", content: slidePrompt },
            ],
            { maxTokens: 4096, temperature: 0.4, tag: `slides/slide${i + 1}` },
          );
          return { text, finishReason: "stop", model: "default" };
        },
        {
          tag: `slides/slide${i + 1}`,
          maxContinuationRounds: 3,
          structuralCheck: true,
          contentCheck: true,
        },
      );

      totalContinuationRounds += slideResult.continuationRounds;

      const slideParsed = await safeJsonParse<SlideContent>(this.client, slideResult.data, `slides/slide-parse-${i}`, 4096);
      if (slideParsed.data) {
        slides.push(slideParsed.data);
        if (slideParsed.recovered) onStatus?.(`  Recovered truncated slide ${i + 1}`);
      } else {
        onStatus?.(`  Slide ${i + 1} response had invalid format, continuing with raw content`);
        slides.push({
          heading: slideInfo.title,
          body: slideResult.data,
          notes: "Auto-generated content.",
        });
      }

      this.conv?.setCheckpoint({
        step: i + 1,
        totalSteps: deck.outline.length,
        mode: "slide",
        partial: { slides, currentSlide: i, currentTitle: slideInfo.title },
        context: `Generating slide deck "${deck.metadata.title}". Completed slide ${i + 1}/${deck.outline.length}: "${slideInfo.title}". Resume by generating slide ${i + 2}.`,
      });

      onStatus?.(`[SLIDE ${i + 1}/${deck.outline.length}] ${slideInfo.title} — ready`);
    }

    if (adaptive && slides.length > 0) {
      onStatus?.("Pulling live data for slides...");
      try {
        const liveData = await this.client.complete(
          [
            { role: "system", content: "You are a research assistant. Fetch relevant current data for slide content." },
            { role: "user", content: `Find current data/statistics for this deck: ${deck.metadata.title}\nSlides: ${deck.outline.join(", ")}` },
          ],
          { maxTokens: 4096, temperature: 0.3, tag: "slides/live-data" },
        );
        slides[0] = { ...slides[0], body: `${slides[0].body}\n\n**Live Data:**\n${liveData.slice(0, 500)}` };
      } catch {
        // live data fetch failed silently
      }
    }

    onStatus?.("Verifying deck structure...");
    const deckTitle = deck.metadata.title;
    const mdBody = slides.map((s) =>
      `## ${s.heading}\n\n${s.body}${s.notes ? `\n\n---\n*Speaker notes: ${s.notes}*` : ""}${s.visual ? `\n\n*Visual: ${s.visual.type} \u2014 ${s.visual.description}*` : ""}`
    ).join("\n\n");

    const assemblyCheck = await verifyAssembly([
      {
        name: "all-slides-present",
        check: () => slides.length === deck.outline.length,
        detail: `Expected ${deck.outline.length} slides, got ${slides.length}`,
      },
      {
        name: "no-empty-slides",
        check: () => slides.every((s) => s.body.trim().length > 10),
        detail: "One or more slides have empty body content",
      },
      {
        name: "no-truncation-signals",
        check: () => !isTruncated(mdBody, 100),
        detail: "Final deck is truncated or too short",
      },
      {
        name: "balanced-code-blocks",
        check: () => {
          const fences = mdBody.match(/```/g);
          return !fences || fences.length % 2 === 0;
        },
        detail: "Unclosed code blocks in deck",
      },
    ]);

    if (!assemblyCheck.passed) {
      onStatus?.(`Assembly issues: ${assemblyCheck.failures.map((f) => f.detail).join("; ")}`);
    }

    const verifyResult = verifyDoc(
      { type: "slides", title: deckTitle, content: mdBody },
      { type: "slides", title: deckTitle, body: mdBody, format: "markdown", verified: false },
    );

    const issues = verifyResult.verificationNotes ? verifyResult.verificationNotes.split("; ").filter(Boolean) : [];

    if (issues.length > 0) {
      onStatus?.(`Fixing deck issues: ${issues.join("; ")}`);
    }

    let finalBody = mdBody;
    const truncCheck = detectTruncation(mdBody, null, { structural: true, content: true });
    if (truncCheck.truncated) {
      onStatus?.(`Final body appears truncated (${truncCheck.detail}), extending...`);
      const convSummary = this.conv?.getContextSummary();
      const extended = await this.client.complete(
        [{
          role: "user",
          content: `Continue exactly where you left off. Do NOT repeat ANYTHING. Do NOT summarize. Output ONLY the direct continuation.\n\n--- PARTIAL OUTPUT ---\n${mdBody.slice(-3000)}`,
        }],
        { maxTokens: 4096, temperature: 0.1, tag: "slides/final-extend" },
      );
      if (extended && extended.trim().length > 10) {
        finalBody = spliceContinuation(mdBody, extended);
      }
    }

    const output: SlidesOutput = {
      title: deckTitle,
      outline: deck.outline.map((o) => o.title),
      slides,
      format: "markdown",
      verified: issues.length === 0 && assemblyCheck.passed,
      verificationNotes: [...issues, ...assemblyCheck.failures.map((f) => f.detail)],
      continuationRounds: totalContinuationRounds,
    };

    const artifact: Artifact = {
      id: crypto.randomUUID(),
      sessionId: this.sessionId,
      type: "slide",
      title: output.title,
      body: finalBody,
      format: "markdown",
      metadata: {
        slideCount: slides.length,
        outline: output.outline,
        sourceArtifactId,
        deckV3: deck,
        continuationRounds: totalContinuationRounds,
      },
      sourceFiles: files.map((f) => f.name),
      parentId: sourceArtifactId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.store.put(artifact);

    this.conv?.clearCheckpoint("slide");

    onStatus?.(`Deck "${output.title}" ready (${slides.length} slides, ${totalContinuationRounds} continuation rounds).`);
    return output;
  }
}
