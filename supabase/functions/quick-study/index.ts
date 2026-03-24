import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_API_URL = "https://api-inference.huggingface.co/models/iamdago/Lumina-Ultimate";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic } = await req.json();
    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN is not configured");

    const prompt = `System: You are an expert tutor. Create a comprehensive quick study lesson. Return ONLY valid JSON with no other text, in this exact format: {"title": "...", "key_concepts": [{"concept": "name", "explanation": "detailed explanation 3-5 sentences"}], "practice_questions": [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]}

User: Create a study lesson on "${topic}" with 8-10 key concepts and 8 practice questions.

JSON:`;

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 4096, temperature: 0.5, top_p: 0.9, repetition_penalty: 1.1, return_full_text: false },
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to generate lesson" }), {
        status: response.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawText = (Array.isArray(data) ? data[0]?.generated_text : data?.generated_text) || "";

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "No lesson generated" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("quick-study error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
