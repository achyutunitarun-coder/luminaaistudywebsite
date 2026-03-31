import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// All verified free OpenRouter models with fallback chain
const FREE_MODELS = [
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3-coder:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-3-12b-it:free",
  "z-ai/glm-4.5-air:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "arcee-ai/trinity-large-preview:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "minimax/minimax-m2.5:free",
  "stepfun/step-3.5-flash:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3n-e4b-it:free",
  "openrouter/auto",
];

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

    // Check for existing resource (skip for game questions)
    if (type !== 'game_questions' && !regenerate) {
      const { data: existing } = await sb
        .from("resources")
        .select("*")
        .eq("user_id", userId)
        .eq("curriculum", curriculum || 'general')
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

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "notes") {
      systemPrompt = `You are an expert educator. Generate comprehensive, well-structured study notes. Use Markdown formatting with headings, bullet points, tables, and blockquotes. Structure: 1) Overview 2) Key Concepts (basic → intermediate → advanced) 3) Important Formulas/Definitions 4) Exam Tips 5) Summary. Adapt terminology and depth for the ${curriculum || 'general'} curriculum. Use LaTeX notation ($...$) for all math formulas.`;
      userPrompt = `Generate detailed study notes for: Subject: ${subject}, Topic: ${topic}, Curriculum: ${curriculum || 'General'}. Make them exam-focused and well-structured.`;
    } else if (type === "flashcards") {
      systemPrompt = `You are a flashcard expert. Generate exactly 15 high-quality flashcards. Return ONLY a JSON array: [{"front":"question","back":"answer"}]. Each card: one concept, clear Q&A, optimized for spaced repetition. Adapt for ${curriculum || 'general'} curriculum. NO markdown, NO code fences, ONLY the JSON array.`;
      userPrompt = `Create 15 flashcards for: ${subject} - ${topic} (${curriculum || 'General'} curriculum). Return ONLY the JSON array.`;
    } else if (type === "questions") {
      systemPrompt = `You are a question bank creator. Generate exactly 10 questions with mixed difficulty. Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","difficulty":"Easy|Medium|Hard"}]. Include conceptual, application-based, and exam-style questions. Adapt for ${curriculum || 'general'} curriculum. NO markdown, NO code fences, ONLY the JSON array.`;
      userPrompt = `Create 10 practice questions for: ${subject} - ${topic} (${curriculum || 'General'} curriculum). Return ONLY the JSON array.`;
    } else if (type === "test") {
      systemPrompt = `You are an exam paper creator. Generate exactly 10 exam-style questions simulating real ${curriculum || 'general'} exam patterns. Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]. Mixed difficulty, realistic format. NO markdown, NO code fences, ONLY the JSON array.`;
      userPrompt = `Create a practice test for: ${subject} - ${topic} (${curriculum || 'General'} curriculum). Return ONLY the JSON array.`;
    } else if (type === "game_questions") {
      const qCount = count || 10;
      systemPrompt = `Generate exactly ${qCount} quiz questions. Return ONLY a JSON object: {"questions":[{"question":"...","options":["A","B","C","D"],"answer":0}]}. Questions should be varied difficulty, clear, and educational. NO markdown, NO code fences.`;
      userPrompt = `Create ${qCount} quiz questions about: ${topic || subject}. Make them engaging and educational. Return ONLY the JSON.`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    let rawContent = "";
    let success = false;

    // Try each free model in sequence until one works
    for (const model of FREE_MODELS) {
      try {
        console.log(`[generate-resources] Trying model: ${model}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(OPENROUTER_URL, {
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
          console.error(`[generate-resources] ${model} error ${response.status}: ${errText.slice(0, 200)}`);
          continue;
        }

        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content;
        if (!content || content.trim().length < 20) {
          console.error(`[generate-resources] ${model} returned empty/short response`);
          continue;
        }

        rawContent = content;
        success = true;
        console.log(`[generate-resources] Success with model: ${model}`);
        break;
      } catch (e) {
        console.error(`[generate-resources] ${model} exception:`, e);
        continue;
      }
    }

    if (!success) {
      // Final fallback: try Lovable AI gateway
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        console.log("[generate-resources] Falling back to Lovable AI gateway");
        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages,
              max_tokens: type === "notes" ? 8000 : 4000,
            }),
          });
          if (response.ok) {
            const aiData = await response.json();
            rawContent = aiData.choices?.[0]?.message?.content || "";
            if (rawContent.length > 20) success = true;
          }
        } catch (e) {
          console.error("[generate-resources] Lovable AI fallback failed:", e);
        }
      }
    }

    if (!success || !rawContent) {
      throw new Error("All AI models failed to generate content");
    }

    let content: any = {};

    if (type === "notes") {
      content = { notes: rawContent };
    } else {
      // Parse JSON from response - strip markdown code fences
      let cleaned = rawContent;
      cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (type === "flashcards") {
            content = { flashcards: Array.isArray(parsed) ? parsed : parsed.flashcards || [] };
          } else if (type === "questions") {
            content = { questions: Array.isArray(parsed) ? parsed : parsed.questions || [] };
          } else if (type === "test") {
            content = { test: Array.isArray(parsed) ? parsed : parsed.test || [] };
          } else if (type === "game_questions") {
            content = { questions: Array.isArray(parsed) ? parsed : parsed.questions || [] };
          }
        } catch {
          throw new Error("Failed to parse AI response as JSON");
        }
      } else {
        throw new Error("No valid JSON in AI response");
      }
    }

    // Save to database (skip for game questions)
    if (type !== "game_questions") {
      const { error: upsertError } = await sb
        .from("resources")
        .upsert({
          user_id: userId,
          curriculum: curriculum || 'general',
          subject,
          topic,
          resource_type: type,
          content,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,curriculum,subject,topic,resource_type" });

      if (upsertError) console.error("Upsert error:", upsertError);
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
