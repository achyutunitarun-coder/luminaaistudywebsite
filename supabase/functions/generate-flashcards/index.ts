import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, title, cardCount = 20 } = await req.json();
    const count = Math.min(Math.max(Number(cardCount) || 20, 5), 80);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You are a flashcard generator. Create exactly ${count} flashcards. Return ONLY valid JSON with no other text, in this exact format: {"cards": [{"front": "question", "back": "answer"}]}` },
          { role: "user", content: `Create exactly ${count} flashcards for "${title}" from this content:\n\n${content}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_flashcards",
            description: "Generate flashcards from content",
            parameters: {
              type: "object",
              properties: {
                cards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { front: { type: "string" }, back: { type: "string" } },
                    required: ["front", "back"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["cards"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_flashcards" } },
      }),
    });

    if (!response.ok) {
      console.error("AI error:", response.status, await response.text());
      return new Response(JSON.stringify({ error: "Failed to generate flashcards" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try parsing content directly
    const content_text = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content_text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(JSON.stringify(JSON.parse(jsonMatch[0])), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "No flashcards generated" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-flashcards error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
