import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = [
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-coder:free",
];

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

async function callOpenRouter(apiKey: string, messages: any[], maxTokens = 500): Promise<string> {
  for (const model of MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`[Lumina] ${model} error ${res.status}: ${err}`);
        continue;
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (e) {
      console.error(`[Lumina] ${model} exception:`, e);
    }
  }
  throw new Error("All models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let searchContext = "";
    if (lastMsg && SERPER_API_KEY) {
      searchContext = await searchSerper(lastMsg.content.slice(0, 120), SERPER_API_KEY);
    }

    let systemPrompt = `You are Lumina AI — the smartest, most supportive study companion a student could have. Built by Tarun Kartikeya.

Write in clear flowing paragraphs. No bullet points. No lists. Be natural and helpful.
Start answering immediately. No filler.
Explain simply first, then build up. Always help the student understand deeply.
Always end with a short check question.`;

    if (searchContext) systemPrompt += `\n\nREFERENCE DATA:\n${searchContext}`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const output = await callOpenRouter(OPENROUTER_API_KEY, aiMessages, 500);

    return new Response(
      JSON.stringify({ choices: [{ message: { content: output.trim() } }] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
