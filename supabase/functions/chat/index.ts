import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const OR_KEYS = [
  Deno.env.get("OPENROUTER_API_KEY"),
  Deno.env.get("OPENROUTER_KEY_2"),
  Deno.env.get("OPENROUTER_KEY_3"),
  Deno.env.get("OPENROUTER_KEY_4"),
  Deno.env.get("OPENROUTER_KEY_5"),
  Deno.env.get("OPENROUTER_KEY_6"),
  Deno.env.get("OPENROUTER_KEY_7"),
].filter(Boolean) as string[];

const CHAIN = ["meta-llama/llama-3.3-70b-instruct:free", "openai/gpt-oss-20b:free", "qwen/qwen3-coder:free"];

let _cursor = 0;
const _cooldown: number[] = OR_KEYS.map(() => 0);

function nextKey(): number {
  const now = Date.now();
  for (let i = 0; i < OR_KEYS.length; i++) {
    const idx = (_cursor + i) % OR_KEYS.length;
    if (_cooldown[idx] <= now) { _cursor = (idx + 1) % OR_KEYS.length; return idx; }
  }
  return 0;
}

async function* streamGen(messages: any[], maxTokens: number, temperature: number, signal: AbortSignal) {
  if (OR_KEYS.length === 0) { yield "[ERROR] No API keys configured.\n"; return; }

  for (const model of CHAIN) {
    for (let attempt = 0; attempt < Math.min(OR_KEYS.length, 3) && !signal.aborted; attempt++) {
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
          body: JSON.stringify({ model, messages, stream: true, max_tokens: maxTokens, temperature: 0.7, top_p: 0.95 }),
          signal,
        });

        if (res.status === 429) { _cooldown[keyIdx] = Date.now() + 45_000; continue; }
        if (res.status === 401 || res.status === 403) { _cooldown[keyIdx] = Date.now() + 600_000; continue; }
        if (!res.ok) { yield `[ERROR] HTTP ${res.status}\n`; continue; }

        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
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
              if (typeof d === "string" && d) yield d;
            } catch {
              buf = line.slice(6) + "\n" + buf;
              break;
            }
          }
        }
        return;
      } catch (e) {
        if (signal.aborted) { yield "[ABORTED]\n"; return; }
        yield `[RETRY] ${e instanceof Error ? e.message : String(e)}\n`;
      }
    }
  }
  yield "[ERROR] All models exhausted.\n";
}

const COMPUTER_PROMPT = `You are Lumina Computer. You help with research, code, documents, and multi-step tasks. Voice: direct and capable. Use FILE: blocks for files, markdown for reports. Never truncate output.`;

function buildSystem(intent: string, mode: string, effort: string, isComputer: boolean): string {
  if (isComputer) return `${COMPUTER_PROMPT}\nEffort: ${effort}`;
  const base = `You are Lumina AI, an elite study assistant. Format beautifully with markdown headings, bold terms, lists, and code blocks. Write like a great teacher.`;
  if (intent === "coding") return `${base}\nProvide working code with explanation.`;
  if (intent === "study") return `${base}\nExplain with examples and analogies.`;
  if (intent === "greeting") return `${base}\nBe warm and brief.`;
  return base;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ue } = await sb.auth.getUser();
    if (ue || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

    const body = JSON.parse(await req.text());
    const { messages, mode, effort } = body;
    if (!Array.isArray(messages)) return new Response(JSON.stringify({ error: "Invalid messages" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });

    const isComputer = mode === "computer" || mode === "mun";
    const effortLvl = ["quick", "normal", "beast"].includes(effort) ? effort : "normal";
    const query = messages.filter((m: any) => m.role === "user").pop()?.content || "";
    const intent = /code|build|create|app|website/i.test(query) ? "coding" : /explain|what|how|why|teach|learn/i.test(query) ? "study" : "general";
    const system = buildSystem(intent, mode, effortLvl, isComputer);
    const maxTokens = isComputer ? (effortLvl === "quick" ? 8192 : 16384) : 4096;

    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        const send = (o: any) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        const delta = (t: string) => send({ choices: [{ delta: { content: t } }] });
        const abort = new AbortController();
        req.signal.addEventListener("abort", () => abort.abort());

        try {
          send({ lumina_meta: { model: isComputer ? "computer" : "chat", intent, is_computer: isComputer } });

          if (OR_KEYS.length === 0) {
            delta("**Error:** No API keys. Set OPENROUTER_API_KEY in Supabase.\n");
          } else {
            const convo = [{ role: "system", content: system }, ...messages];
            for await (const chunk of streamGen(convo, maxTokens, 0.7, abort.signal)) {
              delta(chunk);
            }
          }
        } catch (e) {
          delta(`\n**Error:** ${e instanceof Error ? e.message : String(e)}\n`);
        }
        send({ choices: [{ finish_reason: "stop", delta: {} }] });
        ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
        ctrl.close();
      },
    });

    return new Response(stream, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
