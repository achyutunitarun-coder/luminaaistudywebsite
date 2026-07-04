import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const OLLAMA_URL = "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:3b";

async function checkOllamaStatus() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { healthy: false, message: "Ollama API returned error", modelLoaded: false };
    const data = await res.json();
    const models = data?.models || [];
    const modelLoaded = models.some((m: any) => m.name === DEFAULT_MODEL);
    if (!modelLoaded) return { healthy: true, message: `Model ${DEFAULT_MODEL} not loaded. Run: ollama pull ${DEFAULT_MODEL}`, modelLoaded: false };
    return { healthy: true, message: "Ready", modelLoaded: true };
  } catch {
    return { healthy: false, message: "Ollama not reachable at localhost:11434. Start with: ollama serve", modelLoaded: false };
  }
}

function parseJsonLines(body: string): any[] {
  const results: any[] = [];
  const lines = body.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { results.push(JSON.parse(trimmed)); } catch { /* skip */ }
  }
  return results;
}

const CHAT_TTL = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);

async function proxyToOllama(payload: any, res: any, streamTokens: boolean) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHAT_TTL);
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      res.writeHead(response.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: text || "Ollama request failed", code: "OLLAMA_REQUEST_FAILED" }));
      return;
    }

    if (payload.stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const reader = response.body?.getReader();
      if (!reader) { res.end(); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\n/);
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (!line) continue;
          try {
            const parsed = JSON.parse(line) as { response?: string; done?: boolean; error?: string };
            if (parsed.error) {
              res.write(`data: ${JSON.stringify({ error: parsed.error })}\n\n`);
              continue;
            }
            if (typeof parsed.response === "string" && parsed.response.length) {
              const key = streamTokens ? "token" : "text";
              res.write(`data: ${JSON.stringify({ [key]: parsed.response })}\n\n`);
            }
          } catch { /* ignore malformed chunks */ }
        }
      }
      res.end();
      return;
    }

    const data = await response.json();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ text: data.response || "", model: data.model || DEFAULT_MODEL }));
  } catch (error) {
    clearTimeout(timeout);
    const msg = error instanceof Error ? error.message : "Ollama request failed";
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg, code: "OLLAMA_REQUEST_FAILED" }));
  }
}

const ollamaDevProxy = {
  name: "ollama-dev-proxy",
  configureServer(server: any) {
    const handleRoute = async (req: any, res: any) => {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }

      const url = new URL(req.url || "/", "http://localhost");
      const pathname = url.pathname;

      // GET /api/ai/status — check Ollama health
      if (req.method === "GET" && pathname === "/api/ai/status") {
        const status = await checkOllamaStatus();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(status));
        return;
      }

      // GET /api/ai — legacy status
      if (req.method === "GET" && pathname === "/api/ai") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, model: DEFAULT_MODEL, message: "Ollama backend is ready." }));
        return;
      }

      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", async () => {
        const payload = JSON.parse(body || "{}") as { prompt?: string; model?: string; stream?: boolean; temperature?: number };

        // POST /api/ai/status — check health
        if (pathname === "/api/ai/status") {
          const status = await checkOllamaStatus();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(status));
          return;
        }

        if (!payload.prompt || typeof payload.prompt !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing or invalid prompt" }));
          return;
        }

        const model = payload.model || DEFAULT_MODEL;
        const ollamaPayload = {
          model,
          prompt: payload.prompt,
          stream: true,
          temperature: payload.temperature ?? 0.3,
          top_p: 0.9,
        };

        // POST /api/ai/chat — streaming SSE with { token }
        if (pathname === "/api/ai/chat") {
          await proxyToOllama(ollamaPayload, res, true);
          return;
        }

        // POST /api/ai/generate — non-streaming { response }
        if (pathname === "/api/ai/generate") {
          ollamaPayload.stream = false;
          const timer = setTimeout(() => {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Ollama request timed out", code: "OLLAMA_REQUEST_FAILED" }));
          }, CHAT_TTL);
          try {
            const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(ollamaPayload),
              signal: AbortSignal.timeout(CHAT_TTL),
            });
            clearTimeout(timer);
            if (!ollamaRes.ok) {
              const errText = await ollamaRes.text();
              res.writeHead(ollamaRes.status, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: errText || "Ollama request failed" }));
              return;
            }
            const data = await ollamaRes.json();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ response: data.response || "" }));
          } catch (e) {
            clearTimeout(timer);
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Ollama request failed" }));
          }
          return;
        }

        // Legacy POST /api/ai — backward-compatible with ?stream param
        const stream = payload.stream === true;
        await proxyToOllama({ ...ollamaPayload, stream }, res, false);
      });
    };

    // Attach to both /api/ai and sub-paths
    server.middlewares.use("/api/ai", handleRoute);
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "framer-motion"],
          supabase: ["@supabase/supabase-js", "@supabase/ssr"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tooltip", "@radix-ui/react-select", "@radix-ui/react-tabs"],
          pdf: ["pdfjs-dist"],
          xlsx: ["xlsx", "jszip"],
          katex: ["katex", "rehype-katex"],
          markdown: ["react-markdown", "remark-gfm", "remark-math", "rehype-raw"],
        },
      },
    },
  },
  plugins: [react(), mode === "development" && ollamaDevProxy, mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
