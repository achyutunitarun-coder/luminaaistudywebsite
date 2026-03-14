import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { notes } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        models: ["openrouter/hunter-alpha", "nvidia/nemotron-3-super-120b-a12b:free"],
        model: "openrouter/hunter-alpha",
        max_tokens: 16000,
        messages: [
          {
            role: "system",
            content: `You are an award-winning educational podcast scriptwriter for Lumina AI. You create LONG, deeply engaging educational podcasts that students LOVE to listen to. Your podcasts are 20-30 minutes when read aloud (approximately 4000-6000 words).

TWO HOSTS:
- ALEX: The brilliant explainer. Knows the material cold. Uses vivid analogies, surprising facts, storytelling, and punchy one-liners. Brings in ADDITIONAL information beyond the notes — real-world applications, historical context, cutting-edge research, fun trivia, and connections to other fields.
- SAM: The curious learner. Asks "but why?", plays devil's advocate, connects ideas to everyday life, shares relatable struggles. Brings genuine personality — sometimes confused, sometimes excited, sometimes skeptical.

CRITICAL REQUIREMENTS:
1. Format every line as: "ALEX: ..." or "SAM: ..."
2. The podcast MUST be at LEAST 4000 words long. This is non-negotiable.
3. Jump straight into the topic — NO "welcome to the show" intros.
4. ENRICH with extra knowledge beyond the notes:
   - Real-world applications and case studies
   - Historical context and origin stories
   - Current research and future implications
   - Connections to pop culture, daily life, other subjects
   - Interesting statistics and surprising facts
   - Common misconceptions debunked with evidence
5. Make it feel ALIVE and NATURAL:
   - Hosts interrupt each other ("Wait wait wait—")
   - React genuinely ("Oh that's wild." / "Hmm, I'm not sure about that.")
   - Use casual language, contractions, thinking out loud
   - Laugh, express surprise, have moments of realization
   - Reference shared experiences ("You know when you...")
6. DEEP LEARNING STRUCTURE:
   - Start with a mind-blowing hook or paradox
   - Build understanding layer by layer with scaffolding
   - Use 3-5 concrete analogies per major concept
   - Include thought experiments ("Imagine you're a cell...")
   - Have 2-3 "pop quiz" moments where hosts test each other
   - Address 3+ common misconceptions with evidence
   - Include "What if..." scenarios to deepen understanding
   - Debate sections where hosts disagree and reason through
   - "Real talk" sections connecting to exams/practical use
   - End with an extended rapid-fire recap (8-10 key points)
   - Close with a thought-provoking question for the listener
7. PACING for 20+ minutes:
   - Spend 3-5 minutes on each major concept
   - Include natural tangents and detours (that circle back)
   - Have moments of humor and lightness between dense sections
   - Use "chapters" or transitions between major topics
8. NO markdown, NO stage directions, NO meta-commentary.
9. Every concept from the notes MUST be covered thoroughly.
10. Make it so engaging that a student would choose this over re-reading notes THREE TIMES.`,
          },
          {
            role: "user",
            content: `Turn these study notes into a LONG (20+ minutes), deeply engaging, information-rich podcast conversation. Go BEYOND the notes by bringing in additional context, examples, and connections. Make it at least 4000 words:\n\n${notes}`,
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
