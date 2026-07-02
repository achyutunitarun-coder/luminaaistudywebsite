import { createModelClient, type ModelClient } from "./models.ts";
import type { ArtifactStore, Artifact } from "./artifact-store.ts";
import { verifyDoc } from "./document-gen.ts";

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

  constructor(
    private store: ArtifactStore,
    private sessionId: string,
    opts?: { modelClient?: ModelClient; visionClient?: ModelClient },
  ) {
    this.client = opts?.modelClient ?? createModelClient();
    this.visionClient = opts?.visionClient ?? createModelClient();
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

    const outlinePrompt = `You are a presentation architect. Design the narrative structure first.

Request: ${request}${sourceContext}${fileContext}
${adaptive ? "\nInclude live data/research from web where relevant." : ""}

Return ONLY JSON:
{
  "title": "Deck title",
  "outline": ["slide 1 title", "slide 2 title", ...],
  "narrative_flow": "description of how the argument flows across slides"
}

Aim for 5-15 slides. Each outline entry should be a clear, specific slide title.`;

    onStatus?.("Creating outline...");
    const outlineResp = await this.client.complete(
      [
        { role: "system", content: "You are a presentation architect. Return valid JSON only. Design the narrative arc first, then individual slides." },
        { role: "user", content: outlinePrompt },
      ],
      { maxTokens: 2048, temperature: 0.3, tag: "slides/outline" },
    );

    let deck: { title: string; outline: string[]; narrative_flow?: string };
    try {
      deck = JSON.parse(outlineResp);
    } catch {
      deck = { title: "Presentation", outline: ["Introduction", "Main Content", "Conclusion"] };
    }

    onStatus?.(`Outline ready — ${deck.outline.length} slides. Writing slide content...`);
    onStatus?.(`Slides: ${deck.outline.map((s, i) => `\n  ${i + 1}. ${s}`).join("")}`);
    onStatus?.("---EDITABLE OUTLINE ABOVE--- Confirm or modify structure, then generation will proceed.");

    const slides: SlideContent[] = [];

    for (let i = 0; i < deck.outline.length; i++) {
      onStatus?.(`Writing slide ${i + 1}/${deck.outline.length}: ${deck.outline[i]}`);

      const slidePrompt = `Write content for slide ${i + 1} of the deck "${deck.title}".

Slide title: ${deck.outline[i]}
Narrative flow: ${deck.narrative_flow ?? "sequential"}
${sourceContext}${fileContext}

Return JSON:
{
  "heading": "${deck.outline[i]}",
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
        { maxTokens: 2048, temperature: 0.4, tag: `slides/slide${i + 1}` },
      );

      try {
        const slide = JSON.parse(slideResp);
        slides.push(slide);
      } catch {
        slides.push({
          heading: deck.outline[i],
          body: slideResp,
          notes: "Auto-generated content.",
        });
      }
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
    const mdBody = slides.map((s) =>
      `## ${s.heading}\n\n${s.body}${s.notes ? `\n\n---\n*Speaker notes: ${s.notes}*` : ""}${s.visual ? `\n\n*Visual: ${s.visual.type} — ${s.visual.description}*` : ""}`
    ).join("\n\n");

    const verifyResult = verifyDoc(
      { type: "slides", title: deck.title, content: mdBody },
      { type: "slides", title: deck.title, body: mdBody, format: "markdown", verified: false },
    );

    const issues = verifyResult.verificationNotes ? verifyResult.verificationNotes.split("; ").filter(Boolean) : [];

    if (issues.length > 0) {
      onStatus?.(`Fixing deck issues: ${issues.join("; ")}`);
    }

    const output: SlidesOutput = {
      title: deck.title,
      outline: deck.outline,
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
      body: mdBody,
      format: "markdown",
      metadata: { slideCount: slides.length, outline: deck.outline, sourceArtifactId },
      sourceFiles: files.map((f) => f.name),
      parentId: sourceArtifactId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.store.put(artifact);

    onStatus?.(`Deck "${output.title}" ready (${slides.length} slides).`);
    return output;
  }
}
