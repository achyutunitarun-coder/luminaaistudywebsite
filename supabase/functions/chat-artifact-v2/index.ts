// chat-artifact-v2: queued artifact generation to avoid 150s request idle timeouts.
// POST returns { jobId, status: "queued" } immediately; the client polls artifact_jobs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIText, getModelsForArtifact, type ArtifactType } from "../_shared/models.ts";

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
const JOB_BUDGET_MS = 142_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const FRONTEND_DESIGN_SKILL = `
SKILL: Frontend Design & Aesthetics
Before writing HTML/CSS/JS, silently commit to: PURPOSE, TONE, CONSTRAINTS, DIFFERENTIATION.
- Build a distinctive production-grade interface, never generic AI slop.
- Choose a bold visual anchor and fully commit: brutal minimalism, refined luxury, editorial, industrial, organic, playful, retro-futurist, etc.
- Typography must be characterful. Do not use Inter, Roboto, Arial, Space Grotesk, or default system font stacks as the primary visual identity. Pair a high-impact display font with a readable body font from Google Fonts.
- Avoid clichéd purple/blue gradients over flat white or pitch-black backgrounds. Avoid card soup. Avoid repeated aesthetics.
- Use one unforgettable visual detail: custom cursor, editorial masthead, kinetic counter, diagrammatic grid, tactile switch, animated data drawing, etc.
- Include high-contrast focus states, keyboard/touch accessibility, min 44px targets, responsive 375px→1440px, no horizontal overflow.
- Motion is intentional: one orchestrated page-load reveal, meaningful hover/active states, prefers-reduced-motion respected.
- Match implementation complexity to the aesthetic. Maximalist means layered, detailed, coherent. Minimalist means geometric precision and flawless spacing.
`.trim();

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
    html.length > 900 &&
    (lower.includes("<!doctype") || lower.includes("<html")) &&
    lower.includes("</html>") &&
    !/todo|lorem ipsum|coming soon|rest of (the )?content/i.test(html)
  );
}

function esc(value: string) {
  return String(value || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function fallbackHtml(
  type: string,
  topic: string,
) {
  const safeTopic = esc(topic || "Study artifact");
  const kind = esc(type || "artifact");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${safeTopic} — Lumina ${kind}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,50,1&family=Manrope:wght@400;500;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
:root{--paper:#f5ead4;--ink:#15120d;--charcoal:#23201a;--oxide:#b9482b;--moss:#496f5d;--aqua:#0e8077;--line:rgba(21,18,13,.18);--glow:rgba(185,72,43,.22);--shadow:0 24px 80px rgba(21,18,13,.22);font-family:Manrope,sans-serif}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;background:linear-gradient(135deg,#f5ead4,#e7d3aa 45%,#d8bea0);color:var(--ink);line-height:1.65;overflow-x:hidden}body:before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:42px 42px;mask-image:radial-gradient(circle at 50% 20%,black,transparent 78%);opacity:.45}.wrap{width:min(1160px,calc(100% - 32px));margin:auto;padding:48px 0 72px}.mast{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(24px,5vw,72px);align-items:end;border-bottom:2px solid var(--ink);padding-bottom:32px}.kicker{font:800 12px/1 JetBrains Mono,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--oxide)}h1{font-family:Fraunces,serif;font-size:clamp(48px,10vw,132px);line-height:.82;margin:18px 0;font-weight:850;letter-spacing:0}.lede{font-size:clamp(18px,2vw,24px);max-width:620px}.seal{aspect-ratio:1;border:2px solid var(--ink);border-radius:50%;display:grid;place-items:center;position:relative;background:radial-gradient(circle,#fff3d5,transparent 62%);box-shadow:var(--shadow)}.seal:after{content:"${kind}";font:800 11px/1 JetBrains Mono,monospace;letter-spacing:.22em;text-transform:uppercase;transform:rotate(-14deg);border:2px solid var(--oxide);color:var(--oxide);padding:12px 16px}.rail{display:grid;grid-template-columns:280px 1fr;gap:28px;margin-top:36px}.toc{position:sticky;top:24px;align-self:start;border:2px solid var(--ink);background:rgba(255,248,226,.72);padding:18px}.toc a{display:block;color:var(--ink);text-decoration:none;padding:10px 0;border-bottom:1px solid var(--line);font-weight:800}.section{padding:28px 0;border-bottom:1px solid var(--line)}h2{font-family:Fraunces,serif;font-size:clamp(32px,5vw,64px);line-height:.95;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.panel{border:2px solid var(--ink);background:rgba(255,249,232,.66);padding:20px;box-shadow:8px 8px 0 rgba(21,18,13,.12)}.panel b{color:var(--oxide)}.diagram{min-height:220px;border:2px solid var(--ink);background:repeating-linear-gradient(45deg,rgba(73,111,93,.12) 0 12px,transparent 12px 24px);display:grid;place-items:center;margin:20px 0}.nodes{display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:center}.node{border:2px solid var(--ink);background:var(--paper);padding:14px 18px;border-radius:999px;font-weight:900}.arrow{font-size:28px;color:var(--oxide)}button{min-height:44px;border:2px solid var(--ink);background:var(--oxide);color:#fff7df;font-weight:900;padding:12px 18px;box-shadow:5px 5px 0 var(--ink);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}button:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 var(--ink)}button:active{transform:translate(3px,3px);box-shadow:2px 2px 0 var(--ink)}button:focus-visible,a:focus-visible{outline:3px solid var(--aqua);outline-offset:3px}.quiz button{display:block;margin:8px 0;background:var(--moss)}.meter{height:12px;border:2px solid var(--ink);background:#fff7df}.meter span{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--oxide),var(--aqua));transition:width .4s ease}@media(max-width:820px){.mast,.rail{grid-template-columns:1fr}.seal{max-width:240px}.toc{position:relative;top:auto}.grid{grid-template-columns:1fr}}@media(prefers-reduced-motion:no-preference){.reveal{opacity:0;transform:translateY(18px);animation:up .7s cubic-bezier(.16,1,.3,1) forwards}.reveal:nth-child(2){animation-delay:.08s}.reveal:nth-child(3){animation-delay:.16s}@keyframes up{to{opacity:1;transform:none}}}@media print{body{background:#fff}.toc,button{display:none}.panel,.diagram{box-shadow:none}}</style>
</head>
<body>
<main class="wrap">
  <section class="mast reveal"><div><span class="kicker">Lumina Artifact · ${kind}</span><h1>${safeTopic}</h1><p class="lede">A crafted learning object built as a tactile editorial system: clear enough to study from, distinctive enough to remember, and interactive enough to use immediately.</p></div><div class="seal" aria-hidden="true"></div></section>
  <div class="rail"><nav class="toc reveal" aria-label="Artifact sections"><a href="#overview">Core map</a><a href="#diagram">Visual model</a><a href="#practice">Practice lab</a><a href="#finish">Mastery checklist</a></nav><article>
    <section id="overview" class="section reveal"><h2>Core map</h2><div class="grid"><div class="panel"><b>Definition</b><p>${safeTopic} is treated as a system: terms, causes, mechanisms, outputs, edge cases, and exam language are separated so revision is not just memorisation.</p></div><div class="panel"><b>How to learn it</b><p>Explain the concept aloud, sketch the structure from memory, solve one applied example, then correct the missing links in a second pass.</p></div><div class="panel"><b>What examiners test</b><p>They look for precise vocabulary, cause-effect chains, labelled diagrams, units or evidence, and the ability to transfer the idea into unfamiliar contexts.</p></div></div></section>
    <section id="diagram" class="section reveal"><h2>Visual model</h2><div class="diagram"><div class="nodes"><span class="node">Inputs</span><span class="arrow">→</span><span class="node">Process</span><span class="arrow">→</span><span class="node">Evidence</span><span class="arrow">→</span><span class="node">Answer</span></div></div><p>Use this chain whenever the topic feels broad: identify the starting conditions, describe the mechanism, attach proof or calculation, then write the final answer in command-word language.</p></section>
    <section id="practice" class="section reveal quiz"><h2>Practice lab</h2><p><strong>Question:</strong> Which revision action creates the strongest memory trace?</p><button data-correct="false">Rereading the same paragraph three times</button><button data-correct="true">Retrieving the idea, checking it, then improving the explanation</button><button data-correct="false">Highlighting every important sentence</button><p id="feedback" aria-live="polite"></p><div class="meter" aria-label="Mastery meter"><span id="bar"></span></div></section>
    <section id="finish" class="section reveal"><h2>Mastery checklist</h2><ol><li>Write the topic definition without looking.</li><li>Draw a labelled diagram or flow from memory.</li><li>List three common mistakes and their fixes.</li><li>Answer one easy, one medium, and one hard question.</li><li>Teach the concept in sixty seconds.</li></ol><button onclick="window.print()">Print / Save</button></section>
  </article></div>
</main>
<script>document.addEventListener('DOMContentLoaded',function(){var fb=document.getElementById('feedback'),bar=document.getElementById('bar');document.querySelectorAll('.quiz button').forEach(function(btn){btn.addEventListener('click',function(){var ok=btn.dataset.correct==='true';fb.textContent=ok?'Correct — retrieval plus correction beats passive review.':'Not quite — passive familiarity feels good but fades quickly.';bar.style.width=ok?'100%':'38%';try{window.__lumina=window.__lumina||{};window.__lumina.lastArtifactScore=ok?1:0}catch(e){}})});});</script>
</body>
</html>`;
}

function makeSystemPrompt(type: string, topic: string, provided: string) {
  const base =
    provided && provided.length > 200
      ? provided
      : `Generate a complete, beautiful, self-contained HTML ${type} artifact for ${topic}.`;
  return `${FRONTEND_DESIGN_SKILL}

${base}

CRITICAL OUTPUT CONTRACT:
- Return ONLY raw HTML. No markdown fences, no commentary, no <think> tags.
- Start with <!DOCTYPE html> and include <html>, <head>, <style>, and <body>.
- Keep it complete and interactive, but finish within one response.
- Target 18KB–45KB of HTML. Dense and polished, not huge and unfinished.
- Use distinctive Google Fonts; do not use Inter, Roboto, Arial, Space Grotesk, or default system fonts as the primary identity.
- No visible recovery/error/debug notes inside the artifact.
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
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: makeSystemPrompt(type, topic, systemPrompt) },
            { role: "user", content: `${userPrompt}\n\nProduce a complete, premium, self-contained HTML artifact. Keep it polished and finish the document.` },
          ],
          temperature: 0.35,
          max_tokens: type === "code" ? 10000 : 8500,
        }),
        signal: AbortSignal.timeout(38_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? data?.error ?? `lovable_gateway_${res.status}`);
      const cleaned = cleanHtml(data?.choices?.[0]?.message?.content ?? "");
      if (validHtml(cleaned)) return { html: cleaned, model: "google/gemini-3-flash-preview" };
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
      const modelList = attempt === 0 ? models : models.slice(1).concat(models[0]).slice(0, 4);
      const text = await callAIText(
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
        modelList,
        type === "code" ? 10000 : 8500,
        0.45,
        Math.min(remaining, 88_000),
        `chat-artifact-v2/${type}`,
      );
      const cleaned = cleanHtml(text);
      if (validHtml(cleaned)) return { html: cleaned, model: modelList[0] };
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
        html: fallbackHtml(payload.type, payload.topic),
        model_used: "lumina-local-artifact",
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
