// Lumina Computer — role-based, cooldown-aware, streaming router.
// The ONLY function that talks to OpenRouter. Server-side key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";
import { detectTruncation } from "../_shared/truncation-guard.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";

const KEYS = [
  Deno.env.get("OPENROUTER_API_KEY"),
  Deno.env.get("OPENROUTER_KEY_2"),
  Deno.env.get("OPENROUTER_KEY_3"),
  Deno.env.get("OPENROUTER_KEY_4"),
  Deno.env.get("OPENROUTER_KEY_5"),
  Deno.env.get("OPENROUTER_KEY_6"),
  Deno.env.get("OPENROUTER_KEY_7"),
].filter(Boolean) as string[];

let keyCursor = 0;
function nextKey() {
  if (KEYS.length === 0) return null;
  const k = KEYS[keyCursor % KEYS.length];
  keyCursor++;
  return k;
}

function normalizeModelId(model: string) {
  return model;
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function streamFailure(error: string, detail?: string) {
  const enc = new TextEncoder();
  const out = new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ lumina_error: error, detail })}\n\n`));
      ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      ctrl.close();
    },
  });
  return new Response(out, {
    headers: {
      ...cors,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = await requireUser(req, cors);
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const {
      role,
      project_id,
      block_id,
      prompt,
      system,
      max_tokens = 2400,
      temperature,
      stream = true,
      response_format,
    } = body;

    if (!role || !prompt) {
      return jsonResponse({ error: "role + prompt required", fallback: false }, 400);
    }

    if (KEYS.length === 0) {
      return stream
        ? streamFailure("router_unavailable", "No model keys are configured")
        : jsonResponse({ content: "", error: "router_unavailable", fallback: true, model_used: null });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Load routing
    const { data: routing } = await admin
      .from("lc_model_routing")
      .select("primary_model_id, fallback_model_ids")
      .eq("role", role)
      .single();

    if (!routing) {
      return jsonResponse({ error: `no routing for role ${role}`, fallback: false }, 400);
    }

    const candidates = [routing.primary_model_id, ...(routing.fallback_model_ids ?? [])]
      .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
      .map(normalizeModelId);

    // 2. Drop cooling models
    const { data: cd } = await admin
      .from("lc_model_cooldowns")
      .select("model_id")
      .gt("cooldown_until", new Date().toISOString());
    const cooling = new Set((cd ?? []).map((c) => c.model_id));
    const usable = candidates.filter((m) => !cooling.has(m));
    let chain = usable.length ? usable : candidates;

    // 2b. Hardcoded last‑resort models when routing table is empty
    if (chain.length === 0) {
      chain = [
        "nvidia/nemotron-3-ultra-550b-a55b:free",
        "nvidia/nemotron-3-super-120b-a12b:free",
        "openai/gpt-oss-20b:free",
        "google/gemma-4-31b-it:free",
      ];
    }

    const messages = [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ];

    const errors: string[] = [];

    for (let i = 0; i < chain.length; i++) {
      const model = chain[i];
      const start = Date.now();
      const key = nextKey();
      if (!key) {
        errors.push("No API keys configured");
        break;
      }

      try {
        const upstream = await fetch(OR_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://luminaai.co.in",
            "X-Title": "Lumina Computer",
          },
          body: JSON.stringify({
            model,
            messages,
            stream,
            max_tokens,
            ...(temperature !== undefined ? { temperature } : {}),
            ...(response_format ? { response_format } : {}),
          }),
        });

        if (upstream.status === 429) {
          await admin.from("lc_model_cooldowns").upsert({
            model_id: model,
            cooldown_until: new Date(Date.now() + 60_000).toISOString(),
            reason: "429",
          });
          await admin.from("lc_generation_log").insert({
            project_id, block_id, role, model_id: model, success: false,
            latency_ms: Date.now() - start, error_text: "429",
          });
          errors.push(`${model}: 429 Rate Limit`);
          try { await upstream.body?.cancel(); } catch { /* */ }
          continue;
        }
        if (!upstream.ok || !upstream.body) {
          const errTxt = (await upstream.text().catch(() => "")).slice(0, 200);
          await admin.from("lc_generation_log").insert({
            project_id, block_id, role, model_id: model, success: false,
            latency_ms: Date.now() - start, error_text: `${upstream.status} ${errTxt}`,
          });
          errors.push(`${model}: ${upstream.status} ${errTxt}`);
          continue;
        }

        if (!stream) {
          const data = await upstream.json();
          const content = data.choices?.[0]?.message?.content ?? "";
          await admin.from("lc_generation_log").insert({
            project_id, block_id, role, model_id: model, success: true,
            latency_ms: Date.now() - start,
          });
          return new Response(
            JSON.stringify({ content, model_used: model, fallback: i > 0 }),
            { headers: { ...cors, "Content-Type": "application/json" } },
          );
        }

        // Streaming passthrough with meta header, truncation detection, and auto-continuation
        const reader = upstream.body.getReader();
        const enc = new TextEncoder();
        const decoder = new TextDecoder();
        const meta = `data: ${JSON.stringify({ lumina_meta: { model, fallback: i > 0, role } })}\n\n`;
        const CONTINUATION_PROMPT =
          "Continue exactly where you left off. Do NOT repeat anything already written. Do NOT summarize. Resume mid-sentence, mid-code, or mid-JSON if needed. Output ONLY the direct continuation — no prefixes, no explanations.";
        const MAX_CONTINUATIONS = 4;
        const callTokens = Math.max(2000, Math.min(max_tokens ?? 2400, 8000));

        // Relay one upstream SSE stream to the client while tracking content + finish_reason.
        const relay = async (
          resp: Response,
          ctrl: ReadableStreamDefaultController<Uint8Array>,
          onDelta: (d: string) => void,
          onFinish: (fr: string) => void,
        ): Promise<void> => {
          const r = resp.body!.getReader();
          let buf = "";
          while (true) {
            const { done, value } = await r.read();
            if (done) break;
            ctrl.enqueue(value);
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const raw of lines) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                const delta = j?.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta.length) onDelta(delta);
                const fr = j?.choices?.[0]?.finish_reason;
                if (fr) onFinish(fr);
              } catch { /* ignore malformed */ }
            }
          }
        };

        const out = new ReadableStream({
          async start(ctrl) {
            ctrl.enqueue(enc.encode(meta));
            let ok = true;
            try {
              let currentResponse = upstream;
              let accumulated = "";
              let finishReason: string | null = null;
              let contRound = 0;
              while (contRound <= MAX_CONTINUATIONS) {
                await relay(currentResponse, ctrl, (d) => { accumulated += d; }, (fr) => { finishReason = fr; });

                const trunc = detectTruncation(accumulated, finishReason, {
                  structural: true,
                  content: true,
                });

                if (!trunc.truncated || contRound >= MAX_CONTINUATIONS) break;
                contRound++;

                const contMessages = [
                  ...messages,
                  { role: "assistant", content: accumulated },
                  { role: "user", content: CONTINUATION_PROMPT },
                ];
                const contKey = nextKey();
                if (!contKey) break;
                const contResp = await fetch(OR_URL, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${contKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://luminaai.co.in",
                    "X-Title": "Lumina Computer",
                  },
                  body: JSON.stringify({
                    model,
                    messages: contMessages,
                    stream: true,
                    max_tokens: callTokens,
                    temperature: 0.5,
                  }),
                });
                if (!contResp.ok || !contResp.body) break;
                currentResponse = contResp;
              }
              ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
            } catch (e) {
              ok = false;
              ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ lumina_error: String(e) })}\n\n`));
            } finally {
              await admin.from("lc_generation_log").insert({
                project_id, block_id, role, model_id: model, success: ok,
                latency_ms: Date.now() - start,
                error_text: ok ? null : "stream_error",
              });
              ctrl.close();
            }
          },
        });
        return new Response(out, {
          headers: {
            ...cors,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
          },
        });
      } catch (e) {
        await admin.from("lc_generation_log").insert({
          project_id, block_id, role, model_id: model, success: false,
          latency_ms: Date.now() - start, error_text: String(e).slice(0, 200),
        });
        errors.push(`${model}: ${String(e).slice(0, 100)}`);
      }
    }

    // 4. Last‑resort: try one more model directly when all routing models have failed
    //    (only applies when we actually have keys — not when KEYS is empty)
    const LAST_RESORT_MODELS = stream
      ? ["nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3-super-120b-a12b:free"]
      : ["nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3-super-120b-a12b:free"];
    for (const lastModel of LAST_RESORT_MODELS) {
      if (!chain.includes(lastModel)) {
        const key = nextKey();
        if (!key) break;
        try {
          const up = await fetch(OR_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://luminaai.co.in",
              "X-Title": "Lumina Computer (last-resort)",
            },
            body: JSON.stringify({
              model: lastModel,
              messages,
              stream: false,
              max_tokens: Math.min(max_tokens, 1200),
              ...(temperature !== undefined ? { temperature: 0.5 } : {}),
            }),
          });
          if (up.ok) {
            const data = await up.json();
            const content = data.choices?.[0]?.message?.content ?? "";
            if (content.trim().length > 10) {
              await admin.from("lc_generation_log").insert({
                project_id, block_id, role, model_id: lastModel, success: true,
                latency_ms: Date.now() - (errors.length ? 0 : Date.now()),
              });
              if (stream) {
                const enc = new TextEncoder();
                const out = new ReadableStream({
                  start(ctrl) {
                    ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ lumina_meta: { model: lastModel, fallback: true, role, last_resort: true } })}\n\n`));
                    ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
                    ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
                    ctrl.close();
                  },
                });
                return new Response(out, {
                  headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
                });
              }
              return new Response(
                JSON.stringify({ content, model_used: lastModel, fallback: true, last_resort: true }),
                { headers: { ...cors, "Content-Type": "application/json" } },
              );
            }
          }
        } catch { /* last resort failed too, nothing we can do */ }
      }
    }

    return stream
      ? streamFailure("all_candidates_failed", errors.slice(0, 5).join(" | "))
      : jsonResponse({ content: "", error: "all_candidates_failed", details: errors, fallback: true, model_used: null });
  } catch (e) {
    return jsonResponse({ error: "router_exception", detail: String(e), fallback: true });
  }
});
