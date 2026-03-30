import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "notes") {
      systemPrompt = `You are an expert educator. Generate comprehensive, well-structured study notes. Use Markdown formatting with headings, bullet points, tables, and blockquotes. Structure: 1) Overview 2) Key Concepts (basic → intermediate → advanced) 3) Important Formulas/Definitions 4) Exam Tips 5) Summary. Adapt terminology and depth for the ${curriculum || 'general'} curriculum.`;
      userPrompt = `Generate detailed study notes for: Subject: ${subject}, Topic: ${topic}, Curriculum: ${curriculum || 'General'}. Make them exam-focused and well-structured.`;
    } else if (type === "flashcards") {
      systemPrompt = `You are a flashcard expert. Generate exactly 15 high-quality flashcards. Return ONLY a JSON array: [{"front":"question","back":"answer"}]. Each card: one concept, clear Q&A, optimized for spaced repetition. Adapt for ${curriculum || 'general'} curriculum.`;
      userPrompt = `Create 15 flashcards for: ${subject} - ${topic} (${curriculum || 'General'} curriculum).`;
    } else if (type === "questions") {
      systemPrompt = `You are a question bank creator. Generate exactly 10 questions with mixed difficulty. Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","difficulty":"Easy|Medium|Hard"}]. Include conceptual, application-based, and exam-style questions. Adapt for ${curriculum || 'general'} curriculum.`;
      userPrompt = `Create 10 practice questions for: ${subject} - ${topic} (${curriculum || 'General'} curriculum).`;
    } else if (type === "test") {
      systemPrompt = `You are an exam paper creator. Generate exactly 10 exam-style questions simulating real ${curriculum || 'general'} exam patterns. Return ONLY a JSON array: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]. Mixed difficulty, realistic format.`;
      userPrompt = `Create a practice test for: ${subject} - ${topic} (${curriculum || 'General'} curriculum).`;
    } else if (type === "game_questions") {
      const qCount = count || 10;
      systemPrompt = `Generate exactly ${qCount} quiz questions. Return ONLY a JSON object: {"questions":[{"question":"...","options":["A","B","C","D"],"answer":0}]}. Questions should be varied difficulty, clear, and educational.`;
      userPrompt = `Create ${qCount} quiz questions about: ${topic || subject}. Make them engaging and educational.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: type === "notes" ? 8000 : 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let content: any = {};

    if (type === "notes") {
      content = { notes: rawContent };
    } else {
      // Parse JSON from response
      const jsonMatch = rawContent.match(/[\[{][\s\S]*[\]}]/);
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
          throw new Error("Failed to parse AI response");
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
