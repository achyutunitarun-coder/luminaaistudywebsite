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
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You write podcast dialogues for an educational audio show by Lumina AI.

Two hosts have a real conversation — not a lecture, not a Q&A script. It should feel like two smart friends geeking out over a topic at a coffee shop.

HOSTS:
- ALEX: The explainer. Knows the material cold. Uses vivid analogies, surprising facts, and punchy one-liners. Never sounds like a textbook.
- SAM: The smart skeptic. Asks "but why?", plays devil's advocate, connects ideas to everyday life, and isn't afraid to say "wait, that doesn't make sense."

DIALOGUE RULES:
1. Format every line as: "ALEX: ..." or "SAM: ..."
2. Jump straight into the core concept in the FIRST line. No "welcome to the show" or "today we're going to talk about."
3. Make it feel ALIVE:
   - Hosts interrupt each other sometimes ("Wait wait wait — hold on.")
   - They react genuinely ("Oh that's wild." / "Hmm, I'm not sure about that." / "Okay THAT clicks.")
   - They use casual language — contractions, sentence fragments, thinking out loud
   - They laugh occasionally or express genuine surprise
4. STRUCTURE the learning naturally:
   - Start with a hook or surprising fact
   - Build understanding layer by layer
   - Use concrete examples and thought experiments ("Imagine you're...")
   - Include at least one "pop quiz" moment where Sam tests Alex (or vice versa)
   - Address a common misconception
   - End with a rapid-fire recap (3-4 lines)
5. Keep it 1200-1800 words.
6. NO markdown, NO stage directions, NO meta-commentary about the podcast itself.
7. Every concept from the notes MUST be covered — don't skip anything.
8. Make it so engaging that a student would CHOOSE to listen to this over re-reading their notes.`,
          },
          {
            role: "user",
            content: `Turn these study notes into a natural, engaging podcast conversation:\n\n${notes}`,
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
