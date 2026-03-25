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
          { role: "system", content: `You are an expert tutor. Create a comprehensive quick study lesson. Return ONLY valid JSON: {"title": "...", "key_concepts": [{"concept": "name", "explanation": "detailed explanation 3-5 sentences"}], "practice_questions": [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]}` },
          { role: "user", content: `Create a study lesson on "${topic}" with 8-10 key concepts and 8 practice questions.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_lesson",
            description: "Create a study lesson",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                key_concepts: { type: "array", items: { type: "object", properties: { concept: { type: "string" }, explanation: { type: "string" } }, required: ["concept", "explanation"], additionalProperties: false } },
                practice_questions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" } }, correct: { type: "number" }, explanation: { type: "string" } }, required: ["question", "options", "correct", "explanation"], additionalProperties: false } },
              },
              required: ["title", "key_concepts", "practice_questions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_lesson" } },
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to generate lesson" }), {
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

    return new Response(JSON.stringify({ error: "No lesson generated" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("quick-study error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
