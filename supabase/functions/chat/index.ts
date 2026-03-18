import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Search Wikipedia for real-time context on current topics
async function searchWikipedia(query: string): Promise<string> {
  try {
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, { headers: { "User-Agent": "LuminaAI/1.0" } });
    if (res.ok) {
      const data = await res.json();
      if (data.extract) return `[Wikipedia: ${data.title}] ${data.extract}`;
    }
    // Fallback: search
    const sRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`);
    if (sRes.ok) {
      const sData = await sRes.json();
      const results = sData?.query?.search?.map((r: any) => r.snippet.replace(/<[^>]+>/g, "")).join(" | ");
      if (results) return `[Wikipedia search: ${query}] ${results}`;
    }
  } catch {}
  return "";
}

// Detect if user message needs internet context
function needsWebSearch(text: string): string | null {
  const triggers = [
    /(?:latest|current|recent|today|now|2024|2025|2026)\s+(.+)/i,
    /(?:who won|who is|what happened|news about)\s+(.+)/i,
    /(?:explain|tell me about)\s+(CRISPR|quantum|AI|blockchain|climate|space|mars|moon|james webb)/i,
    /(?:stock|market|price of|value of)\s+(.+)/i,
  ];
  for (const t of triggers) {
    const m = text.match(t);
    if (m) return m[1].trim();
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, memoryContext } = await req.json();

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    // ── System prompt ────────────────────────────────────────
    let systemPrompt = `You are Lumina AI, an expert study tutor built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni.

You have access to internet knowledge and can answer questions about current events, recent news, people, awards, sports results, science, or anything that changes over time.

RULES:
- NEVER say "I don't have real-time access" or "my knowledge cutoff". Use the context provided to give accurate answers.
- NEVER tell the user to "Google it" or visit another site. You already have the answer.
- For current events, give the real, up-to-date answer using provided context.
- Seamlessly blend web knowledge with your explanations.

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

    // ── Web search for last user message ─────────────────────
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    if (lastUserMsg) {
      const searchQuery = needsWebSearch(lastUserMsg.content);
      if (searchQuery) {
        const wikiContext = await searchWikipedia(searchQuery);
        if (wikiContext) {
          systemPrompt += `\n\n## 🌐 Internet Context\n${wikiContext}\n\nUse this information naturally in your response.`;
        }
      }
    }

    // ── Call OpenRouter ──────────────────────────────────────
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        models: [
          "google/gemini-2.0-flash-exp:free",
          "deepseek/deepseek-chat-v3-0324:free",
          "nvidia/nemotron-3-super-120b-a12b:free",
        ],
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
