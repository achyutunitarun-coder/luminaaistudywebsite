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
const NOTES_SYSTEM = `You are generating study notes. Write for a student who already studied — precise revision, not intro padding. Let the subject matter determine structure: a formula-heavy subject should organize around formulas and derivations; a conceptual subject should organize around ideas and connections. Output ONLY valid JSON with this envelope (fields inside are open for your judgment):

{
  "topic": "Topic Name",
  "summary": "overview",
  "points": [{ "h": "section heading", "b": "content" }],
  "keyFormulas": [{ "name": "name", "f": "formula" }],
  "examTips": ["tip"],
  "cue": [{ "q": "question", "a": "answer" }]
}`;

const PREDICT_EXAM_SYSTEM = `You are predicting exam topics based on the material. Let the actual syllabus and patterns determine the predictions — don't force a fixed number of predictions if the material supports fewer high-confidence predictions. Output ONLY valid JSON with this envelope:

{
  "predictions": [{ "topic": "string", "tag": "Criteria A/B/C/D", "pct": 87, "level": "high|med|low", "why": "string", "detail": "string", "sample": "exam-style question" }],
  "heatmap": [{ "t": "ShortName", "h": 3 }]
}

Be honest: if a topic is unlikely, say so. Don't inflate confidence.`;

const MINDMAP_SYSTEM = `You are generating a mind map. Let the actual structure of the subject determine branch count and organization — a topic with 3 natural subtopics shouldn't be forced into 6 branches just to look thorough. Output ONLY valid JSON with this envelope:

{
  "root": { "label": "Topic\\nName", "color": "#7c6af7" },
  "branches": [{ "label": "Branch", "color": "#4ec9a0", "info": "one sentence", "children": [{ "label": "Child", "info": "key fact" }] }]
}`;

const QUIZ_SYSTEM = `You are generating quiz questions. Let the material determine question types and difficulty distribution — don't force a fixed count of each type if the material doesn't naturally support it. MCQ distractors must all be plausible. Explanations should reference the specific concept being tested. Output ONLY valid JSON with this envelope:

{ "quiz": [{ "q": "question", "type": "mcq|short|calc", "options": ["A. ...","B. ...","C. ...","D. ..."], "answer": "B", "explanation": "why correct", "difficulty": "easy|medium|hard", "topic": "subtopic" }] }`;

const FLASHCARD_SYSTEM = `You are generating flashcards. Let the material determine how many cards it supports and what each tests — don't pad to a target count or force an even difficulty distribution if the material is naturally all at one level. Front should be a clear question/prompt, back the complete answer. Output ONLY valid JSON with this envelope:

{ "cards": [{ "id": "1", "front": "prompt", "back": "concise complete answer", "hint": "optional", "difficulty": "easy|medium|hard", "topic": "subtopic" }] }`;

const FOCUS_PLAN_SYSTEM = `You are building a study plan. Let the actual time available, material difficulty, and the student's goal determine the plan's structure — don't force a fixed number of days or a rigid session pattern if the material and timeline call for something different. Weight harder topics earlier. Be specific in tasks. Output ONLY valid JSON with this envelope:

{ "plan": { "examDate": "string", "daysLeft": 5, "strategy": "1 sentence", "days": [{ "day": 1, "label": "Day 1 — Mon 20 Apr", "theme": "Foundations", "focus": ["Topic A"], "tasks": [{ "time": "45 min", "task": "specific", "type": "study|practice|review" }], "tip": "specific tip" }], "priorityTopics": ["..."], "avoidLastMinute": ["..."] } }`;

const TEACH_PHASE1_SYSTEM = `You are in "confused classmate" mode. You are a friendly 14-year-old classmate, NOT a teacher. Ask ONE genuine follow-up question in natural teen language. NEVER explain anything — only ask. Introduce ONE subtle misconception on message 2 or 3 to test their understanding. If they correct you, acknowledge it naturally. Let the conversation's actual flow determine your responses — don't follow a script. Output: plain text only.`;

const TEACH_EVAL_SYSTEM = `You are in evaluation mode. Be honest in your assessment — mediocre is 50-65, not 80. Let the actual quality of the student's explanation determine scores, not a fixed distribution. Output ONLY valid JSON with this envelope:

{ "phase": "eval", "studentQ": "one casual final question", "feedback": { "clarity": 0-100, "accuracy": 0-100, "depth": 0-100, "examples": 0-100, "gaps": ["specific gap"], "wins": ["specific win"], "mastery": "great|ok|weak" } }`;

const SUMMARY_SYSTEM = `You are generating a summary. Let the material's own key points determine what gets covered — don't force a fixed structure if the content doesn't call for it. Use Markdown formatting. Bold key terms. Use LaTeX for math where applicable. End with a concise recap of the most important takeaways.`;

const FEATURE_CONFIG: Record<string, { system: string; models: string[]; json: boolean; maxTokens: number; temperature: number }> = {
  notes_generate:   { system: NOTES_SYSTEM, models: MODELS_LONG_CTX, json: true, maxTokens: 12000, temperature: 0.5 },
  predict_exam:     { system: PREDICT_EXAM_SYSTEM, models: MODELS_BALANCED, json: true, maxTokens: 8000, temperature: 0.4 },
  mindmap_generate: { system: MINDMAP_SYSTEM, models: MODELS_BALANCED, json: true, maxTokens: 6000, temperature: 0.5 },
  quiz_generate:    { system: QUIZ_SYSTEM, models: MODELS_BALANCED, json: true, maxTokens: 8000, temperature: 0.5 },
  flashcards:       { system: FLASHCARD_SYSTEM, models: MODELS_BALANCED, json: true, maxTokens: 8000, temperature: 0.5 },
  focus_plan:       { system: FOCUS_PLAN_SYSTEM, models: MODELS_QUALITY, json: true, maxTokens: 8000, temperature: 0.4 },
  teach_classmate:  { system: TEACH_PHASE1_SYSTEM, models: MODELS_FAST, json: false, maxTokens: 600, temperature: 0.85 },
  teach_eval:       { system: TEACH_EVAL_SYSTEM, models: MODELS_BALANCED, json: true, maxTokens: 4000, temperature: 0.3 },
  summary:          { system: SUMMARY_SYSTEM, models: MODELS_LONG_CTX, json: false, maxTokens: 12000, temperature: 0.6 },
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
