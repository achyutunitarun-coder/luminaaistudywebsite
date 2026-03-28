import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-coder:free",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { notes } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    for (const model of MODELS) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            stream: true,
            max_tokens: 4000,
            temperature: 0.85,
            messages: [
              { role: "system", content: `You are the writer for the most binge-worthy educational podcast on the internet. Create an ELECTRIFYING, LONG conversation between two hosts who are genuinely passionate about learning:

- ALEX: The genius explainer who makes complex ideas feel like magic. Uses mind-blowing analogies, drops surprising facts, connects ideas across fields (physics to cooking, history to startups). Gets genuinely excited when explaining breakthroughs. Sometimes goes on fascinating tangents.
- SAM: The brilliant curious mind who asks the questions everyone's thinking. Challenges Alex's explanations, connects ideas to everyday life, shares relatable "wait, so THAT'S why..." moments. Occasionally one-ups Alex with a fun fact.

RULES:
- Format EVERY line as "ALEX: ..." or "SAM: ..."
- Make it AT LEAST 2500 words — this is a FULL episode, not a summary
- Jump STRAIGHT into the topic — no "welcome to the show" garbage
- Natural interruptions: "Wait wait wait—", "Hold on—", "Oh my god, that's like—", "No way!", "Okay but here's the crazy part—"
- Include genuine debates, "aha!" moments, laughing reactions, mind-blown reactions
- Reference pop culture, movies, everyday situations to make concepts stick
- Build tension and reveals: "So you'd THINK it works like X... but actually..."
- Make listeners feel like they're eavesdropping on the most interesting conversation at a party
- NO markdown formatting, NO stage directions in brackets, NO emojis
- End with a mind-blowing takeaway that makes listeners want to tell someone about it` },
              { role: "user", content: `Turn these study notes into the most engaging podcast episode ever. Make it feel ALIVE — like two brilliant friends geeking out over fascinating ideas:\n\n${notes}` },
            ],
          }),
        });

        if (!res.ok) {
          console.error(`${model} error ${res.status}`);
          continue;
        }

        return new Response(res.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      } catch (e) {
        console.error(`${model} exception:`, e);
      }
    }

    throw new Error("All models failed");
  } catch (e) {
    console.error("generate-podcast-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
