import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_API_URL = "https://api-inference.huggingface.co/models/iamdago/Lumina-Ultimate";

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

function buildPrompt(messages: any[], internetContext: string, memoryContext: any[]): string {
  let systemPart = `You are Lumina AI — the smartest, most supportive study companion a student could have. Built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni.

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
    systemPart += `\n\n## LIVE INTERNET DATA\n${internetContext}`;
  }

  if (memoryContext && memoryContext.length > 0) {
    systemPart += `\n\n## STUDENT HISTORY\n`;
    for (const conv of memoryContext) {
      systemPart += `Topic: "${conv.title}"\n`;
      for (const msg of conv.messages) {
        systemPart += `${msg.role === "user" ? "Student" : "Lumina"}: ${msg.content}\n`;
      }
    }
  }

  // Build conversation as a text prompt
  let prompt = `System: ${systemPart}\n\n`;
  for (const msg of messages) {
    const role = msg.role === "user" ? "Student" : "Lumina";
    prompt += `${role}: ${msg.content}\n`;
  }
  prompt += "Lumina:";

  return prompt;
}

function createSSEStream(text: string): ReadableStream {
  const encoder = new TextEncoder();
  const words = text.split(/(\s+)/);
  let index = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index >= words.length) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }
      // Send 3-5 words at a time for natural streaming feel
      const chunk = words.slice(index, index + 4).join("");
      index += 4;
      const sseData = JSON.stringify({
        choices: [{ delta: { content: chunk } }],
      });
      controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
      // Small delay for streaming effect
      await new Promise((r) => setTimeout(r, 15));
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, memoryContext } = await req.json();

    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN is not configured");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let internetContext = "";

    if (lastUserMsg && SERPER_API_KEY && needsSearch(lastUserMsg.content)) {
      const query = extractQuery(lastUserMsg.content);
      console.log(`[Lumina] Searching: "${query}"`);
      internetContext = await searchInternet(query, SERPER_API_KEY);
    }

    const prompt = buildPrompt(messages, internetContext, memoryContext ?? []);

    console.log(`[Lumina] Calling Lumina-Ultimate HF model`);

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 2048,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.2,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Lumina] HF error ${response.status}:`, errText);

      if (response.status === 503) {
        return new Response(
          JSON.stringify({ error: "Model is loading, please try again in a few seconds." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded — please wait a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service error — please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const generatedText = Array.isArray(data)
      ? data[0]?.generated_text || ""
      : data?.generated_text || "";

    if (!generatedText) {
      return new Response(
        JSON.stringify({ error: "No response generated — please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response as SSE for frontend compatibility
    const stream = createSSEStream(generatedText.trim());

    return new Response(stream, {
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
