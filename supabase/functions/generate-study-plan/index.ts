import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["qwen/qwen3.6-plus:free", "openai/gpt-oss-120b:free", "nvidia/nemotron-3-super-120b-a12b:free", "minimax/minimax-m2.5:free", "google/gemma-3-27b-it:free", "meta-llama/llama-3.3-70b-instruct:free", "z-ai/glm-4.5-air:free", "openrouter/auto"];

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
      systemPrompt = `You are an expert exam preparation strategist. Create a DETAILED day-by-day study timetable in MARKDOWN format with tables.\nRULES:\n- Create a table for EACH day from today (${today}) to exam date\n- Include specific TIME SLOTS\n- Use spaced repetition\n- Last 2-3 days = pure revision and mock tests\n- Use markdown tables: Time | Topic | Activity | Duration\n- Return ONLY markdown.`;
      userPrompt = `Subject: ${subjects[0] || 'General'}\nExam Date: ${examDate}\nDaily Hours: ${dailyHours}h\nWake Up: ${wakeUpTime || '7:00 AM'}\nSleep: ${sleepTime || '10:00 PM'}\n\nSYLLABUS:\n${syllabus}`;
    } else {
      systemPrompt = `Create a study plan. Return ONLY valid JSON: {"days": [{"day": 1, "date": "YYYY-MM-DD", "tasks": [{"subject": "...", "topic": "specific topic", "duration_minutes": 60, "type": "study|practice|review|test", "time": "9:00 AM"}]}]}. Include spaced repetition. Make topics SPECIFIC.`;
      userPrompt = `Subjects: ${JSON.stringify(subjects)}\nTarget date: ${examDate}\nDaily hours: ${dailyHours}\nToday: ${today}`;
    }

    for (const model of MODELS) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 30000);
        const res = await fetch(OPENROUTER_URL, {
          method: "POST", signal: c.signal,
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: isExamMode ? 8000 : 4000, temperature: 0.4 }),
        });
        clearTimeout(t);
        if (!res.ok) { const e = await res.text(); console.error(`[plan] ${model} ${res.status}: ${e.slice(0, 200)}`); continue; }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) continue;
        console.log(`[plan] ✓ ${model} (${mode || 'study'})`);

        if (isExamMode) {
          return new Response(JSON.stringify({ markdown: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else {
          const match = content.match(/\{[\s\S]*\}/);
          if (match) return new Response(match[0], { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (e) { console.error(`[plan] ${model}:`, e); }
    }
    throw new Error("All models are busy — please try again in a moment");
  } catch (e) {
    console.error("generate-study-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
