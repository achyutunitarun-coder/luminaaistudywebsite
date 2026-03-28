import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Primary models (the ones you specified)
const PRIMARY_MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-coder:free",
];

// Auto-router fallback — OpenRouter picks the best available free model
const AUTO_ROUTER = "openrouter/auto";

// Coding-specialized free models
const CODING_MODELS = [
  "qwen/qwen3-coder:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "deepseek/deepseek-r1-0528:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

// Reasoning-specialized free models
const REASONING_MODELS = [
  "deepseek/deepseek-r1-0528:free",
  "qwen/qwq-32b:free",
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
];

// Math/Science free models
const MATH_MODELS = [
  "deepseek/deepseek-r1-0528:free",
  "qwen/qwq-32b:free",
  "deepseek/deepseek-r1:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

// Creative/Writing free models
const CREATIVE_MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
];

// Extended fallback pool of free models
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
  "mistralai/mistral-small-3.1-24b-instruct:free",
];

const CODING_KEYWORDS = [
  "code", "coding", "program", "function", "bug", "debug", "javascript", "python",
  "typescript", "react", "html", "css", "api", "algorithm", "syntax", "compile",
  "runtime", "error", "exception", "class", "object", "array", "variable",
  "loop", "if else", "switch", "import", "export", "async", "await", "promise",
  "fetch", "database", "sql", "git", "deploy", "docker", "npm", "node",
  "backend", "frontend", "framework", "library", "component", "hook",
];

const REASONING_KEYWORDS = [
  "why", "explain why", "reason", "reasoning", "logic", "prove", "proof",
  "deduce", "infer", "conclude", "analyze", "critical thinking", "argument",
  "fallacy", "hypothesis", "theorem", "paradox", "contradiction", "philosophy",
  "think step by step", "step-by-step", "breakdown", "evaluate",
];

const MATH_KEYWORDS = [
  "math", "calculus", "integral", "derivative", "equation", "algebra",
  "geometry", "trigonometry", "statistics", "probability", "matrix",
  "vector", "physics", "chemistry", "formula", "solve", "calculate",
  "graph", "function", "polynomial", "logarithm", "exponent", "limit",
  "series", "sequence", "differential", "linear algebra",
];

const CREATIVE_KEYWORDS = [
  "write", "essay", "story", "poem", "creative", "narrative", "blog",
  "article", "letter", "speech", "script", "dialogue", "fiction",
  "describe", "imagine", "compose", "draft", "rewrite", "summarize",
  "paraphrase", "review", "critique",
];

function detectQueryType(text: string): "coding" | "reasoning" | "math" | "creative" | "general" {
  const lower = text.toLowerCase();
  
  // Score each category
  let codingScore = 0, reasoningScore = 0, mathScore = 0, creativeScore = 0;
  
  for (const kw of CODING_KEYWORDS) if (lower.includes(kw)) codingScore++;
  for (const kw of REASONING_KEYWORDS) if (lower.includes(kw)) reasoningScore++;
  for (const kw of MATH_KEYWORDS) if (lower.includes(kw)) mathScore++;
  for (const kw of CREATIVE_KEYWORDS) if (lower.includes(kw)) creativeScore++;
  
  // Check for code blocks
  if (text.includes("```") || text.includes("function ") || text.includes("const ") || text.includes("let ")) codingScore += 3;
  
  const max = Math.max(codingScore, reasoningScore, mathScore, creativeScore);
  if (max === 0) return "general";
  if (codingScore === max) return "coding";
  if (mathScore === max) return "math";
  if (reasoningScore === max) return "reasoning";
  return "creative";
}

function getModelsForQuery(queryType: string): string[] {
  switch (queryType) {
    case "coding": return [...CODING_MODELS, AUTO_ROUTER, ...FALLBACK_MODELS];
    case "reasoning": return [...REASONING_MODELS, AUTO_ROUTER, ...FALLBACK_MODELS];
    case "math": return [...MATH_MODELS, AUTO_ROUTER, ...FALLBACK_MODELS];
    case "creative": return [...CREATIVE_MODELS, AUTO_ROUTER, ...FALLBACK_MODELS];
    default: return [...PRIMARY_MODELS, AUTO_ROUTER, ...FALLBACK_MODELS];
  }
}

async function searchSerper(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 4, gl: "us", hl: "en" }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    let ctx = "";
    if (data.answerBox) ctx += `Direct Answer: ${data.answerBox.answer ?? data.answerBox.snippet ?? ""}\n`;
    if (data.knowledgeGraph?.description) ctx += `${data.knowledgeGraph.title}: ${data.knowledgeGraph.description}\n`;
    for (const r of (data.organic ?? []).slice(0, 4)) ctx += `${r.title}: ${r.snippet ?? ""}\n`;
    return ctx;
  } catch { return ""; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let searchContext = "";
    if (lastMsg && SERPER_API_KEY) {
      searchContext = await searchSerper(lastMsg.content.slice(0, 120), SERPER_API_KEY);
    }

    // Detect query type and select appropriate models
    const queryType = lastMsg ? detectQueryType(lastMsg.content) : "general";
    const models = getModelsForQuery(queryType);
    console.log(`[Lumina] Query type: ${queryType}, trying ${models.length} models`);

    let systemPrompt = `You are Lumina AI — a friendly, warm, and brilliant study buddy. Built by Tarun Kartikeya.

CRITICAL RULES:
- You are a CONVERSATIONAL friend first, tutor second. Read the vibe of the message.
- If someone says "hello", "hi", "hey", "what's up", "how are you" — just greet them back warmly and casually like a friend would! Do NOT interpret greetings as academic topics.
- Only teach when someone actually asks a question or wants to learn something.
- Be natural. Be human. Chat like a real person, not a textbook.

When someone DOES ask an academic question:
- Start with a vivid analogy or real-world connection that makes the concept click instantly
- Build layer by layer from intuition to formal understanding
- Weave in fascinating facts, historical context, or cross-disciplinary connections
- When explaining math/science, show the "why" behind every formula
- Write in rich, flowing paragraphs. NO bullet points. NO numbered lists. Pure natural prose.
- Use bold for key terms, italics for emphasis
- If the student is confused, try a completely different angle — metaphors, stories, thought experiments
- Be warm, encouraging, intellectually curious — like the brilliant older sibling who genuinely loves explaining things
- End academic answers with one sharp, thought-provoking check question

For casual chat: just be a chill, supportive friend. Keep it short and natural. No need to teach anything.
Start answering immediately. No filler phrases like "Great question!" or "Sure, let me explain."`;

    if (searchContext) systemPrompt += `\n\nREFERENCE DATA (use naturally, don't cite):\n${searchContext}`;

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // Try models with fallback chain
    for (const model of models) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: aiMessages,
            max_tokens: 2048,
            temperature: 0.7,
            stream: true,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[Lumina] ${model} error ${res.status}: ${errText}`);
          continue;
        }

        // Check if the response is actually streaming (not an error wrapped in 200)
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const body = await res.json();
          if (body.error) {
            console.error(`[Lumina] ${model} returned error in body:`, body.error);
            continue;
          }
        }

        console.log(`[Lumina] Success with model: ${model} (type: ${queryType})`);
        return new Response(res.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      } catch (e) {
        console.error(`[Lumina] ${model} exception:`, e);
      }
    }

    throw new Error("All models failed");
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
