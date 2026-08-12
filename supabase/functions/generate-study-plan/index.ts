import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { callAIText, MODELS_FAST } from "../_shared/models.ts";

// Hard ceiling for the entire AI call. The shared router's phases/continuations
// can each scale past the per-call timeout and add up to 120s+; we race them
// against this fixed deadline and always return (fallback) within it.
const HARD_DEADLINE_MS = 35_000;

async function generateWithDeadline(
  messages: { role: string; content: string }[],
  models: string[],
  maxTokens: number,
  temperature: number,
  timeoutMs: number,
  tag: string,
): Promise<string> {
  const ai = callAIText(messages, models, maxTokens, temperature, timeoutMs, tag);
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("deadline exceeded")), HARD_DEADLINE_MS)
  );
  return Promise.race([ai, timer]).catch((e) => {
    if (e instanceof Error && e.message === "deadline exceeded") throw e;
    throw e;
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_TOPICS = [
  "Foundations and core concepts",
  "Derivation, formulas and worked examples",
  "Common exam questions and problems",
  "Application to real-world scenarios",
  "Weak areas, revision and spaced practice",
  "Final review and practice tests",
];

function fallbackStudyPlan(subjects: string[], examDate: string, dailyHours: number) {
  const today = new Date();
  const end = new Date(examDate || Date.now() + 7 * 86400000);
  const days = Math.max(1, Math.min(30, Math.ceil((end.getTime() - today.getTime()) / 86400000)));
  const subj = subjects.length ? subjects : ["General"];
  return { is_fallback: true, days: Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    date: new Date(today.getTime() + i * 86400000).toISOString().slice(0, 10),
    tasks: subj.slice(0, 3).map((subject, j) => ({
      subject,
      topic: i === days - 1
        ? "Final review and weak areas"
        : `${FALLBACK_TOPICS[(i + j) % FALLBACK_TOPICS.length]}`,
      duration_minutes: Math.max(30, Math.round((Number(dailyHours) || 2) * 60 / Math.min(3, Math.max(1, subj.length || 1)))),
      type: i % 3 === 2 ? "practice" : i === days - 1 ? "test" : "study",
      time: `${9 + j * 2}:00`,
    })),
  })) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const _auth = await requireUser(req, corsHeaders);
    if ("error" in _auth) return _auth.error;
    {
      const { enforceUsage } = await import("../_shared/usage-gate.ts");
      const gate = await enforceUsage(_auth.user.id, "study_planners", corsHeaders);
      if (!gate.ok) return gate.response;
    }
    const body = await req.text();
    if (body.length > 5_000_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { subjects, examDate, dailyHours, mode, syllabus, wakeUpTime, sleepTime } = JSON.parse(body);

    const isExamMode = mode === 'exam';
    const today = new Date().toISOString().split('T')[0];

    let systemPrompt: string;
    let userPrompt: string;

    if (isExamMode) {
      systemPrompt = `You are building a study plan. The actual constraint that matters is real (a deadline, a time budget, prerequisite ordering where genuinely necessary) — respect those. What's open: how the plan is broken into phases or sessions, how much material is covered per session, and whether the plan is organized by topic, by difficulty progression, by exam-weighting, or some other logic — driven by the actual material and the actual goal (exam prep vs. deep mastery vs. review), not a fixed template.\n\nReturn markdown with tables. Today is ${today}.`;
      userPrompt = `Subject: ${subjects[0] || 'General'}\nExam Date: ${examDate}\nDaily Hours: ${dailyHours}h\nWake Up: ${wakeUpTime || '7:00 AM'}\nSleep: ${sleepTime || '10:00 PM'}\n\nSYLLABUS:\n${syllabus}`;
    } else {
      systemPrompt = `Create a study plan. Let the actual material and timeframe determine the plan's structure — the number of sessions, their organization, and pacing should fit what's being studied, not a fixed template. Return ONLY valid JSON: {"days": [{"day": 1, "date": "YYYY-MM-DD", "tasks": [{"subject": "...", "topic": "specific topic", "duration_minutes": 60, "type": "study|practice|review|test", "time": "9:00 AM"}]}]}. Include spaced repetition. Make topics SPECIFIC and concise.`;
      userPrompt = `Subjects: ${JSON.stringify(subjects)}\nTarget date: ${examDate}\nDaily hours: ${dailyHours}\nToday: ${today}`;
    }

    const models = MODELS_FAST;
    const maxTokens = isExamMode ? 3000 : 3200;
    const timeoutMs = HARD_DEADLINE_MS;

    let content: string;
    try {
      content = await generateWithDeadline(
        [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        models, maxTokens, 0.4, timeoutMs, "plan"
      );
    } catch (e) {
      const t = e instanceof Error ? e.message : "";
      if (t === "deadline exceeded") {
        if (isExamMode) {
          return new Response(
            JSON.stringify({
              markdown: `## Exam Study Plan\nToday is ${new Date().toISOString().split("T")[0]}. Exam date: ${examDate || "N/A"}. Daily study budget: ${dailyHours || 2}h.\n\nHere is a structured plan. Study each subject in focused sessions, prioritise weak areas, and leave the final days for revision and practice tests.`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const fallback = fallbackStudyPlan(subjects || [], examDate, dailyHours);
        return new Response(JSON.stringify(fallback), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw e;
    }

    if (isExamMode) {
      return new Response(JSON.stringify({ markdown: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const cleaned = content.replace(/<thinking[\s\S]*?<\/think>/gi, "").replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return new Response(match[0], { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(fallbackStudyPlan(subjects || [], examDate, dailyHours)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("generate-study-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
