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

const AUTO_ROUTER = "openrouter/auto";

const FALLBACK_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1-0528:free",
  "qwen/qwq-32b:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "deepseek/deepseek-r1:free",
  "microsoft/phi-4-reasoning-plus:free",
  "microsoft/phi-4-reasoning:free",
  "microsoft/mai-ds-r1:free",
  "rekaai/reka-flash-3:free",
  "moonshotai/kimi-vl-a3b-thinking:free",
  "nvidia/llama-3.1-nemotron-ultra-253b:free",
  "open-r1/olympiccoder-32b:free",
  "allenai/olmo-2-0325-32b-instruct:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-1b-it:free",
];

function getModelsToTry(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of [...PRIMARY_MODELS, AUTO_ROUTER, ...FALLBACK_MODELS]) {
    if (!seen.has(m)) { seen.add(m); result.push(m); }
  }
  return result;
}

async function callOpenRouter(apiKey: string, messages: any[], maxTokens = 2500): Promise<string> {
  const models = getModelsToTry();
  console.log(`[generate-flashcards] Trying ${models.length} models`);

  for (const model of models) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.5 }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[generate-flashcards] ${model} error ${res.status}: ${errText}`);
        continue;
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        console.log(`[generate-flashcards] Success with model: ${model}`);
        return content;
      }
    } catch (e) { console.error(`[generate-flashcards] ${model} exception:`, e); }
  }
  throw new Error("All models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, title, cardCount = 20 } = await req.json();
    const count = Math.min(Math.max(Number(cardCount) || 20, 5), 80);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const aiMessages = [
      { role: "system", content: `You are an expert flashcard creator for students. Create exactly ${count} high-quality flashcards that test UNDERSTANDING, not just memorization.

Rules:
- Front: Ask clear, specific questions that test comprehension (not just "What is X?")
- Back: Give concise but complete answers with key details
- Include a mix: definitions, applications, comparisons, "why" questions, edge cases
- For math/science: include formula cards AND conceptual understanding cards
- Order cards from fundamental to advanced

Return ONLY valid JSON with no markdown fences: {"cards": [{"front": "question", "back": "answer"}]}` },
      { role: "user", content: `Create ${count} flashcards for "${title}" from this content:\n\n${content}` },
    ];

    const text = await callOpenRouter(OPENROUTER_API_KEY, aiMessages, 2500);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(JSON.stringify(JSON.parse(jsonMatch[0])), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Failed to parse flashcards" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-flashcards error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
