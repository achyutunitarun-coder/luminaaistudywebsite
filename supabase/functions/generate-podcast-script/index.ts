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
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an educational podcast scriptwriter. Create LONG, engaging educational podcasts (20+ minutes, 4000+ words).

TWO HOSTS:
- ALEX: Brilliant explainer. Vivid analogies, surprising facts, storytelling. Brings ADDITIONAL information — real-world applications, historical context, fun trivia.
- SAM: Curious learner. Asks "but why?", plays devil's advocate, connects to everyday life.

Format every line as: "ALEX: ..." or "SAM: ..."
Jump straight into the topic — NO intros.
Make it ALIVE: hosts interrupt, react genuinely, use casual language.
Include thought experiments, pop quizzes, misconception debunking.
MUST be at least 4000 words. NO markdown, NO stage directions.`,
          },
          {
            role: "user",
            content: `Turn these study notes into a LONG (20+ minutes), engaging podcast. Go BEYOND the notes with extra context. At least 4000 words:\n\n${notes}`,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errText = await response.text();
      console.error("Podcast script error:", status, errText);
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
