import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { callAIText, OWL, MODEL_FREE_ROUTER } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fallbackStudyPlan(subjects: string[], examDate: string, dailyHours: number) {
  const today = new Date();
  const end = new Date(examDate || Date.now() + 7 * 86400000);
  const days = Math.max(1, Math.min(30, Math.ceil((end.getTime() - today.getTime()) / 86400000)));
  return { days: Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    date: new Date(today.getTime() + i * 86400000).toISOString().slice(0, 10),
    tasks: (subjects.length ? subjects : ["General"]).slice(0, 3).map((subject, j) => ({
      subject,
      topic: i === days - 1 ? "Final review and weak areas" : `Core topic ${i + 1}.${j + 1}`,
      duration_minutes: Math.max(30, Math.round((Number(dailyHours) || 2) * 60 / Math.min(3, Math.max(1, subjects.length || 1)))),
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
      systemPrompt = `You are an expert exam preparation strategist. Create a DETAILED but concise day-by-day study timetable in MARKDOWN format with tables.\nRULES:\n- Create a table for EACH day from today (${today}) to exam date\n- Include specific TIME SLOTS\n- Use spaced repetition\n- Keep each day to 3-5 focused study blocks\n- Last 2-3 days = pure revision and mock tests\n- Use markdown tables: Time | Topic | Activity | Duration\n- Return ONLY markdown.`;
      userPrompt = `Subject: ${subjects[0] || 'General'}\nExam Date: ${examDate}\nDaily Hours: ${dailyHours}h\nWake Up: ${wakeUpTime || '7:00 AM'}\nSleep: ${sleepTime || '10:00 PM'}\n\nSYLLABUS:\n${syllabus}`;
    } else {
      systemPrompt = `Create a fast, high-quality study plan. Return ONLY valid JSON: {"days": [{"day": 1, "date": "YYYY-MM-DD", "tasks": [{"subject": "...", "topic": "specific topic", "duration_minutes": 60, "type": "study|practice|review|test", "time": "9:00 AM"}]}]}. Include spaced repetition. Make topics SPECIFIC and concise.`;
      userPrompt = `Subjects: ${JSON.stringify(subjects)}\nTarget date: ${examDate}\nDaily hours: ${dailyHours}\nToday: ${today}`;
    }

    const models = [OWL, MODEL_FREE_ROUTER];
    const maxTokens = isExamMode ? 4000 : 2000;
    const timeoutMs = isExamMode ? 25_000 : 15_000;

    const content = await callAIText(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      models, maxTokens, 0.4, timeoutMs, "plan"
    );

    if (isExamMode) {
      return new Response(JSON.stringify({ markdown: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return new Response(match[0], { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(fallbackStudyPlan(subjects || [], examDate, dailyHours)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("generate-study-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
