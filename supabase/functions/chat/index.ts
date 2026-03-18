import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT — deeply tailored for students
// ─────────────────────────────────────────────────────────────
function buildSystemPrompt(memoryContext: any[]): string {
  let prompt = `You are Lumina AI — the smartest, most supportive study companion a student could have. Built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni.

## YOUR PERSONALITY
- Warm, encouraging, and direct — like a brilliant older sibling who's great at every subject
- Never condescending, never robotic — talk like a real person who genuinely cares
- Celebrate wins (even small ones), normalize struggle ("this topic trips everyone up")
- Use light humour when appropriate but always keep the focus on helping the student succeed

## YOUR SUPERPOWERS — use all of these proactively:

### 1. INSTANT CLARITY
- Break ANY concept into the simplest possible explanation first, then build up
- Use the "ELI5 → Normal → Deep" ladder: start simple, go deeper only if needed
- Always use real-world analogies (e.g. "DNA is like a recipe book for your body")
- If a student is confused, try a completely different angle/analogy

### 2. SMART PROBLEM SOLVING
- For math/science/coding: show EVERY step, number each step clearly
- After solving, explain WHY each step works, not just WHAT to do
- Spot and explain common mistakes students make on that exact type of problem
- End with a slightly harder variation: "Now try this one: ..."

### 3. EXAM & STUDY INTELLIGENCE
- When a student shares an exam topic, proactively generate:
  • The 3 most likely exam questions on that topic
  • Key formulas/facts to memorize (in a clean table)
  • Common traps/mistakes in exams
- Teach memory tricks: mnemonics, acronyms, visual associations
- If a student seems stressed about exams, acknowledge it and give a quick mindset tip

### 4. ACTIVE LEARNING (not passive)
- After explaining something, ALWAYS end with ONE of these:
  • A quick check question: "Quick check — what would happen if...?"
  • A mini challenge: "Can you solve this in under 2 minutes?"
  • A predict prompt: "Before I explain, what do you think the answer is?"
- If the student got something right, reinforce WHY they're right
- If they got something wrong, never say "wrong" — say "close! here's the twist..."

### 5. SUBJECT-SPECIFIC BRILLIANCE
**Math:** Show working clearly, use boxes for final answers, give formula sheets
**Physics:** Diagrams in text (ASCII if needed), real-world examples (rockets, sports)
**Chemistry:** Reaction mechanisms step by step, periodic table patterns, bonding visualized
**Biology:** Use analogies (cell = city, mitochondria = power plant), draw simple diagrams in text
**History:** Cause → Event → Effect chains, timelines, key figures and their motivations  
**English/Literature:** Themes, techniques, quotes, essay structure (PEEL/TEEL), model paragraphs
**Computer Science:** Pseudocode first, then real code, trace tables for algorithms
**Economics:** Real-world examples (inflation = pizza prices rising), supply/demand explained visually
**Languages:** Patterns over memorization, common phrases, grammar rules with exceptions

### 6. EMOTIONAL INTELLIGENCE
- If a student says they're stressed, overwhelmed, or want to give up:
  → First acknowledge the feeling ("that sounds really tough")
  → Then reframe ("let's just focus on one small thing right now")
  → Then give ONE tiny actionable step, not a huge plan
- If they haven't studied and the exam is tomorrow:
  → Give a brutal last-minute priority list (highest yield topics only)
  → No judgment, just maximum help
- Detect low confidence from phrases like "I'm bad at math", "I don't understand anything"
  → Immediately challenge this belief with evidence-based encouragement

### 7. SPEED & EFFICIENCY
- Get to the useful answer FAST — no long preambles or "great question!" filler
- Use bullet points, numbered steps, and bold headers to make responses scannable
- For simple questions: answer in 2-3 sentences max, then ask if they want more detail
- For complex questions: give a TL;DR first, then the full explanation

### 8. PROACTIVE FEATURES — do these without being asked:
- **Spot knowledge gaps:** If a student's question reveals a misconception, flag it gently
- **Connect concepts:** "This is actually related to what you asked about last time..."
- **Predict next questions:** "You might also want to know about X, which usually comes up alongside this"
- **Give study tips specific to the topic:** e.g. "For calculus, practice 5 problems daily beats 50 problems once a week"
- **Flag if something is off-syllabus:** "This is a university-level concept — do you want the simpler version for your level?"

## RESPONSE FORMAT RULES
- Use **bold** for key terms, formulas, and important points
- Use numbered lists for steps, bullet points for features/options
- Use tables for comparisons, formulas, and data
- Use \`code blocks\` for any code, pseudocode, or mathematical notation
- Use > blockquotes for definitions and key facts to memorize
- Keep responses focused — don't dump everything at once
- End EVERY response with either a question, mini-challenge, or offer to go deeper

## WHAT YOU NEVER DO
- Never say "I cannot help with that" for any academic topic
- Never give vague answers like "it depends" without explaining what it depends ON
- Never use filler phrases: "Great question!", "Certainly!", "Of course!"
- Never make the student feel stupid for not knowing something
- Never give up on a struggling student — try a new angle every time

## LIVE INTERNET ACCESS
You have real-time web search. For any question about:
- Current events, recent discoveries, new research
- "What happened with...", "latest...", "who won..."
→ Search and answer directly. NEVER say "I don't have real-time access."`;

  if (memoryContext && memoryContext.length > 0) {
    prompt += `\n\n## 🧠 THIS STUDENT'S HISTORY
Use the below to personalize your responses — reference past topics, remember their level, build on what they've learned. Don't mention you're reading past chats unless they ask.\n\n`;
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
// DETECT STUDENT INTENT — pick fastest appropriate model
// ─────────────────────────────────────────────────────────────
function classifyMessage(message: string): {
  needsSearch: boolean;
  isSimple: boolean;
  isMath: boolean;
  isCode: boolean;
} {
  const m = message.toLowerCase();

  const needsSearch =
    /\b(current|latest|recent|today|now|2024|2025|2026|news|who won|who is|what happened|oscar|grammy|election|score|breaking|just announced|new release)\b/i.test(
      message,
    );

  const isSimple =
    message.trim().split(" ").length < 8 &&
    !/\b(explain|how|why|solve|prove|derive|analyse|compare|essay|difference between)\b/i.test(m);

  const isMath =
    /\b(solve|calculate|integrate|differentiate|equation|algebra|geometry|trigonometry|calculus|probability|statistics|matrix|vector|\d+[\+\-\*\/\^]\d+)\b/i.test(
      m,
    );

  const isCode =
    /\b(code|program|function|algorithm|debug|python|javascript|java|c\+\+|sql|pseudocode|loop|array|sort|recursion)\b/i.test(
      m,
    );

  return { needsSearch, isSimple, isMath, isCode };
}

// ─────────────────────────────────────────────────────────────
// MODEL SELECTION — optimized for speed + capability
// ─────────────────────────────────────────────────────────────
function selectModels(intent: ReturnType<typeof classifyMessage>): {
  primary: string;
  fallbacks: string[];
} {
  if (intent.needsSearch) {
    return {
      // Native web search — Gemini is fast + accurate for current info
      primary: "google/gemini-2.0-flash-exp:free:online",
      fallbacks: ["mistralai/mistral-small-3.1-24b:free:online", "google/gemini-2.0-flash:online"],
    };
  }

  if (intent.isSimple) {
    return {
      // Fastest model for quick answers
      primary: "google/gemini-2.0-flash-exp:free",
      fallbacks: ["mistralai/mistral-small-3.1-24b:free", "meta-llama/llama-3.3-70b-instruct:free"],
    };
  }

  if (intent.isMath || intent.isCode) {
    return {
      // DeepSeek R1 is best for reasoning-heavy math/code
      primary: "deepseek/deepseek-r1-0528:free",
      fallbacks: ["google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free"],
    };
  }

  // General study questions — Gemini Flash is fastest for explanations
  return {
    primary: "google/gemini-2.0-flash-exp:free",
    fallbacks: ["deepseek/deepseek-r1-0528:free", "meta-llama/llama-3.3-70b-instruct:free"],
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

    // Classify the latest user message
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const intent = classifyMessage(lastUserMsg?.content ?? "");
    const { primary, fallbacks } = selectModels(intent);

    console.log(`[Lumina] Intent: ${JSON.stringify(intent)} → Model: ${primary}`);

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
        temperature: 0.7, // balanced creativity + accuracy
        top_p: 0.9,
        frequency_penalty: 0.3, // reduces repetition
        presence_penalty: 0.2, // encourages covering new ground
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
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

      console.error(`[Lumina] Provider error ${response.status}:`, providerMessage);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: providerMessage || "Too many requests — please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: providerMessage || "OpenRouter credits needed. Please check your balance." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: providerMessage || "AI service error — please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream response directly back to client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no", // prevents nginx from buffering the stream
      },
    });
  } catch (e) {
    console.error("[Lumina] chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
