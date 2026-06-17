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
    html.length > 300 &&
    (lower.includes("<!doctype") || lower.includes("<html")) &&
    lower.includes("</html>") &&
    !/todo|lorem ipsum|coming soon|rest of (the )?content/i.test(html)
  );
}

function esc(value: string) {
  return String(value || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);
}

interface TopicContent {
  definition: string;
  process: string;
  examiners: string;
  inputs: string[];
  question: string;
  options: { text: string; correct: boolean }[];
  checklist: string[];
  keyFacts: string[];
}

async function fetchTopicContent(topic: string, type: string): Promise<TopicContent | null> {
  const orKey = Deno.env.get("OPENROUTER_API_KEY") ?? Deno.env.get("OPENROUTER_KEY_2") ?? "";
  if (!orKey) return null;
  try {
    const sys = `You are an expert tutor. Return ONLY raw JSON (no fences, no prose) with ACTUAL subject-specific content. Never write meta-instructions like "explain it aloud" — write the real subject facts a student must learn.`;
    const user = `Topic: "${topic}". Type: ${type}.
Return JSON exactly:
{
 "definition": "2-3 sentence rigorous definition with real terms",
 "process": "3-4 sentence mechanistic explanation of how it works",
 "examiners": "2-3 sentence list of specific things examiners test on this topic",
 "inputs": ["4","short","real-stage","labels (e.g. for photosynthesis: Light reactions, ATP/NADPH, Calvin cycle, Glucose)"],
 "question": "one good factual multiple-choice question on the topic",
 "options": [{"text":"...","correct":true},{"text":"...","correct":false},{"text":"...","correct":false}],
 "checklist": ["5","topic-specific","mastery","items"],
 "keyFacts": ["4 real factual bullet points about the topic"]
}`;
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${orKey}`, "HTTP-Referer": "https://luminaai.co.in", "X-Title": "Lumina AI" },
      body: JSON.stringify({
        model: "openrouter/owl-alpha",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        temperature: 0.3, max_tokens: 1500, response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const data = await res.json().catch(() => ({}));
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = String(raw).replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed?.definition || !Array.isArray(parsed?.options)) return null;
    return parsed as TopicContent;
  } catch (e) {
    console.warn("fetchTopicContent failed:", (e as Error).message);
    return null;
  }
}

async function fallbackHtml(type: string, topic: string): Promise<string> {
  const safeTopic = esc(topic || "Study artifact");
  const kind = esc(type || "artifact");
  const content = await fetchTopicContent(topic, type);

  const definition = esc(content?.definition || `Detailed notes for ${topic} could not be generated automatically. Please regenerate the artifact for full content.`);
  const process = esc(content?.process || "Regenerate this artifact to receive the full mechanistic explanation.");
  const examiners = esc(content?.examiners || "Regenerate to view the examiner-focus breakdown.");
  const inputs = (content?.inputs && content.inputs.length >= 2 ? content.inputs : ["Stage 1","Stage 2","Stage 3","Outcome"]).slice(0,4).map(esc);
  const question = esc(content?.question || `Regenerate to load a real ${topic} question.`);
  const opts = (content?.options && content.options.length >= 2
    ? content.options
    : [{text:"Regenerate the artifact",correct:true},{text:"Placeholder",correct:false},{text:"Placeholder",correct:false}]
  ).slice(0,4);
  const checklist = (content?.checklist && content.checklist.length >= 3 ? content.checklist : [
    `State the definition of ${topic} from memory.`,
    `Draw the mechanism of ${topic} with labels.`,
    `List three common mistakes specific to ${topic}.`,
    `Solve one easy and one hard ${topic} question.`,
    `Teach ${topic} in sixty seconds.`,
  ]).slice(0,6).map(esc);
  const keyFacts = (content?.keyFacts && content.keyFacts.length >= 2 ? content.keyFacts : []).slice(0,6).map(esc);

  const nodesHtml = inputs.map((n,i)=>`<span class="node">${n}</span>${i<inputs.length-1?'<span class="arrow">→</span>':''}`).join("");
  const optsHtml = opts.map(o=>`<button data-correct="${o.correct?'true':'false'}">${esc(o.text)}</button>`).join("");
  const checklistHtml = checklist.map(c=>`<li>${c}</li>`).join("");
  const keyFactsHtml = keyFacts.length
    ? `<section id="facts" class="section"><h2>Key facts</h2><ul>${keyFacts.map(f=>`<li>${f}</li>`).join("")}</ul></section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${safeTopic} — Lumina ${kind}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@300..900&family=Manrope:wght@400;500;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>:root{--paper:#f5ead4;--ink:#15120d;--oxide:#b9482b;--moss:#496f5d;--aqua:#0e8077;--line:rgba(21,18,13,.18);font-family:Manrope,sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(135deg,#f5ead4,#e7d3aa 45%,#d8bea0);color:var(--ink);line-height:1.65}.wrap{width:min(1160px,calc(100% - 32px));margin:auto;padding:48px 0 72px}.mast{border-bottom:2px solid var(--ink);padding-bottom:32px}.kicker{font:800 12px/1 JetBrains Mono,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--oxide)}h1{font-family:Fraunces,serif;font-size:clamp(48px,9vw,120px);line-height:.85;margin:18px 0;font-weight:850}.lede{font-size:clamp(17px,1.8vw,22px);max-width:760px}.rail{display:grid;grid-template-columns:260px 1fr;gap:28px;margin-top:36px}.toc{position:sticky;top:24px;align-self:start;border:2px solid var(--ink);background:rgba(255,248,226,.8);padding:18px}.toc a{display:block;color:var(--ink);text-decoration:none;padding:10px 0;border-bottom:1px solid var(--line);font-weight:800}.section{padding:28px 0;border-bottom:1px solid var(--line)}h2{font-family:Fraunces,serif;font-size:clamp(30px,4.5vw,56px);margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.panel{border:2px solid var(--ink);background:rgba(255,249,232,.7);padding:20px;box-shadow:8px 8px 0 rgba(21,18,13,.12)}.panel b{color:var(--oxide);display:block;margin-bottom:8px}.diagram{min-height:180px;border:2px solid var(--ink);background:repeating-linear-gradient(45deg,rgba(73,111,93,.12) 0 12px,transparent 12px 24px);display:grid;place-items:center;margin:20px 0;padding:24px}.nodes{display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:center}.node{border:2px solid var(--ink);background:var(--paper);padding:12px 18px;border-radius:999px;font-weight:900}.arrow{font-size:26px;color:var(--oxide)}ul,ol{padding-left:22px}li{margin:6px 0}button{min-height:44px;border:2px solid var(--ink);background:var(--oxide);color:#fff7df;font-weight:900;padding:12px 18px;box-shadow:5px 5px 0 var(--ink);cursor:pointer;font-family:inherit}.quiz button{display:block;margin:8px 0;background:var(--moss)}.meter{height:12px;border:2px solid var(--ink);background:#fff7df;margin-top:12px}.meter span{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--oxide),var(--aqua));transition:width .4s ease}@media(max-width:820px){.rail{grid-template-columns:1fr}.toc{position:relative}.grid{grid-template-columns:1fr}}</style></head>
<body><main class="wrap">
<section class="mast"><span class="kicker">Lumina Artifact · ${kind}</span><h1>${safeTopic}</h1><p class="lede">${definition}</p></section>
<div class="rail"><nav class="toc"><a href="#overview">Core map</a><a href="#diagram">Visual model</a>${keyFacts.length?'<a href="#facts">Key facts</a>':''}<a href="#practice">Practice</a><a href="#finish">Mastery checklist</a></nav><article>
<section id="overview" class="section"><h2>Core map</h2><div class="grid"><div class="panel"><b>Definition</b><p>${definition}</p></div><div class="panel"><b>How it works</b><p>${process}</p></div><div class="panel"><b>What examiners test</b><p>${examiners}</p></div></div></section>
<section id="diagram" class="section"><h2>Visual model</h2><div class="diagram"><div class="nodes">${nodesHtml}</div></div></section>
${keyFactsHtml}
<section id="practice" class="section quiz"><h2>Practice</h2><p><strong>Question:</strong> ${question}</p>${optsHtml}<p id="feedback" aria-live="polite"></p><div class="meter"><span id="bar"></span></div></section>
<section id="finish" class="section"><h2>Mastery checklist</h2><ol>${checklistHtml}</ol><button onclick="window.print()">Print / Save</button></section>
</article></div></main>
<script>document.addEventListener('DOMContentLoaded',function(){var fb=document.getElementById('feedback'),bar=document.getElementById('bar');document.querySelectorAll('.quiz button').forEach(function(btn){btn.addEventListener('click',function(){var ok=btn.dataset.correct==='true';fb.textContent=ok?'Correct.':'Not quite — review the definition above and try again.';bar.style.width=ok?'100%':'40%';})});});</script>
</body></html>`;
}

function makeSystemPrompt(type: string, topic: string, provided: string) {
  const base =
    provided && provided.length > 200
      ? provided
      : `Generate a complete, beautiful, self-contained HTML ${type} artifact for ${topic}.`;
  return `${FRONTEND_DESIGN_SKILL}

${base}

CRITICAL CONTENT CONTRACT — DO NOT VIOLATE:
- The artifact MUST contain real, accurate, subject-specific content about "${topic}". Real definitions, real mechanisms, real worked examples with numbers, real practice questions with answers.
- NEVER write meta-instructions ("explain the concept aloud", "sketch the structure from memory", "look for precise vocabulary", "treated as a system: terms, causes, mechanisms..."). Those describe HOW to study — you must write WHAT to study.
- NEVER use generic placeholder labels like "Inputs → Process → Evidence → Answer". Use the REAL named stages of "${topic}" (e.g. for photosynthesis: "Light reactions → ATP/NADPH → Calvin cycle → Glucose").
- NEVER write "your notes will appear", "click to view", or any prompt-style placeholder text.
- ZERO emoji anywhere. Use SVG icons or text labels (Tip:, Warning:, Example:).

OUTPUT CONTRACT:
- Return ONLY raw HTML starting with <!DOCTYPE html>. No markdown fences, no commentary, no <think>.
- Complete and interactive. Target 18KB–60KB. Dense and finished.
- Distinctive Google Fonts; never Inter/Roboto/Arial/Space Grotesk as primary identity.`;
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

  // Primary attempt: use callAIText with OWL-first model chain + key fanout.
  // This replaces the old sequential owl-alpha fetch that wasted 45s before
  // falling back. callWithFallback handles key rotation, cooldowns, and
  // sequential fallback internally.
  {
    const remaining = JOB_BUDGET_MS - 15_000 - (Date.now() - started);
    if (remaining >= 8_000) {
      try {
        const text = await callAIText(
          [
            { role: "system", content: makeSystemPrompt(type, topic, systemPrompt) },
            { role: "user", content: `${userPrompt}\n\nProduce a complete, premium, self-contained HTML artifact. Keep it polished and finish the document.` },
          ],
          models,
          type === "code" ? 16000 : 12000,
          0.35,
          Math.min(remaining, 88_000),
          `chat-artifact-v2/${type}`,
        );
        const cleaned = cleanHtml(text);
        if (validHtml(cleaned)) return { html: cleaned, model: models[0] };
        lastErr = cleaned ? "invalid_html_from_primary" : "empty_from_primary";
        console.warn(`[artifact-job] primary chain returned invalid: ${lastErr}`);
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        console.warn("[artifact-job] primary chain failed:", lastErr);
      }
    }
  }

  // Secondary attempt: retry with a stricter prompt to force completion.
  // Only runs if the primary chain returned junk or timed out.
  {
    const remaining = JOB_BUDGET_MS - 15_000 - (Date.now() - started);
    if (remaining >= 8_000) {
      try {
        const text = await callAIText(
          [
            { role: "system", content: makeSystemPrompt(type, topic, systemPrompt) },
            { role: "user", content: `Create a focused, complete ${type} artifact about ${topic}. Output ONLY raw HTML starting with <!DOCTYPE html>. No markdown fences. Finish the entire document — do not truncate.` },
          ],
          models,
          type === "code" ? 12000 : 10000,
          0.45,
          Math.min(remaining, 70_000),
          `chat-artifact-v2/${type}/retry`,
        );
        const cleaned = cleanHtml(text);
        if (validHtml(cleaned)) return { html: cleaned, model: models[0] };
        lastErr = cleaned ? "invalid_html_from_retry" : "empty_from_retry";
        console.warn(`[artifact-job] retry chain returned invalid: ${lastErr}`);
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        console.warn("[artifact-job] retry chain failed:", lastErr);
      }
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
    // Never leave the UI spinning or dead-ended: complete with a topic-aware safe artifact.
    const safeHtml = await fallbackHtml(payload.type, payload.topic);
    await admin
      .from("artifact_jobs")
      .update({
        status: "completed",
        html: safeHtml,
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
