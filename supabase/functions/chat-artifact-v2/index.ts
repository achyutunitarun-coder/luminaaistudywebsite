// chat-artifact-v2: queued artifact generation to avoid 150s request idle timeouts.
// POST returns { jobId, status: "queued" } immediately; the client polls artifact_jobs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callWithFallback, getModelsForArtifact, type ArtifactType } from "../_shared/models.ts";

declare const EdgeRuntime:
  | { waitUntil: (promise: Promise<unknown>) => void }
  | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Per-artifact model chains live in _shared/models.ts (getModelsForArtifact).
// This keeps routing centralised and consistent with the rest of the app.

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const JOB_BUDGET_MS = 115_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanHtml(raw: string): string {
  let h = (raw || "").trim();
  h = h.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (h.startsWith("```html")) h = h.slice(7);
  else if (h.startsWith("```")) h = h.slice(3);
  if (h.endsWith("```")) h = h.slice(0, -3);
  h = h.trim();
  const lower = h.toLowerCase();
  const dt = lower.indexOf("<!doctype");
  const ht = lower.indexOf("<html");
  if (dt > 0) h = h.slice(dt);
  else if (dt === -1 && ht > 0) h = h.slice(ht);
  return h.trim();
}

function validHtml(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    html.length > 600 &&
    (lower.includes("<!doctype") || lower.includes("<html"))
  );
}

function fallbackHtml(
  type: string,
  topic: string,
  errorHint = "The AI models were busy.",
) {
  const safeTopic = String(topic || "Study artifact").replace(
    /[<>&]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!,
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTopic} — Lumina ${type}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
:root{--bg:#050508;--surface:#0a0a0f;--card:rgba(255,255,255,.055);--border:rgba(255,255,255,.11);--primary:#14b8a6;--accent:#8b5cf6;--gold:#f59e0b;--text:rgba(255,255,255,.93);--muted:rgba(255,255,255,.55);font-family:Inter,system-ui,sans-serif}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 10%,rgba(20,184,166,.18),transparent 34%),radial-gradient(circle at 85% 20%,rgba(139,92,246,.18),transparent 28%),var(--bg);color:var(--text);line-height:1.7}.wrap{max-width:1120px;margin:0 auto;padding:56px 24px 80px}.hero{position:relative;overflow:hidden;border:1px solid var(--border);background:linear-gradient(135deg,rgba(255,255,255,.075),rgba(255,255,255,.025));border-radius:28px;padding:42px;box-shadow:0 28px 90px rgba(0,0,0,.45),inset 0 1px rgba(255,255,255,.12)}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);transform:translateX(-100%);animation:shine 1.6s ease-out forwards}@keyframes shine{to{transform:translateX(100%)}}h1{font-size:clamp(42px,8vw,92px);line-height:.95;margin:16px 0;font-weight:800;letter-spacing:-.04em}h2{margin:44px 0 18px;font-size:clamp(26px,4vw,44px);letter-spacing:-.025em}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.card{border:1px solid var(--border);border-radius:20px;background:var(--card);backdrop-filter:blur(18px);padding:22px;transition:.2s}.card:hover{transform:translateY(-3px);border-color:rgba(20,184,166,.5);box-shadow:0 0 30px rgba(20,184,166,.12)}.tag{display:inline-flex;border:1px solid rgba(20,184,166,.3);border-radius:999px;padding:7px 12px;color:#7dd3fc;background:rgba(20,184,166,.08);font:600 11px/1 JetBrains Mono,monospace;letter-spacing:.12em;text-transform:uppercase}.warn{border:1px solid rgba(245,158,11,.22);padding:16px 18px;background:rgba(245,158,11,.08);border-radius:18px;color:#fde68a}button{background:var(--primary);color:#04100f;border:0;border-radius:14px;padding:12px 18px;cursor:pointer;font-weight:700;transition:.2s}button:hover{transform:translateY(-2px);box-shadow:0 0 30px rgba(20,184,166,.3)}ol{padding-left:24px}.muted{color:var(--muted)}@media(max-width:700px){.wrap{padding:24px 14px}.hero{padding:26px;border-radius:22px}}</style>
</head>
<body>
<main class="wrap">
  <section class="hero"><span class="tag">Lumina recovered ${type}</span><h1>${safeTopic}</h1><p class="muted">The main generator hit a network budget, so Lumina built a complete safe version instead of leaving you with a broken spinner.</p></section>
  <h2>Core overview</h2><div class="grid"><div class="card"><strong>Definition</strong><p>${safeTopic} is the central topic. Identify its key terms, relationships, inputs, outputs, and exam expectations.</p></div><div class="card"><strong>Study strategy</strong><p>Use active recall: explain the idea, draw it once, solve one example, then correct gaps from memory.</p></div><div class="card"><strong>Exam focus</strong><p>Prioritize cause-effect chains, diagrams, command words, and common misconceptions.</p></div></div>
  <h2>Quick learning path</h2><ol><li>Write the main definition without notes.</li><li>List five non-obvious facts and connect each to an example.</li><li>Create one worked example, diagram, or mini-project.</li><li>Answer three practice questions under time pressure.</li><li>Teach the topic aloud in sixty seconds.</li></ol>
  <div class="warn"><strong>Recovery note:</strong> ${errorHint}. Regenerate for a deeper bespoke version when the model queue is clear.</div>
  <p><button onclick="window.print()">Print / Save</button></p>
</main>
</body>
</html>`;
}

function makeSystemPrompt(type: string, topic: string, provided: string) {
  const base =
    provided && provided.length > 200
      ? provided
      : `Generate a complete, beautiful, self-contained HTML ${type} artifact for ${topic}.`;
  return `${base}

CRITICAL OUTPUT CONTRACT:
- Return ONLY raw HTML. No markdown fences, no commentary, no <think> tags.
- Start with <!DOCTYPE html> and include <html>, <head>, <style>, and <body>.
- Keep it complete and interactive, but finish within one response.
- Prefer concise depth over huge unfinished output.`;
}

async function generateHtml(
  type: string,
  topic: string,
  userPrompt: string,
  systemPrompt: string,
): Promise<{ html: string; model?: string }> {
  const models = getModelsForArtifact((["notes","exam","slides","code"].includes(type) ? type : "notes") as ArtifactType);
  const started = Date.now();
  let lastErr = "";

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          model: type === "code" ? "openai/gpt-5.4-mini" : "google/gemini-3.5-flash",
          messages: [
            { role: "system", content: makeSystemPrompt(type, topic, systemPrompt) },
            { role: "user", content: `${userPrompt}\n\nProduce a complete, premium, self-contained HTML artifact. Keep it polished and finish the document.` },
          ],
          temperature: 0.35,
          max_tokens: type === "notes" ? 12000 : 14000,
        }),
        signal: AbortSignal.timeout(58_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? `lovable_gateway_${res.status}`);
      const cleaned = cleanHtml(data?.choices?.[0]?.message?.content ?? "");
      if (validHtml(cleaned)) return { html: cleaned, model: type === "code" ? "openai/gpt-5.4-mini" : "google/gemini-3.5-flash" };
      lastErr = cleaned ? "invalid_html_from_gateway" : "empty_from_gateway";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn("[artifact-job] Lovable AI gateway failed:", lastErr);
    }
  }

  // Keep the background task well below edge runtime limits; otherwise rows stay
  // stuck as "running" and the client times out forever.
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = JOB_BUDGET_MS - 15_000 - (Date.now() - started);
    if (remaining < 8_000) break;
    try {
      const { response, model } = await callWithFallback(
        [
          {
            role: "system",
            content: makeSystemPrompt(type, topic, systemPrompt),
          },
          {
            role: "user",
            content:
              attempt === 0
                ? userPrompt
                : `Create a focused, complete ${type} artifact about ${topic}. Keep it tight and finish in one response.`,
          },
        ],
        models,
        type === "notes" ? 9000 : 11000,
        0.45,
        Math.min(remaining, 42_000),
        `chat-artifact-v2/${type}`,
      );
      const data = await response.json();
      const cleaned = cleanHtml(data?.choices?.[0]?.message?.content ?? "");
      if (validHtml(cleaned)) return { html: cleaned, model };
      lastErr = cleaned ? "invalid_html_from_model" : "empty_from_model";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`[artifact-job] attempt ${attempt + 1} failed:`, lastErr);
    }
  }

  throw new Error(lastErr || "all_models_failed");
}

async function processJob(
  jobId: string,
  payload: {
    type: string;
    topic: string;
    userPrompt: string;
    systemPrompt: string;
  },
) {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  await admin
    .from("artifact_jobs")
    .update({ status: "running", error_message: null })
    .eq("id", jobId);

  try {
    const { html, model } = await Promise.race([
      generateHtml(payload.type, payload.topic, payload.userPrompt, payload.systemPrompt),
      sleep(JOB_BUDGET_MS).then(() => {
        throw new Error("artifact_generation_timeout");
      }),
    ]);
    await admin
      .from("artifact_jobs")
      .update({
        status: "completed",
        html,
        model_used: model ?? null,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[artifact-job:${jobId}] failed:`, msg);
    // Never leave the UI spinning or dead-ended: complete with a polished safe artifact.
    await admin
      .from("artifact_jobs")
      .update({
        status: "completed",
        html: fallbackHtml(payload.type, payload.topic, msg || "Generation recovered with a safe template"),
        model_used: "lumina-safe-template",
        error_message: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user)
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });

    const body = await req.json().catch(() => ({}));
    const type = String(body.type ?? "");
    const topic = String(body.topic ?? "").slice(0, 500);
    const userPrompt = String(
      body.userPrompt ?? `Generate the ${type} for: ${topic}`,
    ).slice(0, 12000);
    const systemPrompt = String(body.systemPrompt ?? "").slice(0, 20000);
    const chatId = body.chatId ? String(body.chatId) : null;

    if (
      !type ||
      !topic ||
      !["notes", "exam", "slides", "code"].includes(type)
    ) {
      return new Response(
        JSON.stringify({ error: "missing_or_invalid_fields" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: job, error } = await admin
      .from("artifact_jobs")
      .insert({
        user_id: user.id,
        chat_id: chatId,
        prompt: userPrompt,
        topic,
        artifact_type: type,
        status: "queued",
      })
      .select("id")
      .single();

    if (error || !job) {
      console.error("artifact job insert failed:", error);
      return new Response(JSON.stringify({ error: "failed_to_queue_job" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const work = processJob(job.id, { type, topic, userPrompt, systemPrompt });
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil)
      EdgeRuntime.waitUntil(work);
    else work.catch((e) => console.error("background artifact job failed", e));

    return new Response(JSON.stringify({ jobId: job.id, status: "queued" }), {
      status: 202,
      headers: jsonHeaders,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("chat-artifact-v2 error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
