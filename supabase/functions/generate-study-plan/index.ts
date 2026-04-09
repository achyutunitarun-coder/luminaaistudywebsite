import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIText, MODELS_QUALITY } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 30_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { subjects, examDate, dailyHours, mode, syllabus, wakeUpTime, sleepTime } = JSON.parse(body);

    const isExamMode = mode === 'exam';
    const today = new Date().toISOString().split('T')[0];

    let systemPrompt: string;
    let userPrompt: string;

    if (isExamMode) {
      systemPrompt = `You are an expert exam preparation strategist. Create a DETAILED day-by-day study timetable in MARKDOWN format with tables.\nRULES:\n- Create a table for EACH day from today (${today}) to exam date\n- Include specific TIME SLOTS\n- Use spaced repetition\n- Last 2-3 days = pure revision and mock tests\n- Use markdown tables: Time | Topic | Activity | Duration\n- Return ONLY markdown.`;
      userPrompt = `Subject: ${subjects[0] || 'General'}\nExam Date: ${examDate}\nDaily Hours: ${dailyHours}h\nWake Up: ${wakeUpTime || '7:00 AM'}\nSleep: ${sleepTime || '10:00 PM'}\n\nSYLLABUS:\n${syllabus}`;
    } else {
      systemPrompt = `Create a study plan. Return ONLY valid JSON: {"days": [{"day": 1, "date": "YYYY-MM-DD", "tasks": [{"subject": "...", "topic": "specific topic", "duration_minutes": 60, "type": "study|practice|review|test", "time": "9:00 AM"}]}]}. Include spaced repetition. Make topics SPECIFIC.`;
      userPrompt = `Subjects: ${JSON.stringify(subjects)}\nTarget date: ${examDate}\nDaily hours: ${dailyHours}\nToday: ${today}`;
    }

    const content = await callAIText(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      MODELS_QUALITY, isExamMode ? 8000 : 4000, 0.4, 45000, "plan"
    );

    if (isExamMode) {
      return new Response(JSON.stringify({ markdown: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) return new Response(match[0], { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Failed to parse plan" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("generate-study-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
