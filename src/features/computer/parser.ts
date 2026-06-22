/**
 * Lumina Computer streaming file parser.
 *
 * Consumes raw model token stream and incrementally extracts files.
 * Handles two formats:
 *   New: FILE: path/to/file.ext ... END FILE
 *   Legacy: <lumina:file path="...">...</lumina:file>
 *
 * Robust to: streaming partial tags, missing closing tags, mixed formats.
 */

export interface LuminaFile {
  path: string;
  lang: string;
  content: string;
  done: boolean;
}

export interface LuminaAction {
  id: string;
  type: "run" | "open" | "navigate";
  target: string;
  reason?: string;
  status: "proposed" | "confirmed" | "dismissed" | "done";
}

export interface ParsedState {
  plan: string;
  files: LuminaFile[];
  navigate?: { to: string; reason?: string };
  actions: LuminaAction[];
  final: string;
  hasTags: boolean;
}

function guessLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    html: "html", htm: "html", css: "css", js: "javascript", jsx: "javascript",
    ts: "typescript", tsx: "typescript", json: "json", py: "python", md: "markdown",
    svg: "svg", sql: "sql", sh: "bash", bash: "bash",
  };
  return map[ext] || "text";
}

export class LuminaParser {
  private buffer = "";
  private activeFile: LuminaFile | null = null;
  public state: ParsedState = { plan: "", files: [], final: "", actions: [], hasTags: false };

  push(chunk: string): ParsedState {
    if (!chunk) return this.state;
    this.buffer += chunk;
    this.drain();
    return this.state;
  }

  finish(): ParsedState {
    this.drain(true);
    if (this.activeFile) {
      this.activeFile.done = true;
      this.activeFile = null;
    }
    return this.state;
  }

  private drain(final = false) {
    while (true) {
      // Try new format: FILE: path
      const fileMatch = this.buffer.match(/^FILE:\s*([\w./\-_]+)\s*\n/);
      if (fileMatch) {
        this.hasTags = true;
        const path = fileMatch[1];
        // Check if there's an END FILE marker
        const afterMarker = this.buffer.slice(fileMatch[0].length);
        const endIdx = afterMarker.indexOf("\nEND FILE\n");
        if (endIdx !== -1 || (final && afterMarker.includes("END FILE"))) {
          // Complete file
          const content = endIdx !== -1 ? afterMarker.slice(0, endIdx) : afterMarker.replace(/\nEND FILE\s*$/, "");
          const file: LuminaFile = { path, lang: guessLang(path), content, done: true };
          this.state.files.push(file);
          this.buffer = endIdx !== -1 ? afterMarker.slice(endIdx + "\nEND FILE\n".length) : "";
          this.activeFile = null;
          continue;
        } else {
          // File still streaming — show partial content
          if (!this.activeFile || this.activeFile.path !== path) {
            if (this.activeFile) this.activeFile.done = true;
            this.activeFile = { path, lang: guessLang(path), content: "", done: false };
            this.state.files.push(this.activeFile);
          }
          this.activeFile.content = afterMarker;
          // Also update in state.files array
          const f = this.state.files.find(x => x.path === path);
          if (f) f.content = afterMarker;
          this.buffer = "";
          return;
        }
      }

      // Try legacy format: <lumina:file path="...">
      const legacyMatch = this.buffer.match(/<lumina:file\s+path="([^"]+)"[^>]*>/);
      if (legacyMatch) {
        this.hasTags = true;
        const path = legacyMatch[1];
        const afterTag = this.buffer.slice(legacyMatch[0].length);
        const endTag = "</lumina:file>";
        const endIdx = afterTag.indexOf(endTag);
        if (endIdx !== -1) {
          const content = afterTag.slice(0, endIdx);
          this.state.files.push({ path, lang: guessLang(path), content, done: true });
          this.buffer = afterTag.slice(endIdx + endTag.length);
          continue;
        } else {
          // Streaming legacy file
          if (!this.activeFile || this.activeFile.path !== path) {
            if (this.activeFile) this.activeFile.done = true;
            this.activeFile = { path, lang: guessLang(path), content: "", done: false };
            this.state.files.push(this.activeFile);
          }
          this.activeFile.content = afterTag;
          const f = this.state.files.find(x => x.path === path);
          if (f) f.content = afterTag;
          this.buffer = "";
          return;
        }
      }

      // Try legacy plan tag
      const planMatch = this.buffer.match(/<lumina:plan>([\s\S]*?)<\/lumina:plan>/);
      if (planMatch) {
        this.hasTags = true;
        this.state.plan = planMatch[1].trim();
        this.buffer = this.buffer.slice(planMatch[0].length + this.buffer.indexOf(planMatch[0]) > 0 ? this.buffer.indexOf(planMatch[0]) + planMatch[0].length : planMatch[0].length);
        continue;
      }

      // Try legacy final tag
      const finalMatch = this.buffer.match(/<lumina:final>([\s\S]*?)<\/lumina:final>/);
      if (finalMatch) {
        this.hasTags = true;
        this.state.final = finalMatch[1].trim();
        this.buffer = "";
        continue;
      }

      // No tags found — check if we have usable content
      if (final && !this.state.hasTags && this.buffer.trim().length > 0) {
        // Auto-detect file type from content
        const content = this.buffer.trim();
        let path = "response.md";
        let lang = "md";
        if (/<!DOCTYPE|<html/i.test(content)) { path = "index.html"; lang = "html"; }
        else if (/<style|@media|@import|:root\s*\{/i.test(content) && !/<html/i.test(content)) { path = "style.css"; lang = "css"; }
        else if (/<script|document\.|window\.|const\s+\w+\s*=|function\s+\w+/i.test(content) && !/<html/i.test(content)) { path = "script.js"; lang = "javascript"; }
        else if (/^\s*\{[\s\S]*\}\s*$/.test(content)) { path = "data.json"; lang = "json"; }
        this.state.files.push({ path, lang, content, done: true });
        this.buffer = "";
        return;
      }

      // If no tags and not final, show streaming content
      if (!this.state.hasTags && this.buffer.length > 100 && !this.containsPartialTag()) {
        if (!this.state.files.find(f => f.path === "response.md")) {
          this.state.files.push({ path: "response.md", lang: "md", content: this.buffer, done: false });
        } else {
          const f = this.state.files.find(f => f.path === "response.md");
          if (f) f.content = this.buffer;
        }
        if (!this.buffer.includes("FILE:") && !this.buffer.includes("<lumina:") && !this.buffer.includes("<!DOCTYPE") && !this.buffer.includes("<html")) {
          this.buffer = "";
        }
        return;
      }

      return;
    }
  }

  private containsPartialTag(): boolean {
    return /FILE:\s*$/.test(this.buffer) || /<lumina:[\w-]*$/.test(this.buffer) || /<!DOCTYPE\s*$/i.test(this.buffer) || /<html\s*$/i.test(this.buffer);
  }
}
