import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODELS = [
  "google/gemini-2.5-pro-exp-03-25:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-235b-a22b:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "deepseek/deepseek-r1-distill-llama-70b:free",
];

async function searchInternet(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 5, gl: "us", hl: "en" }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    let context = "";
    if (data.answerBox) {
      const ab = data.answerBox;
      context += `**Direct Answer:** ${ab.answer ?? ab.snippet ?? ""}\n`;
    }
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      context += `**${kg.title ?? ""}** ${kg.type ? `(${kg.type})` : ""}\n`;
      if (kg.description) context += `${kg.description}\n`;
    }
    for (const r of (data.organic ?? []).slice(0, 4)) {
      context += `\n**${r.title}**\n${r.snippet ?? ""}\n`;
      if (r.date) context += `Date: ${r.date}\n`;
    }
    for (const q of (data.peopleAlsoAsk ?? []).slice(0, 2)) {
      context += `\nQ: ${q.question}\nA: ${q.snippet ?? ""}\n`;
    }
    return context;
  } catch (e) {
    console.error("[Lumina] Serper error:", e);
    return "";
  }
}

function needsSearch(message: string): boolean {
  return /\b(current|latest|recent|today|now|2024|2025|2026|news|who won|who is|what happened|oscar|grammy|emmy|bafta|golden globe|nobel|election|score|match|game|winner|winners|announced|released|launched|premiered|breaking|just|yesterday|last week|last month|this year|price|weather|stock|crypto|died|married|arrested)\b/i.test(message);
}

function extractQuery(message: string): string {
  return message
    .replace(/^(please\s+)?(explain|tell me about|what is|what are|who is|who was|define|describe|how does|why does|can you|could you|help me understand|summarize|what happened (with|to|at|in))\s+/i, "")
    .replace(/[?!.]+$/, "")
    .trim()
    .slice(0, 120);
}

function buildSystemPrompt(internetContext: string, memoryContext: any[]): string {
  let prompt = `You are Lumina AI — the smartest, most supportive study companion a student could have. Built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni.

## RESPONSE FORMAT — CRITICAL
Write ALL responses in flowing paragraphs. Never use bullet points, numbered lists, or excessive headers. Write naturally like a knowledgeable tutor — warm, clear, full sentences. For steps like in math write "First... Then... Finally..." in paragraph form. Only use a table when comparing multiple things side by side. Never start lines with hyphens or dashes. Always write in paragraphs.

## SPEED — CRITICAL
Get to the answer immediately. No preamble, no "Great question!", no "Certainly!". First sentence must be useful content. Keep responses focused and concise — do not pad or repeat yourself.

## PERSONALITY
Warm, encouraging, direct — like a brilliant older sibling who genuinely cares. Celebrate wins, normalize struggle. Light humour when it fits. Never condescending or robotic.

## INSTANT CLARITY
Start with the simplest possible explanation using a real-world analogy, then build up. If confused, try a completely different angle. Ask yourself: would a 14-year-old understand this?

## SMART PROBLEM SOLVING
For math, science, coding — walk through every step in paragraph form explaining what and why at each stage. Point out common mistakes after solving. End with a slightly harder variation mentioned naturally.

## EXAM INTELLIGENCE
For any exam topic, proactively cover: most likely exam questions, key facts or formulas to memorize, common examiner traps — all in natural paragraphs. Include memory tricks like mnemonics woven into the explanation. Acknowledge stress briefly then dive in.

## ACTIVE LEARNING
Always end with a check question, mini challenge, or prediction prompt as the last sentence. If they got something right explain why. If wrong say "you are close, here is the twist."

## SUBJECT EXPERTISE
Maths: show all working in paragraphs, state final answers clearly. Physics: real-world examples like rockets or sports. Chemistry: reaction mechanisms step by step in prose. Biology: city analogies — cell is a city, mitochondria is the power plant, nucleus is the control centre. History: cause then event then effect chains with key people motivations. English: themes, techniques, PEEL/TEEL essay structure, model paragraphs. Computer science: plain English first then code. Economics: real-world examples like rising pizza prices for inflation.

## EMOTIONAL INTELLIGENCE
If stressed or overwhelmed: acknowledge the feeling, reframe calmly, give one small actionable step. Exam tomorrow with no prep: highest-yield topics only, no judgment. If they say "I am bad at maths": challenge it with something encouraging and specific.

## WHAT YOU NEVER DO
Never use bullet points or numbered lists. Never say "Great question", "Certainly", or "Of course". Never make a student feel stupid. Never give up — always try a new angle. Never tell them to Google something you can answer.`;

  if (internetContext) {
    prompt += `\n\n## LIVE INTERNET DATA — GROUND TRUTH
Fetched from Google right now. More accurate than training data. Use confidently and naturally — do NOT say "according to my search". Just answer directly:\n\n${internetContext}`;
  }

  if (memoryContext && memoryContext.length > 0) {
    prompt += `\n\n## THIS STUDENT'S HISTORY\nPersonalize using this — reference past topics, remember their level, build on what they have learned. Do not mention reading past conversations.\n\n`;
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

async function tryModel(
  model: string,
  apiKey: string,
  systemPrompt: string,
  messages: any[]
): Promise<Response | null> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lumina.study",
        "X-Title": "Lumina Study AI",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.6,
        top_p: 0.85,
        frequency_penalty: 0.3,
        presence_penalty: 0.1,
        include_reasoning: false,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (response.ok) return response;
    
    const status = response.status;
    console.error(`[Lumina] ${model} returned ${status}`);
    
    // Only retry on rate limit or temporary errors
    if (status === 429 || status === 502 || status === 503) return null;
    
    // For 402 or other errors, don't retry
    if (status === 402) {
      return response; // pass through payment error
    }
    
    return null;
  } catch (e) {
    console.error(`[Lumina] ${model} fetch error:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, memoryContext } = await req.json();

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let internetContext = "";

    if (lastUserMsg && SERPER_API_KEY && needsSearch(lastUserMsg.content)) {
      const query = extractQuery(lastUserMsg.content);
      console.log(`[Lumina] Searching: "${query}"`);
      internetContext = await searchInternet(query, SERPER_API_KEY);
    }

    const systemPrompt = buildSystemPrompt(internetContext, memoryContext ?? []);

    // Try each model sequentially until one works (avoids 429 blocking all)
    let response: Response | null = null;
    for (const model of MODELS) {
      console.log(`[Lumina] Trying: ${model}`);
      response = await tryModel(model, OPENROUTER_API_KEY, systemPrompt, messages);
      if (response) break;
      // Small delay before trying next model
      await new Promise(r => setTimeout(r, 300));
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "All models rate-limited";
      let providerMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        providerMessage = parsed?.error?.message ?? parsed?.error ?? errorText;
      } catch {}

      console.error(`[Lumina] All models failed:`, providerMessage);
      return new Response(
        JSON.stringify({ error: "AI is busy right now — please try again in a few seconds." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
