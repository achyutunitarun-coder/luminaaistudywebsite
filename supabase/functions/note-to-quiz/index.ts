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

async function callOpenRouter(apiKey: string, messages: any[], maxTokens = 2000): Promise<string> {
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
      if (content) { console.log(`[note-to-quiz] Success: ${model}`); return content; }
    } catch (e) { console.error(`${model} exception:`, e); }
  }
  throw new Error("All models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.text();
    if (body.length > 100_000) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { notes } = JSON.parse(body);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const aiMessages = [
      { role: "system", content: `You generate quiz questions from student notes. Return ONLY valid JSON with no markdown fences: {"mcq": [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}], "short_answer": [{"question": "...", "answer": "..."}], "conceptual": [{"question": "...", "answer": "..."}]}` },
      { role: "user", content: `Generate quiz questions from these notes:\n\n${notes}` },
    ];

    const text = await callOpenRouter(OPENROUTER_API_KEY, aiMessages, 2000);
    const parsed = cleanAndParseJSON(text);
    if (parsed) {
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("[note-to-quiz] Failed to parse AI response:", text.slice(0, 500));
    return new Response(JSON.stringify({ error: "AI returned an invalid response. Please try again." }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("note-to-quiz error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
