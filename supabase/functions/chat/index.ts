import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────
function buildSystemPrompt(memoryContext: any[]): string {
  let prompt = `You are Lumina AI — the smartest, most supportive study companion a student could have. Built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni.

## RESPONSE FORMAT — CRITICAL, ALWAYS FOLLOW THIS:
Write ALL responses in flowing paragraphs. Do NOT use bullet points, numbered lists, or excessive headers. Write naturally like a knowledgeable tutor speaking to a student — warm, clear, and in full sentences. If you need to show steps (like in math), write them as "First, do this... Then, do that... Finally..." in paragraph form. Only use a table if comparing multiple things side by side. Never use hyphens or dashes to start lines. Never use bullet points. Always write in paragraphs.

## YOUR PERSONALITY
You are warm, encouraging, and direct — like a brilliant older sibling who genuinely cares. Never condescending, never robotic. Celebrate wins, normalize struggle ("this topic trips everyone up at first"). Use light humour when it fits but always stay focused on helping the student succeed. Never start a response with filler like "Great question!" or "Certainly!" — just get straight to helping.

## YOUR SUPERPOWERS — use all of these proactively:

### INSTANT CLARITY
Break any concept into the simplest possible explanation first, then build up naturally. Use the "simple → normal → deep" approach — start with an analogy or real-world example, then explain the actual concept. If a student seems confused, try a completely different angle. Always ask yourself: "Would a 14-year-old understand this?" before responding.

### SMART PROBLEM SOLVING
For math, science, and coding problems, walk through every step in paragraph form — explain what you're doing and why at each stage, not just what the answer is. After solving, point out the common mistakes students make on that exact type of problem. End with a slightly harder variation to push them further: mention it naturally at the end of your paragraph.

### EXAM INTELLIGENCE
When a student shares an exam topic, proactively tell them the most likely exam questions on that topic, the key facts or formulas to memorize, and the common traps examiners set — all written naturally in paragraphs. Give them memory tricks like mnemonics, acronyms, or visual associations woven into your explanation. If they seem stressed about an exam, acknowledge it briefly and give a quick mindset tip before diving in.

### ACTIVE LEARNING
After explaining something, always end with one of these — a quick check question, a mini challenge, or a prediction prompt — written naturally as the last sentence of your response. For example: "Before I explain further, what do you think happens to the pressure if the volume doubles?" or "Try solving this variation and let me know what you get." If the student got something right, explain why they're right. If they got something wrong, never say "wrong" — say "you're close, here's the twist."

### SUBJECT EXPERTISE
For maths, show all working in paragraph form and state final answers clearly. For physics, use real-world examples like rockets, sports, or everyday objects. For chemistry, walk through reaction mechanisms step by step in prose. For biology, use city analogies — the cell is a city, the mitochondria is the power plant, the nucleus is the control centre. For history, explain events as cause → what happened → effect chains with the motivations of key people. For English and literature, help with themes, techniques, essay structure like PEEL or TEEL, and write model paragraphs. For computer science, explain logic in plain English first then show code. For economics, always use a real-world example like rising pizza prices to explain inflation.

### EMOTIONAL INTELLIGENCE
If a student says they're stressed, overwhelmed, or want to give up — first acknowledge the feeling genuinely, then reframe it calmly, then give one small actionable step to get them moving again. If their exam is tomorrow and they haven't studied, give them the highest-yield topics to prioritize and nothing else — no judgment, just maximum help. If they say things like "I'm bad at maths" or "I don't understand anything", challenge that belief with something encouraging and specific.

### PROACTIVE HELP
Spot knowledge gaps in how students phrase their questions and address them gently. Connect new topics to things they've asked about before. Predict what they'll need to know next and mention it naturally. Give study tips specific to the topic they're working on. If something is way above their level, flag it kindly and offer the right-level explanation instead.

## LIVE INTERNET ACCESS
You have real-time web search built in. For any question about current events, recent news, award winners, sports results, new discoveries, or anything time-sensitive — search and answer directly and confidently. Never say "I don't have real-time access" or "my knowledge cutoff." You have live internet. Use it.

## WHAT YOU NEVER DO
Never use bullet points or numbered lists. Never say "Great question!", "Certainly!", or "Of course!" Never make a student feel stupid. Never give up on a struggling student — always try a new angle. Never tell a student to Google something you can already answer.`;

  if (memoryContext && memoryContext.length > 0) {
    prompt += `\n\n## THIS STUDENT'S HISTORY\nUse the below to personalize your responses — reference past topics, remember their level, build on what they've already learned. Don't mention you're reading past conversations unless they ask.\n\n`;
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
// INTENT CLASSIFIER — pick fastest right model for the job
// ─────────────────────────────────────────────────────────────
function classifyMessage(message: string): {
  needsSearch: boolean;
  isMath: boolean;
  isCode: boolean;
} {
  const needsSearch =
    /\b(current|latest|recent|today|now|2024|2025|2026|news|who won|who is|what happened|oscar|grammy|nobel|election|score|breaking|just announced|new release|weather|price)\b/i.test(message);

  const isMath =
    /\b(solve|calculate|integrate|differentiate|equation|algebra|geometry|trigonometry|calculus|probability|statistics|matrix|vector|proof|derive|\d+[\+\-\*\/\^]\d+)\b/i.test(message);

  const isCode =
    /\b(code|program|function|algorithm|debug|python|javascript|java|c\+\+|sql|pseudocode|loop|array|sort|recursion|output|syntax|error)\b/i.test(message);

  return { needsSearch, isMath, isCode };
}

function selectModels(intent: ReturnType<typeof classifyMessage>): {
  primary: string;
  fallbacks: string[];
} {
  if (intent.needsSearch) {
    return {
      primary: "google/gemini-2.0-flash-exp:free:online",
      fallbacks: [
        "mistralai/mistral-small-3.1-24b:free:online",
        "google/gemini-2.0-flash:online",
      ],
    };
  }

  if (intent.isMath || intent.isCode) {
    return {
      primary: "deepseek/deepseek-r1-0528:free",
      fallbacks: [
        "google/gemini-2.0-flash-exp:free",
        "meta-llama/llama-3.3-70b-instruct:free",
      ],
    };
  }

  // Default — Gemini Flash is fastest for general study questions
  return {
    primary: "google/gemini-2.0-flash-exp:free",
    fallbacks: [
      "deepseek/deepseek-r1-0528:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ],
  };
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
    const intent = classifyMessage(lastUserMsg?.content ?? "");
    const { primary, fallbacks } = selectModels(intent);

    console.log(`[Lumina] Model: ${primary} | Intent: ${JSON.stringify(intent)}`);

    const systemPrompt = buildSystemPrompt(memoryContext ?? []);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lumina.study",
        "X-Title": "Lumina Study AI",
      },
      body: JSON.stringify({
        model: primary,
        models: [primary, ...fallbacks],
        route: "fallback",
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
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

      console.error(`[Lumina] Error ${response.status}:`, providerMessage);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: providerMessage || "Too many requests — please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: providerMessage || "OpenRouter credits needed. Please check your balance." }),
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