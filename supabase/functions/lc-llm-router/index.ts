// Lumina Computer — role-based, cooldown-aware, streaming router.
// The ONLY function that talks to OpenRouter. Server-side key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";

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
      return new Response(JSON.stringify({ error: "role + prompt required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: `no routing for role ${role}` }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const candidates = [routing.primary_model_id, ...(routing.fallback_model_ids ?? [])];

    // 2. Drop cooling models
    const { data: cd } = await admin
      .from("lc_model_cooldowns")
      .select("model_id")
      .gt("cooldown_until", new Date().toISOString());
    const cooling = new Set((cd ?? []).map((c) => c.model_id));
    const usable = candidates.filter((m) => !cooling.has(m));
    const chain = usable.length ? usable : candidates;

    const messages = [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ];

    const errors: string[] = [];

    // 3. Try each candidate
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

        // Streaming passthrough with meta header and terminal log
        const reader = upstream.body.getReader();
        const enc = new TextEncoder();
        const meta = `data: ${JSON.stringify({ lumina_meta: { model, fallback: i > 0, role } })}\n\n`;

        const out = new ReadableStream({
          async start(ctrl) {
            ctrl.enqueue(enc.encode(meta));
            let ok = true;
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                ctrl.enqueue(value);
              }
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

    return new Response(JSON.stringify({ error: "all_candidates_failed", details: errors }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
