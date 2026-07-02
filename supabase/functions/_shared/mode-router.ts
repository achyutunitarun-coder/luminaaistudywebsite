import { createModelClient, type ModelClient } from "./models.ts";

export type LuminaMode = "chat" | "research" | "doc" | "sheet" | "slide" | "website";

export interface ModeRoute {
  mode: LuminaMode;
  confidence: number;
  reason: string;
}

export interface ModeRouterOptions {
  modelClient?: ModelClient;
}

export class ModeRouter {
  private client: ModelClient;

  constructor(opts: ModeRouterOptions = {}) {
    this.client = opts.modelClient ?? createModelClient();
  }

  async suggestModes(task: string): Promise<ModeRoute[]> {
    const prompt = `You are a task classifier for an AI assistant with these modes:
- chat: conversation, Q&A, explanations, general help
- research: requires searching, analyzing multiple sources, producing a report
- doc: writing a document, report, essay, article
- sheet: working with data, spreadsheets, tables, formulas
- slide: creating a presentation, slide deck, pitch deck
- website: building a web page, app, UI component, interactive frontend

Classify this task. Return a JSON array of { mode, confidence, reason } objects for each applicable mode.
If the task spans multiple modes, include all that apply (e.g. "research X and make slides" → research + slide).
Confidence 0-1.
Only include modes with confidence > 0.3.

Task: ${task}`;

    const response = await this.client.complete(
      [{ role: "user", content: prompt }],
      { maxTokens: 1024, temperature: 0.2, tag: "mode-router" },
    );

    try {
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) return parsed.slice(0, 3);
      return [{ mode: "chat", confidence: 0.5, reason: "fallback" }];
    } catch {
      if (/research|deep/i.test(task)) return [{ mode: "research", confidence: 0.6, reason: "keyword match" }];
      if (/slide|presentation|deck|pptx/i.test(task)) return [{ mode: "slide", confidence: 0.6, reason: "keyword match" }];
      if (/sheet|spreadsheet|table|data|csv|xlsx/i.test(task)) return [{ mode: "sheet", confidence: 0.6, reason: "keyword match" }];
      if (/doc|report|essay|write|article|document/i.test(task)) return [{ mode: "doc", confidence: 0.6, reason: "keyword match" }];
      if (/website|app|page|ui|frontend|landing/i.test(task)) return [{ mode: "website", confidence: 0.6, reason: "keyword match" }];
      return [{ mode: "chat", confidence: 0.8, reason: "fallback" }];
    }
  }

  detectIntent(query: string): { intent: string; mode: LuminaMode } {
    if (/code|build|create|app|website|frontend|page|ui/i.test(query))
      return { intent: "coding", mode: /website|page|app|frontend|landing/i.test(query) ? "website" : "chat" };
    if (/research|analyze|investigate|source|find|deep/i.test(query))
      return { intent: "research", mode: "research" };
    if (/slide|presentation|deck/i.test(query))
      return { intent: "slides", mode: "slide" };
    if (/sheet|spreadsheet|table|data|csv|excel/i.test(query))
      return { intent: "data", mode: "sheet" };
    if (/doc|report|essay|write|article|document|pdf/i.test(query))
      return { intent: "writing", mode: "doc" };
    return { intent: "general", mode: "chat" };
  }
}

export function formatModeRoutes(routes: ModeRoute[]): string {
  return routes.map((r) => `**${r.mode}** (${Math.round(r.confidence * 100)}%): ${r.reason}`).join("\n");
}
