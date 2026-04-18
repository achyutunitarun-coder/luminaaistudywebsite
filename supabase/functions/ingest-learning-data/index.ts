// ─────────────────────────────────────────────────────────────────
// ingest-learning-data  ·  Structured pipeline for fine-tuning data
// Stores: learning_questions → learning_answers → (optional) performance
// Deduplicates by SHA-256 hash of the question text.
// ─────────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Lightweight rule-based classifier (avoids extra model call)
function classify(text: string): { subject: string; topic: string; difficulty: string } {
  const t = text.toLowerCase();
  let subject = "general";
  if (/\b(math|algebra|calculus|geometry|equation|integral|derivative|matrix|vector)\b/.test(t)) subject = "math";
  else if (/\b(physics|force|velocity|newton|quantum|relativity|gravity|electron|wave)\b/.test(t)) subject = "physics";
  else if (/\b(chem|chemistry|reaction|molecule|atom|acid|base|organic|element)\b/.test(t)) subject = "chemistry";
  else if (/\b(bio|biology|cell|dna|protein|evolution|organism|enzyme|gene)\b/.test(t)) subject = "biology";
  else if (/\b(history|war|civilization|empire|revolution|century|ancient)\b/.test(t)) subject = "history";
  else if (/\b(code|python|javascript|java|programming|function|algorithm|loop|class)\b/.test(t)) subject = "computer_science";
  else if (/\b(english|grammar|essay|literature|poem|novel|writing)\b/.test(t)) subject = "english";
  else if (/\b(econ|economics|market|supply|demand|gdp|inflation)\b/.test(t)) subject = "economics";

  const wc = text.split(/\s+/).length;
  const difficulty = wc < 10 ? "easy" : wc < 40 ? "medium" : "hard";

  // crude topic = first noun-ish phrase or first 6 words
  const topic = text.replace(/[?.!]/g, "").split(/\s+/).slice(0, 6).join(" ").slice(0, 80);
  return { subject, topic, difficulty };
}

// Quality heuristic: longer, structured answers = higher score
function scoreAnswer(answer: string): number {
  const len = answer.length;
  const hasStructure = /(\n[-*]|\n\d+\.|\n#|```)/.test(answer) ? 15 : 0;
  const hasMath = /(\$|\\\(|\\\[)/.test(answer) ? 5 : 0;
  const base = Math.min(70, len / 30);
  return Math.round(Math.max(0, Math.min(100, base + hasStructure + hasMath)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { question, answer, source, modelUsed, wasCorrect, timeTakenSeconds } = await req.json();
    if (!question || typeof question !== "string" || question.length < 4) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: corsHeaders });
    }

    // Skip noise (greetings, single words)
    const trimmed = question.trim();
    if (trimmed.length < 8 || /^(hi|hello|hey|thanks|ok|yes|no|cool|nice)\W*$/i.test(trimmed)) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "noise" }), { headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hash = await sha256(trimmed);
    const { subject, topic, difficulty } = classify(trimmed);

    // Find or create question
    let questionId: string | null = null;
    const { data: existingQ } = await admin
      .from("learning_questions")
      .select("id")
      .eq("question_hash", hash)
      .maybeSingle();
    if (existingQ) {
      questionId = existingQ.id;
    } else {
      const { data: newQ, error: qErr } = await admin
        .from("learning_questions")
        .insert({
          question_text: trimmed.slice(0, 4000),
          question_hash: hash,
          user_id: user.id,
          source: source || "chat",
          subject, topic, difficulty_level: difficulty,
        })
        .select("id")
        .single();
      if (qErr) {
        console.error("question insert error:", qErr);
        return new Response(JSON.stringify({ ok: false, error: qErr.message }), { status: 200, headers: corsHeaders });
      }
      questionId = newQ.id;
    }

    // Insert answer (if provided)
    if (answer && typeof answer === "string" && answer.trim().length > 5) {
      const cleanAnswer = answer.slice(0, 8000);
      await admin.from("learning_answers").insert({
        question_id: questionId,
        answer_text: cleanAnswer,
        model_used: modelUsed || "unknown",
        quality_score: scoreAnswer(cleanAnswer),
        is_final: true,
      });
    }

    // Track performance if marked
    if (typeof wasCorrect === "boolean") {
      await admin.from("learning_performance").insert({
        user_id: user.id,
        question_id: questionId,
        was_correct: wasCorrect,
        time_taken: typeof timeTakenSeconds === "number" ? timeTakenSeconds : null,
      });
    }

    return new Response(JSON.stringify({ ok: true, question_id: questionId, subject, topic, difficulty }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-learning-data error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
