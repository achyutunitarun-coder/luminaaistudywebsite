import { createModelClient } from "./models.ts";
import { ArtifactStore, createArtifact, type ArtifactType, type ArtifactPreview } from "./artifact-store.ts";
import { ModeRouter, type LuminaMode, type ModeRoute } from "./mode-router.ts";
import { DocsMode, type DocOutput } from "./mode-docs.ts";
import { SheetsMode, type SheetOutput } from "./mode-sheets.ts";
import { SlidesMode, type SlidesOutput } from "./mode-slides.ts";
import { DeepResearchMode, type ResearchOutput } from "./mode-research.ts";
import { WebsitesMode, type WebsiteOutput } from "./mode-websites.ts";
import { getSkillContext, type SkillFile } from "./skill-loader.ts";
import { getModePrompt } from "./master-system-prompt.ts";
import { exportEngine, type ExportFormat, type ExportResult } from "./export-engine.ts";
import { designSystem } from "./shared-intelligence.ts";
import { ConversationStore } from "./conversation-store.ts";
import { createGoogleSlides, createGoogleDoc, createGoogleSheet, type GoogleApiResult } from "./google-api.ts";

export type ModeOutput = DocOutput | SheetOutput | SlidesOutput | ResearchOutput | WebsiteOutput;

export interface ModeResult {
  mode: LuminaMode;
  output: ModeOutput;
  handoffTo?: LuminaMode;
  exports?: ExportResult[];
  artifactId?: string;
  conversationEntryId?: string;
  googleExport?: GoogleApiResult;
}

export class LuminaModeOrchestrator {
  private store: ArtifactStore;
  private modeRouter: ModeRouter;
  private sessionId: string;
  private conversation: ConversationStore;

  constructor(sessionId: string, store?: ArtifactStore) {
    this.sessionId = sessionId;
    this.store = store ?? new ArtifactStore();
    this.modeRouter = new ModeRouter();
    this.conversation = new ConversationStore(sessionId);
  }

  getStore(): ArtifactStore {
    return this.store;
  }

  getConversation(): ConversationStore {
    return this.conversation;
  }

  async suggestModes(task: string): Promise<ModeRoute[]> {
    return this.modeRouter.suggestModes(task);
  }

  async detectHandoff(task: string, primaryMode: LuminaMode): Promise<LuminaMode | undefined> {
    const routes = await this.suggestModes(task);
    const secondary = routes.find((r) => r.mode !== primaryMode && r.confidence > 0.4);
    return secondary?.mode;
  }

  async executeMode(
    mode: LuminaMode,
    request: string,
    onStatus?: (msg: string) => void,
    sourceArtifactId?: string,
  ): Promise<ModeResult> {
    let output: ModeOutput;
    let handoffTo: LuminaMode | undefined;

    // Record user message in conversation
    const userEntry = this.conversation.addUserMessage(request, mode);
    const convSummary = this.conversation.getContextSummary(6);

    // Check for interrupted checkpoint to resume
    const checkpoint = this.conversation.getCheckpoint(mode);
    if (checkpoint) {
      onStatus?.(`Resuming interrupted ${mode} task from step ${checkpoint.step}/${checkpoint.totalSteps}...`);
    }

    // Load skill file for this mode
    const skillContext = await getSkillContext(mode);
    const modePrompt = getModePrompt(mode);
    const requestWithSkill = [
      modePrompt ? `[MODE PROMPT — ${mode}]\n${modePrompt}\n[/MODE PROMPT]` : "",
      skillContext,
      checkpoint ? `[RESUMING FROM CHECKPOINT — step ${checkpoint.step}/${checkpoint.totalSteps}]\n${checkpoint.context}` : "",
      `## CONVERSATION CONTEXT\n${convSummary}`,
      `## USER REQUEST\n${request}`,
    ].filter(Boolean).join("\n\n");

    onStatus?.(`${mode.charAt(0).toUpperCase() + mode.slice(1)} mode active. Building response...`);

    switch (mode) {
      case "doc": {
        const docs = new DocsMode(this.store, this.sessionId, { conversation: this.conversation });
        output = await docs.generate(requestWithSkill, sourceArtifactId, onStatus);
        handoffTo = await this.detectHandoff(request, "doc");
        break;
      }
      case "sheet": {
        const sheets = new SheetsMode(this.store, this.sessionId, { conversation: this.conversation });
        output = await sheets.generate(requestWithSkill, sourceArtifactId, onStatus);
        handoffTo = await this.detectHandoff(request, "sheet");
        break;
      }
      case "slide": {
        const slides = new SlidesMode(this.store, this.sessionId, { conversation: this.conversation });
        output = await slides.generate(requestWithSkill, sourceArtifactId, false, onStatus);
        handoffTo = await this.detectHandoff(request, "slide");
        break;
      }
      case "research": {
        const research = new DeepResearchMode(this.store, this.sessionId, { conversation: this.conversation });
        output = await research.generate(requestWithSkill, undefined, onStatus);
        handoffTo = await this.detectHandoff(request, "research");
        break;
      }
      case "website": {
        const websites = new WebsitesMode(this.store, this.sessionId, { conversation: this.conversation });
        output = await websites.generate(requestWithSkill, undefined, onStatus);
        handoffTo = await this.detectHandoff(request, "website");
        break;
      }
      default:
        throw new Error(`Unknown mode: ${mode}`);
    }

    // Clear checkpoint on success
    this.conversation.clearCheckpoint(mode);

    // Find the artifact that was just created
    const artifact = this.store.list(this.sessionId, mode as ArtifactType).slice(-1)[0];
    const artifactId = artifact?.id;

    // Record assistant response in conversation
    const body = typeof output === "object" ? JSON.stringify(output).slice(0, 2000) : String(output).slice(0, 2000);
    const assistantEntry = this.conversation.addAssistantMessage(body, mode, artifactId);

    if (artifactId && artifact) {
      // Update artifact with preview + export metadata
      artifact.metadata = {
        ...artifact.metadata,
        conversationEntryId: assistantEntry.id,
        preview: {
          title: artifact.title,
          type: mode,
          format: artifact.format,
          snippet: artifact.body.slice(0, 500),
          exports: this.getAvailableExports(mode),
        },
      };
    }

    const result: ModeResult = { mode, output, handoffTo, artifactId, conversationEntryId: assistantEntry.id };

    // Auto-generate export for preview
    result.exports = [this.exportOutput(mode, output, "html", output?.title ?? "output")];

    return result;
  }

  getAvailableExports(mode: LuminaMode): ExportFormat[] {
    const map: Record<LuminaMode, ExportFormat[]> = {
      slide: ["pptx", "google_slides", "html", "md", "pdf"],
      doc: ["docx", "google_docs", "html", "md", "pdf"],
      sheet: ["xlsx", "google_sheets", "csv", "html"],
      website: ["html"],
      research: ["md", "html", "pdf", "docx"],
    };
    return map[mode] ?? ["html", "md"];
  }

  async exportToGoogle(mode: LuminaMode, output: ModeOutput, title: string): Promise<GoogleApiResult> {
    if (mode === "slide") {
      const s = output as SlidesOutput;
      const md = s.slides.map((sl, i) => `## ${sl.heading}\n\n${sl.body}`).join("\n\n");
      return createGoogleSlides(title, md);
    }
    if (mode === "doc") {
      return createGoogleDoc(title, (output as DocOutput).body);
    }
    if (mode === "sheet") {
      const sh = output as SheetOutput;
      const csv = sh.tables.map((t) => [t.headers.join(","), ...t.rows.map((r) => t.headers.map((h) => r[h] ?? "").join(","))].join("\n")).join("\n\n");
      return createGoogleSheet(title, csv);
    }
    return { success: false, error: `Google export not supported for ${mode}` };
  }

  async exportOutput(
    mode: LuminaMode,
    output: ModeOutput,
    format: ExportFormat,
    filename?: string,
  ): Promise<ExportResult> {
    const theme = "dark_modern";
    if (mode === "slide") {
      const slidesOutput = output as SlidesOutput;
      const slideData = {
        metadata: { title: slidesOutput.title, theme, slide_count: slidesOutput.slides.length },
        slides: slidesOutput.slides.map((s, i) => ({
          slide_number: i + 1, type: "content" as const, layout: "single_column",
          elements: [{ type: "text" as const, id: `el_${i}`, content: `# ${s.heading}\n\n${s.body}`, position: { x: 5, y: 10, width: 90, height: 80, unit: "percent" as const }, style: { font_size: 18, color: "#ffffff" } }],
        })),
        theme: designSystem.getTheme(theme as any),
      };
      return exportEngine.exportSlides(slideData, { format, filename });
    }
    if (mode === "doc") return exportEngine.exportDocument((output as DocOutput).body, { format, filename });
    if (mode === "sheet") {
      const sheetOutput = output as SheetOutput;
      const sheetData = {
        workbook: { name: sheetOutput.title, theme },
        sheets: sheetOutput.tables.map((t, idx) => ({
          name: `Table_${idx + 1}`,
          headers: t.headers.map((h, ci) => ({ column: String.fromCharCode(65 + ci), name: h })),
          data: t.rows.map((r) => t.headers.map((h) => r[h] ?? "")),
        })),
      };
      return exportEngine.exportSheet(sheetData, { format, filename });
    }
    if (mode === "website") {
      const webOutput = output as WebsiteOutput;
      const htmlContent = webOutput.files.map((f) => `<!-- ${f.path} -->\n${f.content}`).join("\n\n");
      return { format: "html", content: htmlContent, filename: `${filename ?? webOutput.title}.html`, mimeType: "text/html" };
    }
    if (mode === "research") {
      const researchOutput = output as ResearchOutput;
      const md = `# ${researchOutput.topic}\n\n${researchOutput.summary}\n\n${researchOutput.sections.map((s) => `## ${s.heading}\n${s.content}`).join("\n\n")}\n\n---\n*${researchOutput.sources.length} sources consulted*`;
      return exportEngine.exportDocument(md, { format, filename });
    }
    return { format, content: JSON.stringify(output), filename: `${filename ?? "output"}.json`, mimeType: "application/json" };
  }

  async executeChain(
    chain: { mode: LuminaMode; request: string }[],
    onStatus?: (msg: string) => void,
  ): Promise<ModeResult[]> {
    const results: ModeResult[] = [];
    let lastArtifactId: string | undefined;

    for (let i = 0; i < chain.length; i++) {
      const { mode, request } = chain[i];
      onStatus?.(`Mode ${i + 1}/${chain.length}: ${mode}`);

      const result = await this.executeMode(
        mode,
        i === 0 ? request : `Building on previous output.\n\n${request}`,
        (msg) => onStatus?.(`[${mode}] ${msg}`),
        lastArtifactId,
      );

      results.push(result);

      const latest = this.store.list(this.sessionId, mode as ArtifactType).slice(-1)[0];
      if (latest) lastArtifactId = latest.id;
    }

    return results;
  }

  async crossModeHandoff(
    sourceMode: LuminaMode,
    targetMode: LuminaMode,
    additionalInstructions?: string,
    onStatus?: (msg: string) => void,
  ): Promise<ModeResult> {
    const source = this.store.list(this.sessionId, sourceMode as ArtifactType).slice(-1)[0];
    if (!source) throw new Error(`No ${sourceMode} output found in session context to hand off.`);

    const request = `Transform this ${sourceMode} output into a ${targetMode} format.\n\nSource:\n${source.body.slice(0, 32000)}\n\n${additionalInstructions ?? ""}`;

    onStatus?.(`Handing off from ${sourceMode} → ${targetMode}...`);
    const targetArtifactId = source.id;
    return this.executeMode(targetMode, request, onStatus, targetArtifactId);
  }

  getSessionSummary(): string {
    const artifacts = this.store.list(this.sessionId);
    const files = this.store.getFiles(this.sessionId);
    const lines: string[] = [];
    const turnCount = this.conversation.getTurnCount();

    if (turnCount > 0) lines.push(`Turns: ${turnCount}`);
    if (files.length > 0) lines.push(`Files: ${files.map((f) => f.name).join(", ")}`);
    if (artifacts.length > 0) {
      const byType = new Map<string, number>();
      for (const a of artifacts) {
        byType.set(a.type, (byType.get(a.type) ?? 0) + 1);
      }
      lines.push(`Outputs: ${Array.from(byType.entries()).map(([t, c]) => `${t}: ${c}`).join(", ")}`);
    }

    return lines.join(" | ");
  }

  getArtifactPreviews(): ArtifactPreview[] {
    return this.store.list(this.sessionId).map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      format: a.format,
      snippet: (a.body ?? "").slice(0, 300),
      exports: this.getAvailableExports(a.type as LuminaMode),
      createdAt: a.createdAt,
    }));
  }
}
