import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-coder:free",
];

async function callOpenRouter(apiKey: string, messages: any[], maxTokens = 2000): Promise<string> {
  for (const model of MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.6 }),
      });
      if (!res.ok) { console.error(`${model} error ${res.status}`); continue; }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (e) { console.error(`${model} exception:`, e); }
  }
  throw new Error("All models failed");
}

async function streamOpenRouter(apiKey: string, messages: any[], maxTokens = 2000): Promise<Response> {
  for (const model of MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.6, stream: true }),
      });
      if (!res.ok) { console.error(`${model} error ${res.status}`); continue; }
      return res;
    } catch (e) { console.error(`${model} exception:`, e); }
  }
  throw new Error("All models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileContent, fileName, mode, language } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    let systemPrompt = "";
    let userContent = "";

    if (mode === "notes") {
      systemPrompt = `You are Lumina AI's study notes generator. Create incredibly detailed, well-organized notes with clear headings, key concepts in **bold**, formulas highlighted, real-world examples, and a concise "Quick Review" summary at the end. Use markdown formatting. Be thorough — cover every concept in the document.`;
      userContent = `Create comprehensive study notes from this file "${fileName}":\n\n${fileContent}`;
    } else if (mode === "flowchart") {
      systemPrompt = `Analyze the content and produce a JSON flowchart. Return ONLY valid JSON (no markdown, no code fences): {"nodes": [{"id": "1", "label": "Short Title", "description": "Brief description", "type": "start", "status": "completed"}], "edges": [{"from": "1", "to": "2", "label": "relationship"}]}. Use types: start, process, decision, end, milestone. Create 6-12 nodes.`;
      userContent = `Analyze "${fileName}" and create a concept flowchart:\n\n${fileContent}`;
    } else if (mode === "overview") {
      const targetLang = language || "Spanish";
      systemPrompt = `Create a comprehensive overview/summary in ${targetLang}. Include key concepts, important points as bullet lists, and a conclusion. Use markdown. Keep technical terms in original language in parentheses.`;
      userContent = `Create a detailed overview in ${targetLang} of "${fileName}":\n\n${fileContent}`;
    } else {
      throw new Error("Invalid mode");
    }

    const aiMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    // Flowchart needs JSON parsing, so no streaming
    if (mode === "flowchart") {
      const text = await callOpenRouter(OPENROUTER_API_KEY, aiMessages, 2000);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return new Response(JSON.stringify({ content: jsonMatch[0] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ content: text.trim() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notes and overview can stream
    const streamRes = await streamOpenRouter(OPENROUTER_API_KEY, aiMessages, 2500);
    return new Response(streamRes.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("smart-notebook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
