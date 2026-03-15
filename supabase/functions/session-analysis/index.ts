import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionData, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    let mistakesData: any[] = [];
    let testsData: any[] = [];
    
    if (userId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const [mistakes, tests] = await Promise.all([
        supabase.from("mistakes").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        supabase.from("tests").select("subject, score, correct_answers, total_questions, analysis").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      ]);
      mistakesData = mistakes.data || [];
      testsData = tests.data || [];
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an educational analyst. Provide detailed, actionable analysis. Be specific about topics, not vague.`,
          },
          {
            role: "user",
            content: `Analyze this student's study session:\nSession: ${JSON.stringify(sessionData)}\nMistakes: ${JSON.stringify(mistakesData)}\nTests: ${JSON.stringify(testsData)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_session",
            description: "Analyze student performance",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                strengths: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic: { type: "string" }, subject: { type: "string" }, detail: { type: "string" },
                      confidence_level: { type: "string", enum: ["high", "medium"] },
                      maintenance_tip: { type: "string" },
                    },
                    required: ["topic", "subject", "detail", "confidence_level", "maintenance_tip"],
                    additionalProperties: false,
                  },
                },
                weaknesses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic: { type: "string" }, subject: { type: "string" }, root_cause: { type: "string" },
                      severity: { type: "string", enum: ["critical", "moderate", "minor"] },
                      fix_suggestion: { type: "string" }, prerequisite_gaps: { type: "string" },
                    },
                    required: ["topic", "subject", "root_cause", "severity", "fix_suggestion", "prerequisite_gaps"],
                    additionalProperties: false,
                  },
                },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      action: { type: "string" }, priority: { type: "string", enum: ["high", "medium", "low"] },
                      estimated_time: { type: "string" }, subjects_to_cover: { type: "string" },
                      study_method: { type: "string" },
                    },
                    required: ["action", "priority", "estimated_time", "subjects_to_cover", "study_method"],
                    additionalProperties: false,
                  },
                },
                score_breakdown: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { area: { type: "string" }, score: { type: "number" }, comment: { type: "string" } },
                    required: ["area", "score", "comment"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["summary", "strengths", "weaknesses", "recommendations", "score_breakdown"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "analyze_session" } },
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to analyze session" }), {
        status: response.status === 429 ? 429 : response.status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const analysis = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "No analysis generated" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("session-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
