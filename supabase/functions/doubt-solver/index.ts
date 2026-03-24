import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_API_URL = "https://api-inference.huggingface.co/models/iamdago/Lumina-Ultimate";

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
    for (const r of (data.organic ?? []).slice(0, 4)) {
      ctx += `${r.title}: ${r.snippet ?? ""}\n`;
    }
    return ctx;
  } catch { return ""; }
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
      const chunk = words.slice(index, index + 4).join("");
      index += 4;
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
      await new Promise((r) => setTimeout(r, 15));
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN is not configured");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let searchContext = "";
    if (lastMsg && SERPER_API_KEY) {
      searchContext = await searchSerper(lastMsg.content.slice(0, 120), SERPER_API_KEY);
    }

    let systemContent = `You are Lumina AI Doubt Solver, built by Tarun Kartikeya. When a student asks a question:
1. Give a clear, concise explanation
2. Provide relevant examples
3. Show step-by-step solutions for math/science
4. End with 1-2 follow-up practice questions
Use markdown for formatting. Be encouraging and supportive.`;

    if (searchContext) {
      systemContent += `\n\nREFERENCE DATA:\n${searchContext}`;
    }

    let prompt = `System: ${systemContent}\n\n`;
    for (const msg of messages) {
      prompt += `${msg.role === "user" ? "Student" : "Lumina"}: ${msg.content}\n`;
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
        parameters: { max_new_tokens: 2048, temperature: 0.7, top_p: 0.9, repetition_penalty: 1.2, return_full_text: false },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errText = await response.text();
      console.error("HF error:", status, errText);
      return new Response(JSON.stringify({ error: status === 503 ? "Model loading, try again shortly." : "AI service error" }), {
        status: status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = (Array.isArray(data) ? data[0]?.generated_text : data?.generated_text) || "";

    return new Response(createSSEStream(text.trim()), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("doubt-solver error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
