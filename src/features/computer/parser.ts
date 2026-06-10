/**
 * Lumina Computer streaming tag parser.
 *
 * Consumes raw model token stream and incrementally extracts:
 *   <lumina:plan>...</lumina:plan>
 *   <lumina:file path="..." lang="...">...</lumina:file>
 *   <lumina:navigate to="..." reason="..." />
 *   <lumina:final>...</lumina:final>
 *
 * Robust to: streaming partial tags, missing closing tags (treats trailing
 * unclosed file as still-streaming), tags appearing in any order, and
 * legacy responses with no tags (whole stream → response.md).
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
  /** True when parser saw at least one lumina:* tag */
  hasTags: boolean;
}

type Section = "none" | "plan" | "file" | "final";

function readAttr(attrsRaw: string, name: string): string | undefined {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const match = pattern.exec(attrsRaw);
  return match?.[1] ?? match?.[2];
}

function readAnyAttr(attrsRaw: string, names: string[]): string | undefined {
  for (const name of names) {
    const value = readAttr(attrsRaw, name);
    if (value) return value;
  }
  return undefined;
}

export class LuminaParser {
  private buffer = "";
  private section: Section = "none";
  private activeFile: LuminaFile | null = null;
  public state: ParsedState = {
    plan: "",
    files: [],
    final: "",
    actions: [],
    hasTags: false,
  };

  /**
   * Push a new chunk of streamed text. Returns the updated state (same reference).
   */
  push(chunk: string): ParsedState {
    if (!chunk) return this.state;
    this.buffer += chunk;
    this.drain();
    return this.state;
  }

  /**
   * Call when the stream finishes. Closes any open sections.
   */
  finish(): ParsedState {
    // flush remaining buffer
    this.drain(true);
    if (this.activeFile) {
      this.activeFile.done = true;
      this.activeFile = null;
    }
    this.section = "none";
    return this.state;
  }

  private drain(final = false) {
    // Keep parsing until no more progress can be made
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.section === "none") {
        const nextTag = this.findNextOpenTag();
        if (!nextTag) {
          // No tag found. If we've never seen tags AND stream isn't final,
          // hold the buffer (it might still be assembling a tag).
          // If final and still no tags, dump everything into a virtual file.
          if (final && !this.state.hasTags && this.buffer.trim().length > 0) {
            this.activeFile = {
              path: "response.md",
              lang: "md",
              content: this.buffer,
              done: true,
            };
            this.state.files.push(this.activeFile);
            this.buffer = "";
            this.activeFile = null;
          } else if (!this.state.hasTags) {
            // Mirror buffer into a live virtual file so user sees something
            // streaming even before any tag arrives.
            if (this.buffer.length > 60 && !this.containsPartialTag()) {
              if (!this.state.files.find((f) => f.path === "response.md")) {
                this.state.files.push({
                  path: "response.md",
                  lang: "md",
                  content: "",
                  done: false,
                });
              }
              const f = this.state.files.find((f) => f.path === "response.md")!;
              f.content = this.buffer;
            }
          }
          return;
        }

        // Drop anything before the tag (shouldn't normally exist)
        this.buffer = this.buffer.slice(nextTag.index);
        // Try to fully parse the opening tag (need to wait if attributes are partial)
        const opened = this.tryConsumeOpenTag();
        if (!opened) return; // wait for more
      } else if (this.section === "plan") {
        const close = this.buffer.indexOf("</lumina:plan>");
        if (close === -1) {
          // stream body
          const safe = this.safeBodySlice();
          if (safe > 0) {
            this.state.plan += this.buffer.slice(0, safe);
            this.buffer = this.buffer.slice(safe);
          }
          return;
        }
        this.state.plan += this.buffer.slice(0, close);
        this.buffer = this.buffer.slice(close + "</lumina:plan>".length);
        this.section = "none";
      } else if (this.section === "file") {
        const close = this.buffer.indexOf("</lumina:file>");
        if (close === -1) {
          const safe = this.safeBodySlice();
          if (safe > 0 && this.activeFile) {
            this.activeFile.content += this.buffer.slice(0, safe);
            this.buffer = this.buffer.slice(safe);
          }
          return;
        }
        if (this.activeFile) {
          this.activeFile.content += this.buffer.slice(0, close);
          this.activeFile.done = true;
          this.activeFile = null;
        }
        this.buffer = this.buffer.slice(close + "</lumina:file>".length);
        this.section = "none";
      } else if (this.section === "final") {
        const close = this.buffer.indexOf("</lumina:final>");
        if (close === -1) {
          const safe = this.safeBodySlice();
          if (safe > 0) {
            this.state.final += this.buffer.slice(0, safe);
            this.buffer = this.buffer.slice(safe);
          }
          return;
        }
        this.state.final += this.buffer.slice(0, close);
        this.buffer = this.buffer.slice(close + "</lumina:final>".length);
        this.section = "none";
      }
    }
  }

  /**
   * When streaming body content, hold back the last few chars in case they
   * are the start of a closing tag like "</lum...".
   */
  private safeBodySlice(): number {
    const tail = Math.min(this.buffer.length, 20);
    const tailStr = this.buffer.slice(this.buffer.length - tail);
    const idx = tailStr.lastIndexOf("<");
    if (idx === -1) return this.buffer.length;
    // hold back from the last "<"
    return this.buffer.length - (tail - idx);
  }

  private findNextOpenTag(): { index: number } | null {
    const idx = this.buffer.indexOf("<lumina:");
    return idx === -1 ? null : { index: idx };
  }

  /** Return true if buffer ends with a partial tag we should wait on. */
  private containsPartialTag(): boolean {
    const tail = this.buffer.slice(-12);
    return /<l?u?m?i?n?a?:?$|<lumina:[a-z]*$/i.test(tail) || tail.includes("<lumina:");
  }

  /**
   * Try to consume one opening tag at buffer[0]. Returns true if consumed.
   * If the tag is incomplete (missing `>`), returns false.
   */
  private tryConsumeOpenTag(): boolean {
    const m = this.buffer.match(/^<lumina:(plan|file|final|navigate|action|run|open)\b([^>]*)(\/?)>/);
    if (!m) {
      const unknown = this.buffer.match(/^<lumina:[^>]*>/);
      if (unknown) {
        this.state.hasTags = true;
        this.buffer = this.buffer.slice(unknown[0].length);
        this.section = "none";
        return true;
      }
      return false;
    }
    const [full, kind, attrsRaw, selfClose] = m;
    this.state.hasTags = true;
    this.buffer = this.buffer.slice(full.length);

    if (kind === "navigate") {
      const to = readAttr(attrsRaw, "to");
      const reason = readAttr(attrsRaw, "reason");
      if (to) {
        this.state.navigate = { to, reason };
        this.state.actions.push({
          id: `act-${this.state.actions.length}`,
          type: "navigate",
          target: to,
          reason,
          status: "proposed",
        });
      }
      this.section = "none";
      return true;
    }

    if (kind === "action" || kind === "run" || kind === "open") {
      const type =
        kind === "run" || kind === "open"
          ? (kind as "run" | "open")
          : ((readAttr(attrsRaw, "type") ?? "open") as
              | "run"
              | "open"
              | "navigate");
      const target =
        readAnyAttr(attrsRaw, ["path", "target", "file", "to"]) ?? "";
      const reason = readAttr(attrsRaw, "reason");
      if (target) {
        this.state.actions.push({
          id: `act-${this.state.actions.length}`,
          type,
          target,
          reason,
          status: "proposed",
        });
      }
      this.section = "none";
      return true;
    }

    if (kind === "plan") {
      this.section = "plan";
      return true;
    }

    if (kind === "final") {
      this.section = "final";
      return true;
    }

    if (kind === "file") {
      const path =
        readAttr(attrsRaw, "path") ?? `file-${this.state.files.length + 1}.txt`;
      const lang =
        readAttr(attrsRaw, "lang") ?? guessLang(path);
      // Self-closing file is invalid; ignore
      if (selfClose) return true;
      const file: LuminaFile = { path, lang, content: "", done: false };
      this.state.files.push(file);
      this.activeFile = file;
      this.section = "file";
      // strip leading newline immediately after the opening tag
      if (this.buffer.startsWith("\n")) this.buffer = this.buffer.slice(1);
      return true;
    }

    return true;
  }
}

export function guessLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "html", htm: "html",
    css: "css",
    js: "js", mjs: "js", cjs: "js",
    ts: "ts", tsx: "tsx",
    jsx: "jsx",
    json: "json",
    md: "md", markdown: "md",
    py: "py",
    sh: "sh",
    svg: "svg",
  };
  return map[ext] ?? "txt";
}
