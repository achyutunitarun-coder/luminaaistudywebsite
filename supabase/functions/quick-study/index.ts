import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { callAIText, MODELS_FAST } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanJSON(raw: string): any {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const start = text.search(/[\[{]/);
  if (start < 0) return null;
  const startChar = text[start];
  const end = text.lastIndexOf(startChar === "[" ? "]" : "}");
  if (end <= start) return null;
  let jsonStr = text.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1");
  try { return JSON.parse(jsonStr); } catch {
    let b = 0, k = 0;
    for (const c of jsonStr) { if (c === "{") b++; if (c === "}") b--; if (c === "[") k++; if (c === "]") k--; }
    while (k > 0) { jsonStr += "]"; k--; }
    while (b > 0) { jsonStr += "}"; b--; }
    try { return JSON.parse(jsonStr); } catch { return null; }
  }
}

function fallbackLesson(topic: string) {
  const t = String(topic || "the topic").split("--- ATTACHED FILES ---")[0].trim().slice(0, 120) || "Quick Study";
  return {
    title: t,
    key_concepts: [
      { concept: "Core idea", explanation: `Start by defining ${t} in one sentence, then connect it to one real example.` },
      { concept: "Cause and effect", explanation: "Ask what changes, why it changes, and what result follows. This turns facts into understanding." },
      { concept: "Exam trigger", explanation: "Look for command words like define, explain, compare, calculate, or evaluate, then answer in that style." },
    ],
    practice_questions: [
      { question: `What is the best first step when studying ${t}?`, options: ["Memorise random facts", "Define the core idea", "Skip examples", "Only read headings"], correct: 1, explanation: "A clear definition anchors every later detail." },
      { question: "Which method improves recall fastest?", options: ["Passive rereading", "Active recall", "Highlighting everything", "Avoiding mistakes"], correct: 1, explanation: "Active recall forces your brain to retrieve, which strengthens memory." },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const _auth = await requireUser(req, corsHeaders);
    if ("error" in _auth) return _auth.error;
    const body = await req.text();
    if (body.length > 2_000_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { topic } = JSON.parse(body);

    const text = await callAIText(
      [
        { role: "system", content: `Create a quick study lesson. Return ONLY JSON: {"title": "...", "key_concepts": [{"concept": "name", "explanation": "engaging explanation with analogies"}], "practice_questions": [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]}. Do NOT include thinking tags.` },
        { role: "user", content: `Quick study lesson on "${topic}".` },
      ],
      MODELS_FAST, 3000, 0.5, 40_000, "quick-study"
    );
    const parsed = cleanJSON(text);
    return new Response(JSON.stringify(parsed || fallbackLesson(topic)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("quick-study error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
