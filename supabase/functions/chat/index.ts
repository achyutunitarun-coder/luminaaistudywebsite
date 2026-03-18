import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────────────────────
// OpenRouter :online models — these browse the web natively.
// No injected context needed; the model does real searches itself.
//
// Free :online models (as of 2025):
//   - google/gemini-2.0-flash-exp:free:online   ← best free option
//   - mistralai/mistral-small-3.1-24b:free:online
//
// Paid :online fallbacks (cheap, ~$0.0001/req) if free quota runs out:
//   - google/gemini-2.0-flash:online
//   - openai/gpt-4o-mini:online
// ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, memoryContext } = await req.json();

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    // ── System prompt ────────────────────────────────────────
    let systemPrompt = `You are Lumina AI, an expert study tutor built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni.

You have LIVE internet access and automatically search the web before answering any question about current events, recent news, people, awards, sports results, science, or anything that changes over time.

RULES:
- NEVER say "I don't have real-time access" or "my knowledge cutoff". You have live internet — use it.
- NEVER tell the user to "Google it" or visit another site. You already have the answer.
- For current events (Oscars, elections, sports, news, new releases, etc.) always search and give the real, up-to-date answer.
- Seamlessly blend web knowledge with your explanations — don't say "according to my search".

As a study tutor you provide:
- Clear explanations with examples
- Step-by-step solutions for math/science problems
- Diagrams described in text when useful
- Practice questions after explanations
- Encouragement and motivation

Keep responses well-structured using markdown. Be concise but thorough.`;

    if (memoryContext && memoryContext.length > 0) {
      systemPrompt += `\n\n## 🧠 Memory from Past Conversations\nUse these to provide continuity and remember this student's topics/preferences. Do NOT mention reading past conversations unless asked.\n\n`;
      for (const conv of memoryContext) {
        systemPrompt += `### "${conv.title}"\n`;
        for (const msg of conv.messages) {
          systemPrompt += `${msg.role === "user" ? "Student" : "Lumina"}: ${msg.content}\n`;
        }
        systemPrompt += "\n";
      }
    }

    // ── Call OpenRouter with :online model ───────────────────
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Primary: Gemini 2.0 Flash with native web search (free)
        // Fallbacks in order if free quota is exhausted
        model: "google/gemini-2.0-flash-exp:free:online",
        models: [
          "google/gemini-2.0-flash-exp:free:online",
          "google/gemini-2.0-flash:online",
        ],
        // Route preference: always prefer :online variants
        route: "fallback",
        max_tokens: 4096,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      const rawError = await response.text();
      let providerMessage = "";
      try {
        const parsed = JSON.parse(rawError);
        providerMessage = parsed?.error?.message ?? parsed?.error ?? "";
      } catch {
        providerMessage = rawError;
      }

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: providerMessage || "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: providerMessage || "Credits needed. Please check your OpenRouter balance." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      console.error("AI provider error:", response.status, rawError);
      return new Response(JSON.stringify({ error: providerMessage || "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
