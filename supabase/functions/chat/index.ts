import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_MODEL = "iamdago/Lumina-Ultimate";
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN not set");

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

    let prompt = systemPrompt + "\n\n";
    for (const msg of messages) {
      if (msg.role === "user") prompt += `User: ${msg.content}\n`;
      else if (msg.role === "assistant") prompt += `Lumina: ${msg.content}\n`;
    }
    prompt += "Lumina:";

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 500, temperature: 0.7, return_full_text: false },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("HF API error:", err);
      return new Response(JSON.stringify({ error: `HF API error: ${err}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const output = data?.[0]?.generated_text || "I couldn't generate a response. Please try again.";

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
