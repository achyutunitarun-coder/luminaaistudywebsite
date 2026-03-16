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
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");
    // Fetch user's mistakes and test data for deep analysis
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

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1-0528:free",
        models: ["deepseek/deepseek-r1-0528:free", "deepseek/deepseek-r1:free", "deepseek/deepseek-chat-v3-0324:free"],
        max_tokens: 6000,
        messages: [
          {
            role: "system",
            content: `You are Lumina AI's educational analyst, built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni. You provide extremely detailed, actionable analysis. 

CRITICAL RULES FOR ALL FIELDS:
- NEVER give vague or generic responses. Every field must be rich with specific detail.
- For "detail" fields: Write 2-4 sentences explaining exactly what the student does well, with specific examples from their data.
- For "root_cause" fields: Write 2-3 sentences diagnosing the exact conceptual gap, not just "needs practice".
- For "fix_suggestion" fields: Write 3-5 sentences with a concrete step-by-step remediation plan including specific resources, techniques, and practice strategies.
- For topics: NEVER say just "Math" or "Physics". Say "Quadratic Equations — completing the square method" or "Electromagnetic Induction — Faraday's law applications".
- For the summary: Write a comprehensive 4-6 sentence assessment covering overall performance trajectory, key patterns, and immediate priorities.

RECOMMENDATIONS MUST BE EXTREMELY DETAILED ACTION PLANS:
- Each recommendation "action" must be a full paragraph (4-6 sentences) describing exactly what to study, which specific topics/subtopics to cover, what practice problems to do, what technique to use, and what outcome to expect.
- Include specific subjects and chapter/topic names the student should focus on.
- Provide a clear study sequence (what to do first, second, third).
- Mention specific problem types, formula applications, or conceptual frameworks to review.

SCORE BREAKDOWN COMMENTS:
- Each "comment" must be 2-3 sentences explaining the score with specific evidence from the student's data.`,
          },
          {
            role: "user",
            content: `Analyze this student's study session and historical data:
            
Session: ${JSON.stringify(sessionData)}
Recent mistakes (last 50): ${JSON.stringify(mistakesData)}
Recent test scores: ${JSON.stringify(testsData)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_session",
            description: "Provide deep-root analysis of student performance with specific topic-level insights",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "Overall assessment of the student's current state" },
                strengths: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic: { type: "string" },
                      subject: { type: "string" },
                      detail: { type: "string", description: "2-4 sentences explaining what the student does well with specific examples" },
                      confidence_level: { type: "string", enum: ["high", "medium"] },
                      maintenance_tip: { type: "string", description: "1-2 sentences on how to maintain and build on this strength" },
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
                      topic: { type: "string", description: "Specific sub-topic e.g. 'Integration by Parts — choosing u and dv'" },
                      subject: { type: "string" },
                      root_cause: { type: "string", description: "2-3 sentences diagnosing the exact conceptual gap with evidence from their mistakes" },
                      severity: { type: "string", enum: ["critical", "moderate", "minor"] },
                      fix_suggestion: { type: "string", description: "3-5 sentences with step-by-step remediation: specific techniques, practice types, and resources" },
                      prerequisite_gaps: { type: "string", description: "Any foundational concepts they need to revisit first before tackling this topic" },
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
                      action: { type: "string", description: "4-6 sentence detailed action plan: what to study, specific topics, practice problems, techniques, and expected outcomes" },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                      estimated_time: { type: "string" },
                      subjects_to_cover: { type: "string", description: "Comma-separated list of specific subjects and topics this action targets" },
                      study_method: { type: "string", description: "Recommended study technique e.g. 'Feynman technique', 'spaced repetition', 'practice problems', 'concept mapping'" },
                    },
                    required: ["action", "priority", "estimated_time", "subjects_to_cover", "study_method"],
                    additionalProperties: false,
                  },
                },
                score_breakdown: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      area: { type: "string" },
                      score: { type: "number" },
                      comment: { type: "string", description: "2-3 sentences explaining the score with specific evidence" },
                    },
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
