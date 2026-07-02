import { createModelClient } from "./models.ts";
import { ArtifactStore, createArtifact, type ArtifactType } from "./artifact-store.ts";
import { ModeRouter, type LuminaMode, type ModeRoute } from "./mode-router.ts";
import { DocsMode, type DocOutput } from "./mode-docs.ts";
import { SheetsMode, type SheetOutput } from "./mode-sheets.ts";
import { SlidesMode, type SlidesOutput } from "./mode-slides.ts";
import { DeepResearchMode, type ResearchOutput } from "./mode-research.ts";
import { WebsitesMode, type WebsiteOutput } from "./mode-websites.ts";

export type ModeOutput = DocOutput | SheetOutput | SlidesOutput | ResearchOutput | WebsiteOutput;

export interface ModeResult {
  mode: LuminaMode;
  output: ModeOutput;
  handoffTo?: LuminaMode;
}

export class LuminaModeOrchestrator {
  private store: ArtifactStore;
  private modeRouter: ModeRouter;
  private sessionId: string;

  constructor(sessionId: string, store?: ArtifactStore) {
    this.sessionId = sessionId;
    this.store = store ?? new ArtifactStore();
    this.modeRouter = new ModeRouter();
  }

  getStore(): ArtifactStore {
    return this.store;
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

    switch (mode) {
      case "doc": {
        const docs = new DocsMode(this.store, this.sessionId);
        output = await docs.generate(request, sourceArtifactId, onStatus);
        handoffTo = await this.detectHandoff(request, "doc");
        break;
      }
      case "sheet": {
        const sheets = new SheetsMode(this.store, this.sessionId);
        output = await sheets.generate(request, sourceArtifactId, onStatus);
        handoffTo = await this.detectHandoff(request, "sheet");
        break;
      }
      case "slide": {
        const slides = new SlidesMode(this.store, this.sessionId);
        output = await slides.generate(request, sourceArtifactId, false, onStatus);
        handoffTo = await this.detectHandoff(request, "slide");
        break;
      }
      case "research": {
        const research = new DeepResearchMode(this.store, this.sessionId);
        output = await research.generate(request, undefined, onStatus);
        handoffTo = await this.detectHandoff(request, "research");
        break;
      }
      case "website": {
        const websites = new WebsitesMode(this.store, this.sessionId);
        output = await websites.generate(request, undefined, onStatus);
        handoffTo = await this.detectHandoff(request, "website");
        break;
      }
      default:
        throw new Error(`Unknown mode: ${mode}`);
    }

    return { mode, output, handoffTo };
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

    const request = `Transform this ${sourceMode} output into a ${targetMode} format.\n\nSource:\n${source.body.slice(0, 4000)}\n\n${additionalInstructions ?? ""}`;

    onStatus?.(`Handing off from ${sourceMode} → ${targetMode}...`);
    const targetArtifactId = source.id;
    return this.executeMode(targetMode, request, onStatus, targetArtifactId);
  }

  getSessionSummary(): string {
    const artifacts = this.store.list(this.sessionId);
    const files = this.store.getFiles(this.sessionId);
    const lines: string[] = [];

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
}
