import type { LuminaMode } from "./mode-router.ts";

export interface CheckpointData {
  step: number;
  totalSteps: number;
  mode: LuminaMode;
  partial: Record<string, unknown>;
  context: string;
  artifactId?: string;
  timestamp: number;
}

export interface ConversationEntry {
  id: string;
  role: "user" | "assistant" | "system";
  mode: LuminaMode | "general";
  content: string;
  artifactId?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

const MAX_HISTORY_ENTRIES = 100;
const sessions = new Map<string, ConversationEntry[]>();
const checkpoints = new Map<string, CheckpointData>();

export class ConversationStore {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }
  }

  addEntry(entry: Omit<ConversationEntry, "id" | "timestamp">): ConversationEntry {
    const full: ConversationEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    const history = sessions.get(this.sessionId)!;
    history.push(full);
    if (history.length > MAX_HISTORY_ENTRIES) {
      history.splice(0, history.length - MAX_HISTORY_ENTRIES);
    }
    return full;
  }

  addUserMessage(content: string, mode?: LuminaMode): ConversationEntry {
    return this.addEntry({ role: "user", content, mode: mode ?? "general" });
  }

  addAssistantMessage(content: string, mode: LuminaMode, artifactId?: string): ConversationEntry {
    return this.addEntry({ role: "assistant", content, mode, artifactId });
  }

  getHistory(limit = 20): ConversationEntry[] {
    const history = sessions.get(this.sessionId) ?? [];
    return history.slice(-limit);
  }

  getHistorySince(entryId: string): ConversationEntry[] {
    const history = sessions.get(this.sessionId) ?? [];
    const idx = history.findIndex((e) => e.id === entryId);
    return idx >= 0 ? history.slice(idx + 1) : history;
  }

  getContextSummary(maxEntries = 10): string {
    const recent = this.getHistory(maxEntries);
    if (recent.length === 0) return "No prior conversation context.";

    return recent.map((e) => {
      const modeTag = e.mode !== "general" ? ` [${e.mode}]` : "";
      const artifactTag = e.artifactId ? ` (artifact: ${e.artifactId.slice(0, 8)}...)` : "";
      const prefix = e.role === "user" ? "USER:" : "ASSISTANT:";
      const content = e.content.length > 500 ? e.content.slice(0, 500) + "..." : e.content;
      return `${prefix}${modeTag}${artifactTag} ${content}`;
    }).join("\n\n");
  }

  getLastArtifactId(mode?: LuminaMode): string | undefined {
    const history = sessions.get(this.sessionId) ?? [];
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].artifactId && (!mode || history[i].mode === mode)) {
        return history[i].artifactId;
      }
    }
    return undefined;
  }

  setCheckpoint(data: Omit<CheckpointData, "timestamp">): void {
    checkpoints.set(`${this.sessionId}:${data.mode}`, { ...data, timestamp: Date.now() });
  }

  getCheckpoint(mode: LuminaMode): CheckpointData | null {
    return checkpoints.get(`${this.sessionId}:${mode}`) ?? null;
  }

  clearCheckpoint(mode: LuminaMode): void {
    checkpoints.delete(`${this.sessionId}:${mode}`);
  }

  getRecentArtifacts(): { artifactId: string; mode: LuminaMode; content: string }[] {
    const history = sessions.get(this.sessionId) ?? [];
    return history
      .filter((e) => e.artifactId && e.role === "assistant")
      .slice(-5)
      .map((e) => ({ artifactId: e.artifactId!, mode: e.mode as LuminaMode, content: e.content }));
  }

  clear(): void {
    sessions.delete(this.sessionId);
    for (const key of checkpoints.keys()) {
      if (key.startsWith(`${this.sessionId}:`)) checkpoints.delete(key);
    }
  }

  getTurnCount(): number {
    return (sessions.get(this.sessionId) ?? []).length;
  }
}

export function createConversationStore(sessionId: string): ConversationStore {
  return new ConversationStore(sessionId);
}
