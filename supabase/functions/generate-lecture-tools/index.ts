import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIText, MODELS_FAST } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 100_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { notes, type } = JSON.parse(body);

    const prompts: Record<string, string> = {
      flashcards: `Generate 10-15 flashcards. Return ONLY JSON array: [{"front": "question", "back": "answer"}]`,
      quiz: `Generate 8-10 MCQ questions. Return ONLY JSON array: [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]`,
      summary: `Create a powerful "Exam Revision" summary with headers, **bold** terms, bullet points, formulas, mnemonics. Keep under 600 words.`,
    };
    const text = await callAIText(
      [{ role: "system", content: prompts[type] || prompts.summary }, { role: "user", content: `Notes:\n${notes}` }],
      MODELS_FAST, 2500, 0.5, 30000, "lecture-tools"
    );
    if (type === "flashcards" || type === "quiz") {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) return new Response(JSON.stringify({ content: match[0] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ content: text.trim() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-lecture-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
