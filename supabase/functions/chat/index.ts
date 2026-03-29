import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PAYLOAD_BYTES = 50_000;
const MAX_MESSAGES = 50;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ═══════════════════════════════════════════════════════════
// VERIFIED FREE MODELS (as of 2026-03-29)
// ═══════════════════════════════════════════════════════════

const CATEGORY_MODELS: Record<string, string[]> = {
  reasoning: [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "openai/gpt-oss-120b:free",
  ],
  coding: [
    "qwen/qwen3-coder:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "openai/gpt-oss-120b:free",
  ],
  general: [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-3-27b-it:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
  ],
  fast: [
    "google/gemma-3n-e4b-it:free",
    "google/gemma-3n-e2b-it:free",
    "google/gemma-3-4b-it:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "liquid/lfm-2.5-1.2b-instruct:free",
  ],
  study: [
    "z-ai/glm-4.5-air:free",
    "stepfun/step-3.5-flash:free",
    "google/gemma-3-12b-it:free",
  ],
  long_context: [
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
  ],
  creative: [
    "arcee-ai/trinity-large-preview:free",
    "arcee-ai/trinity-mini:free",
    "google/gemma-3-27b-it:free",
  ],
};

// Balanced backup layer
const BALANCED_BACKUP = [
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "minimax/minimax-m2.5:free",
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
];

const FINAL_FALLBACK = "openrouter/auto";

// Timeouts (ms)
const TIMEOUT_MS: Record<string, number> = {
  fast: 8000,
  general: 12000,
  coding: 12000,
  study: 12000,
  creative: 12000,
  long_context: 15000,
  reasoning: 15000,
};

// ═══════════════════════════════════════════════════════════
// KEYWORD-BASED TASK DETECTION
// ═══════════════════════════════════════════════════════════

const CODING_KW = [
  "code","coding","program","function","bug","debug","javascript","python",
  "typescript","react","html","css","api","algorithm","syntax","compile",
  "runtime","error","exception","class","array","variable","loop","import",
  "export","async","await","promise","fetch","database","sql","git","deploy",
  "docker","npm","node","backend","frontend","framework","library","component",
  "hook","rust","java","golang","c++","swift","kotlin",
];

const REASONING_KW = [
  "why","explain why","reason","reasoning","logic","prove","proof","deduce",
  "infer","conclude","analyze","critical thinking","argument","fallacy",
  "hypothesis","theorem","paradox","contradiction","philosophy","step by step",
  "step-by-step","breakdown","evaluate","math","calculus","integral",
  "derivative","equation","algebra","geometry","trigonometry","statistics",
  "probability","matrix","vector","physics","chemistry","formula","solve",
  "calculate","polynomial","logarithm","exponent","limit","series",
  "sequence","differential","linear algebra",
];

const STUDY_KW = [
  "study","learn","explain","concept","definition","exam","test prep",
  "revision","flashcard","quiz","chapter","textbook","lecture","syllabus",
  "curriculum","practice","homework","assignment","notes","summary",
  "important points","key concepts",
];

const CREATIVE_KW = [
  "write","essay","story","poem","creative","narrative","blog","article",
  "letter","speech","script","dialogue","fiction","describe","imagine",
  "compose","draft","rewrite","paraphrase","review","critique","tone",
  "storytelling",
];

const LONG_CONTEXT_KW = [
  "summarize","summary","long text","entire document","full text",
  "large input","whole file","all pages","condense","brief overview",
  "tldr","key takeaways",
];

const FAST_KW = [
  "quick","fast","short answer","yes or no","one word","brief",
  "simple","what is","define","translate","convert","how much",
  "when did","where is","who is",
];

type Category = "reasoning" | "coding" | "general" | "fast" | "study" | "long_context" | "creative";

function detectCategory(text: string): Category {
  const lower = text.toLowerCase();
  const scores: Record<Category, number> = {
    reasoning: 0, coding: 0, general: 0, fast: 0,
    study: 0, long_context: 0, creative: 0,
  };

  for (const kw of CODING_KW) if (lower.includes(kw)) scores.coding++;
  for (const kw of REASONING_KW) if (lower.includes(kw)) scores.reasoning++;
  for (const kw of STUDY_KW) if (lower.includes(kw)) scores.study++;
  for (const kw of CREATIVE_KW) if (lower.includes(kw)) scores.creative++;
  for (const kw of LONG_CONTEXT_KW) if (lower.includes(kw)) scores.long_context++;
  for (const kw of FAST_KW) if (lower.includes(kw)) scores.fast++;

  if (text.includes("```") || text.includes("function ") || text.includes("const ") || text.includes("let ")) scores.coding += 3;
  if (text.length > 3000) scores.long_context += 3;
  if (text.length < 60 && !text.includes("```")) scores.fast += 2;

  const max = Math.max(...Object.values(scores));
  if (max === 0) return "general";

  const priority: Category[] = ["coding", "reasoning", "long_context", "study", "creative", "fast", "general"];
  for (const cat of priority) {
    if (scores[cat] === max) return cat;
  }
  return "general";
}

function buildModelChain(category: Category): string[] {
  const categoryModels = CATEGORY_MODELS[category] || CATEGORY_MODELS.general;
  const seen = new Set<string>();
  const chain: string[] = [];
  for (const m of [...categoryModels, ...BALANCED_BACKUP, FINAL_FALLBACK]) {
    if (!seen.has(m)) { seen.add(m); chain.push(m); }
  }
  return chain;
}

// ═══════════════════════════════════════════════════════════
// SERPER SEARCH
// ═══════════════════════════════════════════════════════════

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

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.text();
    if (body.length > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { messages, mode } = JSON.parse(body);
    if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: "Invalid or too many messages (max 50)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let searchContext = "";
    if (lastMsg && SERPER_API_KEY) {
      const searchQuery = lastMsg.content.split("--- ATTACHED FILES ---")[0].trim().slice(0, 120);
      if (searchQuery.length > 5) {
        searchContext = await searchSerper(searchQuery, SERPER_API_KEY);
      }
    }

    const queryText = lastMsg?.content || "";
    const validModes: Category[] = ["reasoning", "coding", "general", "fast", "study", "long_context", "creative"];
    const category: Category = (mode && validModes.includes(mode)) ? mode : detectCategory(queryText);
    const models = buildModelChain(category);
    const timeout = TIMEOUT_MS[category] || 12000;
    console.log(`[Lumina] Mode: ${category} | Timeout: ${timeout}ms | Chain: ${models.length} models`);

    // Check if user actually attached files
    const hasFiles = queryText.includes("--- ATTACHED FILES ---");

    let systemPrompt = `You are Lumina AI — a friendly, warm, and brilliant study buddy built by Tarun Kartikeya.

RULES:
- If the user sends a casual greeting (hi, hello, hey) with no question, reply with a warm 2-3 sentence greeting and ask what they need help with. Keep it natural.
- For academic questions: open with an analogy, build understanding layer by layer, use rich Markdown formatting with **bold** key terms, LaTeX for math ($x^2$, $\\frac{1}{2}$), and end with a check question.
- Start answering immediately — no filler phrases like "Great question!" or "Sure!"
- Be thorough but clear. Every response should feel like a mini-lecture from the best professor.`;

    if (hasFiles) {
      systemPrompt += `\n\nThe user has attached files in their message (after "--- ATTACHED FILES ---"). Read ALL the file content and respond based on it. Focus on the file content.`;
    }

    if (searchContext) systemPrompt += `\n\nReference data (use naturally, don't cite):\n${searchContext}`;

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    for (const model of models) {
      try {
        const res = await fetchWithTimeout(OPENROUTER_URL, {
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
        }, timeout);

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[Lumina] ${model} error ${res.status}: ${errText.slice(0, 200)}`);
          continue;
        }

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const jsonBody = await res.json();
          if (jsonBody.error) {
            console.error(`[Lumina] ${model} body error:`, jsonBody.error);
            continue;
          }
        }

        console.log(`[Lumina] ✓ ${model} (mode: ${category})`);

        const metaEvent = `data: ${JSON.stringify({ lumina_meta: { model, mode: category } })}\n\n`;
        const metaBytes = new TextEncoder().encode(metaEvent);

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        (async () => {
          await writer.write(metaBytes);
          const reader = res.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
          await writer.close();
        })();

        return new Response(readable, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      } catch (e) {
        const isTimeout = e instanceof DOMException && e.name === "AbortError";
        console.error(`[Lumina] ${model} ${isTimeout ? "TIMEOUT" : "exception"}:`, isTimeout ? `>${timeout}ms` : e);
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
