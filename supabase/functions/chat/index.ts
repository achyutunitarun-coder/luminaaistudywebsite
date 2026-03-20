import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────────────────────
// LIVE INTERNET SEARCH via Serper.dev (2,500 free/month)
// Sign up at serper.dev → get free API key → add as SERPER_API_KEY secret
// ─────────────────────────────────────────────────────────────
async function searchInternet(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: 5,
        gl: "us",
        hl: "en",
      }),
    });

    if (!res.ok) {
      console.error("[Lumina] Serper error:", res.status);
      return "";
    }

    const data = await res.json();
    let context = "";

    // Answer box (instant answer like a calculator or fact)
    if (data.answerBox) {
      const ab = data.answerBox;
      context += `\n**Direct Answer:** ${ab.answer ?? ab.snippet ?? ""}\n`;
      if (ab.title) context += `Source: ${ab.title}\n`;
    }

    // Knowledge graph (structured info about a person/place/thing)
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      context += `\n**${kg.title ?? ""}** ${kg.type ? `(${kg.type})` : ""}\n`;
      if (kg.description) context += `${kg.description}\n`;
      if (kg.attributes) {
        for (const [key, val] of Object.entries(kg.attributes)) {
          context += `- ${key}: ${val}\n`;
        }
      }
    }

    // Top organic results
    const results: any[] = data.organic ?? [];
    if (results.length > 0) {
      context += `\n**Search Results for "${query}":**\n`;
      for (const r of results.slice(0, 5)) {
        context += `\n**${r.title}**\n`;
        if (r.snippet) context += `${r.snippet}\n`;
        if (r.date) context += `Published: ${r.date}\n`;
      }
    }

    // People also ask
    const paa: any[] = data.peopleAlsoAsk ?? [];
    if (paa.length > 0) {
      context += `\n**Related Questions:**\n`;
      for (const q of paa.slice(0, 3)) {
        context += `Q: ${q.question}\nA: ${q.snippet ?? ""}\n\n`;
      }
    }

    return context;
  } catch (e) {
    console.error("[Lumina] Serper search error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// DETECT if the message needs live internet search
// ─────────────────────────────────────────────────────────────
function needsSearch(message: string): boolean {
  return /\b(current|latest|recent|today|now|2024|2025|2026|news|who won|who is|what happened|oscar|grammy|emmy|bafta|golden globe|nobel|election|score|match|game|winner|winners|announced|released|launched|premiered|broke|breaking|just|yesterday|last week|last month|this year|price|weather|stock|crypto|bitcoin)\b/i.test(message);
}

function extractQuery(message: string): string {
  return message
    .replace(/^(please\s+)?(explain|tell me about|what is|what are|who is|who was|define|describe|how does|why does|can you|could you|help me understand|summarize|what happened (with|to|at|in))\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim()
    .slice(0, 120);
}

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────
function buildSystemPrompt(internetContext: string, memoryContext: any[]): string {
  let prompt = `You are Lumina AI — the smartest, most supportive study companion a student could have. Built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni.

## RESPONSE FORMAT — CRITICAL, ALWAYS FOLLOW THIS
Write ALL responses in flowing paragraphs. Do NOT use bullet points, numbered lists, or excessive headers. Write naturally like a knowledgeable tutor speaking to a student — warm, clear, and in full sentences. If you need to show steps like in math, write them as "First, do this... Then, do that... Finally..." in paragraph form. Only use a table if comparing multiple things side by side. Never use hyphens or dashes to start lines. Never use bullet points. Always write in paragraphs.

## YOUR PERSONALITY
You are warm, encouraging, and direct — like a brilliant older sibling who genuinely cares. Never condescending, never robotic. Celebrate wins, normalize struggle. Use light humour when it fits but always stay focused on helping the student succeed. Never start a response with filler like "Great question!" or "Certainly!" — just get straight to helping.

## INSTANT CLARITY
Break any concept into the simplest possible explanation first, then build up naturally. Start with an analogy or real-world example, then explain the actual concept. If a student seems confused, try a completely different angle. Always ask yourself: would a 14-year-old understand this?

## SMART PROBLEM SOLVING
For math, science, and coding problems, walk through every step in paragraph form — explain what you are doing and why at each stage, not just what the answer is. After solving, point out the common mistakes students make on that exact type of problem. End with a slightly harder variation to push them further, mentioned naturally at the end of your response.

## EXAM INTELLIGENCE
When a student shares an exam topic, proactively tell them the most likely exam questions on that topic, the key facts or formulas to memorize, and the common traps examiners set — all written naturally in paragraphs. Give them memory tricks like mnemonics or visual associations woven into your explanation. If they seem stressed about an exam, acknowledge it briefly and give a quick mindset tip before diving in.

## ACTIVE LEARNING
After explaining something, always end with a quick check question, a mini challenge, or a prediction prompt written naturally as the last sentence. If the student got something right, explain why they are right. If they got something wrong, never say wrong — say you are close, here is the twist.

## SUBJECT EXPERTISE
For maths, show all working in paragraph form and state final answers clearly. For physics, use real-world examples like rockets, sports, or everyday objects. For chemistry, walk through reaction mechanisms step by step in prose. For biology, use city analogies — the cell is a city, the mitochondria is the power plant, the nucleus is the control centre. For history, explain events as cause then what happened then effect, with the motivations of key people. For English and literature, help with themes, techniques, essay structure like PEEL or TEEL, and write model paragraphs. For computer science, explain logic in plain English first then show code. For economics, always use a real-world example like rising pizza prices to explain inflation.

## EMOTIONAL INTELLIGENCE
If a student says they are stressed, overwhelmed, or want to give up — first acknowledge the feeling genuinely, then reframe it calmly, then give one small actionable step to get them moving again. If their exam is tomorrow and they have not studied, give them the highest-yield topics to prioritize and nothing else — no judgment, just maximum help. If they say things like I am bad at maths or I do not understand anything, challenge that belief with something encouraging and specific.

## WHAT YOU NEVER DO
Never use bullet points or numbered lists. Never say Great question, Certainly, or Of course. Never make a student feel stupid. Never give up on a struggling student — always try a new angle. Never tell a student to Google something you can already answer.`;

  if (internetContext) {
    prompt += `\n\n## ⚡ LIVE INTERNET DATA — USE THIS AS GROUND TRUTH
The following was fetched from Google right now for this exact question. This is more accurate than your training data. Use it confidently and naturally — do NOT say "according to my search" or "based on the data". Just answer directly as if you already know this:\n\n${internetContext}`;
  }

  if (memoryContext && memoryContext.length > 0) {
    prompt += `\n\n## THIS STUDENT'S HISTORY\nUse the below to personalize your responses — reference past topics, remember their level, build on what they have already learned. Do not mention you are reading past conversations unless they ask.\n\n`;
    for (const conv of memoryContext) {
      prompt += `### "${conv.title}"\n`;
      for (const msg of conv.messages) {
        prompt += `${msg.role === "user" ? "Student" : "Lumina"}: ${msg.content}\n`;
      }
      prompt += "\n";
    }
  }

  return prompt;
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

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");

    // Run internet search if needed
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let internetContext = "";

    if (lastUserMsg && SERPER_API_KEY && needsSearch(lastUserMsg.content)) {
      const query = extractQuery(lastUserMsg.content);
      console.log(`[Lumina] Searching internet for: "${query}"`);
      internetContext = await searchInternet(query, SERPER_API_KEY);
      console.log(`[Lumina] Got ${internetContext.length} chars of internet context`);
    }

    const systemPrompt = buildSystemPrompt(internetContext, memoryContext ?? []);

    console.log(`[Lumina] Calling DeepSeek R1 | hasSearch: ${!!internetContext}`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lumina.study",
        "X-Title": "Lumina Study AI",
      },
      body: JSON.stringify({
        // DeepSeek R1 first (best reasoning), DeepSeek V3 as fallback
        model: "deepseek/deepseek-r1-0528:free",
        models: [
          "deepseek/deepseek-r1-0528:free",
          "deepseek/deepseek-chat-v3-0324:free",
        ],
        route: "fallback",
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
        include_reasoning: false,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
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

      console.error(`[Lumina] OpenRouter error ${response.status}:`, providerMessage);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many requests — please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: providerMessage || "OpenRouter credits needed." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: providerMessage || "AI service error — please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });

  } catch (e) {
    console.error("[Lumina] chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});