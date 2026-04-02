import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 20+ free OpenRouter models — openrouter/free as PRIMARY
const FREE_MODELS = [
  "openrouter/free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3-coder:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "arcee-ai/trinity-large-preview:free",
  "arcee-ai/trinity-mini:free",
  "z-ai/glm-4.5-air:free",
  "stepfun/step-3.5-flash:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3n-e4b-it:free",
  "minimax/minimax-m2.5:free",
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "openrouter/auto",
];

function buildPrompts(type: string, curriculum: string, subject: string, topic: string, count?: number) {
  const cur = curriculum || "general";
  if (type === "notes") {
    return {
      system: `You are an expert educator. Generate comprehensive, well-structured study notes in Markdown.

Structure EXACTLY like this:
# ${topic}

## 1. Overview
Brief introduction to the topic.

## 2. Key Concepts
### Basic
- ...
### Intermediate
- ...
### Advanced
- ...

## 3. Important Formulas & Definitions
| Term | Definition |
|------|-----------|
| ... | ... |

## 4. Worked Examples
Step-by-step examples with explanations.

## 5. Practice Questions
3-5 practice questions with answers.

## 6. Exam Tips
> Key tips for exam success

## 7. Summary
Concise bullet-point summary.

Use LaTeX ($...$) for ALL math. Use tables, blockquotes, bold, bullet points. Adapt for ${cur} curriculum. Be thorough and exam-focused.`,
      user: `Generate detailed study notes for: Subject: ${subject}, Topic: ${topic}, Curriculum: ${cur}.`,
    };
  }
  if (type === "flashcards") {
    return {
      system: `Generate exactly 15 high-quality flashcards. Return ONLY a JSON array: [{"front":"question","back":"answer"}]. One concept per card. Adapt for ${cur}. NO markdown fences, ONLY raw JSON.`,
      user: `Create 15 flashcards for: ${subject} - ${topic} (${cur}). Return ONLY the JSON array.`,
    };
  }
  if (type === "questions") {
    return {
      system: `Generate exactly 10 questions with mixed difficulty. Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","difficulty":"Easy|Medium|Hard"}]. NO markdown fences, ONLY raw JSON.`,
      user: `Create 10 practice questions for: ${subject} - ${topic} (${cur}). Return ONLY the JSON array.`,
    };
  }
  if (type === "test") {
    return {
      system: `Generate exactly 10 exam-style questions simulating real ${cur} exam patterns. Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]. NO markdown fences, ONLY raw JSON.`,
      user: `Create a practice test for: ${subject} - ${topic} (${cur}). Return ONLY the JSON array.`,
    };
  }
  const qCount = count || 10;
  return {
    system: `Generate exactly ${qCount} quiz questions. Return ONLY a JSON object: {"questions":[{"question":"...","options":["A","B","C","D"],"answer":0}]}. NO markdown fences, ONLY raw JSON.`,
    user: `Create ${qCount} quiz questions about: ${topic || subject}. Return ONLY the JSON.`,
  };
}

function cleanAndParse(raw: string) {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  cleaned = cleaned.replace(/^\s*json\s*/i, "");
  const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    // Try fixing trailing commas
    const fixed = match[0].replace(/,\s*([\]}])/g, "$1");
    try { return JSON.parse(fixed); } catch { return null; }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { curriculum, subject, topic, type, userId, regenerate, count } = await req.json();

    if (!subject || !topic || !type || !userId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Return existing resource if available (no AI call)
    if (type !== "game_questions" && !regenerate) {
      const { data: existing } = await sb
        .from("resources")
        .select("*")
        .eq("user_id", userId)
        .eq("curriculum", curriculum || "general")
        .eq("subject", subject)
        .eq("topic", topic)
        .eq("resource_type", type)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ content: existing.content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const prompts = buildPrompts(type, curriculum, subject, topic, count);
    const messages = [
      { role: "system", content: prompts.system },
      { role: "user", content: prompts.user },
    ];

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    let rawContent = "";
    let success = false;

    for (const model of FREE_MODELS) {
      try {
        console.log(`[generate-resources] Trying: ${model}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 40000);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: type === "notes" ? 8000 : 4000,
            temperature: 0.7,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errText = await response.text();
          console.error(`${model} error ${response.status}: ${errText.slice(0, 200)}`);
          continue;
        }

        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content;
        if (content && content.trim().length > 20) {
          rawContent = content;
          success = true;
          console.log(`[generate-resources] Success: ${model}`);
          break;
        }
      } catch (e) {
        console.error(`${model} exception:`, e);
        continue;
      }
    }

    if (!success || !rawContent) throw new Error("All AI models failed to generate content");

    let content: Record<string, unknown> = {};

    if (type === "notes") {
      content = { notes: rawContent };
    } else {
      const parsed = cleanAndParse(rawContent);
      if (!parsed) throw new Error("No valid JSON in AI response");

      if (type === "flashcards") {
        content = { flashcards: Array.isArray(parsed) ? parsed : parsed.flashcards || [] };
      } else if (type === "questions") {
        content = { questions: Array.isArray(parsed) ? parsed : parsed.questions || [] };
      } else if (type === "test") {
        content = { test: Array.isArray(parsed) ? parsed : parsed.test || [] };
      } else if (type === "game_questions") {
        content = { questions: Array.isArray(parsed) ? parsed : parsed.questions || [] };
      }
    }

    // Persist (skip game questions)
    if (type !== "game_questions") {
      const { error: upsertError } = await sb
        .from("resources")
        .upsert(
          {
            user_id: userId,
            curriculum: curriculum || "general",
            subject,
            topic,
            resource_type: type,
            content,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,curriculum,subject,topic,resource_type" }
        );
      if (upsertError) console.error("Upsert error:", upsertError);
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
