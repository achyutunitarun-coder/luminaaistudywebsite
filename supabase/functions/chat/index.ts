import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEB_CACHE_TTL_MS = 5 * 60 * 1000;
const WEB_FETCH_TIMEOUT_MS = 1800;
const PROVIDER_TIMEOUT_MS = 25000;
const MAX_CONTEXT_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;
const MAX_MEMORY_CHATS = 3;
const MAX_MEMORY_MESSAGES = 2;
const MAX_MEMORY_CHARS = 180;

const webCache = new Map<string, { expiresAt: number; context: string }>();

const withTimeout = async (url: string, init: RequestInit = {}, timeoutMs = WEB_FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const cleanupWebCache = () => {
  const now = Date.now();
  for (const [key, value] of webCache.entries()) {
    if (value.expiresAt <= now) webCache.delete(key);
  }
};

const clampText = (text: string, maxChars: number) => text.replace(/\s+/g, " ").trim().slice(0, maxChars);

const needsWebSearch = (text: string) => {
  const lower = text.toLowerCase();
  return [
    "latest",
    "current",
    "today",
    "now",
    "news",
    "recent",
    "2024",
    "2025",
    "2026",
    "who won",
    "stock",
    "market",
    "price",
    "research",
    "breakthrough",
    "applications",
  ].some((trigger) => lower.includes(trigger));
};

const makeSearchQuery = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\n\r]/g, " ")
    .slice(0, 120);

async function searchWikipedia(query: string): Promise<string> {
  try {
    const summaryRes = await withTimeout(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "LuminaAI/1.0" } },
    );

    if (summaryRes.ok) {
      const data = await summaryRes.json();
      if (data?.extract) {
        return `[Wikipedia] ${data.title}: ${clampText(data.extract, 520)}`;
      }
    }

    const searchRes = await withTimeout(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`,
      { headers: { "User-Agent": "LuminaAI/1.0" } },
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      const snippets = data?.query?.search
        ?.map((result: { snippet?: string }) => result.snippet?.replace(/<[^>]+>/g, "").trim())
        ?.filter(Boolean)
        ?.join(" | ");

      if (snippets) {
        return `[Wikipedia search] ${clampText(snippets, 520)}`;
      }
    }
  } catch {
    // Ignore web fetch errors for speed/resilience
  }
  return "";
}

async function searchDuckDuckGo(query: string): Promise<string> {
  try {
    const res = await withTimeout(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`,
      { headers: { "User-Agent": "LuminaAI/1.0" } },
    );

    if (!res.ok) return "";

    const data = await res.json();
    const abstract = typeof data?.AbstractText === "string" ? data.AbstractText : "";

    if (abstract) {
      return `[Web] ${clampText(abstract, 520)}`;
    }

    const relatedTopics = Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : [];
    const relatedText = relatedTopics
      .flatMap((topic: { Text?: string; Topics?: Array<{ Text?: string }> }) => {
        if (typeof topic?.Text === "string") return [topic.Text];
        if (Array.isArray(topic?.Topics)) return topic.Topics.map((nested) => nested?.Text).filter(Boolean);
        return [];
      })
      .slice(0, 4)
      .join(" | ");

    if (relatedText) {
      return `[Web related] ${clampText(relatedText, 520)}`;
    }
  } catch {
    // Ignore web fetch errors for speed/resilience
  }

  return "";
}

async function getWebContext(query: string): Promise<string> {
  cleanupWebCache();

  const key = query.toLowerCase();
  const cached = webCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.context;

  const [wikiResult, duckResult] = await Promise.allSettled([
    searchWikipedia(query),
    searchDuckDuckGo(query),
  ]);

  const snippets = [
    wikiResult.status === "fulfilled" ? wikiResult.value : "",
    duckResult.status === "fulfilled" ? duckResult.value : "",
  ].filter(Boolean);

  const context = snippets.join("\n\n");
  if (context) {
    webCache.set(key, { expiresAt: Date.now() + WEB_CACHE_TTL_MS, context });
  }

  return context;
}

const sanitizeMessages = (messages: unknown) => {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (message): message is { role: "user" | "assistant"; content: string } =>
        !!message &&
        typeof message === "object" &&
        ((message as { role?: string }).role === "user" || (message as { role?: string }).role === "assistant") &&
        typeof (message as { content?: string }).content === "string",
    )
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: clampText(message.content, MAX_MESSAGE_CHARS),
    }));
};

const sanitizeMemoryContext = (memoryContext: unknown) => {
  if (!Array.isArray(memoryContext)) return [];

  return memoryContext
    .slice(0, MAX_MEMORY_CHATS)
    .map((conversation) => {
      if (!conversation || typeof conversation !== "object") return null;

      const title = typeof (conversation as { title?: unknown }).title === "string"
        ? clampText((conversation as { title: string }).title, 120)
        : "Previous Conversation";

      const messages = Array.isArray((conversation as { messages?: unknown[] }).messages)
        ? (conversation as { messages: unknown[] }).messages
            .filter(
              (message): message is { role: "user" | "assistant"; content: string } =>
                !!message &&
                typeof message === "object" &&
                ((message as { role?: string }).role === "user" || (message as { role?: string }).role === "assistant") &&
                typeof (message as { content?: string }).content === "string",
            )
            .slice(0, MAX_MEMORY_MESSAGES)
            .map((message) => ({
              role: message.role,
              content: clampText(message.content, MAX_MEMORY_CHARS),
            }))
        : [];

      if (messages.length === 0) return null;
      return { title, messages };
    })
    .filter(Boolean) as Array<{ title: string; messages: Array<{ role: "user" | "assistant"; content: string }> }>;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const messages = sanitizeMessages(body?.messages);
    const memoryContext = sanitizeMemoryContext(body?.memoryContext);

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "No valid chat messages provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    let systemPrompt = `You are Lumina AI, an expert study tutor built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni.

You can use live internet context to answer current events, recent news, modern scientific applications, and time-sensitive facts.

RULES:
- Never say you lack real-time access.
- Never ask the user to search elsewhere.
- If the question is time-sensitive, use provided web context naturally.

As a study tutor you provide:
- Clear explanations with examples
- Step-by-step solutions for math/science
- Practice questions after explanations
- Encouraging guidance

Keep responses clear, concise, and useful.`;

    if (memoryContext.length > 0) {
      systemPrompt += "\n\n## Memory from Past Conversations\nUse these to preserve continuity without explicitly saying you are reading old chats.\n\n";

      for (const conversation of memoryContext) {
        systemPrompt += `### ${conversation.title}\n`;
        for (const message of conversation.messages) {
          systemPrompt += `${message.role === "user" ? "Student" : "Lumina"}: ${message.content}\n`;
        }
        systemPrompt += "\n";
      }
    }

    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (lastUserMessage && needsWebSearch(lastUserMessage.content)) {
      const query = makeSearchQuery(lastUserMessage.content);
      const webContext = await getWebContext(query);
      if (webContext) {
        systemPrompt += `\n\n## Live Web Context\n${webContext}\n\nBlend this into your answer naturally.`;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        models: [
          "google/gemini-2.0-flash-exp:free",
          "mistralai/mistral-small-3.1-24b:free",
          "deepseek/deepseek-chat-v3-0324:free",
        ],
        route: "fallback",
        temperature: 0.3,
        max_tokens: 1200,
        include_reasoning: false,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeout);
    });

    if (!response.ok) {
      const rawError = await response.text();
      let providerMessage = "";

      try {
        const parsed = JSON.parse(rawError);
        providerMessage = parsed?.error?.message ?? parsed?.error ?? "";
      } catch {
        providerMessage = rawError;
      }

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: providerMessage || "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: providerMessage || "Credits needed. Please check your OpenRouter balance." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      console.error("AI provider error:", response.status, rawError);
      return new Response(JSON.stringify({ error: providerMessage || "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("chat error:", error);

    if (message.includes("aborted")) {
      return new Response(JSON.stringify({ error: "Request timed out. Please try a shorter prompt." }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});