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
// MODEL CATEGORY MAPPING — ALL FREE, ORDERED BY PRIORITY
// ═══════════════════════════════════════════════════════════

const CATEGORY_MODELS: Record<string, string[]> = {
  reasoning: [
    "deepseek/deepseek-r1:free",
    "nvidia/nemotron-nano-9b-v2:free",
  ],
  coding: [
    "qwen/qwen3-coder:free",
    "deepseek/deepseek-coder-v2-lite:free",
  ],
  general: [
    "deepseek/deepseek-chat:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],
  fast: [
    "mistralai/mistral-7b-instruct:free",
    "google/gemma-2b-it:free",
    "liquid/lfm2.5-1.2b-instruct:free",
  ],
  study: [
    "zhipu-ai/glm-4.5-air:free",
    "stepfun/step-3.5-flash:free",
  ],
  long_context: [
    "meta-llama/llama-3.3-70b-instruct:free",
    "zhipu-ai/glm-4.5-air:free",
  ],
  creative: [
    "arcee-ai/trinity-mini:free",
    "mistralai/mistral-7b-instruct:free",
  ],
};

// Balanced backup layer — tried after category models fail
const BALANCED_BACKUP = [
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "zhipu-ai/glm-4.5-air:free",
];

// Final safety net
const FINAL_FALLBACK = "openrouter/auto";

// ═══════════════════════════════════════════════════════════
// TIMEOUT CONFIG PER CATEGORY (ms)
// ═══════════════════════════════════════════════════════════

const TIMEOUT_MS: Record<string, number> = {
  fast: 2000,
  general: 4000,
  coding: 4000,
  study: 4000,
  creative: 4000,
  long_context: 6000,
  reasoning: 6000,
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

  // Code block boost
  if (text.includes("```") || text.includes("function ") || text.includes("const ") || text.includes("let ")) scores.coding += 3;

  // Long input boost
  if (text.length > 3000) scores.long_context += 3;

  // Short input boost
  if (text.length < 60 && !text.includes("```")) scores.fast += 2;

  const max = Math.max(...Object.values(scores));
  if (max === 0) return "general";

  // Priority order for tie-breaking
  const priority: Category[] = ["coding", "reasoning", "long_context", "study", "creative", "fast", "general"];
  for (const cat of priority) {
    if (scores[cat] === max) return cat;
  }
  return "general";
}

function buildModelChain(category: Category): string[] {
  const categoryModels = CATEGORY_MODELS[category] || CATEGORY_MODELS.general;
  // Deduplicate while preserving order
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

// ═══════════════════════════════════════════════════════════
// FETCH WITH TIMEOUT
// ═══════════════════════════════════════════════════════════

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
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Payload ──
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

    // ── Search context ──
    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let searchContext = "";
    if (lastMsg && SERPER_API_KEY) {
      const searchQuery = lastMsg.content.split("--- ATTACHED FILES ---")[0].trim().slice(0, 120);
      if (searchQuery.length > 5) {
        searchContext = await searchSerper(searchQuery, SERPER_API_KEY);
      }
    }

    // ── Detect category (or use manual override) ──
    const queryText = lastMsg?.content || "";
    const validModes: Category[] = ["reasoning", "coding", "general", "fast", "study", "long_context", "creative"];
    const category: Category = (mode && validModes.includes(mode)) ? mode : detectCategory(queryText);
    const models = buildModelChain(category);
    const timeout = TIMEOUT_MS[category] || 4000;
    console.log(`[Lumina] Mode: ${category} | Timeout: ${timeout}ms | Chain: ${models.length} models`);

    // ── System prompt ──
    const hasFiles = queryText.includes("--- ATTACHED FILES ---");

    let systemPrompt = `You are Lumina AI — a friendly, warm, and brilliant study buddy built by Tarun Kartikeya.

## CRITICAL RULES:
1. **ALWAYS respond directly to what the user is asking.** Read their FULL message including any attached file content. Never give a generic greeting when the user has asked a question or attached files.
2. **ATTACHED FILES**: When the user's message contains "--- ATTACHED FILES ---", they have uploaded a document. You MUST read ALL the file content carefully and respond based on it. NEVER ignore it. NEVER respond with just a greeting when files are attached.
3. **GREETINGS**: ONLY give a short 2-3 sentence greeting if the user's ENTIRE message is just "hello", "hi", "hey" etc. with NO other content and NO attached files.
4. **Casual chat** = short, friendly, human. Like texting a friend.

## ACADEMIC QUESTIONS:
- **Open** with a powerful analogy or real-world hook
- **Build** understanding layer by layer — intuition → formal definition → deeper insight
- **Explain** the WHY behind every formula, theorem, or concept
- **Format**: Rich Markdown — **bold** key terms, *italics* for emphasis, headings for sections
- **Math/Science**: Use LaTeX notation ($x^2$, $\\frac{1}{2}$). Show derivations, explain each step
- **Depth**: Thorough and comprehensive. Cover edge cases, misconceptions, exam insights
- **End** with ONE thought-provoking check question

## RESPONSE QUALITY:
- Start answering IMMEDIATELY. No filler like "Great question!" or "Sure, let me explain."
- Every academic response should feel like a mini-lecture from the world's best professor
- If the student seems confused, try a COMPLETELY different angle`;

    if (hasFiles) {
      systemPrompt += `\n\n## FILE CONTEXT ACTIVE:
The user has attached files. Their question is about the file content. Read ALL attached content and answer based on it. Do NOT greet — answer directly using the file content.`;
    }

    if (searchContext) systemPrompt += `\n\nREFERENCE DATA (use naturally, don't cite):\n${searchContext}`;

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // ── Try models with fallback + timeout ──
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

        // Inject model/mode metadata as first SSE event
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
