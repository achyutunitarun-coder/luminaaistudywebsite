import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1-0528:free",
        models: ["deepseek/deepseek-r1-0528:free", "openrouter/hunter-alpha", "nvidia/nemotron-3-super-120b-a12b:free"],
        max_tokens: 6000,
        messages: [
          {
            role: "system",
            content: `You are Lumina AI, an expert tutor. Create comprehensive quick study lessons that are detailed enough for real exam preparation. Each concept explanation should be 3-5 sentences minimum, covering the what, why, how, and real-world applications. Include formulas, examples, and connections between concepts. Generate 8-10 key concepts (not just 4-5) and 8 practice questions with thorough explanations.`,
          },
          {
            role: "user",
            content: `Create a comprehensive study lesson on "${topic}". Include 8-10 detailed key concepts with thorough explanations (3-5 sentences each, with examples and applications) and 8 practice questions with detailed answer explanations.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_lesson",
            description: "Generate a comprehensive quick study lesson with detailed concepts and questions",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                key_concepts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      concept: { type: "string", description: "The concept name or title" },
                      explanation: { type: "string", description: "Detailed explanation with examples, 3-5 sentences minimum" },
                    },
                    required: ["concept", "explanation"],
                    additionalProperties: false,
                  },
                },
                practice_questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      correct: { type: "number" },
                      explanation: { type: "string", description: "Detailed explanation of why this answer is correct and why others are wrong" },
                    },
                    required: ["question", "options", "correct", "explanation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "key_concepts", "practice_questions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_lesson" } },
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to generate lesson" }), {
        status: response.status === 429 ? 429 : response.status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const lesson = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(lesson), {
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
