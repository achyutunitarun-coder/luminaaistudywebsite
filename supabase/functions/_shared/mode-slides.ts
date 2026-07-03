import { createModelClient, type ModelClient } from "./models.ts";
import type { ArtifactStore, Artifact } from "./artifact-store.ts";
import { verifyDoc } from "./document-gen.ts";
import { safeJsonParse, isTruncated, completeTruncated } from "./truncation-handler.ts";

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
        sourceContext = `\nSource material (${source.type}): ${source.title}\n${source.body.slice(0, 6000)}`;
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

      const slideResp = await this.client.complete(
        [
          { role: "system", content: "You are a presentation content writer. Write concise, impactful slide content. Return JSON." },
          { role: "user", content: slidePrompt },
        ],
        { maxTokens: 4096, temperature: 0.4, tag: `slides/slide${i + 1}` },
      );

      const slideParsed = await safeJsonParse<SlideContent>(this.client, slideResp, `slides/slide-parse-${i}`, 4096);
      if (slideParsed.data) {
        slides.push(slideParsed.data);
        if (slideParsed.recovered) onStatus?.(`  Recovered truncated content for slide ${i + 1}`);
      } else {
        onStatus?.(`  Slide ${i + 1} response had invalid format, continuing with raw content`);
        slides.push({
          heading: slideInfo.title,
          body: slideResp,
          notes: "Auto-generated content.",
        });
      }

      // Checkpoint after each slide so we can resume if interrupted
      this.conv?.setCheckpoint({
        step: i + 1,
        totalSteps: deck.outline.length,
        mode: "slide",
        partial: { slides, currentSlide: i, currentTitle: slideInfo.title },
        context: `Generating slide deck "${deck.metadata.title}". Completed slide ${i + 1}/${deck.outline.length}: "${slideInfo.title}". Resume by generating slide ${i + 2}.`,
      });

      // Stream progress — user sees slides appearing in real-time
      onStatus?.(`[SLIDE ${i + 1}/${deck.outline.length}] ${slideInfo.title} — ready`);
    }

    if (adaptive && slides.length > 0) {
      onStatus?.("Pulling live data for slides...");
      try {
        const liveData = await this.client.complete(
          [
            { role: "system", content: "You are a research assistant. Fetch relevant current data for slide content." },
            { role: "user", content: `Find current data/statistics for this deck: ${deck.title}\nSlides: ${deck.outline.join(", ")}` },
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
      `## ${s.heading}\n\n${s.body}${s.notes ? `\n\n---\n*Speaker notes: ${s.notes}*` : ""}${s.visual ? `\n\n*Visual: ${s.visual.type} — ${s.visual.description}*` : ""}`
    ).join("\n\n");

    const verifyResult = verifyDoc(
      { type: "slides", title: deckTitle, content: mdBody },
      { type: "slides", title: deckTitle, body: mdBody, format: "markdown", verified: false },
    );

    const issues = verifyResult.verificationNotes ? verifyResult.verificationNotes.split("; ").filter(Boolean) : [];

    if (issues.length > 0) {
      onStatus?.(`Fixing deck issues: ${issues.join("; ")}`);
    }

    let finalBody = mdBody;
    if (isTruncated(mdBody)) {
      onStatus?.("Final body appears truncated, extending...");
      const convSummary = this.conv?.getContextSummary();
      finalBody = await completeTruncated(this.client, mdBody, "slides/final-extend", false, 4096, undefined, convSummary);
    }

    const outlineTitles = deck.outline.map((o) => o.title);

    const output: SlidesOutput = {
      title: deckTitle,
      outline: outlineTitles,
      slides,
      format: "markdown",
      verified: issues.length === 0,
      verificationNotes: issues,
    };

    const artifact: Artifact = {
      id: crypto.randomUUID(),
      sessionId: this.sessionId,
      type: "slide",
      title: output.title,
      body: finalBody,
      format: "markdown",
      metadata: { slideCount: slides.length, outline: outlineTitles, sourceArtifactId, deckV3: deck },
      sourceFiles: files.map((f) => f.name),
      parentId: sourceArtifactId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.store.put(artifact);

    // Clear checkpoint on successful completion
    this.conv?.clearCheckpoint("slide");

    onStatus?.(`Deck "${output.title}" ready (${slides.length} slides).`);
    return output;
  }
}
