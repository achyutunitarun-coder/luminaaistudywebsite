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
    const { notes, type } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const prompts: Record<string, string> = {
      flashcards: `From these lecture notes, generate 10-15 flashcards. Return ONLY valid JSON array with no markdown fences: [{"front": "question", "back": "answer"}]. No other text.\n\nNotes:\n${notes}`,
      quiz: `From these lecture notes, generate 8-10 MCQ quiz questions. Return ONLY valid JSON array with no markdown fences: [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]. No other text.\n\nNotes:\n${notes}`,
      summary: `Create a condensed "Exam Revision" summary from these notes. Use bullet points, bold key terms, keep under 500 words.\n\nNotes:\n${notes}`,
    };

    const isStreaming = type === "summary";

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
            stream: isStreaming,
            messages: [
              { role: "system", content: "You are Lumina AI's study tool generator." },
              { role: "user", content: prompts[type] || prompts.summary },
            ],
          }),
        });

        if (!response.ok) { console.error(`Model ${model} failed:`, response.status); continue; }

        if (isStreaming) {
          return new Response(response.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
          });
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        return new Response(JSON.stringify({ content: text.trim() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) { console.error(`Model ${model} error:`, e); continue; }
    }

    return new Response(JSON.stringify({ error: "All models failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lecture-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
