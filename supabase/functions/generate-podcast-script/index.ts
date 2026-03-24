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
    const { notes } = await req.json();
    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN is not configured");

    const prompt = `System: You are an educational podcast scriptwriter. Create LONG, engaging podcast conversations between two hosts:
- ALEX: The brilliant explainer with vivid analogies and extra knowledge
- SAM: The curious learner who asks "but why?" and connects ideas to everyday life

Format every line as "ALEX: ..." or "SAM: ...". Make it at least 2000 words. Jump straight into the topic. Make it feel alive with natural interruptions and reactions. NO markdown, NO stage directions.

User: Turn these study notes into a deeply engaging podcast conversation:

${notes}

ALEX:`;

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 4096, temperature: 0.8, top_p: 0.95, repetition_penalty: 1.2, return_full_text: false },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(
        JSON.stringify({ error: status === 429 ? "Rate limited" : "AI error" }),
        { status: status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let text = (Array.isArray(data) ? data[0]?.generated_text : data?.generated_text) || "";
    // Prepend ALEX: since our prompt ends with it
    text = "ALEX:" + text;

    return new Response(createSSEStream(text.trim()), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("generate-podcast-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
