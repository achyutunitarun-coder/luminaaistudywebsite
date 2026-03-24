import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_API_URL = "https://api-inference.huggingface.co/models/iamdago/Lumina-Ultimate";

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
    const { fileContent, fileName, mode, language } = await req.json();
    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "notes") {
      systemPrompt = `You are Lumina AI's study notes generator. Create detailed, well-organized notes with clear headings, key concepts in bold, bullet points, and a concise summary. Use markdown formatting.`;
      userPrompt = `Create comprehensive study notes from this file "${fileName}":\n\n${fileContent}`;
    } else if (mode === "flowchart") {
      systemPrompt = `Analyze the content and produce a JSON flowchart. Return ONLY valid JSON in this exact format (no markdown, no code fences):
{"nodes": [{"id": "1", "label": "Short Title", "description": "Brief description", "type": "start", "status": "completed"}], "edges": [{"from": "1", "to": "2", "label": "relationship"}]}
Use types: start, process, decision, end, milestone. Create 6-12 nodes.`;
      userPrompt = `Analyze "${fileName}" and create a concept flowchart:\n\n${fileContent}`;
    } else if (mode === "overview") {
      const targetLang = language || "Spanish";
      systemPrompt = `Create a comprehensive overview/summary in ${targetLang}. Include key concepts, important points as bullet lists, and a conclusion. Use markdown. Keep technical terms in original language in parentheses.`;
      userPrompt = `Create a detailed overview in ${targetLang} of "${fileName}":\n\n${fileContent}`;
    } else {
      throw new Error("Invalid mode");
    }

    const isStream = mode !== "flowchart";
    const prompt = `System: ${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`;

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 3000, temperature: 0.6, top_p: 0.9, repetition_penalty: 1.2, return_full_text: false },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(JSON.stringify({ error: status === 429 ? "Rate limit exceeded" : "AI generation failed" }), {
        status: status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = (Array.isArray(data) ? data[0]?.generated_text : data?.generated_text) || "";

    if (isStream) {
      return new Response(createSSEStream(text.trim()), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    } else {
      return new Response(JSON.stringify({ content: text.trim() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("smart-notebook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
