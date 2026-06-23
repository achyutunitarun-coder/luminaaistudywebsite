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
        this.state.hasTags = true;
        const path = fileMatch[1];
        const afterMarker = this.buffer.slice(fileMatch[0].length);
        const endIdx = afterMarker.indexOf("\nEND FILE\n");
        if (endIdx !== -1 || (final && afterMarker.includes("END FILE"))) {
          let content = endIdx !== -1 ? afterMarker.slice(0, endIdx) : afterMarker.replace(/\nEND FILE\s*$/, "");
          // Strip code block fences if AI wrapped content
          content = content.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "").trim();
          const file: LuminaFile = { path, lang: guessLang(path), content, done: true };
          this.state.files.push(file);
          this.buffer = endIdx !== -1 ? afterMarker.slice(endIdx + "\nEND FILE\n".length) : "";
          this.activeFile = null;
          continue;
        } else {
          if (!this.activeFile || this.activeFile.path !== path) {
            if (this.activeFile) this.activeFile.done = true;
            this.activeFile = { path, lang: guessLang(path), content: "", done: false };
            this.state.files.push(this.activeFile);
          }
          let partialContent = afterMarker;
          // Strip code block fences from partial content
          partialContent = partialContent.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
          this.activeFile.content = partialContent;
          const f = this.state.files.find(x => x.path === path);
          if (f) f.content = partialContent;
          this.buffer = "";
          return;
        }
      }

      // Try legacy format: <lumina:file path="...">
      const legacyMatch = this.buffer.match(/<lumina:file\s+path="([^"]+)"[^>]*>/);
      if (legacyMatch) {
        this.state.hasTags = true;
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
        this.state.hasTags = true;
        this.state.plan = planMatch[1].trim();
        this.buffer = this.buffer.slice(planMatch[0].length + this.buffer.indexOf(planMatch[0]) > 0 ? this.buffer.indexOf(planMatch[0]) + planMatch[0].length : planMatch[0].length);
        continue;
      }

      // Try legacy final tag
      const finalMatch = this.buffer.match(/<lumina:final>([\s\S]*?)<\/lumina:final>/);
      if (finalMatch) {
        this.state.hasTags = true;
        this.state.final = finalMatch[1].trim();
        this.buffer = "";
        continue;
      }

      // No tags found — check if we have usable content
      if (final && !this.state.hasTags && this.buffer.trim().length > 0) {
        // Auto-detect file type from content — split into multiple files if possible
        const content = this.buffer.trim();

        // Try to detect and split multiple files from raw content
        const rawFiles = this.autoDetectAndSplit(content);
        if (rawFiles.length > 0) {
          for (const rf of rawFiles) {
            this.state.files.push({ path: rf.path, lang: rf.lang, content: rf.content, done: true });
          }
        } else {
          // Fallback: single file
          let path = "response.md";
          let lang = "md";
          if (/<!DOCTYPE|<html/i.test(content)) { path = "index.html"; lang = "html"; }
          else if (/<style|@media|@import|:root\s*\{/i.test(content) && !/<html/i.test(content)) { path = "style.css"; lang = "css"; }
          else if (/<script|document\.|window\.|const\s+\w+\s*=|function\s+\w+/i.test(content) && !/<html/i.test(content)) { path = "script.js"; lang = "javascript"; }
          else if (/^\s*\{[\s\S]*\}\s*$/.test(content)) { path = "data.json"; lang = "json"; }
          this.state.files.push({ path, lang, content, done: true });
        }
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
    return /FILE:\s*$/.test(this.buffer)
      || /<lumina:[\w-]*$/.test(this.buffer)
      || /<!DOCTYPE\s*$/i.test(this.buffer)
      || /<html\s*$/i.test(this.buffer)
      || /<style\s*$/i.test(this.buffer)
      || /<script\s*$/i.test(this.buffer)
      || /<lumina:file\s+path="[^"]*$/i.test(this.buffer)
      || /FILE:\s*\S+\s*$/i.test(this.buffer)
      || /END\s+FILE\s*$/i.test(this.buffer);
  }

  /**
   * Auto-detect and split raw content into multiple files.
   * Looks for embedded <style>, <script>, and <link> tags within HTML,
   * or standalone CSS/JS patterns.
   */
  private autoDetectAndSplit(content: string): Array<{ path: string; lang: string; content: string }> {
    const files: Array<{ path: string; lang: string; content: string }> = [];

    // Case 1: Full HTML document — extract embedded CSS/JS
    if (/<!DOCTYPE|<html/i.test(content)) {
      // Extract inline <style> blocks
      const styleBlocks: string[] = [];
      const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      let styleMatch;
      while ((styleMatch = styleRegex.exec(content)) !== null) {
        styleBlocks.push(styleMatch[1].trim());
      }

      // Extract inline <script> blocks
      const scriptBlocks: string[] = [];
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let scriptMatch;
      while ((scriptMatch = scriptRegex.exec(content)) !== null) {
        scriptBlocks.push(scriptMatch[1].trim());
      }

      // Strip inline CSS/JS from HTML to create clean index.html
      let cleanHtml = content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .trim();

      // Add link to external CSS/JS if we extracted any
      if (styleBlocks.length > 0 && !cleanHtml.includes('href="style.css"')) {
        cleanHtml = cleanHtml.replace(
          /<\/head>/i,
          '  <link rel="stylesheet" href="style.css">\n</head>'
        );
      }
      if (scriptBlocks.length > 0 && !cleanHtml.includes('src="script.js"')) {
        cleanHtml = cleanHtml.replace(
          /<\/body>/i,
          '  <script src="script.js"></script>\n</body>'
        );
      }

      files.push({ path: "index.html", lang: "html", content: cleanHtml });

      if (styleBlocks.length > 0) {
        files.push({ path: "style.css", lang: "css", content: styleBlocks.join("\n\n") });
      }
      if (scriptBlocks.length > 0) {
        files.push({ path: "script.js", lang: "javascript", content: scriptBlocks.join("\n\n") });
      }

      return files;
    }

    // Case 2: Content has clear CSS section (starts with CSS-like patterns)
    const cssOnly = /^[.#]?[\w-]+\s*\{[\s\S]*\}$/.test(content) || /@media|@import|@keyframes/i.test(content);
    if (cssOnly && !/<html/i.test(content) && !/<script/i.test(content)) {
      files.push({ path: "style.css", lang: "css", content });
      return files;
    }

    // Case 3: Content has clear JS patterns
    const jsOnly = /^(const|let|var|function|class|import|export|document\.|window\.)/m.test(content);
    if (jsOnly && !/<html/i.test(content) && !/<style/i.test(content)) {
      files.push({ path: "script.js", lang: "javascript", content });
      return files;
    }

    // Case 4: JSON content
    if (/^\s*\{[\s\S]*\}\s*$/.test(content) || /^\s*\[[\s\S]*\]\s*$/.test(content)) {
      try {
        JSON.parse(content);
        files.push({ path: "data.json", lang: "json", content });
        return files;
      } catch {
        // Not valid JSON, fall through
      }
    }

    return files;
  }
}
