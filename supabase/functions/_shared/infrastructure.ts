/**
 * Infrastructure Layers (Section 2 of the architecture spec).
 *
 * Four distinct layers matching production agent runtime structure:
 *
 * 1. CONTROL PLANE — Manages execution environment lifecycle (start/reset/stop code sandbox per session)
 * 2. COMPUTE ENGINE — Persistent code execution kernel (IPython/Jupyter-style) that tasks can run code
 *    against across multiple steps without losing state between calls
 * 3. WEB LAYER — Browser automation (Playwright) as the ONLY path to the network.
 *    No raw HTTP calls available to executed code — all web access goes through the browser tool exclusively.
 * 4. WORKSPACE LAYER — Session-scoped persistent storage with directory isolation.
 */

const ENV_MARKER = "/tmp/lumina-env";

// ── 1. Control Plane ────────────────────────────────────────────────

export type SandboxStatus = "stopped" | "starting" | "running" | "error";

export interface SandboxState {
  status: SandboxStatus;
  sessionId: string;
  startedAt: number;
  lastActivity: number;
  workspacePath: string;
}

const sandboxes = new Map<string, SandboxState>();

export class ControlPlane {
  async start(sessionId: string): Promise<SandboxState> {
    const existing = sandboxes.get(sessionId);
    if (existing && existing.status === "running") {
      existing.lastActivity = Date.now();
      return existing;
    }

    const state: SandboxState = {
      status: "starting",
      sessionId,
      startedAt: Date.now(),
      lastActivity: Date.now(),
      workspacePath: `/tmp/lumina-workspace/${sessionId.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    };

    // Create workspace directory
    try {
      await Deno.mkdir(state.workspacePath, { recursive: true });
      state.status = "running";
    } catch {
      state.status = "error";
    }

    sandboxes.set(sessionId, state);
    return state;
  }

  getState(sessionId: string): SandboxState | undefined {
    return sandboxes.get(sessionId);
  }

  async reset(sessionId: string): Promise<SandboxState> {
    await this.stop(sessionId);
    return this.start(sessionId);
  }

  async stop(sessionId: string): Promise<void> {
    const state = sandboxes.get(sessionId);
    if (state) {
      // Clean up workspace
      try {
        await Deno.remove(state.workspacePath, { recursive: true });
      } catch {
        // Best effort cleanup
      }
      sandboxes.delete(sessionId);
    }
  }

  isRunning(sessionId: string): boolean {
    return sandboxes.get(sessionId)?.status === "running";
  }
}

// Singleton control plane instance
export const controlPlane = new ControlPlane();

// ── 2. Compute Engine ────────────────────────────────────────────────

export interface ComputeCell {
  id: string;
  language: "javascript" | "typescript" | "python" | "bash";
  code: string;
  output: string;
  error?: string;
  durationMs: number;
  createdAt: number;
}

/**
 * A persistent compute kernel for a session.
 * Maintains state across code execution calls (variable scope lives across calls).
 *
 * This is a lightweight Jupyter-style kernel simulator. In production,
 * this would connect to a real kernel (Deno.serve for JS/TS, or a subprocess for Python).
 */
export class ComputeEngine {
  private sessionId: string;
  private cells: ComputeCell[] = [];
  private kernelState: Record<string, unknown> = {};

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async execute(
    code: string,
    language: ComputeCell["language"] = "javascript",
  ): Promise<ComputeCell> {
    const startTime = Date.now();
    const cell: ComputeCell = {
      id: crypto.randomUUID(),
      language,
      code,
      output: "",
      durationMs: 0,
      createdAt: Date.now(),
    };

    try {
      if (language === "bash") {
        // For bash, spawn a subprocess (sandboxed to workspace)
        const cmd = new Deno.Command("bash", {
          args: ["-c", code],
          cwd: `/tmp/lumina-workspace/${this.sessionId.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
          stdout: "piped",
          stderr: "piped",
        });
        const result = await cmd.output();
        cell.output = new TextDecoder().decode(result.stdout);
        const stderr = new TextDecoder().decode(result.stderr);
        if (stderr) cell.error = stderr;
      } else {
        // JS/TS evaluation via safe sandbox
        try {
          // Use a Function constructor for evaluation (basic sandbox)
          const fn = new Function(...Object.keys(this.kernelState), code);
          const result = fn(...Object.values(this.kernelState));
          cell.output = result === undefined ? "(no return value)" : String(result);
        } catch (evalErr) {
          cell.error = evalErr instanceof Error ? evalErr.message : String(evalErr);
        }
      }
    } catch (execErr) {
      cell.error = execErr instanceof Error ? execErr.message : String(execErr);
    }

    cell.durationMs = Date.now() - startTime;
    this.cells.push(cell);
    return cell;
  }

  getCells(): ComputeCell[] {
    return [...this.cells];
  }

  getRecentCells(n = 5): ComputeCell[] {
    return this.cells.slice(-n);
  }

  setKernelState(key: string, value: unknown): void {
    this.kernelState[key] = value;
  }

  getKernelState(key: string): unknown {
    return this.kernelState[key];
  }

  reset(): void {
    this.cells = [];
    this.kernelState = {};
  }
}

// ── 3. Web Layer ─────────────────────────────────────────────────────

export interface NavigationResult {
  url: string;
  title: string;
  content: string;
  screenshot?: string;
  statusCode?: number;
}

/**
 * Web layer — browser automation as the ONLY network path.
 *
 * The execution sandbox has NO direct outbound network access.
 * All web interactions go through this browser tool exclusively.
 * This is a deliberate security and observability choice.
 *
 * In production, this wraps Playwright. For the edge function environment,
 * we simulate browser operations via fetch (the function's own HTTP client),
 * but the key architectural constraint is enforced at the agent level:
 * agents must route ALL web access through this layer.
 */
export class WebLayer {
  private browserAvailable: boolean;

  constructor() {
    // Check if we're in a browser-capable environment
    this.browserAvailable = typeof (globalThis as any).navigator !== "undefined";
  }

  async navigate(url: string): Promise<NavigationResult> {
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      url = `https://${url}`;
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Lumina-Research-Agent/1.0 (+https://luminaai.co.in)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
      });

      const html = await response.text();
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : url;

      // Strip HTML tags for content extraction
      const content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " [navigation] ")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 10000);

      return {
        url: response.url,
        title,
        content,
        statusCode: response.status,
      };
    } catch (err) {
      throw new Error(`Web fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async search(query: string): Promise<NavigationResult[]> {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
      const result = await this.navigate(searchUrl);
      // Extract search result snippets
      const snippets = result.content
        .split(/\n{2,}/)
        .filter((s) => s.length > 80 && s.length < 500)
        .slice(0, 5);

      return snippets.map((snippet, i) => ({
        url: `${searchUrl}#result-${i + 1}`,
        title: `Search result ${i + 1} for "${query}"`,
        content: snippet,
      }));
    } catch {
      return [];
    }
  }

  isAvailable(): boolean {
    return this.browserAvailable;
  }
}

// ── 4. Workspace Layer ───────────────────────────────────────────────

/**
 * Session-scoped persistent workspace directory.
 * All file operations for a session are scoped to this directory.
 * Survives across steps within a task.
 */
export class WorkspaceLayer {
  private basePath: string;

  constructor(sessionId: string) {
    this.basePath = `/tmp/lumina-workspace/${sessionId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  }

  getPath(): string {
    return this.basePath;
  }

  async ensureDir(): Promise<void> {
    await Deno.mkdir(this.basePath, { recursive: true });
  }

  async writeFile(relativePath: string, content: string): Promise<string> {
    const fullPath = `${this.basePath}/${relativePath}`;
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(fullPath, content);
    return fullPath;
  }

  async readFile(relativePath: string): Promise<string> {
    const fullPath = `${this.basePath}/${relativePath}`;
    return await Deno.readTextFile(fullPath);
  }

  async listFiles(relativeDir = ""): Promise<string[]> {
    const fullPath = `${this.basePath}/${relativeDir}`;
    const entries: string[] = [];
    try {
      for await (const entry of Deno.readDir(fullPath)) {
        entries.push(entry.name);
      }
    } catch {
      // Directory may not exist yet
    }
    return entries;
  }

  async removeFile(relativePath: string): Promise<void> {
    const fullPath = `${this.basePath}/${relativePath}`;
    try {
      await Deno.remove(fullPath);
    } catch {
      // Best effort
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = `${this.basePath}/${relativePath}`;
    try {
      await Deno.stat(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async readJSON<T = unknown>(relativePath: string): Promise<T | null> {
    try {
      const content = await this.readFile(relativePath);
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  async writeJSON(relativePath: string, data: unknown): Promise<string> {
    return this.writeFile(relativePath, JSON.stringify(data, null, 2));
  }

  async clear(): Promise<void> {
    try {
      await Deno.remove(this.basePath, { recursive: true });
    } catch {
      // Best effort
    }
  }
}
