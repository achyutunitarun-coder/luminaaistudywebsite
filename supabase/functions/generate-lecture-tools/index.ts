import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["openrouter/auto", "google/gemma-3-27b-it:free", "meta-llama/llama-3.3-70b-instruct:free", "nvidia/nemotron-3-super-120b-a12b:free"];

async function callAI(apiKey: string, messages: any[], maxTokens = 2000): Promise<string> {
  for (const model of MODELS) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const res = await fetch(OPENROUTER_URL, { method: "POST", signal: c.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.5 }) });
      clearTimeout(t);
      if (!res.ok) { const e = await res.text(); console.error(`[lecture-tools] ${model} ${res.status}: ${e.slice(0,200)}`); continue; }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) { console.log(`[lecture-tools] ✓ ${model}`); return content; }
    } catch (e) { console.error(`[lecture-tools] ${model}:`, e); }
  }
  throw new Error("All models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 100_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { notes, type } = JSON.parse(body);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const prompts: Record<string, string> = {
      flashcards: `From lecture notes, generate 10-15 flashcards. Return ONLY JSON array: [{"front": "question", "back": "answer"}]`,
      quiz: `From lecture notes, generate 8-10 MCQ questions. Return ONLY JSON array: [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]`,
      summary: `Create a powerful "Exam Revision" summary from these notes. Use headers, bold terms, bullet points. Include formulas, mnemonics, "Top 5 Things to Remember". Keep under 600 words.`,
    };
    const text = await callAI(OPENROUTER_API_KEY, [{ role: "system", content: prompts[type] || prompts.summary }, { role: "user", content: `Notes:\n${notes}` }], 2000);
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
