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

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const JOB_BUDGET_MS = 200_000;  // increased from 142s — edge functions can run up to 250s
const OWL = "openrouter/owl-alpha";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── HTML cleanup ────────────────────────────────────────────────────

function cleanHtml(raw: string): string {
  let h = (raw || "").trim();
  // Strip <think> blocks
  h = h.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Strip markdown code fences
  if (h.startsWith("```html")) h = h.slice(7);
  else if (h.startsWith("```")) h = h.slice(3);
  if (h.endsWith("```")) h = h.slice(0, -3);
  h = h.trim();
  // Trim to first structural tag
  const lower = h.toLowerCase();
  const dt = lower.indexOf("<!doctype");
  const ht = lower.indexOf("<html");
  if (dt > 0) h = h.slice(dt);
  else if (dt === -1 && ht > 0) h = h.slice(ht);
  return h.trim();
}

function validHtml(html: string): boolean {
  if (!html || html.length < 200) return false;
  const lower = html.toLowerCase();
  const hasDoctype = lower.includes("<!doctype");
  const hasHtml = lower.includes("<html");
  const hasClose = lower.includes("</html>");
  const hasBody = lower.includes("<body");
  const hasContent = lower.includes("<h1") || lower.includes("<h2") || lower.includes("<p") || lower.includes("<section") || lower.includes("<div");
  const hasGarbage = /lorem ipsum|coming soon|rest of (the )?content|your .* will appear/i.test(html);
  return (hasDoctype || hasHtml) && hasClose && (hasBody || hasContent) && !hasGarbage;
}

function esc(value: string) {
  return String(value || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// ── Inline fallback HTML (no external AI call needed) ──────────────

function buildFallbackHtml(type: string, topic: string): string {
  const safeTopic = esc(topic || "Study artifact");
  const kind = esc(type || "artifact");
  const topicSlug = encodeURIComponent(topic || "study-guide");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${safeTopic} — Lumina ${kind}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0a0f;--surface:#12121a;--border:#1e1e2e;--text:#e4e4e7;--muted:#71717a;--accent:#a78bfa;--accent2:#6ee7b7;--danger:#f87171;--radius:14px}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.7;min-height:100vh}
.wrap{max-width:960px;margin:0 auto;padding:40px 24px 80px}
header{border-bottom:1px solid var(--border);padding-bottom:32px;margin-bottom:40px}
.kicker{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);margin-bottom:12px;display:block}
h1{font-family:Syne,serif;font-size:clamp(32px,6vw,56px);font-weight:800;line-height:1.1;background:linear-gradient(135deg,#fff 0%,#a78bfa 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:16px}
.lede{color:var(--muted);font-size:17px;max-width:600px}
.section{margin-bottom:48px}
h2{font-family:Syne,serif;font-size:clamp(22px,3.5vw,36px);font-weight:700;margin-bottom:20px;color:var(--text)}
p{margin-bottom:12px;color:#d4d4d8}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:28px;margin-bottom:16px}
.card h3{font-size:15px;font-weight:600;color:var(--accent);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.tag{display:inline-flex;align-items:center;gap:6px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);color:var(--accent);padding:6px 14px;border-radius:99px;font-size:13px;font-weight:500;margin:4px}
.qa{border-left:3px solid var(--accent);padding-left:20px;margin-bottom:24px}
.qa .q{font-weight:600;margin-bottom:8px}
.qa .a{color:var(--muted)}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#0a0a0f;border:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:Inter,sans-serif}
.btn:hover{opacity:0.9;transform:translateY(-1px)}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--text)}
.btn-outline:hover{border-color:var(--accent);color:var(--accent)}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px;padding-top:24px;border-top:1px solid var(--border)}
textarea{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;color:var(--text);font-family:'Space Mono',monospace;font-size:13px;resize:vertical;min-height:120px}
textarea:focus{outline:none;border-color:var(--accent)}
.hint{font-size:12px;color:var(--muted);margin-top:8px}
@media(max-width:640px){.wrap{padding:24px 16px 60px}.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">
<header>
<span class="kicker">Lumina ${kind}</span>
<h1>${safeTopic}</h1>
<p class="lede">Your AI-generated ${type} is being prepared. This is a structured study template — regenerate for a fully AI-crafted interactive artifact.</p>
</header>

<section class="section" id="overview">
<h2>Overview</h2>
<div class="grid">
<div class="card"><h3>Definition</h3><p>A comprehensive study resource for <strong>${safeTopic}</strong>. This artifact covers key concepts, mechanisms, and exam-ready content.</p></div>
<div class="card"><h3>Key Areas</h3><p>Core principles, real-world applications, common misconceptions, and practice questions tailored to ${safeTopic}.</p></div>
<div class="card"><h3>Study Goals</h3><p>Master the fundamentals, apply concepts to problems, and test your understanding with interactive exercises.</p></div>
</div>
</section>

<section class="section" id="tags">
<h2>Key Terms</h2>
<div><span class="tag">📖 ${safeTopic}</span><span class="tag">🔬 Core Concepts</span><span class="tag">📝 Exam Prep</span><span class="tag">⚡ Quick Review</span></div>
</section>

<section class="section" id="practice">
<h2>Practice Questions</h2>
<div class="qa">
<p class="q">Q1: What is the fundamental principle behind ${safeTopic}?</p>
<p class="a">Review the core definition and mechanism. Try explaining it in your own words before checking the answer.</p>
</div>
<div class="qa">
<p class="q">Q2: How does ${safeTopic} apply in real-world scenarios?</p>
<p class="a">Think about practical examples and case studies related to this topic.</p>
</div>
<div class="qa">
<p class="q">Q3: What are common mistakes students make when studying ${safeTopic}?</p>
<p class="a">Identify misconceptions and focus on areas where understanding typically breaks down.</p>
</div>
</section>

<section class="section" id="notes">
<h2>Your Notes</h2>
<textarea placeholder="Write your notes here... Use this space to summarize ${safeTopic} in your own words."></textarea>
<p class="hint">💡 Tip: Writing notes by hand (or typing them) helps cement understanding.</p>
</section>

<div class="actions">
<button class="btn" onclick="window.print()">⬇ Download / Print</button>
<button class="btn btn-outline" onclick="document.querySelector('textarea').focus()">✏ Start Writing</button>
</div>
</div>
<script>
document.querySelectorAll('.tag').forEach(t => {
  t.addEventListener('click', () => {
    t.style.background = t.style.background ? '' : 'rgba(110,231,183,0.15)';
    t.style.borderColor = t.style.borderColor ? '' : 'rgba(110,231,183,0.4)';
  });
});
const ta = document.querySelector('textarea');
const key = 'lumina-notes-${topicSlug}';
ta.value = localStorage.getItem(key) || '';
ta.addEventListener('input', () => localStorage.setItem(key, ta.value));
</script>
</body></html>`;
}

// ── System prompt builder — SHORT and FOCUSED ────────────────────────
// Long prompts overwhelm free models → raw output. Keep it under 50 lines.

function makeSystemPrompt(type: string, topic: string, _provided: string) {
  void _provided;
  return `Generate a complete, self-contained HTML ${type} about "${topic}".

RULES:
- Start with <!DOCTYPE html> and end with </html>. NOTHING else.
- No markdown fences, no commentary, no preamble.
- Include real educational content, not placeholders.
- Dark theme (#0a0a0f bg, #12121a surface, teal/purple accents).
- Use Google Fonts: Syne (headings), Inter (body), Space Mono (code).
- Glassmorphism cards, gradient accents, smooth animations.
- Include working JS: collapsible sections, quiz with feedback, tabs.
- Sections: hero with title + overview, table of contents, key concepts with detailed explanations, worked examples step-by-step, formula reference, practice questions with full answers, summary.
- Minimum 400 lines of HTML.
- No emoji, no lorem ipsum, no "click here to view".`;
}

// ── Main generation logic ───────────────────────────────────────────

async function generateHtml(
  type: string,
  topic: string,
  userPrompt: string,
  systemPrompt: string,
): Promise<{ html: string; model?: string }> {
  const artifactType = (["notes", "exam", "slides", "code"].includes(type) ? type : "notes") as ArtifactType;
  const models = getModelsForArtifact(artifactType);
  const started = Date.now();
  const maxTtl = JOB_BUDGET_MS - 15_000; // leave 15s buffer

  const sys = makeSystemPrompt(type, topic, systemPrompt);
  const maxTokens = type === "code" ? 32000 : 24000;

  // ── Attempt 1: Primary ──
  {
    const elapsed = Date.now() - started;
    if (elapsed < maxTtl) {
      try {
        const text = await callAIText(
          [
            { role: "system", content: sys },
            { role: "user", content: `${userPrompt}\n\nProduce a complete, polished HTML artifact.` },
          ],
          models,
          maxTokens,
          0.3,
          Math.min(maxTtl - elapsed, 120_000),
          `artifact/${type}`,
        );
        const cleaned = cleanHtml(text);
        if (validHtml(cleaned)) {
          return { html: cleaned, model: models[0] };
        }
        // Accept even invalid but substantial HTML as last resort
        if (cleaned.length > 500) {
          console.warn(`[artifact] primary: substantial HTML (${cleaned.length} chars) but invalid, using anyway`);
          return { html: cleaned, model: models[0] };
        }
      } catch (e) {
        console.warn(`[artifact] primary error:`, e);
      }
    }
  }

  // ── Attempt 2: Simpler prompt ──
  {
    const elapsed = Date.now() - started;
    if (elapsed < maxTtl) {
      try {
        const simpleSys = `Output a complete HTML page about "${topic}". Start with <!DOCTYPE html>. Real content, dark theme, No markdown, No explanations.`;
        const text = await callAIText(
          [
            { role: "system", content: simpleSys },
            { role: "user", content: `Create a ${type} artifact for "${topic}". Complete HTML with real content.` },
          ],
          models,
          maxTokens,
          0.2,
          Math.min(maxTtl - elapsed, 90_000),
          `artifact/${type}/retry`,
        );
        const cleaned = cleanHtml(text);
        if (validHtml(cleaned)) {
          return { html: cleaned, model: models[0] };
        }
        if (cleaned.length > 500) {
          return { html: cleaned, model: models[0] };
        }
      } catch (e) {
        console.warn(`[artifact] retry error:`, e);
      }
    }
  }

  // ── Attempt 3: Minimal, OWL only ──
  {
    const elapsed = Date.now() - started;
    if (elapsed < maxTtl) {
      try {
        const text = await callAIText(
          [
            { role: "system", content: `Write HTML. Output only a complete <!DOCTYPE html> page. No markdown or explanations.` },
            { role: "user", content: `Write a complete HTML page about "${topic}". Include sections: overview, key concepts, examples, practice questions. Dark theme. Real content.` },
          ],
          [OWL],
          12000,
          0.2,
          Math.min(maxTtl - elapsed, 60_000),
          `artifact/${type}/minimal`,
        );
        const cleaned = cleanHtml(text);
        if (validHtml(cleaned)) {
          return { html: cleaned, model: OWL };
        }
        if (cleaned.length > 500) {
          return { html: cleaned, model: OWL };
        }
      } catch (e) {
        console.warn(`[artifact] minimal error:`, e);
      }
    }
  }

  // ── Fallback ──
  console.warn(`[artifact] All AI attempts failed for ${type}/${topic}, returning fallback`);
  return { html: buildFallbackHtml(type, topic), model: "lumina-fallback" };
}

// ── Job processor ───────────────────────────────────────────────────

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
    console.log(`[artifact-job:${jobId}] completed, ${html.length} chars, model: ${model}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[artifact-job:${jobId}] failed:`, msg);
    const safeHtml = buildFallbackHtml(payload.type, payload.topic);
    await admin
      .from("artifact_jobs")
      .update({
        status: "completed",
        html: safeHtml,
        model_used: "lumina-fallback",
        error_message: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}

// ── HTTP handler ────────────────────────────────────────────────────

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
    console.error("chat-artifact-v2 error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
