// Lumina Features — unified edge function for all structured AI tools
// Handles: notes, predict_exam, teach_classmate, teach_eval, mindmap, quiz, flashcards, focus_plan, summary
// Uses smart key rotation + multi-model fallback from _shared/models.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  callAIText,
  MODELS_BALANCED,
  MODELS_FAST,
  MODELS_QUALITY,
  MODELS_LONG_CTX,
} from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────── PROMPTS ───────────
const NOTES_SYSTEM = `You are Lumina AI's Notes Generator. A student gives you a topic, subject, and grade.

Generate comprehensive study notes. Output ONLY valid JSON. No markdown, no preamble. Start with { end with }.

{
  "topic": "Topic Name",
  "subtitle": "Subject · Grade",
  "summary": "2-3 sentence overview of the whole topic. Clear and exam-focused.",
  "points": [{ "h": "Section heading — 3-5 words", "b": "2-4 sentences. Accurate, specific, exam-relevant. Include formulas or numbers where applicable." }],
  "keyFormulas": [{ "name": "Formula name (short)", "f": "The actual formula" }],
  "examTips": ["One specific, actionable exam tip per item. Reference exact mistakes students make."],
  "cue": [{ "q": "Short question for Cornell cue column", "a": "Short answer — max 8 words" }]
}

Rules:
- Give exactly 6 points
- keyFormulas: 3-5 if subject has them. Empty array for history/english.
- examTips: exactly 3 tips, specific to THIS topic.
- cue: exactly 4 cue Q-A pairs
- Write for a student who already studied — precise revision, not intro padding.`;

const PREDICT_EXAM_SYSTEM = `You are Lumina AI's Exam Predictor. Output ONLY valid JSON. Start with { end with }.

{
  "predictions": [{ "topic": "max 5 words", "tag": "Criteria A/B/C/D", "pct": 87, "level": "high", "why": "max 15 words", "detail": "2-3 sentences", "sample": "realistic exam-style question" }],
  "heatmap": [{ "t": "ShortName", "h": 3 }]
}

Rules:
- Exactly 6 predictions ordered highest to lowest pct
- level: "high" if pct>=75, "med" if 50-74, "low" if <50
- heatmap h: 0=very unlikely to 4=very likely; 16-20 cells, t max 10 chars no spaces
- "why" strictly under 15 words
- "sample" must sound like a real teacher wrote it`;

const MINDMAP_SYSTEM = `You are Lumina AI's Mind Map Generator. Output ONLY valid JSON. Start with { end with }.

{
  "root": { "label": "Topic\\nName", "color": "#7c6af7" },
  "branches": [{ "label": "Branch", "color": "#4ec9a0", "info": "one sentence", "children": [{ "label": "Child", "info": "key fact" }] }]
}

Rules:
- 4-6 branches, each with 2-4 children
- Branch labels max 3 words, child labels max 3 words
- Colors vary from: #7c6af7 #4ec9a0 #f06292 #ffb74d #64b5f6 #a5d6a7 #ef9a9a — no two adjacent the same
- Subject-specific branches, not generic "Introduction"`;

const QUIZ_SYSTEM = `You are Lumina AI's Quiz Generator. Output ONLY valid JSON. Start with { end with }.

{ "quiz": [{ "q": "question", "type": "mcq", "options": ["A. ...","B. ...","C. ...","D. ..."], "answer": "B", "explanation": "why correct, reference rule/formula", "difficulty": "medium", "topic": "subtopic" }] }

Rules:
- 8 questions: 5 mcq, 2 short, 1 calc
- Distribute: 2 easy, 4 medium, 2 hard
- For short/calc: omit options
- MCQ distractors must all be plausible
- Explanation references the specific rule, not just "this is correct"`;

const FLASHCARD_SYSTEM = `You are Lumina AI's Flashcard Generator. Output ONLY valid JSON. Start with { end with }.

{ "cards": [{ "id": "1", "front": "prompt", "back": "concise complete answer", "hint": "optional", "difficulty": "easy", "topic": "subtopic" }] }

Rules:
- 12 cards, distribute: 4 easy, 5 medium, 3 hard
- Front: question/prompt, not full fact
- Back: include units, conditions, exceptions
- hint: only on medium/hard cards`;

const FOCUS_PLAN_SYSTEM = `You are Lumina AI's Study Planner. Output ONLY valid JSON. Start with { end with }.

{ "plan": { "examDate": "string", "daysLeft": 5, "strategy": "1 sentence", "days": [{ "day": 1, "label": "Day 1 — Mon 20 Apr", "theme": "Foundations", "focus": ["Topic A"], "tasks": [{ "time": "45 min", "task": "specific", "type": "study|practice|review" }], "tip": "specific tip" }], "priorityTopics": ["..."], "avoidLastMinute": ["..."] } }

Rules:
- Weight harder topics earlier — not the day before exam
- Be specific in tasks, not "study quadratics"`;

const TEACH_PHASE1_SYSTEM = `You are in "confused classmate" mode. You are a friendly 14-year-old classmate, NOT a teacher.

- Ask ONE genuine follow-up question (1-2 sentences, teen language: "wait so...", "but doesn't that mean...")
- NEVER explain anything yourself — only ask
- On message 2 or 3, introduce ONE subtle misconception to test them
- If they correct you, say "ohhh okay yeah that makes way more sense, thanks"
- Output: plain text only — just the question.`;

const TEACH_EVAL_SYSTEM = `You are in evaluation mode. Output ONLY valid JSON. Start with { end with }.

{ "phase": "eval", "studentQ": "one casual final question", "feedback": { "clarity": 0-100, "accuracy": 0-100, "depth": 0-100, "examples": 0-100, "gaps": ["specific gap"], "wins": ["specific win"], "mastery": "great|ok|weak" } }

Be honest. Mediocre = 50-65, not 80. mastery: great if avg>=80, ok if 60-79, weak if <60.`;

const SUMMARY_SYSTEM = `You are Lumina AI's Summary Generator. Output a clear, structured study summary in well-formatted Markdown.
- Start with a 2-3 sentence overview
- Use ## headings for each major sub-topic
- Bold **key terms**
- Use LaTeX for math: $...$ inline, $$...$$ block
- End with a short "Quick Recap" bulleted list`;

const FEATURE_CONFIG: Record<string, { system: string; models: string[]; json: boolean; maxTokens: number; temperature: number }> = {
  notes_generate:   { system: NOTES_SYSTEM, models: MODELS_LONG_CTX, json: true, maxTokens: 3000, temperature: 0.5 },
  predict_exam:     { system: PREDICT_EXAM_SYSTEM, models: MODELS_BALANCED, json: true, maxTokens: 2000, temperature: 0.4 },
  mindmap_generate: { system: MINDMAP_SYSTEM, models: MODELS_BALANCED, json: true, maxTokens: 1800, temperature: 0.5 },
  quiz_generate:    { system: QUIZ_SYSTEM, models: MODELS_BALANCED, json: true, maxTokens: 2500, temperature: 0.5 },
  flashcards:       { system: FLASHCARD_SYSTEM, models: MODELS_BALANCED, json: true, maxTokens: 2200, temperature: 0.5 },
  focus_plan:       { system: FOCUS_PLAN_SYSTEM, models: MODELS_QUALITY, json: true, maxTokens: 2500, temperature: 0.4 },
  teach_classmate:  { system: TEACH_PHASE1_SYSTEM, models: MODELS_FAST, json: false, maxTokens: 200, temperature: 0.85 },
  teach_eval:       { system: TEACH_EVAL_SYSTEM, models: MODELS_BALANCED, json: true, maxTokens: 1200, temperature: 0.3 },
  summary:          { system: SUMMARY_SYSTEM, models: MODELS_LONG_CTX, json: false, maxTokens: 2500, temperature: 0.6 },
};

const TEMPLATE_HINTS: Record<string, string> = {
  darklab:   "detailed technical notes emphasising formulas and definitions",
  cornell:   "structured cornell-format notes with strong cue questions and summary",
  neonboxes: "vivid concept-by-concept breakdown, each idea standalone",
  paper:     "warm conversational notes like a student explaining to another",
  minimal:   "ultra-concise, only the most important info",
  deepnotes: "comprehensive deep-dive covering edge cases",
  editorial: "narrative-style with strong lead paragraph",
  summary:   "condensed rapid-revision with formulas front and centre",
  flashdeck: "Q&A format with each concept self-contained",
  glass:     "immersive structured notes with clear visual hierarchy",
};

function cleanJson(raw: string): any {
  const clean = raw.replace(/^```(json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(clean); }
  catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Invalid JSON from model");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { feature, topic, subject, grade, messages, templateId, extra } = await req.json();
    const cfg = FEATURE_CONFIG[feature];
    if (!cfg) {
      return new Response(JSON.stringify({ error: `Unknown feature: ${feature}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let system = cfg.system;
    if (feature === "notes_generate" && templateId && TEMPLATE_HINTS[templateId]) {
      system += `\n\nNote style requested: ${TEMPLATE_HINTS[templateId]}`;
    }

    let userContent: string;
    let convoMessages: any[];
    if (messages && Array.isArray(messages)) {
      convoMessages = [{ role: "system", content: system }, ...messages];
      userContent = messages[messages.length - 1]?.content || "";
    } else {
      userContent = `Topic: ${topic || "general"}\nSubject: ${subject || "general"}\nGrade: ${grade || "general"}${extra ? `\n${extra}` : ""}`;
      convoMessages = [{ role: "system", content: system }, { role: "user", content: userContent }];
    }

    const startedAt = Date.now();
    const raw = await callAIText(convoMessages, cfg.models, cfg.maxTokens, cfg.temperature, 60_000, `lumina/${feature}`);
    const elapsed = Date.now() - startedAt;

    const result = cfg.json ? cleanJson(raw) : raw;

    // Log for training (fire and forget)
    void sb.functions.invoke("learning-pipeline", {
      body: {
        action: "capture",
        userInput: userContent.slice(0, 4000),
        aiResponse: typeof result === "string" ? result.slice(0, 8000) : JSON.stringify(result).slice(0, 8000),
        subject: subject || null,
        topic: topic || null,
        source: `lumina_${feature}`,
        sessionId: crypto.randomUUID(),
      },
    }).catch(() => {});

    return new Response(JSON.stringify({ result, elapsedMs: elapsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lumina-features error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
