import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_API_URL = "https://router.huggingface.co/hf-inference/models/iamdago/Lumina-Ultimate";

async function searchSerper(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 3, gl: "us", hl: "en" }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    let ctx = "";
    for (const r of (data.organic ?? []).slice(0, 3)) ctx += `${r.title}: ${r.snippet ?? ""}\n`;
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
    const { notes, type } = await req.json();
    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN is not configured");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    let searchContext = "";
    if (SERPER_API_KEY && notes) {
      const topicSnippet = notes.slice(0, 200).replace(/[^a-zA-Z0-9 ]/g, " ").trim();
      searchContext = await searchSerper(`${topicSnippet} key facts`, SERPER_API_KEY);
    }

    const searchSuffix = searchContext ? `\n\nAdditional reference:\n${searchContext}` : "";

    const prompts: Record<string, string> = {
      flashcards: `From these lecture notes, generate 10-15 flashcards. Return ONLY valid JSON array: [{"front": "question", "back": "answer"}]. No other text.\n\nNotes:\n${notes}${searchSuffix}`,
      quiz: `From these lecture notes, generate 8-10 MCQ quiz questions. Return ONLY valid JSON array: [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]. No other text.\n\nNotes:\n${notes}${searchSuffix}`,
      summary: `Create a condensed "Exam Revision" summary from these notes. Use bullet points, bold key terms, keep under 500 words.\n\nNotes:\n${notes}${searchSuffix}`,
    };

    const isStreaming = type === "summary";
    const prompt = `System: You are Lumina AI's study tool generator.\n\nUser: ${prompts[type] || prompts.summary}\n\nAssistant:`;

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 3000, temperature: 0.5, top_p: 0.9, repetition_penalty: 1.1, return_full_text: false },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(JSON.stringify({ error: status === 429 ? "Rate limited" : "AI error" }), {
        status: status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = (Array.isArray(data) ? data[0]?.generated_text : data?.generated_text) || "";

    if (isStreaming) {
      return new Response(createSSEStream(text.trim()), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    return new Response(JSON.stringify({ content: text.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lecture-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
