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

export interface ArtifactPreview {
  id: string;
  type: ArtifactType;
  title: string;
  format: ArtifactFormat;
  snippet: string;
  exports: string[];
  createdAt: number;
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

/**
 * Shared artifact/context store — the backbone of the integrated system.
 *
 * Every mode reads from and writes to this store. Files uploaded once are
 * usable across all modes in the same session without re-upload.
 *
 * Supports these artifact chains:
 *   research → slides, research → doc
 *   sheet → doc, sheet → slides
 *   doc/research → website content
 *
 * Built as one generic store any mode can access (not special-cased glue code
 * between specific mode pairs), making adding a sixth mode cheap.
 */
export class ArtifactStore {
  private artifacts = new Map<string, Artifact>();
  private files = new Map<string, UploadedFile[]>();
  private sessionContexts = new Map<string, Map<string, unknown>>();
  private persistTable = "lumina_artifacts";
  private ready = false;

  constructor(private sb?: ReturnType<typeof createClient>, private persist = true) {
    // Supabase connection is optional — if missing, we stay in-memory
    if (sb && persist) {
      this.ensureTable().catch(() => {});
    }
  }

  private async ensureTable(): Promise<void> {
    if (!this.sb) return;
    try {
      // Check if table exists by querying it
      const { error } = await this.sb
        .from(this.persistTable)
        .select("id", { count: "exact", head: true })
        .limit(1);
      if (error && error.message?.includes("does not exist")) {
        // Create table via raw SQL if it doesn't exist
        await this.sb.rpc("exec_sql", {
          sql: `
            CREATE TABLE IF NOT EXISTS ${this.persistTable} (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              session_id TEXT NOT NULL,
              type TEXT NOT NULL,
              title TEXT,
              body TEXT,
              format TEXT,
              metadata JSONB DEFAULT '{}',
              source_files TEXT[] DEFAULT '{}',
              parent_id TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_artifacts_session ON ${this.persistTable}(session_id);
            CREATE INDEX IF NOT EXISTS idx_artifacts_type ON ${this.persistTable}(type);

            CREATE TABLE IF NOT EXISTS lumina_session_files (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              session_id TEXT NOT NULL,
              name TEXT NOT NULL,
              file_type TEXT,
              size BIGINT,
              content TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_session_files_session ON lumina_session_files(session_id);
          `,
        });
      }
      this.ready = true;
    } catch {
      // In-memory fallback is always available
    }
  }

  private async persistArtifact(artifact: Artifact): Promise<void> {
    if (!this.sb || !this.ready) return;
    try {
      await this.sb.from(this.persistTable).upsert({
        id: artifact.id,
        session_id: artifact.sessionId,
        type: artifact.type,
        title: artifact.title,
        body: artifact.body,
        format: artifact.format,
        metadata: artifact.metadata,
        source_files: artifact.sourceFiles,
        parent_id: artifact.parentId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    } catch {
      // In-memory is the fallback
    }
  }

  async restoreFromDb(sessionId: string): Promise<void> {
    if (!this.sb || !this.ready) return;
    try {
      const { data: artifacts } = await this.sb
        .from(this.persistTable)
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (artifacts) {
        for (const a of artifacts) {
          const artifact: Artifact = {
            id: a.id,
            sessionId: a.session_id,
            type: a.type,
            title: a.title ?? "",
            body: a.body ?? "",
            format: a.format ?? "markdown",
            metadata: a.metadata ?? {},
            sourceFiles: a.source_files ?? [],
            parentId: a.parent_id,
            createdAt: new Date(a.created_at).getTime(),
            updatedAt: new Date(a.updated_at).getTime(),
          };
          this.artifacts.set(artifact.id, artifact);
        }
      }

      const { data: sessionFiles } = await this.sb
        .from("lumina_session_files")
        .select("*")
        .eq("session_id", sessionId);

      if (sessionFiles) {
        const fileList: UploadedFile[] = sessionFiles.map((f: any) => ({
          id: f.id,
          sessionId: f.session_id,
          name: f.name,
          type: f.file_type ?? "unknown",
          size: f.size ?? 0,
          content: f.content ?? "",
          createdAt: new Date(f.created_at).getTime(),
        }));
        this.files.set(sessionId, fileList);
      }
    } catch {
      // In-memory fallback
    }
  }

  addFile(file: UploadedFile): void {
    const existing = this.files.get(file.sessionId) ?? [];
    existing.push(file);
    this.files.set(file.sessionId, existing);
    // Persist to DB
    if (this.sb && this.ready) {
      this.sb.from("lumina_session_files").insert({
        id: file.id,
        session_id: file.sessionId,
        name: file.name,
        file_type: file.type,
        size: file.size,
        content: file.content,
      }).catch(() => {});
    }
  }

  getFiles(sessionId: string): UploadedFile[] {
    return this.files.get(sessionId) ?? [];
  }

  getFile(sessionId: string, name: string): UploadedFile | undefined {
    return this.getFiles(sessionId).find((f) => f.name === name);
  }

  put(artifact: Artifact): void {
    this.artifacts.set(artifact.id, artifact);
    this.persistArtifact(artifact);
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

  /** Find artifacts from other modes that could be source material for cross-mode handoff */
  findCrossModeSources(sessionId: string, targetType: ArtifactType): Artifact[] {
    const all = this.list(sessionId);
    const compatibleTypes: Record<ArtifactType, ArtifactType[]> = {
      research: ["doc", "slide", "website"],
      doc: ["research", "sheet", "website"],
      sheet: ["doc", "slide"],
      slide: ["research", "sheet", "website"],
      website: ["research", "doc"],
    };
    const sourceTypes = compatibleTypes[targetType] ?? [];
    return all.filter((a) => sourceTypes.includes(a.type)).sort((a, b) => b.createdAt - a.createdAt);
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
    if (this.sb && this.ready) {
      this.sb.from(this.persistTable).delete().eq("session_id", sessionId).catch(() => {});
      this.sb.from("lumina_session_files").delete().eq("session_id", sessionId).catch(() => {});
    }
  }

  /** Get workspace storage path for a session (for file-based I/O) */
  getWorkspacePath(sessionId: string): string {
    return `/tmp/lumina-workspace/${sessionId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
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
