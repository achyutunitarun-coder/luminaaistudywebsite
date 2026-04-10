import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIText, MODELS_BALANCED, MODELS_QUALITY } from "../_shared/models.ts";

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
  return match ? match[0] : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 20_000) return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { topic, step, totalSteps, userAnswers, difficulty } = JSON.parse(body);

    if (!topic) return new Response(JSON.stringify({ error: "Topic required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const diff = difficulty || "intermediate";

    // STEP 0: Generate lesson outline
    if (step === undefined || step === null || step === -1) {
      const outlinePrompt = `Create a step-by-step lesson outline for: "${topic}"

Return ONLY valid JSON (no markdown, no thinking tags):
{
  "title": "Lesson title",
  "totalSteps": 5,
  "steps": ["Step 1 title", "Step 2 title", "Step 3 title", "Step 4 title", "Step 5 title"],
  "difficulty": "${diff}"
}

Rules:
- 4-6 steps total
- Each step should be a small, digestible micro-concept
- Progressive difficulty
- Build upon previous steps`;

      const text = await callAIText(
        [{ role: "system", content: "You are an expert curriculum designer. Return ONLY valid JSON." }, { role: "user", content: outlinePrompt }],
        MODELS_BALANCED, 900, 0.35, 12_000, "guided-outline"
      );
      const json = extractJson(text);
      if (!json) return new Response(JSON.stringify({ error: "Failed to generate outline" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(json, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // STEP N: Generate micro-lesson + 4 questions
    const answersContext = userAnswers ? `\nThe student's previous answers: ${JSON.stringify(userAnswers)}. Adapt difficulty accordingly.` : "";
    
    const stepPrompt = `You are teaching "${topic}", Step ${step + 1} of ${totalSteps || 5}.${answersContext}

Difficulty level: ${diff}

Return ONLY valid JSON (no markdown, no code fences, no thinking):
{
  "stepNumber": ${step + 1},
  "stepTitle": "Title of this micro-concept",
  "teaching": "A SHORT 2-4 line explanation of ONE small concept. Use a simple analogy. Bold **key terms**. Keep it digestible — NO long paragraphs.",
  "understandingCheck": "A natural one-liner asking if they got it, like 'Makes sense so far?' or 'See how that works?'",
  "questions": [
    {
      "type": "recall",
      "question": "Easy recall question about what was just taught",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "hint": "A helpful hint",
      "explanation": "Why this is correct"
    },
    {
      "type": "understanding",
      "question": "Concept understanding question — tests if they GET it",
      "options": ["A", "B", "C", "D"],
      "correct": 1,
      "hint": "A helpful hint",
      "explanation": "Why this is correct"
    },
    {
      "type": "application",
      "question": "Apply the concept to a scenario",
      "options": ["A", "B", "C", "D"],
      "correct": 2,
      "hint": "A helpful hint",
      "explanation": "Why this is correct"
    },
    {
      "type": "tricky",
      "question": "A slightly tricky thinking question",
      "options": ["A", "B", "C", "D"],
      "correct": 3,
      "hint": "A helpful hint",
      "explanation": "Why this is correct"
    }
  ],
  "encouragement": "A short motivating message for after completing this step",
  "xpReward": 25
}

CRITICAL RULES:
- Teaching must be 2-4 lines MAX
- Exactly 4 questions
- Mix difficulty: easy → medium → medium → hard
- Options must be plausible
- ${diff === "beginner" ? "Use very simple language" : diff === "advanced" ? "Make Q4 genuinely challenging" : "Balance clarity and depth"}`;

    const models = diff === "advanced" ? MODELS_QUALITY : MODELS_BALANCED;
    const text = await callAIText(
      [{ role: "system", content: "You are Lumina, an expert step-by-step tutor. Return ONLY valid JSON. No thinking tags." }, { role: "user", content: stepPrompt }],
      models, 2200, 0.45, 14_000, `guided-step-${step}`
    );
    
    const json = extractJson(text);
    if (!json) return new Response(JSON.stringify({ error: "Failed to generate step" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    
    return new Response(json, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("guided-lesson error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
