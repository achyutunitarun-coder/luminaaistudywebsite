import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Search Wikipedia for relevant context (free, no API key needed)
async function searchWikipedia(query: string): Promise<string> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return "";
    const searchData = await searchRes.json();
    const titles = searchData.query?.search?.map((r: any) => r.title) || [];
    if (titles.length === 0) return "";

    // Get extracts for top results
    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles.slice(0, 2).join("|"))}&prop=extracts&exintro=true&explaintext=true&exlimit=2&format=json&origin=*`;
    const extractRes = await fetch(extractUrl);
    if (!extractRes.ok) return "";
    const extractData = await extractRes.json();
    const pages = extractData.query?.pages || {};
    
    let context = "";
    for (const page of Object.values(pages) as any[]) {
      if (page.extract) {
        context += `\n### ${page.title}\n${page.extract.slice(0, 1500)}\n`;
      }
    }
    return context;
  } catch (e) {
    console.error("Wikipedia search error:", e);
    return "";
  }
}

// Check if the message likely needs internet/current info
function needsInternetSearch(message: string): boolean {
  const triggers = [
    /\b(current|latest|recent|today|now|2024|2025|2026|news|modern)\b/i,
    /\b(what is|who is|explain|tell me about|define)\b/i,
    /\b(CRISPR|quantum|AI |machine learning|blockchain|climate|space|NASA)\b/i,
    /\b(history of|discovery of|invention of|origin of)\b/i,
  ];
  return triggers.some(r => r.test(message));
}

// Extract search query from user message
function extractSearchQuery(message: string): string {
  // Remove common question prefixes
  return message
    .replace(/^(explain|tell me about|what is|who is|define|describe|how does|why does|can you)\s+/i, "")
    .replace(/\?$/, "")
    .trim()
    .slice(0, 100);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, memoryContext } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    // Check if latest user message needs internet context
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let internetContext = "";
    
    if (lastUserMsg && needsInternetSearch(lastUserMsg.content)) {
      const query = extractSearchQuery(lastUserMsg.content);
      console.log("Searching Wikipedia for:", query);
      internetContext = await searchWikipedia(query);
      if (internetContext) {
        console.log("Found Wikipedia context:", internetContext.length, "chars");
      }
    }

    let systemPrompt = `You are Lumina AI, an expert study tutor built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni. You help students understand concepts deeply. You provide:
- Clear explanations with examples
- Step-by-step solutions for math/science problems
- Diagrams described in text when useful
- Practice questions after explanations
- Encourage and motivate students
Keep responses well-structured using markdown. Be concise but thorough.

You have access to real-time internet knowledge. When you use information from the internet, naturally integrate it into your explanations without explicitly saying "according to Wikipedia" — just use the knowledge naturally.`;

    if (internetContext) {
      systemPrompt += `\n\n## Real-time Knowledge from the Internet\nHere is current, factual information relevant to the student's question. Use this to provide accurate, up-to-date answers:\n${internetContext}`;
    }

    if (memoryContext && memoryContext.length > 0) {
      systemPrompt += `\n\n## Memory from past conversations\nBelow are excerpts from the student's previous conversations. Use these to provide continuity, remember their topics/preferences, and reference past discussions when relevant. Do NOT mention that you're reading past conversations unless the user asks.\n\n`;
      for (const conv of memoryContext) {
        systemPrompt += `### "${conv.title}"\n`;
        for (const msg of conv.messages) {
          systemPrompt += `${msg.role === 'user' ? 'Student' : 'Lumina'}: ${msg.content}\n`;
        }
        systemPrompt += '\n';
      }
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1-0528:free",
        models: ["deepseek/deepseek-r1-0528:free", "openrouter/hunter-alpha", "nvidia/nemotron-3-super-120b-a12b:free"],
        max_tokens: 4096,
        include_reasoning: false,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const rawError = await response.text();
      let providerMessage = "";
      try {
        const parsed = JSON.parse(rawError);
        providerMessage = parsed?.error?.message || parsed?.error || "";
      } catch {
        providerMessage = rawError;
      }

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: providerMessage || "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: providerMessage || "This request needs more available credits or fewer max_tokens." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI provider error:", response.status, rawError);
      return new Response(JSON.stringify({ error: providerMessage || "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
