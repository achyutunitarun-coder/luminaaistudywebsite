import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = [
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-coder:free",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { notes } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    for (const model of MODELS) {
      try {
        const response = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: `You generate quiz questions from student notes. Return ONLY valid JSON with no markdown fences: {"mcq": [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}], "short_answer": [{"question": "...", "answer": "..."}], "conceptual": [{"question": "...", "answer": "..."}]}` },
              { role: "user", content: `Generate quiz questions from these notes:\n\n${notes}` },
            ],
          }),
        });

        if (!response.ok) { console.error(`Model ${model} failed:`, response.status); continue; }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return new Response(JSON.stringify(JSON.parse(jsonMatch[0])), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        continue;
      } catch (e) { console.error(`Model ${model} error:`, e); continue; }
    }

    return new Response(JSON.stringify({ error: "All models failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("note-to-quiz error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
