import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-coder:free",
];

async function callOpenRouter(apiKey: string, messages: any[], maxTokens = 2000): Promise<string> {
  for (const model of MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.5 }),
      });
      if (!res.ok) { console.error(`${model} error ${res.status}`); continue; }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (e) { console.error(`${model} exception:`, e); }
  }
  throw new Error("All models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { notes, type } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const systemPrompts: Record<string, string> = {
      flashcards: `From lecture notes, generate 10-15 flashcards. Return ONLY valid JSON array with no markdown fences: [{"front": "question", "back": "answer"}]. No other text.`,
      quiz: `From lecture notes, generate 8-10 MCQ quiz questions. Return ONLY valid JSON array with no markdown fences: [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]. No other text.`,
      summary: `Create a condensed "Exam Revision" summary from these notes. Use bullet points, bold key terms, keep under 500 words.`,
    };

    const aiMessages = [
      { role: "system", content: systemPrompts[type] || systemPrompts.summary },
      { role: "user", content: `Notes:\n${notes}` },
    ];

    const text = await callOpenRouter(OPENROUTER_API_KEY, aiMessages, 2000);

    if (type === "flashcards" || type === "quiz") {
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return new Response(JSON.stringify({ content: arrayMatch[0] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
