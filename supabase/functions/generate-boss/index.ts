import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You create educational boss battle questions. Return ONLY valid JSON: {"name": "Boss Name", "icon": "emoji", "questions": [{"q": "question", "options": ["A", "B", "C", "D"], "correct": 0}]}` },
          { role: "user", content: `Create a boss battle for "${topic}" with a boss name, emoji icon, and 5 challenging questions with 4 options each.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_boss",
            description: "Create a boss battle",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
                icon: { type: "string" },
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      q: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      correct: { type: "number" },
                    },
                    required: ["q", "options", "correct"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["name", "icon", "questions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_boss" } },
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to generate boss" }), {
        status: response.status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      return new Response(JSON.stringify(JSON.parse(toolCall.function.arguments)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "No boss generated" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-boss error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
