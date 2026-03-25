import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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
      context += `Direct Answer: ${data.answerBox.answer ?? data.answerBox.snippet ?? ""}\n`;
    }
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      context += `${kg.title ?? ""} ${kg.type ? `(${kg.type})` : ""}: ${kg.description ?? ""}\n`;
    }
    for (const r of (data.organic ?? []).slice(0, 4)) {
      context += `${r.title}: ${r.snippet ?? ""}\n`;
    }
    return context;
  } catch (e) {
    console.error("[Lumina] Serper error:", e);
    return "";
  }
}

function needsSearch(message: string): boolean {
  return /\b(current|latest|recent|today|now|2024|2025|2026|news|who won|who is|what happened|oscar|grammy|nobel|election|score|match|winner|announced|released|launched|breaking|yesterday|last week|this year|price|weather|stock|crypto)\b/i.test(message);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, memoryContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let internetContext = "";

    if (lastUserMsg && SERPER_API_KEY && needsSearch(lastUserMsg.content)) {
      const query = lastUserMsg.content.slice(0, 120);
      console.log(`[Lumina] Searching: "${query}"`);
      internetContext = await searchInternet(query, SERPER_API_KEY);
    }

    let systemPrompt = `You are Lumina AI — the smartest, most supportive study companion a student could have. Built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni.

## RESPONSE FORMAT — CRITICAL
Write ALL responses in flowing paragraphs. Never use bullet points, numbered lists, or excessive headers. Write naturally like a knowledgeable tutor — warm, clear, full sentences. For steps like in math write "First... Then... Finally..." in paragraph form. Only use a table when comparing multiple things side by side.

## SPEED — CRITICAL
Get to the answer immediately. No preamble. First sentence must be useful content. Keep responses focused and concise.

## PERSONALITY
Warm, encouraging, direct — like a brilliant older sibling who genuinely cares. Never condescending or robotic.

## INSTANT CLARITY
Start with the simplest possible explanation using a real-world analogy, then build up.

## SMART PROBLEM SOLVING
For math, science, coding — walk through every step in paragraph form explaining what and why. Point out common mistakes after solving.

## ACTIVE LEARNING
Always end with a check question or mini challenge as the last sentence.`;

    if (internetContext) {
      systemPrompt += `\n\n## LIVE INTERNET DATA\n${internetContext}`;
    }

    if (memoryContext && memoryContext.length > 0) {
      systemPrompt += `\n\n## STUDENT HISTORY\n`;
      for (const conv of memoryContext) {
        systemPrompt += `Topic: "${conv.title}"\n`;
      }
    }

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Lumina] AI error ${response.status}:`, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded — please wait a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error — please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
