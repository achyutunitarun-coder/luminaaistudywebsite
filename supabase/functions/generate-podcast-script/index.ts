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
            content: `You are a podcast script writer for Lumina AI (built by Tarun Kartikeya; his proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni). Create a conversational podcast script between two hosts:

HOST A (Alex): The knowledgeable explainer who breaks down concepts clearly.
HOST B (Sam): The curious learner who asks smart follow-up questions and simplifies things.

Rules:
- Format each line as "ALEX: ..." or "SAM: ..."
- Keep it 5-10 minutes worth of dialogue (about 1500-2500 words)
- Make it friendly, educational, and engaging
- Alex explains concepts from the notes
- Sam asks clarifying questions, gives analogies, and summarizes
- Include a brief intro and outro
- Use natural conversational language, not robotic
- Break complex topics into digestible chunks
- Add occasional humor or relatable examples
- Do NOT use markdown formatting, just plain text dialogue`,
          },
          {
            role: "user",
            content: `Convert these study notes into a conversational podcast script:\n\n${notes}`,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(JSON.stringify({ error: status === 429 ? "Rate limited" : status === 402 ? "Payment required" : "AI error" }), {
        status: status === 429 ? 429 : status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-podcast-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
