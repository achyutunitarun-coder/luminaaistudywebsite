import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIText, OWL, MODEL_FREE_ROUTER } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanJSON(raw: string): any {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const start = text.search(/[\[{]/);
  if (start < 0) return null;
  const startChar = text[start];
  const end = text.lastIndexOf(startChar === "[" ? "]" : "}");
  if (end <= start) return null;
  let jsonStr = text.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1");
  try { return JSON.parse(jsonStr); } catch {
    let b = 0, k = 0;
    for (const c of jsonStr) { if (c === "{") b++; if (c === "}") b--; if (c === "[") k++; if (c === "]") k--; }
    while (k > 0) { jsonStr += "]"; k--; }
    while (b > 0) { jsonStr += "}"; b--; }
    try { return JSON.parse(jsonStr); } catch { return null; }
  }
}

type Q = { question: string; options: string[]; correct: number; explanation: string };

function sanitize(payload: any): Q[] {
  const raw = payload?.questions;
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, Q>();
  for (const item of raw) {
    const question = typeof item?.question === "string" ? item.question.trim() : "";
    const options = Array.isArray(item?.options) ? item.options.map((o: any) => String(o ?? "").trim()).filter(Boolean) : [];
    const correct = Number(item?.correct);
    const explanation = typeof item?.explanation === "string" ? item.explanation.trim() : "";
    if (!question || options.length < 2 || !Number.isInteger(correct) || correct < 0 || correct >= options.length || !explanation) continue;
    const key = question.toLowerCase().replace(/\s+/g, " ").trim();
    if (!deduped.has(key)) deduped.set(key, { question, options, correct, explanation });
  }
  return [...deduped.values()];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    {
      const { enforceUsage } = await import("../_shared/usage-gate.ts");
      const gate = await enforceUsage(user.id, "test_generations", corsHeaders);
      if (!gate.ok) return gate.response;
    }


    const body = await req.text();
    if (body.length > 5_000_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { syllabus, subject, numQuestions } = JSON.parse(body);

    const num = Math.min(Math.max(Number(numQuestions) || 5, 1), 20);
    const subjectStr = String(subject || 'General').slice(0, 200);
    const syllabusStr = String(syllabus || '').slice(0, 120000);
    
    const text = await callAIText(
      [
        {
          role: "system",
          content: `You are an expert exam question generator. Create ${num} high-quality multiple-choice questions that test DEEP UNDERSTANDING, not just recall.

QUESTION QUALITY STANDARDS:
- Each question must test a specific concept, principle, or application
- Include conceptual questions ("Why does...?", "What happens if...?", "Which best explains...?")
- Include application questions ("Given this scenario...", "How would you apply...")
- Include analysis questions ("Compare...", "What is the relationship between...")
- Avoid trivial factual recall ("What is the definition of...")
- Questions should be exam-grade difficulty (JEE/NEET/CBSE Board level)

DISTRACTOR QUALITY:
- All 4 options should be plausible
- Distractors should reflect common student misconceptions
- No obviously wrong options
- Options should be similar in length and style

FORMAT: Return ONLY valid JSON (no markdown, no thinking tags):
{"questions": [
  {
    "question": "The question text. Use LaTeX for math: $E=mc^2$",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Clear 2-3 sentence explanation of why the correct answer is right AND why each distractor is wrong. Include the underlying concept."
  }
]}

CRITICAL: Every question MUST have a unique, non-trivial concept being tested. The explanation MUST teach something.`
        },
        {
          role: "user",
          content: `Subject: ${subjectStr}\n\nSyllabus/Topic:\n${syllabusStr}\n\nGenerate ${num} conceptual, exam-grade MCQs.`
        },
      ],
      [OWL, MODEL_FREE_ROUTER],
      Math.min(8000, Math.max(3000, num * 800)),
      0.35,
      30_000,
      "test-gen"
    );

    const valid = sanitize(cleanJSON(text));
    if (valid.length > 0) return new Response(JSON.stringify({ questions: valid.slice(0, num) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: "Failed to generate valid questions" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-test error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
