import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PAYLOAD_BYTES = 50_000;

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

type SessionPayload = {
  tests_completed?: number;
  average_score?: number;
  top_mistakes?: [string, number][];
  test_subjects?: { subject: string | null; score: number | null }[];
  duration_minutes?: number;
  tools_used?: string[];
  uploaded_materials?: string;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function buildStrengths(avgScore: number, testsCompleted: number, durationMinutes: number): Strength[] {
  const strengths: Strength[] = [];

  if (avgScore >= 75) {
    strengths.push({
      topic: "Accuracy in solved work",
      subject: "Overall",
      detail: `Your recent average score is ${Math.round(avgScore)}%, which indicates strong concept retention and good execution under test conditions.`,
      confidence_level: "high",
      maintenance_tip: "Preserve this edge by doing one timed mixed set daily and reviewing only the 2 toughest questions.",
    });
  }

  if (testsCompleted >= 3) {
    strengths.push({
      topic: "Practice consistency",
      subject: "Study habits",
      detail: `You completed ${testsCompleted} recent tests, showing steady effort and repeat exposure, which is the biggest predictor of score stability.`,
      confidence_level: testsCompleted >= 6 ? "high" : "medium",
      maintenance_tip: "Keep the cadence: short frequent tests beat occasional marathon sessions.",
    });
  }

  if (durationMinutes >= 30) {
    strengths.push({
      topic: "Focused study stamina",
      subject: "Session discipline",
      detail: `This session ran for ${durationMinutes} minutes, suggesting you can sustain attention long enough for deeper learning cycles.`,
      confidence_level: "medium",
      maintenance_tip: "Use 25–35 minute blocks with quick reflection at the end of each block.",
    });
  }

  if (strengths.length < 2) {
    strengths.push(
      {
        topic: "Learning momentum",
        subject: "Overall",
        detail: "You are actively generating data (sessions, mistakes, tests), which is exactly how high performers improve over time.",
        confidence_level: "medium",
        maintenance_tip: "Continue logging attempts and reflect on one improvement point per session.",
      },
      {
        topic: "Tool engagement",
        subject: "Study workflow",
        detail: "Using multiple study tools creates better retention through varied practice and context switching.",
        confidence_level: "medium",
        maintenance_tip: "Pair one recall-heavy tool with one explanation-heavy tool in each session.",
      }
    );
  }

  return strengths.slice(0, 4);
}

function buildWeaknesses(topMistakes: [string, number][], avgScore: number): Weakness[] {
  const weaknesses: Weakness[] = topMistakes.slice(0, 4).map(([topic, count]) => {
    const severity: "critical" | "moderate" | "minor" = count >= 4 || avgScore < 50
      ? "critical"
      : count >= 2 || avgScore < 70
      ? "moderate"
      : "minor";

    return {
      topic,
      subject: "Detected from errors",
      root_cause: `This topic appears repeatedly (${count} recent mistakes), which usually signals a foundation gap plus rushed answer execution under pressure.`,
      severity,
      fix_suggestion: "Revisit core theory for 20 minutes, then solve 8 targeted questions in increasing difficulty, and end with a 5-minute error log of why each miss happened.",
      prerequisite_gaps: "Definitions, base formulas, and step order",
    };
  });

  if (weaknesses.length < 2) {
    weaknesses.push(
      {
        topic: "Error review discipline",
        subject: "Meta-learning",
        root_cause: "Performance dips are often caused by not converting mistakes into explicit rules for future attempts.",
        severity: avgScore < 60 ? "critical" : "moderate",
        fix_suggestion: "After each test, write three 'if-this-then-that' correction rules and apply them in the next practice set.",
        prerequisite_gaps: "Self-review structure",
      },
      {
        topic: "Timed execution",
        subject: "Exam technique",
        root_cause: "Even with concept knowledge, timing pressure can reduce accuracy in the final third of a test.",
        severity: "moderate",
        fix_suggestion: "Practice in short timed bursts and checkpoint accuracy every 10 minutes to prevent late-session collapse.",
        prerequisite_gaps: "Pacing strategy",
      }
    );
  }

  return weaknesses.slice(0, 5);
}

function buildRecommendations(weaknesses: Weakness[], testsCompleted: number): Recommendation[] {
  const recs: Recommendation[] = [];

  if (weaknesses[0]) {
    recs.push({
      action: `Run a focused repair sprint on ${weaknesses[0].topic}: 20 minutes concept rebuild, 25 minutes targeted drills, 10 minutes correction notes, then retest the same sub-topic tomorrow.`,
      priority: "high",
      estimated_time: "55 minutes",
      subjects_to_cover: weaknesses[0].topic,
      study_method: "Active recall + error log",
    });
  }

  recs.push({
    action: "Adopt a two-pass test routine: first pass solves high-confidence questions quickly, second pass handles medium and hard items with strict step checks to reduce avoidable errors.",
    priority: "high",
    estimated_time: "Per test session",
    subjects_to_cover: weaknesses.map((w) => w.topic).join(", ") || "Core weak areas",
    study_method: "Timed practice",
  });

  recs.push({
    action: "Schedule micro-revision loops on alternate days: one short formula/concept revision block plus one short mixed problem block to stabilize memory without burnout.",
    priority: testsCompleted < 3 ? "high" : "medium",
    estimated_time: "35 minutes",
    subjects_to_cover: "Core fundamentals",
    study_method: "Spaced repetition",
  });

  if (recs.length < 3) {
    recs.push({
      action: "Close each study session with a 5-minute reflection: what improved, what failed, and the next smallest actionable fix.",
      priority: "medium",
      estimated_time: "5 minutes",
      subjects_to_cover: "All subjects",
      study_method: "Metacognitive review",
    });
  }

  return recs.slice(0, 4);
}

function buildScoreBreakdown(avgScore: number, testsCompleted: number, topMistakes: [string, number][], toolsUsed: string[]): ScoreArea[] {
  const repetitionPenalty = Math.min(35, topMistakes.reduce((acc, [, count]) => acc + count, 0) * 3);
  const consistencyScore = clampScore(Math.min(100, testsCompleted * 18 + 20));
  const errorControlScore = clampScore(100 - repetitionPenalty);
  const workflowScore = clampScore(Math.min(100, toolsUsed.length * 16 + 40));

  return [
    {
      area: "Concept Accuracy",
      score: clampScore(avgScore),
      comment: "Reflects correctness level in recent attempts and conceptual command under test conditions.",
    },
    {
      area: "Consistency",
      score: consistencyScore,
      comment: "Measures regularity of test practice; higher frequency usually correlates with stable exam performance.",
    },
    {
      area: "Error Control",
      score: errorControlScore,
      comment: "Tracks how concentrated repeat mistakes are across topics; repeated errors reduce this score.",
    },
    {
      area: "Study Workflow",
      score: workflowScore,
      comment: "Indicates how effectively tools and routines are being combined for active learning.",
    },
  ];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check — derive userId from JWT, never from request body
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = authUser.id;

    // Payload size check
    const body = await req.text();
    if (body.length > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { sessionData } = JSON.parse(body) as { sessionData?: SessionPayload };
    const payload = sessionData || {};

    const testsCompleted = Number(payload.tests_completed || 0);
    const avgScore = Number(payload.average_score || 0);
    const durationMinutes = Number(payload.duration_minutes || 0);
    const toolsUsed = Array.isArray(payload.tools_used) ? payload.tools_used : [];

    let topMistakes: [string, number][] = Array.isArray(payload.top_mistakes)
      ? payload.top_mistakes.filter((item): item is [string, number] => Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "number")
      : [];

    if (topMistakes.length === 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: mistakes } = await supabase
        .from("mistakes")
        .select("topic")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      const counts = (mistakes || []).reduce((acc: Record<string, number>, row: any) => {
        const topic = String(row?.topic || "General");
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
      }, {});

      topMistakes = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic, count]) => [topic, count]);
    }

    const strengths = buildStrengths(avgScore, testsCompleted, durationMinutes);
    const weaknesses = buildWeaknesses(topMistakes, avgScore);
    const recommendations = buildRecommendations(weaknesses, testsCompleted);
    const score_breakdown = buildScoreBreakdown(avgScore, testsCompleted, topMistakes, toolsUsed);

    const summary = `You completed ${testsCompleted} recent tests with an average score of ${Math.round(avgScore)}%, and your current pattern shows clear progress potential with targeted correction. The strongest signal is in your learning momentum, while the main drag comes from repeated mistakes in a small set of topics. If you convert those repeat errors into a daily correction routine, your score should improve quickly over the next 7–10 days. Prioritize one weak topic at a time, keep sessions structured, and use short timed drills to improve both speed and accuracy.`;

    return new Response(
      JSON.stringify({
        summary,
        strengths,
        weaknesses,
        recommendations,
        score_breakdown,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("session-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});