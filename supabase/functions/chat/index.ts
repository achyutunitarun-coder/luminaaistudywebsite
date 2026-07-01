// Lumina AI — Chat & Computer Mode
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── OpenRouter Key Pool ────────────────────────────────────────────

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const OR_KEYS = [
  "OPENROUTER_API_KEY", "OPENROUTER_KEY_2", "OPENROUTER_KEY_3",
  "OPENROUTER_KEY_4", "OPENROUTER_KEY_5", "OPENROUTER_KEY_6", "OPENROUTER_KEY_7",
].map((k) => Deno.env.get(k)).filter(Boolean) as string[];

const CHAIN = ["meta-llama/llama-3.3-70b-instruct:free", "openai/gpt-oss-20b:free", "qwen/qwen3-coder:free"];

let _cursor = 0;
const _cooldown: number[] = OR_KEYS.map(() => 0);
const COOLDOWN_429 = 45_000;
const COOLDOWN_BAD = 600_000;

function nextKey(): number {
  const now = Date.now();
  for (let i = 0; i < OR_KEYS.length; i++) {
    const idx = (_cursor + i) % OR_KEYS.length;
    if (_cooldown[idx] <= now) { _cursor = (idx + 1) % OR_KEYS.length; return idx; }
  }
  let best = 0, bestT = Infinity;
  OR_KEYS.forEach((_, i) => { if (_cooldown[i] < bestT) { best = i; bestT = _cooldown[i]; } });
  _cursor = (best + 1) % OR_KEYS.length;
  return best;
}

// ── Streaming Helper ───────────────────────────────────────────────

async function streamModel(
  messages: any[],
  maxTokens: number,
  temperature: number,
  signal: AbortSignal,
  onDelta: (chunk: string) => void,
): Promise<{ full: string; model: string; finish: string | null }> {
  if (OR_KEYS.length === 0) throw new Error("No API keys configured");

  let lastErr = "";
  for (const model of CHAIN) {
    for (let attempt = 0; attempt < Math.min(OR_KEYS.length, 3); attempt++) {
      const keyIdx = nextKey();
      try {
        const res = await fetch(OR_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OR_KEYS[keyIdx]}`,
            "HTTP-Referer": "https://luminaai.co.in",
            "X-Title": "Lumina AI",
          },
          body: JSON.stringify({
            model, messages, stream: true,
            max_tokens: maxTokens, max_completion_tokens: maxTokens,
            temperature, top_p: 0.95,
          }),
          signal,
        });

        if (!res.ok) {
          if (res.status === 429) { _cooldown[keyIdx] = Date.now() + COOLDOWN_429; continue; }
          if (res.status === 401 || res.status === 403) { _cooldown[keyIdx] = Date.now() + COOLDOWN_BAD; continue; }
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let full = "";
        let finish: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const raw = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const p = JSON.parse(jsonStr);
              const d = p?.choices?.[0]?.delta?.content;
              if (typeof d === "string" && d) { full += d; onDelta(d); }
              const fr = p?.choices?.[0]?.finish_reason;
              if (fr) finish = fr;
            } catch {
              buf = line.slice(6) + "\n" + buf;
              break;
            }
          }
        }

        return { full, model, finish };
      } catch (e) {
        if (e instanceof TypeError && (e.message.includes("abort") || e.message.includes("signal"))) throw e;
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
  }
  throw new Error(`All models failed: ${lastErr}`);
}

// ── URL Fetcher ────────────────────────────────────────────────────

async function fetchUrlContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LuminaComputer/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return `Error: HTTP ${res.status}`;
    const html = await res.text();
    // Strip tags for a clean text view
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "\n")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 8000);
  } catch (e) {
    return `Error fetching: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ── Prompts ─────────────────────────────────────────────────────────

const COMPUTER_PROMPT = `You are Lumina Computer — an assistant that helps with research, code, documents, and multi-step tasks.

Voice: direct, capable, human. No filler. Say what you're doing, what you found, and what you built.

Output rules:
- For files, use FILE: path/name.ext
  ...content...
  END FILE
- For reports, use markdown with headings
- For actions, say what you're doing plainly
- Never truncate with "..." or "rest unchanged"
- Close all tags, complete all functions`;

const STYLE_GUIDE = `Format your answers beautifully using markdown:

- Use # ## ### headings to structure your answer
- Use **bold** for key terms and concepts
- Use bullet lists and numbered lists for steps and summaries
- Use \`code\` for technical terms, filenames, and short snippets
- Use triple backticks for longer code blocks
- Use blockquote formatting for important callouts or quotes
- Add blank lines between sections for readability
- Keep paragraphs short (2-4 sentences)
- Lead with the answer, then explain

Your tone: confident, warm, articulate. Write like a great teacher who loves the subject.`;

function buildSystem(intent: string, mode: string, effort: string, isComputer: boolean): string {
  if (isComputer) return `${COMPUTER_PROMPT}\n\n${STYLE_GUIDE}\n\nEffort: ${effort.toUpperCase()}`;
  const base = `You are Lumina AI, an elite study assistant.\n\n${STYLE_GUIDE}\n\nMode: ${mode} | Effort: ${effort}`;
  if (intent === "coding") return `${base}\n\nProvide complete working code. Explain your approach briefly, then show the code, then summarize.`;
  if (intent === "study") return `${base}\n\nStart with a clear definition or answer. Then explain with examples and analogies. Connect concepts.`;
  if (intent === "greeting") return `${base}\n\nBe warm and inviting. Ask how you can help today. Keep it brief.`;
  return base;
}

// ── Entry Point ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ue } = await sb.auth.getUser();
    if (ue || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

    const body = await req.text();
    if (body.length > 5_000_000) return new Response(JSON.stringify({ error: "Too large" }), { status: 413, headers: { ...CORS, "Content-Type": "application/json" } });

    const { messages, mode, effort } = JSON.parse(body);
    if (!Array.isArray(messages) || messages.length > 60) return new Response(JSON.stringify({ error: "Invalid messages" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });

    const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
    const query = typeof lastUser?.content === "string" ? lastUser.content : "";
    const intent = /code|build|create|app|website|function|bug|error/i.test(query) ? "coding" : /explain|what|how|why|teach|learn/i.test(query) ? "study" : /hi|hey|hello|sup/i.test(query) ? "greeting" : "general";
    const isComputer = (mode === "computer" || mode === "mun");
    const effortLvl = ["quick", "normal", "beast"].includes(effort) ? effort : "normal";

    const system = buildSystem(intent, mode, effortLvl, isComputer);
    const maxTokens = isComputer ? (effortLvl === "quick" ? 4096 : 8192) : (intent === "coding" ? 4096 : mode === "deepDive" ? 4096 : 2048);
    const temperature = 0.7;

    const enc = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        const send = (o: any) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        const delta = (t: string) => send({ choices: [{ delta: { content: t } }] });

        const abort = new AbortController();
        req.signal.addEventListener("abort", () => abort.abort());

        try {
          if (OR_KEYS.length === 0) {
            delta("**Error:** No API keys found. Set OPENROUTER_API_KEY in Supabase project settings.\n");
            send({ choices: [{ finish_reason: "stop", delta: {} }] });
            ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
            ctrl.close();
            return;
          }

          let convo = [{ role: "system", content: system }, ...messages];

          // ── Pre-fetch URL if user asked to visit a site ──
          let fetched = "";
          const urlMatch = query.match(/https?:\/\/[^\s]+/);
          if (isComputer && urlMatch) {
            delta(`Fetching ${urlMatch[0]}...\n\n`);
            fetched = await fetchUrlContent(urlMatch[0]);
            if (fetched.startsWith("Error")) {
              delta(`Could not fetch: ${fetched}\n\n`);
            } else {
              delta(`Got ${fetched.length} chars. Analyzing...\n\n`);
              convo = [
                { role: "system", content: system + "\n\nHere is the content from the URL the user asked about. Read it and respond based on what you find.\n\n--- PAGE CONTENT ---\n" + fetched + "\n--- END PAGE ---" },
                ...messages,
              ];
            }
          }

          delta(isComputer && !urlMatch ? "**Lumina Computer**\n\n" : "");
          send({ lumina_meta: { model: isComputer ? "computer" : "chat", intent, is_computer: isComputer, tier_target: "TIER_1" } });

          const { full: fullText } = await streamModel(convo, maxTokens, temperature, abort.signal, (chunk) => delta(chunk));

          if (isComputer && /FILE:/i.test(fullText) && !/\nEND FILE\s*$/.test(fullText.trimEnd())) {
            const closer = /<\/html>\s*$/i.test(fullText.trimEnd()) ? "\nEND FILE\n" : "\n</body>\n</html>\nEND FILE\n";
            delta(closer);
          }

          send({ choices: [{ finish_reason: "stop", delta: {} }] });
          ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
          ctrl.close();

        } catch (e) {
          if (abort.signal.aborted) { try { ctrl.close(); } catch {} return; }
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[chat]", msg);
          try { delta(`\n**Error:** ${msg}\n`); } catch {}
          try {
            send({ choices: [{ finish_reason: "stop", delta: {} }] });
            ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
            ctrl.close();
          } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });

  } catch (e) {
    console.error("[chat] fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
