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
    const { notes, type } = await req.json();
    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN not set");

    const prompts: Record<string, string> = {
      flashcards: `From these lecture notes, generate 10-15 flashcards. Return ONLY valid JSON array with no markdown fences: [{"front": "question", "back": "answer"}]. No other text.\n\nNotes:\n${notes}\n\nJSON:`,
      quiz: `From these lecture notes, generate 8-10 MCQ quiz questions. Return ONLY valid JSON array with no markdown fences: [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]. No other text.\n\nNotes:\n${notes}\n\nJSON:`,
      summary: `Create a condensed "Exam Revision" summary from these notes. Use bullet points, bold key terms, keep under 500 words.\n\nNotes:\n${notes}\n\nSummary:`,
    };

    const prompt = prompts[type] || prompts.summary;

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

    // For flashcards and quiz, try to parse JSON array or object
    if (type === "flashcards" || type === "quiz") {
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return new Response(JSON.stringify({ content: arrayMatch[0] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // For summary or fallback
    return new Response(JSON.stringify({ content: text.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lecture-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
