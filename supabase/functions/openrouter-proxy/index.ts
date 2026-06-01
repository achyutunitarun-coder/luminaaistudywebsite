// ════════════════════════════════════════════════════════════════════
// OpenRouter Proxy — server-side key, client-side routing
// Streams SSE back. Handles universal fallback chain primary → openrouter/free
// → deepseek-v4-flash with one retry after 800ms.
// ════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const FALLBACK_CHAIN = ["openrouter/free", "deepseek/deepseek-v4-flash:free"];

function pickKey(): string {
  const keys = [
    Deno.env.get("OPENROUTER_API_KEY"),
    Deno.env.get("OPENROUTER_KEY_2"),
    Deno.env.get("OPENROUTER_KEY_3"),
  ].filter(Boolean) as string[];
  if (keys.length === 0) throw new Error("No OpenRouter key configured");
  return keys[Math.floor(Math.random() * keys.length)];
}

async function callOR(model: string, body: any, stream: boolean) {
  const key = pickKey();
  return fetch(OR_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://luminaai.co.in",
      "X-Title": "Lumina",
    },
    body: JSON.stringify({ ...body, model, stream, max_tokens: body.max_tokens ?? 4096 }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = await requireUser(req);
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
      let res = await callOR(m, payload, stream);
      if (!res.ok && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 800));
        res = await callOR(m, payload, stream);
      }
      if (res.ok && res.body) {
        usedModel = m;
        if (stream) {
          // Inject a meta event so client can show "Switched to backup model" toast.
          const meta = `data: ${JSON.stringify({ lumina_meta: { model: m, fallback: i > 0 } })}\n\n`;
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
        return new Response(JSON.stringify({ ...data, lumina_meta: { model: m, fallback: i > 0 } }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      lastErr = `${res.status} ${await res.text().catch(() => "")}`.slice(0, 200);
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
