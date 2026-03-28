import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_MODEL = "iamdago/Lumina-Ultimate";
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { syllabus, subject, numQuestions } = await req.json();
    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN not set");

    const num = numQuestions || 5;
    const prompt = `You are a test question generator. Generate ${num} multiple choice questions for "${subject || 'General'}" based on the following syllabus. Return ONLY valid JSON with no markdown fences: {"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}]} where correct is the 0-based index.

Syllabus:
${syllabus}

JSON:`;

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 2000, temperature: 0.5, return_full_text: false },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: err }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data?.[0]?.generated_text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(JSON.stringify(JSON.parse(jsonMatch[0])), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Failed to parse test from model output" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-test error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
