import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PAYLOAD_BYTES = 50_000;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-coder:free",
];
const FALLBACK_MODELS = [
  "openrouter/auto",
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1-0528:free",
  "qwen/qwq-32b:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "deepseek/deepseek-r1:free",
  "microsoft/phi-4-reasoning-plus:free",
  "microsoft/phi-4-reasoning:free",
  "microsoft/mai-ds-r1:free",
  "rekaai/reka-flash-3:free",
  "nvidia/llama-3.1-nemotron-ultra-253b:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-4b-it:free",
];
const ALL_MODELS = [...PRIMARY_MODELS, ...FALLBACK_MODELS.filter(m => !PRIMARY_MODELS.includes(m))];

type TestPayload = {
  questions: Array<{ question: string; options: string[]; correct: number; explanation: string }>;
};

type Question = TestPayload["questions"][number];

const normalizeSingleQuotes = (input: string) => input
  .replace(/([{,]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'\s*:/g, '$1"$2":')
  .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, value) => `: "${String(value).replace(/"/g, '\\"')}"`);

const autoCloseJson = (input: string) => {
  let json = input;
  let braces = 0;
  let brackets = 0;
  for (const ch of json) {
    if (ch === "{") braces++;
    if (ch === "}") braces--;
    if (ch === "[") brackets++;
    if (ch === "]") brackets--;
  }
  while (brackets > 0) {
    json += "]";
    brackets--;
  }
  while (braces > 0) {
    json += "}";
    braces--;
  }
  return json;
};

function cleanAndParseJSON(raw: string): unknown {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

  const start = text.search(/[\[{]/);
  if (start < 0) return null;

  const startChar = text[start];
  const end = text.lastIndexOf(startChar === "[" ? "]" : "}");
  const extracted = end > start ? text.slice(start, end + 1) : text.slice(start);
  const sanitized = extracted
    .replace(/,\s*([\]}])/g, "$1")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");

  const candidates = [
    sanitized,
    normalizeSingleQuotes(sanitized),
    autoCloseJson(sanitized),
    autoCloseJson(normalizeSingleQuotes(sanitized)),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next
    }
  }

  return null;
}

function normalizeQuestionKey(question: string): string {
  return question.toLowerCase().replace(/\s+/g, " ").trim();
}

function sanitizeQuestions(payload: unknown): Question[] {
  const rawQuestions = (payload as TestPayload | null)?.questions;
  if (!Array.isArray(rawQuestions)) return [];

  const deduped = new Map<string, Question>();

  for (const item of rawQuestions) {
    const question = typeof item?.question === "string" ? item.question.trim() : "";
    const options = Array.isArray(item?.options)
      ? item.options.map((opt) => String(opt ?? "").trim()).filter(Boolean)
      : [];
    const correct = Number(item?.correct);
    const explanation = typeof item?.explanation === "string" ? item.explanation.trim() : "";

    if (!question || options.length < 2 || !Number.isInteger(correct) || correct < 0 || correct >= options.length || !explanation) {
      continue;
    }

    const key = normalizeQuestionKey(question);
    if (!deduped.has(key)) {
      deduped.set(key, { question, options, correct, explanation });
    }
  }

  return [...deduped.values()];
}

async function callOpenRouter(apiKey: string, messages: any[], expectedCount: number, maxTokens = 4500): Promise<TestPayload> {
  let bestPartial: Question[] = [];

  for (const model of ALL_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature: 0.4,
            response_format: { type: "json_object" },
          }),
        });

        if (!res.ok) {
          const t = await res.text();
          console.error(`${model} error ${res.status}: ${t}`);
          continue;
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) continue;

        const parsed = cleanAndParseJSON(content);
        const validQuestions = sanitizeQuestions(parsed);

        if (validQuestions.length >= expectedCount) {
          console.log(`[generate-test] Success: ${model} (attempt ${attempt}) - ${validQuestions.length}/${expectedCount}`);
          return { questions: validQuestions.slice(0, expectedCount) };
        }

        if (validQuestions.length > bestPartial.length) {
          bestPartial = validQuestions;
        }

        if (validQuestions.length > 0) {
          console.error(`[generate-test] ${model} returned only ${validQuestions.length}/${expectedCount} questions on attempt ${attempt}`);
          continue;
        }

        console.error(`[generate-test] ${model} produced unparsable output on attempt ${attempt}`);
      } catch (e) {
        console.error(`${model} exception:`, e);
      }
    }
  }

  if (bestPartial.length > 0) {
    return { questions: bestPartial };
  }

  throw new Error("All models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: _authUser }, error: _authErr } = await _supabase.auth.getUser();
    if (_authErr || !_authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Payload size check
    const body = await req.text();
    if (body.length > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { syllabus, subject, numQuestions } = JSON.parse(body);

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const num = Math.min(Math.max(Number(numQuestions) || 5, 1), 20);
    const aiMessages = [
      { role: "system", content: `You are an expert exam question setter. Generate ${num} challenging multiple choice questions that test deep understanding, not just surface recall.

Rules:
- Mix difficulty: 30% easy, 50% medium, 20% hard
- Include application-based and analytical questions, not just factual recall
- Each wrong option should be a plausible distractor (common misconception)
- Explanations should teach WHY the answer is correct AND why each wrong option fails

Return ONLY valid JSON with no markdown fences: {"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}]} where correct is the 0-based index.
- Keep each explanation under 2 sentences.
- Use plain text only (no LaTeX, no markdown).` },
      { role: "user", content: `Subject: ${String(subject || 'General').slice(0, 200)}\n\nSyllabus/Topic:\n${String(syllabus || '').slice(0, 10000)}` },
    ];

    const initialMaxTokens = Math.min(8192, Math.max(3500, num * 900));
    const initialResult = await callOpenRouter(OPENROUTER_API_KEY, aiMessages, num, initialMaxTokens);

    let mergedQuestions = sanitizeQuestions(initialResult).slice(0, num);
    const seen = new Set(mergedQuestions.map((q) => normalizeQuestionKey(q.question)));

    for (let topUpAttempt = 1; mergedQuestions.length < num && topUpAttempt <= 3; topUpAttempt++) {
      const remaining = num - mergedQuestions.length;
      const topUpMessages = [
        {
          role: "system",
          content: `Generate exactly ${remaining} NEW multiple choice questions in valid JSON only: {"questions":[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]}. Do not repeat or rephrase any existing questions. Keep explanations under 2 sentences and plain text only.`,
        },
        {
          role: "user",
          content: `Subject: ${String(subject || "General").slice(0, 200)}\n\nSyllabus/Topic:\n${String(syllabus || "").slice(0, 10000)}\n\nExisting questions to avoid:\n${mergedQuestions.map((q, i) => `${i + 1}. ${q.question}`).join("\n")}`,
        },
      ];

      const topUp = await callOpenRouter(
        OPENROUTER_API_KEY,
        topUpMessages,
        remaining,
        Math.min(8192, Math.max(3000, remaining * 1000)),
      );

      const next = sanitizeQuestions(topUp).filter((q) => !seen.has(normalizeQuestionKey(q.question)));
      for (const q of next) {
        if (mergedQuestions.length >= num) break;
        seen.add(normalizeQuestionKey(q.question));
        mergedQuestions.push(q);
      }
    }

    if (mergedQuestions.length < num) {
      throw new Error(`Could only generate ${mergedQuestions.length} of ${num} questions. Please retry.`);
    }

    return new Response(JSON.stringify({ questions: mergedQuestions.slice(0, num) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-test error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});