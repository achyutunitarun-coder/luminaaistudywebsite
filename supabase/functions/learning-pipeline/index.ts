// ─────────────────────────────────────────────────────────────────
// learning-pipeline · Production-grade training data collector
// Endpoints (POST { action, ... }):
//   capture    → record one anonymized interaction (PII-scrubbed)
//   feedback   → thumbs_up | thumbs_down | understood | confusing | correction
//   consent    → set training_data_opt_in = true|false
//   delete_me  → user-driven full deletion of their captured data
//   export     → service-role only: returns gold dataset (instruction|chat format)
//   stats      → service-role only: dataset health metrics
// ─────────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── PII SCRUBBER ────────────────────────────────────────────────
// Removes: emails, phones, long digit runs (cards/IDs), URLs with usernames,
//          common name patterns ("My name is X", "I am X"), addresses (street/city hints),
//          @handles, IP addresses, dates of birth.
function scrubPII(input: string): string {
  if (!input) return "";
  let t = input;
  // emails
  t = t.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[EMAIL]");
  // phone numbers (intl + local)
  t = t.replace(/\+?\d[\d\s().-]{7,}\d/g, "[PHONE]");
  // credit-card-like 13-19 digit runs
  t = t.replace(/\b\d{13,19}\b/g, "[CARD]");
  // generic long IDs
  t = t.replace(/\b[A-Z0-9]{8,}\b/g, (m) => (/^[A-Z]+$/.test(m) ? m : "[ID]"));
  // IP addresses
  t = t.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP]");
  // @handles
  t = t.replace(/(^|\s)@[A-Za-z0-9_]{2,}/g, "$1[HANDLE]");
  // URLs with auth (user:pass@)
  t = t.replace(/https?:\/\/[^\s/]+:[^\s/]+@[^\s]+/gi, "[URL]");
  // "my name is X", "I am X", "this is X (Y)" — capture next 1-3 capitalized words
  t = t.replace(/\b(my name is|i am|i'm|this is|call me)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/g, "$1 [NAME]");
  // dates of birth like "born on", "DOB"
  t = t.replace(/\b(born on|dob|date of birth)[\s:]+[\w\s,/-]{4,30}/gi, "$1: [DOB]");
  // address hints
  t = t.replace(/\b\d{1,5}\s+([A-Z][a-z]+\s){1,3}(street|st|road|rd|avenue|ave|lane|ln|blvd|drive|dr)\b/gi, "[ADDRESS]");
  // postal codes (US 5/9, India 6, UK)
  t = t.replace(/\b\d{5}(-\d{4})?\b/g, "[POSTAL]");
  t = t.replace(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/g, "[POSTAL]");
  return t;
}

// ── CLASSIFIER (rule-based, fast) ───────────────────────────────
function classify(text: string): { subject: string; topic: string; difficulty: "easy"|"medium"|"hard"; concepts: string[]; language: string } {
  const t = text.toLowerCase();
  let subject = "general";
  const concepts: string[] = [];

  const subjectMap: Array<[string, RegExp, string[]]> = [
    ["math",       /\b(algebra|calculus|geometry|trigonometry|equation|integral|derivative|matrix|vector|polynomial|theorem)\b/, ["algebra","calculus","geometry"]],
    ["physics",    /\b(physics|force|velocity|newton|quantum|relativity|gravity|electron|wave|momentum|kinematics|thermodynamics)\b/, ["mechanics","electromagnetism","thermodynamics","quantum"]],
    ["chemistry",  /\b(chem|chemistry|reaction|molecule|atom|acid|base|organic|inorganic|element|bond|valence|mole)\b/, ["organic","inorganic","physical-chem"]],
    ["biology",    /\b(bio|biology|cell|dna|rna|protein|evolution|organism|enzyme|gene|mitosis|meiosis|ecosystem)\b/, ["genetics","cell-bio","ecology"]],
    ["history",    /\b(history|war|civilization|empire|revolution|century|ancient|medieval|colonial)\b/, ["world-history"]],
    ["computer_science", /\b(code|python|javascript|typescript|java|c\+\+|programming|function|algorithm|loop|class|recursion|complexity)\b/, ["algorithms","data-structures"]],
    ["english",    /\b(english|grammar|essay|literature|poem|novel|writing|sentence|verb|noun)\b/, ["grammar","literature"]],
    ["economics",  /\b(econ|economics|market|supply|demand|gdp|inflation|monetary|fiscal)\b/, ["micro","macro"]],
  ];
  for (const [s, rx, cs] of subjectMap) {
    if (rx.test(t)) { subject = s; concepts.push(...cs.filter(c => t.includes(c.split("-")[0]))); break; }
  }

  // concept keywords (more specific tags)
  const conceptHints: Array<[RegExp, string]> = [
    [/newton'?s? (first|second|third)? ?law/, "newtons-laws"],
    [/integration|integral/, "integration"],
    [/differentiation|derivative/, "differentiation"],
    [/photosynthesis/, "photosynthesis"],
    [/mitosis|meiosis/, "cell-division"],
    [/ohm'?s law/, "ohms-law"],
    [/pythagor/, "pythagorean-theorem"],
    [/quadratic/, "quadratic-equations"],
    [/redox|oxidation|reduction/, "redox"],
  ];
  for (const [rx, tag] of conceptHints) if (rx.test(t) && !concepts.includes(tag)) concepts.push(tag);

  const wc = text.trim().split(/\s+/).length;
  const difficulty: "easy"|"medium"|"hard" = wc < 12 ? "easy" : wc < 45 ? "medium" : "hard";

  // crude language detection
  const language = /[\u0900-\u097F]/.test(text) ? "hi" :
                   /[\u4E00-\u9FFF]/.test(text) ? "zh" :
                   /[\u0600-\u06FF]/.test(text) ? "ar" : "en";

  const topic = text.replace(/[?.!]/g, "").split(/\s+/).slice(0, 6).join(" ").slice(0, 80);
  return { subject, topic, difficulty, concepts: concepts.slice(0, 5), language };
}

// ── QUALITY SCORER ──────────────────────────────────────────────
function scoreInteraction(question: string, answer: string): number {
  const qLen = question.length;
  const aLen = answer.length;
  if (qLen < 8 || aLen < 20) return 0;
  let s = 0;
  s += Math.min(30, aLen / 40);                                 // length up to 30
  s += /(\n[-*]|\n\d+\.|\n#{1,6}\s|```)/.test(answer) ? 20 : 0; // structure
  s += /(\$|\\\(|\\\[)/.test(answer) ? 10 : 0;                  // math
  s += /\bstep\s*\d|\bfirst,|\bnext,|\bfinally,/i.test(answer) ? 15 : 0; // step-by-step
  s += qLen > 40 ? 10 : 0;                                      // substantive question
  s += /\?(\s|$)/.test(question) ? 5 : 0;                       // is a question
  return Math.round(Math.max(0, Math.min(100, s)));
}

// ── SPAM / NOISE FILTER ─────────────────────────────────────────
function isNoise(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 8) return true;
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|cool|nice|lol|hmm|what|why|how)\W*$/i.test(t)) return true;
  if (/(.)\1{6,}/.test(t)) return true;        // repeated chars
  if (t.split(/\s+/).length < 3 && !/\?/.test(t)) return true;
  return false;
}

// ── DEVICE NORMALIZER ───────────────────────────────────────────
function normalizeDevice(ua: string | null): string | null {
  if (!ua) return null;
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  return "desktop";
}

// ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = body.action as string;

    // ─── CONSENT ─────────────────────────────────────────────────
    if (action === "consent") {
      const optIn = body.opt_in !== false;
      await admin.from("data_consent").upsert({ user_id: user.id, training_data_opt_in: optIn, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      return new Response(JSON.stringify({ ok: true, opt_in: optIn }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── DELETE MY DATA ──────────────────────────────────────────
    if (action === "delete_me") {
      const { count } = await admin.from("learning_interactions").delete({ count: "exact" }).eq("user_id", user.id);
      await admin.from("data_access_audit").insert({ action: "delete_user_data", actor: user.id, record_count: count ?? 0 });
      return new Response(JSON.stringify({ ok: true, deleted: count }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CAPTURE ─────────────────────────────────────────────────
    if (action === "capture") {
      const { question, answer, sessionId, source, modelUsed, latencyMs, steps } = body;

      // 1. consent gate
      const { data: consent } = await admin.from("data_consent").select("training_data_opt_in").eq("user_id", user.id).maybeSingle();
      if (consent && consent.training_data_opt_in === false) {
        return new Response(JSON.stringify({ ok: true, skipped: "opted_out" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. validate
      if (typeof question !== "string" || isNoise(question)) {
        return new Response(JSON.stringify({ ok: true, skipped: "noise" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (typeof answer !== "string" || answer.trim().length < 20) {
        return new Response(JSON.stringify({ ok: true, skipped: "short_answer" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 3. PII scrub
      const cleanQ = scrubPII(question.trim()).slice(0, 4000);
      const cleanA = scrubPII(answer.trim()).slice(0, 12000);

      // 4. classify + score
      const meta = classify(cleanQ);
      const quality = scoreInteraction(cleanQ, cleanA);

      // 5. session id (random per session, NOT user id)
      const session_id = (typeof sessionId === "string" && /^[0-9a-f-]{36}$/i.test(sessionId)) ? sessionId : crypto.randomUUID();

      // 6. follow-up detection: any prior interaction in last 10 min for this session?
      const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
      const { count: priorCount } = await admin
        .from("learning_interactions")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session_id)
        .gte("created_at", tenMinAgo);
      const follow_up = (priorCount ?? 0) > 0;

      const device_type = normalizeDevice(req.headers.get("user-agent"));

      const { data: inserted, error } = await admin.from("learning_interactions").insert({
        session_id,
        user_id: user.id,
        subject: meta.subject,
        topic: meta.topic,
        concepts: meta.concepts,
        difficulty: meta.difficulty,
        language: meta.language,
        user_input: cleanQ,
        ai_response: cleanA,
        steps: steps ?? null,
        follow_up,
        latency_ms: typeof latencyMs === "number" ? latencyMs : null,
        model_used: modelUsed ?? null,
        quality_score: quality,
        device_type,
        source: source ?? "chat",
        pii_scrubbed: true,
      }).select("id, session_id, quality_score").single();

      if (error) {
        console.error("capture error:", error);
        return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ ok: true, ...inserted, ...meta, follow_up }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── FEEDBACK ────────────────────────────────────────────────
    if (action === "feedback") {
      const { interactionId, type, correction } = body;
      const allowed = ["thumbs_up","thumbs_down","understood","confusing","correction"];
      if (!interactionId || !allowed.includes(type)) {
        return new Response(JSON.stringify({ error: "invalid feedback" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cleanCorrection = type === "correction" && typeof correction === "string" ? scrubPII(correction).slice(0, 4000) : null;
      const { error } = await admin.from("learning_feedback").upsert({
        interaction_id: interactionId,
        user_id: user.id,
        feedback_type: type,
        correction_text: cleanCorrection,
      }, { onConflict: "interaction_id,user_id,feedback_type" });
      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── EXPORT (service-role token only) ────────────────────────
    if (action === "export") {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const provided = req.headers.get("x-export-key");
      if (provided !== serviceKey) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const format = body.format ?? "instruction";          // 'instruction' | 'chat' | 'jsonl'
      const minQuality = typeof body.minQuality === "number" ? body.minQuality : 50;
      const limit = Math.min(body.limit ?? 1000, 10_000);
      const subject = body.subject as string | undefined;

      let q = admin.from("learning_interactions")
        .select("id,session_id,subject,topic,concepts,difficulty,language,user_input,ai_response,user_correction,follow_up,quality_score")
        .gte("quality_score", minQuality)
        .order("quality_score", { ascending: false })
        .limit(limit);
      if (subject) q = q.eq("subject", subject);
      const { data: rows, error } = await q;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const dataset = (rows ?? []).map((r: any) => {
        // prefer corrected answer if present (gold)
        const output = r.user_correction || r.ai_response;
        if (format === "chat") {
          return { messages: [{ role: "user", content: r.user_input }, { role: "assistant", content: output }], meta: { subject: r.subject, topic: r.topic, concepts: r.concepts, difficulty: r.difficulty, language: r.language, quality: r.quality_score } };
        }
        return { input: r.user_input, output, meta: { subject: r.subject, topic: r.topic, concepts: r.concepts, difficulty: r.difficulty, language: r.language, quality: r.quality_score } };
      });

      // mark exported + audit
      const ids = (rows ?? []).map((r: any) => r.id);
      if (ids.length) await admin.from("learning_interactions").update({ exported_at: new Date().toISOString() }).in("id", ids);
      await admin.from("data_access_audit").insert({ action: "export", actor: "service_role", record_count: dataset.length, filters: { format, minQuality, subject, limit } });

      if (format === "jsonl") {
        const jsonl = dataset.map(d => JSON.stringify(d)).join("\n");
        return new Response(jsonl, { headers: { ...corsHeaders, "Content-Type": "application/x-ndjson", "Content-Disposition": `attachment; filename="lumina-dataset-${Date.now()}.jsonl"` } });
      }
      return new Response(JSON.stringify({ ok: true, count: dataset.length, dataset }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── STATS (service-role only) ───────────────────────────────
    if (action === "stats") {
      const provided = req.headers.get("x-export-key");
      if (provided !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { count: total } = await admin.from("learning_interactions").select("id", { count: "exact", head: true });
      const { count: gold } = await admin.from("learning_interactions").select("id", { count: "exact", head: true }).gte("quality_score", 70);
      const { count: corrected } = await admin.from("learning_interactions").select("id", { count: "exact", head: true }).not("user_correction", "is", null);
      return new Response(JSON.stringify({ ok: true, total, gold, corrected }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("learning-pipeline error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
