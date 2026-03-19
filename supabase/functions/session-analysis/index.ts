import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Strength = {
  topic: string;
  subject: string;
  detail: string;
  confidence_level: "high" | "medium";
  maintenance_tip: string;
};

type Weakness = {
  topic: string;
  subject: string;
  root_cause: string;
  severity: "critical" | "moderate" | "minor";
  fix_suggestion: string;
  prerequisite_gaps: string;
};

type Recommendation = {
  action: string;
  priority: "high" | "medium" | "low";
  estimated_time: string;
  subjects_to_cover: string;
  study_method: string;
};

type ScoreArea = {
  area: string;
  score: number;
  comment: string;
};

type AnalysisResponse = {
  summary: string;
  strengths: Strength[];
  weaknesses: Weakness[];
  recommendations: Recommendation[];
  score_breakdown: ScoreArea[];
};

function extractJsonObject(text: string): string {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return cleaned;
  return cleaned.slice(first, last + 1);
}

function normalizeAnalysis(raw: any): AnalysisResponse {
  const safeScore = (v: unknown) => {
    const n = Number(v);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  };

  return {
    summary: typeof raw?.summary === "string" ? raw.summary : "Session analysis generated successfully.",
    strengths: Array.isArray(raw?.strengths)
      ? raw.strengths.slice(0, 5).map((s: any) => ({
          topic: String(s?.topic ?? "Untitled strength"),
          subject: String(s?.subject ?? "General"),
          detail: String(s?.detail ?? "Good progress observed."),
          confidence_level: s?.confidence_level === "high" ? "high" : "medium",
          maintenance_tip: String(s?.maintenance_tip ?? "Keep practicing consistently."),
        }))
      : [],
    weaknesses: Array.isArray(raw?.weaknesses)
      ? raw.weaknesses.slice(0, 6).map((w: any) => ({
          topic: String(w?.topic ?? "Untitled weakness"),
          subject: String(w?.subject ?? "General"),
          root_cause: String(w?.root_cause ?? "Conceptual gap needs reinforcement."),
          severity: w?.severity === "critical" || w?.severity === "moderate" || w?.severity === "minor" ? w.severity : "moderate",
          fix_suggestion: String(w?.fix_suggestion ?? "Revise fundamentals and practice targeted questions."),
          prerequisite_gaps: String(w?.prerequisite_gaps ?? "Core basics"),
        }))
      : [],
    recommendations: Array.isArray(raw?.recommendations)
      ? raw.recommendations.slice(0, 6).map((r: any) => ({
          action: String(r?.action ?? "Revise weak topics and solve timed questions daily."),
          priority: r?.priority === "high" || r?.priority === "medium" || r?.priority === "low" ? r.priority : "medium",
          estimated_time: String(r?.estimated_time ?? "45 minutes"),
          subjects_to_cover: String(r?.subjects_to_cover ?? "Core weak topics"),
          study_method: String(r?.study_method ?? "Active recall"),
        }))
      : [],
    score_breakdown: Array.isArray(raw?.score_breakdown)
      ? raw.score_breakdown.slice(0, 6).map((s: any) => ({
          area: String(s?.area ?? "Overall"),
          score: safeScore(s?.score),
          comment: String(s?.comment ?? "Steady progress with room for improvement."),
        }))
      : [],
  };
}

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
        supabase
          .from("mistakes")
          .select("topic, subject, mistake_type, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("tests")
          .select("subject, score, correct_answers, total_questions, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      mistakesData = mistakes.data || [];
      testsData = tests.data || [];
    }

    const mistakeCounts = Object.entries(
      mistakesData.reduce((acc: Record<string, number>, m: any) => {
        const key = String(m?.topic || "General");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([topic, count]) => ({ topic, count }));

    const compactInput = {
      current_session: sessionData,
      top_mistake_topics: mistakeCounts,
      recent_tests: testsData,
      totals: {
        mistakes_tracked: mistakesData.length,
        tests_tracked: testsData.length,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        max_tokens: 2200,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are Lumina AI's educational analyst. Return ONLY a valid JSON object with this schema:
{
  "summary": "4-6 sentence comprehensive assessment",
  "strengths": [{ "topic": "", "subject": "", "detail": "", "confidence_level": "high|medium", "maintenance_tip": "" }],
  "weaknesses": [{ "topic": "", "subject": "", "root_cause": "", "severity": "critical|moderate|minor", "fix_suggestion": "", "prerequisite_gaps": "" }],
  "recommendations": [{ "action": "", "priority": "high|medium|low", "estimated_time": "", "subjects_to_cover": "", "study_method": "" }],
  "score_breakdown": [{ "area": "", "score": 0, "comment": "" }]
}
Rules:
- Always include at least 2 strengths, 2 weaknesses, 3 recommendations, and 4 score areas.
- Make content specific, concise, actionable, and student-friendly.
- Return JSON only.`,
          },
          {
            role: "user",
            content: `Analyze this student performance data and generate deep analysis:\n${JSON.stringify(compactInput)}`,
          },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("session-analysis AI error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to analyze session" }), {
        status: response.status === 429 ? 429 : response.status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "No analysis generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(extractJsonObject(content));
    } catch (parseErr) {
      console.error("session-analysis JSON parse error:", parseErr, content.slice(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse analysis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalizeAnalysis(parsed);

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("session-analysis error:", e);
    const isAbort = e instanceof DOMException && e.name === "AbortError";
    return new Response(JSON.stringify({ error: isAbort ? "Analysis timed out, please retry" : e instanceof Error ? e.message : "Unknown error" }), {
      status: isAbort ? 504 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});