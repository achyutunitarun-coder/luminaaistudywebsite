import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ArtifactType = "research" | "doc" | "sheet" | "slide" | "website";
export type ArtifactFormat = "html" | "markdown" | "csv" | "docx" | "pptx" | "xlsx" | "pdf" | "code";

export interface Artifact {
  id: string;
  sessionId: string;
  type: ArtifactType;
  title: string;
  body: string;
  format: ArtifactFormat;
  metadata: Record<string, unknown>;
  sourceFiles: string[];
  parentId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UploadedFile {
  id: string;
  sessionId: string;
  name: string;
  type: string;
  size: number;
  content: string;
  parsedData?: Record<string, unknown>[];
  createdAt: number;
}

export class ArtifactStore {
  private artifacts = new Map<string, Artifact>();
  private files = new Map<string, UploadedFile[]>();
  private sessionContexts = new Map<string, Map<string, unknown>>();

  constructor(private sb?: ReturnType<typeof createClient>) {}

  addFile(file: UploadedFile): void {
    const existing = this.files.get(file.sessionId) ?? [];
    existing.push(file);
    this.files.set(file.sessionId, existing);
  }

  getFiles(sessionId: string): UploadedFile[] {
    return this.files.get(sessionId) ?? [];
  }

  getFile(sessionId: string, name: string): UploadedFile | undefined {
    return this.getFiles(sessionId).find((f) => f.name === name);
  }

  put(artifact: Artifact): void {
    this.artifacts.set(artifact.id, artifact);
  }

  get(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  list(sessionId: string, type?: ArtifactType): Artifact[] {
    const all = Array.from(this.artifacts.values());
    return all.filter((a) => a.sessionId === sessionId && (!type || a.type === type));
  }

  getLatest(sessionId: string, type: ArtifactType): Artifact | undefined {
    const matches = this.list(sessionId, type).sort((a, b) => b.createdAt - a.createdAt);
    return matches[0];
  }

  setSessionContext(sessionId: string, key: string, value: unknown): void {
    let ctx = this.sessionContexts.get(sessionId);
    if (!ctx) {
      ctx = new Map();
      this.sessionContexts.set(sessionId, ctx);
    }
    ctx.set(key, value);
  }

  getSessionContext(sessionId: string, key: string): unknown {
    return this.sessionContexts.get(sessionId)?.get(key);
  }

  clearSession(sessionId: string): void {
    this.sessionContexts.delete(sessionId);
    this.files.delete(sessionId);
    for (const [id, a] of this.artifacts) {
      if (a.sessionId === sessionId) this.artifacts.delete(id);
    }
  }
}

export function createArtifact(
  sessionId: string,
  type: ArtifactType,
  title: string,
  body: string,
  format: ArtifactFormat,
  opts?: { sourceFiles?: string[]; parentId?: string; metadata?: Record<string, unknown> },
): Artifact {
  return {
    id: crypto.randomUUID(),
    sessionId,
    type,
    title,
    body,
    format,
    metadata: opts?.metadata ?? {},
    sourceFiles: opts?.sourceFiles ?? [],
    parentId: opts?.parentId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
