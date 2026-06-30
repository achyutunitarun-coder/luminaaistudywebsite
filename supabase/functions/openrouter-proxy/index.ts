// ════════════════════════════════════════════════════════════════════
// OpenRouter Proxy — server-side key, client-side routing
// Streams SSE back. Handles universal fallback chain primary → openrouter/free
// → current fast free models with one retry after 800ms.
// ════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const FALLBACK_CHAIN = ["meta-llama/llama-3.3-70b-instruct:free", "openrouter/free", "openai/gpt-oss-20b:free"];

const ALL_KEYS: string[] = [
  Deno.env.get("OPENROUTER_API_KEY"),
  Deno.env.get("OPENROUTER_KEY_2"),
  Deno.env.get("OPENROUTER_KEY_3"),
  Deno.env.get("OPENROUTER_KEY_4"),
  Deno.env.get("OPENROUTER_KEY_5"),
  Deno.env.get("OPENROUTER_KEY_6"),
  Deno.env.get("OPENROUTER_KEY_7"),
].filter(Boolean) as string[];

if (ALL_KEYS.length === 0) console.error("[proxy] No OpenRouter keys configured");
console.log(`[proxy] ${ALL_KEYS.length} OpenRouter key(s) loaded`);

const KEY_COOLDOWN_MS = 45_000;
const KEY_BAD_COOLDOWN_MS = 10 * 60_000;
const _cooledUntil: number[] = ALL_KEYS.map(() => 0);
let _cursor = 0;

function nextHealthyKeyIndex(skip: Set<number> = new Set()): number {
  if (ALL_KEYS.length === 0) return -1;
  for (let step = 0; step < ALL_KEYS.length; step++) {
    const i = (_cursor + step) % ALL_KEYS.length;
    if (skip.has(i)) continue;
    if (_cooledUntil[i] <= Date.now()) {
      _cursor = (i + 1) % ALL_KEYS.length;
      return i;
    }
  }
  // All cooling — pick the one that recovers soonest and isn't skipped
  let best = -1, bestUntil = Infinity;
  for (let i = 0; i < ALL_KEYS.length; i++) {
    if (skip.has(i)) continue;
    if (_cooledUntil[i] < bestUntil) { best = i; bestUntil = _cooledUntil[i]; }
  }
  if (best === -1) best = _cursor;
  _cursor = (best + 1) % ALL_KEYS.length;
  return best;
}

function coolKey(i: number, ms: number, reason: string) {
  const until = Date.now() + ms;
  if (until > _cooledUntil[i]) _cooledUntil[i] = until;
  console.warn(`[proxy] key ${i + 1} cooled ${Math.round(ms / 1000)}s (${reason})`);
}

async function callOR(model: string, body: any, stream: boolean, keyIdx: number) {
  const key = ALL_KEYS[keyIdx];
  return fetch(OR_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://luminaai.co.in",
      "X-Title": "Lumina AI",
    },
    body: JSON.stringify({ ...body, model, stream, max_tokens: body.max_tokens ?? 4096 }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = await requireUser(req, cors);
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const { model, messages, stream = true, max_tokens, temperature, response_format } = body;
    if (!model || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "model + messages required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const payload: any = { messages, max_tokens, temperature, response_format };

    const chain = [model, ...FALLBACK_CHAIN.filter((m) => m !== model)];
    let lastErr = "";
    let usedModel = "";

    for (let i = 0; i < chain.length; i++) {
      const m = chain[i];
      // Try up to N keys for this model; rotate on 429/401/403/5xx
      const maxKeyAttempts = Math.min(ALL_KEYS.length, 3);
      const triedKeys = new Set<number>();
      let res: Response | null = null;
      let keyIdx = -1;
      for (let k = 0; k < maxKeyAttempts; k++) {
        keyIdx = nextHealthyKeyIndex(triedKeys);
        if (keyIdx < 0) { lastErr = "API key not configured"; break; }
        triedKeys.add(keyIdx);
        res = await callOR(m, payload, stream, keyIdx);
        if (res.ok) break;
        if (res.status === 429) {
          coolKey(keyIdx, KEY_COOLDOWN_MS, `429 on ${m}`);
          try { await res.body?.cancel(); } catch { /* */ }
          res = null;
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          coolKey(keyIdx, KEY_BAD_COOLDOWN_MS, `${res.status} auth`);
          try { await res.body?.cancel(); } catch { /* */ }
          res = null;
          continue;
        }
        if (res.status >= 500) {
          try { await res.body?.cancel(); } catch { /* */ }
          await new Promise((r) => setTimeout(r, 400));
          res = null;
          continue;
        }
        // 4xx other — model rejected the request; stop rotating keys, try next model
        break;
      }

      if (res && res.ok && res.body) {
        if (stream) {
          const meta = `data: ${JSON.stringify({ lumina_meta: { model: m, fallback: i > 0, key: keyIdx + 1 } })}\n\n`;
          const reader = res.body.getReader();
          const out = new ReadableStream({
            async start(ctrl) {
              ctrl.enqueue(new TextEncoder().encode(meta));
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                ctrl.enqueue(value);
              }
              ctrl.close();
            },
          });
          return new Response(out, {
            headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
          });
        }
        const data = await res.json();
        return new Response(JSON.stringify({ ...data, lumina_meta: { model: m, fallback: i > 0, key: keyIdx + 1 } }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (res) lastErr = `${res.status} ${await res.text().catch(() => "")}`.slice(0, 200);
    }

    return new Response(JSON.stringify({ error: "All models failed", detail: lastErr }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
