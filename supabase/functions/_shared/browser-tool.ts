// ═══════════════════════════════════════════════════════════════════
// Lumina Computer — Browser Automation Tool
//
// Playwright-compatible interface with two implementations:
//   1. HTTP-based: connects to an external browser service (Browserless,
//      Playwright-as-a-service, or self-hosted)
//   2. Fetch-based: simple GET/POST extraction for non-JS pages (no
//      browser needed — useful fallback)
// ═══════════════════════════════════════════════════════════════════

import type { Tool, ToolSchema } from "./computer-agent.ts";

// ── Types ───────────────────────────────────────────────────────────

export interface BrowserAction {
  type: "navigate" | "click" | "type" | "scroll" | "wait" | "extract" | "screenshot" | "upload" | "download" | "switch_tab";
  target?: string;     // URL, selector, or tab ID
  value?: string;      // text to type, scroll amount, wait ms
  selector?: string;   // CSS/XPath selector for click/type
  options?: Record<string, any>;
}

export interface BrowserResult {
  success: boolean;
  data?: string;        // extracted text, file content, etc.
  screenshot?: string;  // base64-encoded PNG
  url?: string;         // current URL after action
  error?: string;
}

export interface BrowserClient {
  execute(action: BrowserAction): Promise<BrowserResult>;
  close(): Promise<void>;
}

// ── Browser Tool Schema ──────────────────────────────────────────────

export const BROWSER_TOOL_SCHEMA: ToolSchema = {
  name: "browser",
  description: "Control a web browser: navigate to URLs, click elements, type text, scroll, extract content, take screenshots, upload/download files, switch tabs.",
  inputSchema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["navigate", "click", "type", "scroll", "wait", "extract", "screenshot", "upload", "download", "switch_tab"],
        description: "The browser action to perform",
      },
      target: { type: "string", description: "URL to navigate to, selector to click, or tab ID" },
      value: { type: "string", description: "Text to type, pixels to scroll, or milliseconds to wait" },
      selector: { type: "string", description: "CSS selector for click/type/extract actions" },
    },
    required: ["type"],
  },
};

// ── HTTP-based Browser Client (connects to external browser service) ──

export interface BrowserServiceConfig {
  url: string;         // e.g. "https://chrome.browserless.io"
  apiKey?: string;     // optional API key
}

export class HTTPBrowserClient implements BrowserClient {
  private config: BrowserServiceConfig;

  constructor(config: BrowserServiceConfig) {
    this.config = config;
  }

  async execute(action: BrowserAction): Promise<BrowserResult> {
    try {
      const payload = { action: action.type, ...action };
      const res = await fetch(`${this.config.url}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { "Authorization": `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return { success: false, error: `Browser service returned ${res.status}: ${errText.slice(0, 200)}` };
      }
      return await res.json();
    } catch (e) {
      return { success: false, error: `Browser request failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  async close(): Promise<void> {
    // Connection cleanup — no-op for HTTP client
  }
}

// ── Fetch-based Fallback Client (no browser needed) ──────────────────
// Works for plain HTML pages. Cannot run JS or handle SPAs.

export class FetchBrowserClient implements BrowserClient {
  private currentUrl: string | null = null;

  async execute(action: BrowserAction): Promise<BrowserResult> {
    switch (action.type) {
      case "navigate": {
        if (!action.target) return { success: false, error: "navigate requires a URL" };
        try {
          const res = await fetch(action.target, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; LuminaComputer/1.0)" },
          });
          this.currentUrl = action.target;
          const html = await res.text();
          // Strip tags for a clean text view
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 50000);
          return { success: true, data: text, url: this.currentUrl };
        } catch (e) {
          return { success: false, error: `Fetch failed: ${e instanceof Error ? e.message : String(e)}` };
        }
      }

      case "extract": {
        if (!this.currentUrl) return { success: false, error: "No page loaded. Navigate first." };
        // Re-fetch the page to get fresh content
        return this.execute({ type: "navigate", target: this.currentUrl });
      }

      case "screenshot": {
        return { success: false, error: "Screenshots require a real browser (HTTPBrowserClient with a browser service)" };
      }

      case "wait": {
        const ms = parseInt(action.value ?? "1000");
        await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 10000)));
        return { success: true };
      }

      default:
        return { success: false, error: `Action '${action.type}' requires a real browser. Use HTTPBrowserClient with Browserless or Playwright service.` };
    }
  }

  async close(): Promise<void> {
    this.currentUrl = null;
  }
}

// ── Create Tool (factory) ───────────────────────────────────────────

export function createBrowserTool(client?: BrowserClient): Tool {
  const browser = client ?? new FetchBrowserClient();

  return {
    schema: BROWSER_TOOL_SCHEMA,
    async execute(args: Record<string, any>): Promise<string> {
      const action: BrowserAction = {
        type: args.type as BrowserAction["type"],
        target: args.target,
        value: args.value,
        selector: args.selector,
      };
      const result = await browser.execute(action);
      if (!result.success) {
        return `ERROR: ${result.error}`;
      }
      let output = `Browser action '${action.type}' succeeded.`;
      if (result.url) output += `\nURL: ${result.url}`;
      if (result.data) output += `\n\nContent:\n${result.data.slice(0, 8000)}`;
      if (result.screenshot) output += `\n[Screenshot: ${result.screenshot.length} bytes base64 PNG]`;
      return output;
    },
  };
}
