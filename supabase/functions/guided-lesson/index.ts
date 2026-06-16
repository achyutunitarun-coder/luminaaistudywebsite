import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { callAIText, MODELS_BALANCED, MODELS_FAST, MODELS_QUALITY } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractJson(raw: string): string | null {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return match[0];
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  return arrMatch ? arrMatch[0] : null;
}

function safeJsonParse(raw: string, fallback: any = null): any {
  const json = extractJson(raw);
  if (!json) return fallback;
  try { return JSON.parse(json); } catch { return fallback; }
}

const SYSTEM = `You are Lumina, a brilliant study tutor who explains like a smart older friend. You use analogies, bold **key terms**, and keep explanations digestible (150-250 words max per step). Never be condescending. Return ONLY valid JSON — no markdown fences, no thinking tags.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const _auth = await requireUser(req, corsHeaders);
    if ("error" in _auth) return _auth.error;
    {
      const { enforceUsage } = await import("../_shared/usage-gate.ts");
      const gate = await enforceUsage(_auth.user.id, "guided_lesson", corsHeaders);
      if (!gate.ok) return gate.response;
    }
    const body = await req.text();
    if (body.length > 4_000_000) return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const params = JSON.parse(body);
    const mode = params.mode || "outline";

    // ── OUTLINE — use FAST models, small token count for speed ──
    if (mode === "outline") {
      const { topic, difficulty } = params;
      if (!topic) return new Response(JSON.stringify({ error: "Topic required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const prompt = `Create a step-by-step lesson outline for: "${topic}"
Difficulty: ${difficulty || "intermediate"}

Return ONLY valid JSON:
{
  "title": "Lesson title",
  "totalSteps": 5,
  "steps": [
    {"title": "Step title", "description": "One-line description of what this step covers"}
  ],
  "difficulty": "${difficulty || "intermediate"}"
}

Rules:
- 5-7 steps total
- Each step is a small, digestible micro-concept
- Progressive difficulty — build on previous steps
- Step descriptions should be 1 sentence each`;

      const text = await callAIText(
        [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        MODELS_FAST, 700, 0.35, 30_000, "guided-outline"
      );
      const parsed = safeJsonParse(text);
      if (!parsed) return new Response(JSON.stringify({ error: "Failed to generate outline" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── STEP — use BALANCED for quality teaching ──
    if (mode === "step") {
      const { topic, step, totalSteps, difficulty, stepTitle } = params;
      const prompt = `You are teaching "${topic}", Step ${step + 1} of ${totalSteps}. Step title: "${stepTitle || ""}".
Difficulty: ${difficulty || "intermediate"}

Return ONLY valid JSON:
{
  "stepTitle": "Title of this micro-concept",
  "explanation": "A clear 150-250 word explanation using analogies, bold **key terms**, bullet points. Teach ONE concept well.",
  "example": "A concrete real-world example illustrating this concept (2-3 sentences)",
  "check_questions": [
    {
      "type": "mcq",
      "question": "A comprehension question about this step",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "Why this answer is correct"
    },
    {
      "type": "short_answer",
      "question": "In your own words, explain...",
      "model_answer": "Key points the answer should include"
    }
  ],
  "encouragement": "A short motivating message"
}

Rules:
- Explanation MUST be 150-250 words, using analogies
- Exactly 2 questions: 1 MCQ + 1 short answer
- MCQ options must be plausible
- ${difficulty === "beginner" ? "Use very simple language and everyday analogies" : difficulty === "advanced" ? "Include nuance and edge cases" : "Balance clarity and depth"}`;

      const text = await callAIText(
        [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        MODELS_BALANCED, 2000, 0.4, 40_000, `guided-step-${step}`
      );
      const parsed = safeJsonParse(text);
      if (!parsed) return new Response(JSON.stringify({ error: "Failed to generate step" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SIMPLIFY — FAST, small response ──
    if (mode === "simplify") {
      const { topic, stepTitle, originalExplanation } = params;
      const prompt = `The student didn't understand this explanation about "${stepTitle}" (topic: ${topic}):
"${originalExplanation}"

Re-explain the SAME concept but simpler — like explaining to a 10-year-old. Use a different analogy. Keep it under 150 words.

Return ONLY JSON: {"explanation": "your simpler explanation here"}`;

      const text = await callAIText(
        [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        MODELS_FAST, 400, 0.4, 15_000, "guided-simplify"
      );
      const parsed = safeJsonParse(text, { explanation: "Let me try again in simpler terms..." });
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── DEEPER — BALANCED ──
    if (mode === "deeper") {
      const { topic, stepTitle, originalExplanation } = params;
      const prompt = `The student wants MORE DETAIL about "${stepTitle}" (topic: ${topic}). Original:
"${originalExplanation}"

Add deeper detail — cover edge cases, exceptions, or advanced nuances. 150-200 words. Don't repeat the original.

Return ONLY JSON: {"explanation": "your deeper explanation here"}`;

      const text = await callAIText(
        [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        MODELS_BALANCED, 600, 0.4, 20_000, "guided-deeper"
      );
      const parsed = safeJsonParse(text, { explanation: "Here's more detail on this topic..." });
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── EXAMPLE — FAST ──
    if (mode === "example") {
      const { topic, stepTitle } = params;
      const prompt = `Give a NEW, creative real-world example for "${stepTitle}" (topic: ${topic}). Make it relatable and concrete. 2-4 sentences.

Return ONLY JSON: {"example": "your example here"}`;

      const text = await callAIText(
        [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        MODELS_FAST, 300, 0.5, 12_000, "guided-example"
      );
      const parsed = safeJsonParse(text, { example: "Think of it like this..." });
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── EVALUATE — FAST ──
    if (mode === "evaluate") {
      const { question, modelAnswer, studentAnswer } = params;
      const prompt = `A student answered this question:
Question: "${question}"
Expected answer should cover: "${modelAnswer}"
Student wrote: "${studentAnswer}"

Evaluate: is it correct, partially correct, or wrong? Give specific feedback. Be encouraging.

Return ONLY JSON:
{
  "verdict": "correct",
  "feedback": "Your specific feedback here",
  "score": 75
}
verdict must be one of: "correct", "partial", "wrong"`;

      const text = await callAIText(
        [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        MODELS_FAST, 400, 0.3, 15_000, "guided-evaluate"
      );
      const parsed = safeJsonParse(text, { verdict: "partial", feedback: "Good attempt! Keep going.", score: 50 });
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── FINAL QUIZ — BALANCED ──
    if (mode === "final_quiz") {
      const { topic, steps, difficulty } = params;
      const stepsStr = (steps || []).map((s: string, i: number) => `${i + 1}. ${s}`).join("\n");
      const prompt = `Create a final quiz covering this entire lesson on "${topic}".
Steps covered:
${stepsStr}

Difficulty: ${difficulty || "intermediate"}

Return ONLY JSON — an array of 5 questions:
[
  {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct": 0,
    "explanation": "Why this is correct",
    "step_ref": 1
  }
]

Rules:
- 5 questions total, covering different steps
- Mix easy and hard
- Options must be plausible
- step_ref indicates which step this question relates to`;

      const text = await callAIText(
        [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        MODELS_BALANCED, 1800, 0.35, 45_000, "guided-final-quiz"
      );
      const parsed = safeJsonParse(text);
      if (!parsed) return new Response(JSON.stringify({ error: "Failed to generate quiz" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Unknown mode: ${mode}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("guided-lesson error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const userMsg = msg.includes("high demand") || msg.includes("busy")
      ? msg
      : "Something went wrong — please try again.";
    return new Response(JSON.stringify({ error: userMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
