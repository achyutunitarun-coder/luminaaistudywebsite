import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIText, MODELS_QUALITY } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { exam, subjects, chapters, totalMarks, timeLimit, difficultyMix, questionTypes, weakTopics, memoryContext } = await req.json();

    const prompt = `${memoryContext || ""}

Generate a ${totalMarks}-mark ${exam || "practice"} mock paper for ${(subjects || []).join(", ")}.

Configuration:
- Chapters: ${(chapters || []).join(", ")}
- Difficulty: ${difficultyMix?.easy || 30}% easy, ${difficultyMix?.medium || 50}% medium, ${difficultyMix?.hard || 20}% hard
- Time limit: ${timeLimit || 60} minutes
- Question types: ${(questionTypes || ["MCQ"]).join(", ")}
- Weak areas to emphasize: ${(weakTopics || []).join(", ")}

Generate the full paper in this exact JSON format:
{
  "title": "Lumina Mock Paper",
  "duration_minutes": ${timeLimit || 60},
  "total_marks": ${totalMarks || 40},
  "sections": [
    {
      "name": "Section A",
      "instructions": "All questions are compulsory",
      "questions": [
        {
          "number": 1,
          "type": "MCQ",
          "text": "full question text",
          "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
          "marks": 4,
          "negative_marks": -1,
          "topic": "topic name",
          "concept": "concept",
          "difficulty": "medium",
          "correct_answer": "A",
          "solution": "step by step solution",
          "hint": "one-line hint"
        }
      ]
    }
  ]
}

Make questions realistic and varied. Ensure total marks sum to ${totalMarks || 40}. Return only valid JSON.`;

    const response = await callAIText(
      [{ role: "system", content: "You are an expert exam paper setter. Generate only valid JSON." }, { role: "user", content: prompt }],
      MODELS_QUALITY, 4096, 0.7, 50000, "smart-paper"
    );

    const clean = response.replace(/```json|```/g, "").trim();
    let paper;
    try {
      paper = JSON.parse(clean);
    } catch {
      // Try to auto-close JSON
      let fixed = clean;
      const opens = (fixed.match(/\{/g) || []).length;
      const closes = (fixed.match(/\}/g) || []).length;
      for (let i = 0; i < opens - closes; i++) fixed += "}";
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;
      for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += "]";
      paper = JSON.parse(fixed);
    }

    return new Response(JSON.stringify(paper), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-paper error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Failed to generate paper" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
