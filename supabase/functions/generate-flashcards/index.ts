import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PAYLOAD_BYTES = 100_000;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const PRIMARY_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3-coder:free",
];

const AUTO_ROUTER = "openrouter/auto";

const FALLBACK_MODELS = [
  "openrouter/auto",
  "z-ai/glm-4.5-air:free",
  "google/gemma-3-12b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "arcee-ai/trinity-large-preview:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "minimax/minimax-m2.5:free",
  "stepfun/step-3.5-flash:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3n-e4b-it:free",
  "openai/gpt-oss-120b:free",
];

function cleanAndParseJSON(raw: string): any {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

  const start = text.search(/[\[{]/);
  if (start < 0) return null;
  const startChar = text[start];
  const end = text.lastIndexOf(startChar === "[" ? "]" : "}");
  if (end < 0 || end <= start) return null;

  let jsonStr = text.slice(start, end + 1).trim();
  jsonStr = jsonStr.replace(/,\s*([\]}])/g, "$1");
  jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");

  try {
    return JSON.parse(jsonStr);
  } catch {
    let braces = 0;
    let brackets = 0;
    for (const ch of jsonStr) {
      if (ch === "{") braces++;
      if (ch === "}") braces--;
      if (ch === "[") brackets++;
      if (ch === "]") brackets--;
    }
    while (brackets > 0) {
      jsonStr += "]";
      brackets--;
    }
    while (braces > 0) {
      jsonStr += "}";
      braces--;
    }
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }
}

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
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: _authUser }, error: _authErr } = await _supabase.auth.getUser();
    if (_authErr || !_authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Payload size check
    const body = await req.text();
    if (body.length > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { content, title, cardCount = 20 } = JSON.parse(body);

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
      { role: "user", content: `Create ${count} flashcards for "${String(title || '').slice(0, 200)}" from this content:\n\n${String(content || '').slice(0, 30000)}` },
    ];

    const text = await callOpenRouter(OPENROUTER_API_KEY, aiMessages, 2500);
    const parsed = cleanAndParseJSON(text);
    if (parsed?.cards) {
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("[generate-flashcards] Failed to parse AI response:", text.slice(0, 500));
    return new Response(JSON.stringify({ error: "AI returned an invalid response. Please try again." }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-flashcards error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});