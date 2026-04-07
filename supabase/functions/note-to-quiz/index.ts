import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["meta-llama/llama-3.3-70b-instruct:free", "minimax/minimax-m2.5:free", "google/gemma-3-27b-it:free", "z-ai/glm-4.5-air:free", "qwen/qwen3-next-80b-a3b-instruct:free", "google/gemma-3-12b-it:free"];

function cleanJSON(raw: string): any {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const start = text.search(/[\[{]/);
  if (start < 0) return null;
  const startChar = text[start];
  const end = text.lastIndexOf(startChar === "[" ? "]" : "}");
  if (end <= start) return null;
  let jsonStr = text.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1");
  try { return JSON.parse(jsonStr); } catch { return null; }
}

async function callAI(apiKey: string, messages: any[], maxTokens = 2000): Promise<string> {
  for (const model of MODELS) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const res = await fetch(OPENROUTER_URL, { method: "POST", signal: c.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.5 }) });
      clearTimeout(t);
      if (!res.ok) { const e = await res.text(); console.error(`[note-to-quiz] ${model} ${res.status}: ${e.slice(0,200)}`); continue; }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) { console.log(`[note-to-quiz] ✓ ${model}`); return content; }
    } catch (e) { console.error(`[note-to-quiz] ${model}:`, e); }
  }
  throw new Error("All models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 100_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { notes } = JSON.parse(body);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const text = await callAI(OPENROUTER_API_KEY, [
      { role: "system", content: `Convert notes into a challenging quiz. Create questions that test UNDERSTANDING, not just recall. Include tricky options that expose common misconceptions.

Return ONLY JSON: {"mcq": [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}], "short_answer": [{"question": "...", "answer": "..."}], "conceptual": [{"question": "...", "answer": "..."}]}

Make explanations teach something — not just "the answer is B."` },
      { role: "user", content: `Generate quiz from:\n\n${notes}` },
    ], 2000);
    const parsed = cleanJSON(text);
    if (parsed) return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: "AI returned invalid response. Try again." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("note-to-quiz error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
