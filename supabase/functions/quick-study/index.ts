import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-coder:free",
];
const FALLBACK_MODELS = [
  "openrouter/auto",
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1-0528:free",
  "qwen/qwq-32b:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "deepseek/deepseek-r1:free",
  "microsoft/phi-4-reasoning-plus:free",
  "microsoft/phi-4-reasoning:free",
  "microsoft/mai-ds-r1:free",
  "rekaai/reka-flash-3:free",
  "nvidia/llama-3.1-nemotron-ultra-253b:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-4b-it:free",
];
const ALL_MODELS = [...PRIMARY_MODELS, ...FALLBACK_MODELS.filter(m => !PRIMARY_MODELS.includes(m))];

async function callOpenRouter(apiKey: string, messages: any[], maxTokens = 3000): Promise<string> {
  for (const model of ALL_MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.5 }),
      });
      if (!res.ok) { const t = await res.text(); console.error(`${model} error ${res.status}: ${t}`); continue; }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) { console.log(`[quick-study] Success: ${model}`); return content; }
    } catch (e) { console.error(`${model} exception:`, e); }
  }
  throw new Error("All models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const aiMessages = [
      { role: "system", content: `You are an expert tutor creating a comprehensive quick study lesson. Create 8-10 key concepts with DETAILED explanations (4-6 sentences each, with examples and real-world connections) and 8 practice questions with thorough explanations.

Return ONLY valid JSON with no markdown fences: {"title": "...", "key_concepts": [{"concept": "name", "explanation": "detailed explanation with examples"}], "practice_questions": [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "why this is correct and why others aren't"}]}` },
      { role: "user", content: `Create an incredibly thorough quick study lesson on "${topic}" — make it so good that a student could ace an exam just from this.` },
    ];

    const text = await callOpenRouter(OPENROUTER_API_KEY, aiMessages, 3000);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(JSON.stringify(JSON.parse(jsonMatch[0])), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Failed to parse quick study" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("quick-study error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
