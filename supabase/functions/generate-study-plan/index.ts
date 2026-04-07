import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["meta-llama/llama-3.3-70b-instruct:free", "minimax/minimax-m2.5:free", "google/gemma-3-27b-it:free", "z-ai/glm-4.5-air:free", "qwen/qwen3-next-80b-a3b-instruct:free"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 30_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { subjects, examDate, dailyHours, mode, syllabus, wakeUpTime, sleepTime } = JSON.parse(body);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const isExamMode = mode === 'exam';
    const today = new Date().toISOString().split('T')[0];

    let systemPrompt: string;
    let userPrompt: string;

    if (isExamMode) {
      systemPrompt = `You are an expert exam preparation strategist. Create a DETAILED day-by-day study timetable in MARKDOWN format with tables.

RULES:
- Create a table for EACH day from today (${today}) to exam date
- Include specific TIME SLOTS (e.g. 7:00 AM - 8:30 AM)
- Distribute syllabus topics across days using spaced repetition
- Include breaks, revision sessions, and practice tests
- Last 2-3 days should be pure revision and mock tests
- Be specific about WHAT to study in each slot
- Use markdown tables with columns: Time | Topic | Activity | Duration
- Add tips after each week's schedule
- Make it realistic and achievable

Return ONLY the markdown timetable. No JSON wrapping.`;

      userPrompt = `Subject: ${subjects[0] || 'General'}
Exam Date: ${examDate}
Daily Study Hours: ${dailyHours}h
Wake Up: ${wakeUpTime || '7:00 AM'}
Sleep: ${sleepTime || '10:00 PM'}

SYLLABUS:
${syllabus}

Create a detailed day-by-day timetable with time slots covering this entire syllabus before the exam.`;
    } else {
      systemPrompt = `Create a realistic, actionable study plan with timetable structure. Be strategic — prioritize weak areas, use spaced repetition, and include breaks.

Return ONLY valid JSON in this EXACT format:
{"days": [{"day": 1, "date": "YYYY-MM-DD", "tasks": [{"subject": "...", "topic": "specific topic", "duration_minutes": 60, "type": "study|practice|review|test", "time": "9:00 AM"}]}]}

RULES:
- Include specific TIME slots for each task
- Distribute subjects evenly across days
- Add review sessions using spaced repetition (review day 1 material on day 3, day 7)
- Include practice/test sessions every 3-4 days
- Include short breaks between sessions
- Make topics SPECIFIC (not just "Math" but "Quadratic Equations - Factoring")`;

      userPrompt = `Subjects: ${JSON.stringify(subjects)}\nTarget date: ${examDate}\nDaily hours: ${dailyHours}\nToday: ${today}`;
    }

    for (const model of MODELS) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 25000);
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          signal: c.signal,
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_tokens: isExamMode ? 8000 : 4000,
            temperature: 0.4,
          }),
        });
        clearTimeout(t);
        if (!res.ok) { const e = await res.text(); console.error(`[plan] ${model} ${res.status}: ${e.slice(0, 200)}`); continue; }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) continue;

        console.log(`[plan] ✓ ${model} (${mode || 'study'})`);

        if (isExamMode) {
          // Return markdown directly
          return new Response(JSON.stringify({ markdown: content }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          // Parse JSON
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            return new Response(match[0], { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch (e) { console.error(`[plan] ${model}:`, e); }
    }
    throw new Error("All models failed");
  } catch (e) {
    console.error("generate-study-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});