import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userData } = await req.json();
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
        max_tokens: 4096,
        messages: [
          { role: "system", content: "You are Lumina AI, built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni. You generate detailed monthly study reports for students. Be encouraging but honest about weaknesses." },
          { role: "user", content: `Generate a monthly report for this student data:\n${JSON.stringify(userData)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_monthly_report",
            description: "Generate a comprehensive monthly study report",
            parameters: {
              type: "object",
              properties: {
                headline: { type: "string", description: "A motivational headline like 'Great Progress!' or 'Time to Push Harder'" },
                total_study_minutes: { type: "number" },
                total_study_hours: { type: "number" },
                average_test_score: { type: "number" },
                tests_taken: { type: "number" },
                xp_earned: { type: "number" },
                strengths: { type: "array", items: { type: "object", properties: { topic: { type: "string" }, detail: { type: "string" } }, required: ["topic", "detail"], additionalProperties: false } },
                weaknesses: { type: "array", items: { type: "object", properties: { topic: { type: "string" }, detail: { type: "string" } }, required: ["topic", "detail"], additionalProperties: false } },
                recommendations: { type: "array", items: { type: "string" } },
                overall_grade: { type: "string", description: "A, B, C, D, or F" },
              },
              required: ["headline", "total_study_minutes", "total_study_hours", "average_test_score", "tests_taken", "xp_earned", "strengths", "weaknesses", "recommendations", "overall_grade"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_monthly_report" } },
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed" }), {
        status: response.status === 429 ? 429 : response.status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const report = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(report), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "No report" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
