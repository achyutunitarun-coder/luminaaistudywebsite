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

    // Use Gemini for structured output (supports JSON mode reliably, unlike DeepSeek R1)
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
        max_tokens: 6000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are Lumina AI's educational analyst. Provide extremely detailed, actionable analysis.

You MUST respond with a valid JSON object with this exact structure:
{
  "summary": "4-6 sentence comprehensive assessment",
  "strengths": [
    {
      "topic": "Specific topic name",
      "subject": "Subject area",
      "detail": "2-4 sentences explaining what the student does well",
      "confidence_level": "high" or "medium",
      "maintenance_tip": "1-2 sentences on maintaining this strength"
    }
  ],
  "weaknesses": [
    {
      "topic": "Specific sub-topic e.g. 'Quadratic Equations — completing the square'",
      "subject": "Subject area",
      "root_cause": "2-3 sentences diagnosing the exact conceptual gap",
      "severity": "critical" or "moderate" or "minor",
      "fix_suggestion": "3-5 sentences with step-by-step remediation plan",
      "prerequisite_gaps": "Foundational concepts to revisit"
    }
  ],
  "recommendations": [
    {
      "action": "4-6 sentence detailed action plan",
      "priority": "high" or "medium" or "low",
      "estimated_time": "e.g. 2 hours",
      "subjects_to_cover": "Comma-separated specific topics",
      "study_method": "e.g. Feynman technique, spaced repetition"
    }
  ],
  "score_breakdown": [
    {
      "area": "Area name",
      "score": 75,
      "comment": "2-3 sentences explaining the score"
    }
  ]
}

RULES:
- NEVER give vague responses. Be specific with topic names and actionable advice.
- Always include at least 2 strengths, 2 weaknesses, 3 recommendations, and 4 score areas.
- If limited data, infer reasonable analysis from what's available.
- Return ONLY the JSON object, no markdown or extra text.`,
          },
          {
            role: "user",
            content: `Analyze this student's study data:\n\nSession: ${JSON.stringify(sessionData)}\nRecent mistakes (last 50): ${JSON.stringify(mistakesData)}\nRecent test scores: ${JSON.stringify(testsData)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI error:", response.status, await response.text());
      return new Response(JSON.stringify({ error: "Failed to analyze session" }), {
        status: response.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "No analysis generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse JSON from response (handle markdown code blocks if present)
    let analysis;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Raw:", content.substring(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse analysis" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("session-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
