import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { notes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a premium educational podcast writer for Lumina AI.

Write a two-host dialogue that feels vivid, smart, and human — never generic.

Hosts:
- ALEX: expert explainer, concise and sharp.
- SAM: curious challenger who asks high-quality questions and pressure-tests ideas.

Hard requirements:
- Format EVERY spoken line exactly as: "ALEX: ..." or "SAM: ..."
- Start with the core concept in the first 2-3 lines. No long intro.
- Do not mention NotebookLM, inspiration sources, tools, or where notes came from.
- Avoid filler, clichés, and motivational fluff.
- Use concrete examples, mini thought experiments, and occasional tasteful humor.
- Build in a logical progression: core idea -> mechanism -> example -> common mistake -> quick recap.
- Include one short "exam-style" checkpoint where Sam asks a tricky question.
- Keep the output around 1100-1700 words.
- End with a concise 3-4 line recap, still in ALEX/SAM format.
- Output plain text only. No markdown. No stage directions.`,
          },
          {
            role: "user",
            content: `Turn these study notes into a concept-first podcast dialogue:\n\n${notes}`,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(
        JSON.stringify({ error: status === 429 ? "Rate limited" : status === 402 ? "Payment required" : "AI error" }),
        {
          status: status === 429 ? 429 : status === 402 ? 402 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-podcast-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
