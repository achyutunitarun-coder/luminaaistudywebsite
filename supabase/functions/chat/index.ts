import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────────────────────
// 1. WIKIPEDIA — encyclopedic + current events
// ─────────────────────────────────────────────────────────────
async function searchWikipedia(query: string): Promise<string> {
  try {
    const searchUrl =
      `https://en.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return "";

    const searchData = await searchRes.json();
    const titles: string[] = searchData.query?.search?.map((r: any) => r.title) ?? [];
    if (titles.length === 0) return "";

    const extractUrl =
      `https://en.wikipedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(titles.slice(0, 3).join("|"))}` +
      `&prop=extracts&exintro=true&explaintext=true&exlimit=3&format=json&origin=*`;

    const extractRes = await fetch(extractUrl);
    if (!extractRes.ok) return "";

    const extractData = await extractRes.json();
    const pages = extractData.query?.pages ?? {};

    let context = "";
    for (const page of Object.values(pages) as any[]) {
      if (page.extract && !page.missing) {
        context += `\n### [Wikipedia] ${page.title}\n${page.extract.slice(0, 2500)}\n`;
      }
    }
    return context;
  } catch (e) {
    console.error("Wikipedia error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 2. DUCKDUCKGO INSTANT ANSWERS
// ─────────────────────────────────────────────────────────────
async function searchDuckDuckGo(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "LuminaStudyAI/1.0 (educational tutor)" },
    });
    if (!res.ok) return "";

    const data = await res.json();
    let context = "";

    if (data.AbstractText) {
      context += `\n### [DuckDuckGo] ${data.Heading ?? query}\n${data.AbstractText}\n`;
      if (data.AbstractSource) context += `Source: ${data.AbstractSource}\n`;
    }
    if (data.Definition) {
      context += `\n**Definition (${data.DefinitionSource ?? ""}):** ${data.Definition}\n`;
    }
    if (data.Answer) {
      context += `\n**Instant Answer:** ${data.Answer}\n`;
    }

    const topics: any[] = data.RelatedTopics ?? [];
    const snippets = topics
      .filter((t: any) => t.Text)
      .slice(0, 4)
      .map((t: any) => `- ${t.Text}`);
    if (snippets.length > 0) {
      context += `\n**Related Facts:**\n${snippets.join("\n")}\n`;
    }

    return context;
  } catch (e) {
    console.error("DuckDuckGo error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 3. WIKTIONARY — definitions, etymology
// ─────────────────────────────────────────────────────────────
async function searchWiktionary(query: string): Promise<string> {
  try {
    const words = query.trim().split(/\s+/);
    const term = words.slice(0, 3).join(" ");

    const url =
      `https://en.wiktionary.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(term)}&prop=extracts&exintro=true` +
      `&explaintext=true&format=json&origin=*`;

    const res = await fetch(url);
    if (!res.ok) return "";

    const data = await res.json();
    const pages = data.query?.pages ?? {};

    for (const page of Object.values(pages) as any[]) {
      if (page.extract && !page.missing) {
        return `\n### [Wiktionary] ${page.title}\n${page.extract.slice(0, 800)}\n`;
      }
    }
    return "";
  } catch (e) {
    console.error("Wiktionary error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 4. HACKERNEWS — tech & science news
// ─────────────────────────────────────────────────────────────
async function searchHackerNews(query: string): Promise<string> {
  try {
    const url =
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}` +
      `&tags=story&hitsPerPage=4&attributesToRetrieve=title,url,points,story_text,created_at`;

    const res = await fetch(url);
    if (!res.ok) return "";

    const data = await res.json();
    const hits: any[] = data.hits ?? [];
    if (hits.length === 0) return "";

    let context = `\n### [HackerNews] Recent Discussions on "${query}"\n`;
    for (const hit of hits.slice(0, 4)) {
      context += `- **${hit.title}** (${hit.created_at?.slice(0, 10) ?? ""})\n`;
      if (hit.story_text) {
        context += `  ${hit.story_text.replace(/<[^>]+>/g, "").slice(0, 300)}\n`;
      }
    }
    return context;
  } catch (e) {
    console.error("HackerNews error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 5. OPEN LIBRARY — books
// ─────────────────────────────────────────────────────────────
async function searchOpenLibrary(query: string): Promise<string> {
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=3&fields=title,author_name,first_sentence,subject`;
    const res = await fetch(url);
    if (!res.ok) return "";

    const data = await res.json();
    const docs: any[] = data.docs ?? [];
    if (docs.length === 0) return "";

    let context = `\n### [Open Library] Books on "${query}"\n`;
    for (const doc of docs.slice(0, 3)) {
      context += `- **${doc.title}**`;
      if (doc.author_name?.length) context += ` by ${doc.author_name.slice(0, 2).join(", ")}`;
      context += "\n";
      if (doc.first_sentence) {
        const sentence = Array.isArray(doc.first_sentence)
          ? doc.first_sentence[0]
          : (doc.first_sentence?.value ?? doc.first_sentence);
        if (sentence) context += `  *${String(sentence).slice(0, 200)}*\n`;
      }
    }
    return context;
  } catch (e) {
    console.error("Open Library error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 6. ARXIV — research papers
// ─────────────────────────────────────────────────────────────
async function searchArxiv(query: string): Promise<string> {
  try {
    const url =
      `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}` +
      `&start=0&max_results=3&sortBy=relevance&sortOrder=descending`;

    const res = await fetch(url);
    if (!res.ok) return "";

    const text = await res.text();
    const entries = text.match(/<entry>([\s\S]*?)<\/entry>/g) ?? [];
    if (entries.length === 0) return "";

    let context = `\n### [arXiv] Research Papers on "${query}"\n`;
    for (const entry of entries.slice(0, 3)) {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
      const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);

      const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
      const summary = summaryMatch?.[1]?.replace(/\s+/g, " ").trim().slice(0, 400) ?? "";
      const published = publishedMatch?.[1]?.slice(0, 10) ?? "";

      if (title) {
        context += `- **${title}** (${published})\n`;
        if (summary) context += `  ${summary}\n`;
      }
    }
    return context;
  } catch (e) {
    console.error("arXiv error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 7. REST COUNTRIES — geography data
// ─────────────────────────────────────────────────────────────
async function searchRestCountries(query: string): Promise<string> {
  try {
    const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(query)}?fields=name,capital,region,subregion,population,area,languages,currencies`;
    const res = await fetch(url);
    if (!res.ok) return "";

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return "";

    const country = data[0];
    const languages = Object.values(country.languages ?? {}).join(", ");
    const currencies = Object.values(country.currencies ?? {})
      .map((c: any) => `${c.name} (${c.symbol ?? ""})`)
      .join(", ");

    return (
      `\n### [RestCountries] ${country.name?.common}\n` +
      `- **Official Name:** ${country.name?.official}\n` +
      `- **Capital:** ${country.capital?.[0] ?? "N/A"}\n` +
      `- **Region:** ${country.region} — ${country.subregion}\n` +
      `- **Population:** ${country.population?.toLocaleString()}\n` +
      `- **Area:** ${country.area?.toLocaleString()} km²\n` +
      `- **Languages:** ${languages}\n` +
      `- **Currencies:** ${currencies}\n`
    );
  } catch (e) {
    console.error("RestCountries error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 8. NUMBERS API — math trivia
// ─────────────────────────────────────────────────────────────
async function searchNumbersApi(query: string): Promise<string> {
  try {
    const numberMatch = query.match(/\b(\d+(\.\d+)?)\b/);
    if (!numberMatch) return "";

    const number = numberMatch[1];
    const isMath = /\b(math|number|prime|factor|equation)\b/i.test(query);
    const type = isMath ? "math" : "trivia";

    const url = `http://numbersapi.com/${number}/${type}?json`;
    const res = await fetch(url);
    if (!res.ok) return "";

    const data = await res.json();
    if (data.text) return `\n### [NumbersAPI] About ${number}\n${data.text}\n`;
    return "";
  } catch (e) {
    console.error("NumbersAPI error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 9. FREE DICTIONARY API
// ─────────────────────────────────────────────────────────────
async function searchFreeDictionary(query: string): Promise<string> {
  try {
    const words = query.trim().split(/\s+/);
    if (words.length > 3) return "";

    const term = words[0];
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`;
    const res = await fetch(url);
    if (!res.ok) return "";

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return "";

    const entry = data[0];
    let context = `\n### [Dictionary] ${entry.word}`;
    if (entry.phonetic) context += ` — *${entry.phonetic}*`;
    context += "\n";

    for (const meaning of (entry.meanings ?? []).slice(0, 3)) {
      context += `\n**${meaning.partOfSpeech}**\n`;
      for (const def of (meaning.definitions ?? []).slice(0, 2)) {
        context += `- ${def.definition}\n`;
        if (def.example) context += `  > *"${def.example}"*\n`;
      }
    }
    return context;
  } catch (e) {
    console.error("FreeDictionary error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 10. NASA IMAGES API
// ─────────────────────────────────────────────────────────────
async function searchNasaNews(query: string): Promise<string> {
  try {
    const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&year_start=2020`;
    const res = await fetch(url);
    if (!res.ok) return "";

    const data = await res.json();
    const items: any[] = data.collection?.items ?? [];
    if (items.length === 0) return "";

    let context = `\n### [NASA] on "${query}"\n`;
    for (const item of items.slice(0, 3)) {
      const d = item.data?.[0];
      if (d?.title) {
        context += `- **${d.title}** (${d.date_created?.slice(0, 10) ?? ""})\n`;
        if (d.description) context += `  ${d.description.slice(0, 300)}\n`;
      }
    }
    return context;
  } catch (e) {
    console.error("NASA error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 11. WIKIPEDIA "IN THE NEWS" — current events, awards, sports
//     Fetches the Wikipedia portal for recent events
// ─────────────────────────────────────────────────────────────
async function fetchWikipediaCurrentEvents(query: string): Promise<string> {
  try {
    // Search Wikipedia specifically with "2025" appended for recency
    const currentQuery = `${query} 2025`;
    const searchUrl =
      `https://en.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(currentQuery)}&srlimit=4&format=json&origin=*`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return "";

    const searchData = await searchRes.json();
    const titles: string[] = searchData.query?.search?.map((r: any) => r.title) ?? [];
    if (titles.length === 0) return "";

    // Get full extract of top result
    const extractUrl =
      `https://en.wikipedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(titles[0])}` +
      `&prop=extracts&explaintext=true&exlimit=1&format=json&origin=*`;

    const extractRes = await fetch(extractUrl);
    if (!extractRes.ok) return "";

    const extractData = await extractRes.json();
    const pages = extractData.query?.pages ?? {};

    for (const page of Object.values(pages) as any[]) {
      if (page.extract && !page.missing) {
        return `\n### [Wikipedia – Current/2025] ${page.title}\n${page.extract.slice(0, 3000)}\n`;
      }
    }
    return "";
  } catch (e) {
    console.error("Wikipedia current events error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────────────────────
interface SearchPlan {
  wikipedia: boolean;
  currentEvents: boolean; // NEW — always on for news/events
  duckduckgo: boolean;
  wiktionary: boolean;
  dictionary: boolean;
  hackernews: boolean;
  openLibrary: boolean;
  arxiv: boolean;
  restCountries: boolean;
  numbersApi: boolean;
  nasa: boolean;
}

function buildSearchPlan(message: string): SearchPlan {
  const m = message.toLowerCase();

  const isDefinition = /\b(define|what does|meaning of|etymology|word|term|vocabulary|spell|pronunciation)\b/.test(m);
  const isTech =
    /\b(ai|ml|software|code|programming|startup|tech|algorithm|llm|neural|gpu|chip|api|framework|model)\b/.test(m);
  const isResearch =
    /\b(research|paper|study|published|journal|arxiv|physics|biology|chemistry|math|theorem|proof|quantum|crispr|genome|protein|molecule)\b/.test(
      m,
    );
  const isGeo =
    /\b(country|countries|capital|continent|geography|population|language|currency|flag|region|nation)\b/.test(m);
  const isNumber = /\b\d+\b/.test(m) && /\b(number|math|prime|factor|trivia)\b/.test(m);
  const isBooks = /\b(book|author|novel|literature|poem|written by|published by|classic|chapter|fiction)\b/.test(m);
  const isSpace =
    /\b(space|nasa|planet|star|galaxy|asteroid|rocket|astronaut|satellite|universe|cosmos|moon|mars|jupiter)\b/.test(m);

  // Current events: awards, sports, elections, movies, news, pop culture
  const isCurrentEvent =
    /\b(oscar|oscar|academy award|grammy|emmy|bafta|golden globe|nobel|pulitzer|winner|winners|won|ceremony|2024|2025|2026|latest|recent|current|yesterday|last week|last month|this year|new|just|breaking|announced|released|premiered|launched|elected|appointed|died|passed away|married|championship|world cup|super bowl|nba finals|world series|box office|number one|trending|viral)\b/i.test(
      m,
    );

  return {
    wikipedia: true,
    currentEvents: isCurrentEvent, // extra Wikipedia search pinned to 2025
    duckduckgo: true, // always on — catches things others miss
    wiktionary: isDefinition,
    dictionary: isDefinition,
    hackernews: isTech,
    openLibrary: isBooks,
    arxiv: isResearch || isTech,
    restCountries: isGeo,
    numbersApi: isNumber,
    nasa: isSpace,
  };
}

// ─────────────────────────────────────────────────────────────
// TRIGGER — should we fetch internet at all?
// ─────────────────────────────────────────────────────────────
function needsInternetSearch(message: string): boolean {
  // Short greetings / pure math expressions don't need search
  const skipPatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|bye|sure|great|awesome)\b/i,
    /^[\d\s\+\-\*\/\(\)\^=<>]+$/, // pure arithmetic
  ];
  if (skipPatterns.some((r) => r.test(message.trim()))) return false;

  // Everything else gets a search — better to over-fetch than under-fetch
  return true;
}

function extractSearchQuery(message: string): string {
  return message
    .replace(
      /^(please\s+)?(explain|tell me about|what is|what are|who is|who was|define|describe|how does|why does|can you|could you|help me understand|i want to know about|summarize|give me an overview of|what happened (with|to|at|in)|did you hear about)\s+/i,
      "",
    )
    .replace(/[?!.]+$/, "")
    .trim()
    .slice(0, 120);
}

// ─────────────────────────────────────────────────────────────
// AGGREGATOR — parallel fetch all relevant sources
// ─────────────────────────────────────────────────────────────
async function fetchInternetContext(message: string): Promise<string> {
  const query = extractSearchQuery(message);
  const plan = buildSearchPlan(message);

  console.log(`[Lumina] Searching: "${query}" | Plan: ${JSON.stringify(plan)}`);

  const tasks: Promise<string>[] = [];

  if (plan.wikipedia) tasks.push(searchWikipedia(query));
  if (plan.currentEvents) tasks.push(fetchWikipediaCurrentEvents(query));
  if (plan.duckduckgo) tasks.push(searchDuckDuckGo(query));
  if (plan.wiktionary) tasks.push(searchWiktionary(query));
  if (plan.dictionary) tasks.push(searchFreeDictionary(query));
  if (plan.hackernews) tasks.push(searchHackerNews(query));
  if (plan.openLibrary) tasks.push(searchOpenLibrary(query));
  if (plan.arxiv) tasks.push(searchArxiv(query));
  if (plan.restCountries) tasks.push(searchRestCountries(query));
  if (plan.numbersApi) tasks.push(searchNumbersApi(query));
  if (plan.nasa) tasks.push(searchNasaNews(query));

  const results = await Promise.allSettled(tasks);

  const parts = results.map((r) => (r.status === "fulfilled" ? r.value : "")).filter(Boolean);

  const combined = parts.join("\n");
  console.log(`[Lumina] ${parts.length} sources, ${combined.length} chars total`);
  return combined;
}

// ─────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, memoryContext } = await req.json();

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let internetContext = "";

    if (lastUserMsg && needsInternetSearch(lastUserMsg.content)) {
      internetContext = await fetchInternetContext(lastUserMsg.content);
    }

    // ── System prompt — FORCE the model to trust live context ─
    let systemPrompt = `You are Lumina AI, an expert study tutor built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni. You help students understand concepts deeply. You provide:
- Clear explanations with examples
- Step-by-step solutions for math/science problems
- Diagrams described in text when useful
- Practice questions after explanations
- Encouragement and motivation for students

Keep responses well-structured using markdown. Be concise but thorough.`;

    if (internetContext) {
      // CRITICAL: Put internet context FIRST and be very explicit that it overrides training
      systemPrompt = `You are Lumina AI, an expert study tutor with LIVE internet access. Your internet connection fetches real-time data before every response.

## ⚡ CRITICAL RULES — READ CAREFULLY:
1. The "LIVE INTERNET DATA" section below was fetched from the internet RIGHT NOW, just for this question.
2. You MUST use this live data as your primary source of truth. It is always more accurate and current than your training data.
3. NEVER say "I don't have real-time access", "my knowledge cutoff", or "I cannot access the internet". These statements are FALSE — you DO have internet access via Lumina's live fetch system.
4. NEVER recommend the user to "Google it" or visit another website for information you already have in the live data below.
5. Integrate live data naturally into your answer without saying "according to the data" or "the live context says". Just answer confidently.
6. If the live data contains the answer (e.g. award winners, recent events, current leaders), state it directly and confidently.

## 🌐 LIVE INTERNET DATA (fetched right now — treat as ground truth):
${internetContext}

## Your role:
You are Lumina AI, an expert study tutor built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni. Help students understand concepts deeply:
- Clear explanations with examples
- Step-by-step solutions for math/science problems  
- Practice questions after explanations
- Encouragement and motivation

Keep responses well-structured using markdown. Be concise but thorough.`;
    }

    if (memoryContext && memoryContext.length > 0) {
      systemPrompt += `\n\n## 🧠 Memory from Past Conversations\nUse these to provide continuity. Do NOT mention reading past conversations unless asked.\n\n`;
      for (const conv of memoryContext) {
        systemPrompt += `### "${conv.title}"\n`;
        for (const msg of conv.messages) {
          systemPrompt += `${msg.role === "user" ? "Student" : "Lumina"}: ${msg.content}\n`;
        }
        systemPrompt += "\n";
      }
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1-0528:free",
        models: ["deepseek/deepseek-r1-0528:free", "openrouter/hunter-alpha", "nvidia/nemotron-3-super-120b-a12b:free"],
        max_tokens: 4096,
        include_reasoning: false,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
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
          JSON.stringify({
            error: providerMessage || "This request needs more available credits or fewer max_tokens.",
          }),
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
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
