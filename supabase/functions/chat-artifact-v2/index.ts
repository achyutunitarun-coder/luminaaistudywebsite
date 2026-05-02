// chat-artifact-v2: queued artifact generation to avoid 150s request idle timeouts.
// POST returns { jobId, status: "queued" } immediately; the client polls artifact_jobs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callWithFallback } from "../_shared/models.ts";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HTML_MODELS = [
  "openai/gpt-oss-120b:free",
  "qwen/qwen3-coder:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "openai/gpt-oss-20b:free",
];

const CODE_MODELS = [
  "qwen/qwen3-coder:free",
  "openai/gpt-oss-120b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-20b:free",
];

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

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
  return html.length > 600 && (lower.includes("<!doctype") || lower.includes("<html"));
}

function fallbackHtml(type: string, topic: string, errorHint = "The AI models were busy.") {
  const safeTopic = String(topic || "Study artifact").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTopic} — Lumina ${type}</title>
<style>
:root{--bg:#0f1117;--surface:#161b27;--card:#1c2333;--border:#2a3449;--primary:#6366f1;--accent:#a78bfa;--text:#e5e7eb;--muted:#94a3b8;--green:#4ade80;--yellow:#fbbf24;--red:#f87171;font-family:Inter,system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);line-height:1.65}.wrap{max-width:960px;margin:0 auto;padding:48px 22px}.hero{border:1px solid var(--border);background:linear-gradient(135deg,var(--surface),var(--card));border-radius:18px;padding:32px}h1{font-size:clamp(34px,6vw,68px);line-height:1;margin:0 0 12px}h2{margin-top:32px;color:var(--accent)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.card{border:1px solid var(--border);border-radius:14px;background:var(--card);padding:18px}.tag{display:inline-flex;border:1px solid var(--border);border-radius:999px;padding:6px 10px;color:var(--muted);font-size:12px}.warn{border-left:4px solid var(--yellow);padding:14px;background:rgba(251,191,36,.08);border-radius:10px}button{background:var(--primary);color:white;border:0;border-radius:10px;padding:10px 14px;cursor:pointer}</style>
</head>
<body>
<main class="wrap">
  <section class="hero"><span class="tag">Lumina ${type}</span><h1>${safeTopic}</h1><p>This artifact was recovered with a fast safe template because the generation network stalled. You were not charged unless the app confirmed success.</p></section>
  <h2>Core overview</h2><div class="grid"><div class="card"><strong>Definition</strong><p>${safeTopic} is the central topic. Start by identifying the key terms, relationships, and exam expectations.</p></div><div class="card"><strong>How to study it</strong><p>Build a concept map, practise active recall, and explain the process in your own words.</p></div><div class="card"><strong>Exam focus</strong><p>Look for cause-effect chains, common misconceptions, diagrams, and short-answer wording.</p></div></div>
  <h2>Quick learning path</h2><ol><li>Write the main definition from memory.</li><li>List 5 key facts.</li><li>Create one worked example or diagram.</li><li>Answer 3 practice questions without notes.</li></ol>
  <div class="warn"><strong>Status:</strong> ${errorHint}. Try regenerating for a richer custom version.</div>
  <p><button onclick="window.print()">Print / Save</button></p>
</main>
</body>
</html>`;
}

function makeSystemPrompt(type: string, topic: string, provided: string) {
  const base = provided && provided.length > 200 ? provided : `Generate a complete, beautiful, self-contained HTML ${type} artifact for ${topic}.`;
  return `${base}

CRITICAL OUTPUT CONTRACT:
- Return ONLY raw HTML. No markdown fences, no commentary, no <think> tags.
- Start with <!DOCTYPE html> and include <html>, <head>, <style>, and <body>.
- Keep it complete and interactive, but finish within one response.
- Prefer concise depth over huge unfinished output.`;
}

async function generateHtml(type: string, topic: string, userPrompt: string, systemPrompt: string): Promise<{ html: string; model?: string }> {
  const models = type === "code" ? CODE_MODELS : HTML_MODELS;
  const started = Date.now();
  let lastErr = "";

  // Two high-quality attempts max. waitUntil prevents browser timeout; this cap prevents runaway workers.
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = 135_000 - (Date.now() - started);
    if (remaining < 18_000) break;
    try {
      const { response, model } = await callWithFallback(
        [
          { role: "system", content: makeSystemPrompt(type, topic, systemPrompt) },
          { role: "user", content: attempt === 0 ? userPrompt : `Create a focused complete ${type} artifact about ${topic}.` },
        ],
        models,
        type === "notes" ? 9000 : 12000,
        0.45,
        Math.min(remaining, 95_000),
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

async function processJob(jobId: string, payload: { type: string; topic: string; userPrompt: string; systemPrompt: string }) {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  await admin.from("artifact_jobs").update({ status: "running", error_message: null }).eq("id", jobId);

  try {
    const { html, model } = await generateHtml(payload.type, payload.topic, payload.userPrompt, payload.systemPrompt);
    await admin.from("artifact_jobs").update({
      status: "completed",
      html,
      model_used: model ?? null,
      completed_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[artifact-job:${jobId}] failed:`, msg);
    // Mark failed instead of leaving the UI spinning. Do not charge credits client-side.
    await admin.from("artifact_jobs").update({
      status: "failed",
      error_message: msg || "generation_failed",
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonHeaders });

    const body = await req.json().catch(() => ({}));
    const type = String(body.type ?? "");
    const topic = String(body.topic ?? "").slice(0, 500);
    const userPrompt = String(body.userPrompt ?? `Generate the ${type} for: ${topic}`).slice(0, 12000);
    const systemPrompt = String(body.systemPrompt ?? "").slice(0, 20000);
    const chatId = body.chatId ? String(body.chatId) : null;

    if (!type || !topic || !["notes", "exam", "slides", "code"].includes(type)) {
      return new Response(JSON.stringify({ error: "missing_or_invalid_fields" }), { status: 400, headers: jsonHeaders });
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
      return new Response(JSON.stringify({ error: "failed_to_queue_job" }), { status: 500, headers: jsonHeaders });
    }

    const work = processJob(job.id, { type, topic, userPrompt, systemPrompt });
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
    else work.catch((e) => console.error("background artifact job failed", e));

    return new Response(JSON.stringify({ jobId: job.id, status: "queued" }), { status: 202, headers: jsonHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("chat-artifact-v2 error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: jsonHeaders });
  }
});
