import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIText, MODELS_FAST } from "../_shared/models.ts";

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

    const { responses } = await req.json();
    if (!Array.isArray(responses)) {
      return new Response(JSON.stringify({ error: "Missing responses array" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const wrongAnswers = responses.filter((r: any) => !r.is_correct).slice(0, 10);
    const tagged: any[] = [];

    for (const r of wrongAnswers) {
      try {
        const prompt = `Question: ${r.question_text}
Correct answer: ${r.correct_answer}
Student answered: ${r.student_answer}

Classify this error into exactly ONE category:
CONCEPTUAL - didn't understand the underlying concept
APPLICATION - knows concept but couldn't apply
CARELESS - likely knew it, silly error
MEMORY - forgot formula/definition
TIME_PRESSURE - rushed answer
MISREAD - misread question or options

Respond JSON only: {"error_type": "CATEGORY", "explanation": "one sentence why"}`;

        const result = await callAIText(
          [{ role: "user", content: prompt }],
          MODELS_FAST, 200, 0.3, 10000, "tag-mistake"
        );

        const parsed = JSON.parse(result.replace(/```json|```/g, "").trim());

        await sb.from("mistake_tags").insert({
          user_id: user.id,
          response_id: r.id,
          subject: r.subject,
          topic: r.topic,
          concept: r.concept,
          error_type: parsed.error_type || "CONCEPTUAL",
          ai_explanation: parsed.explanation || "Error classification unavailable",
        });

        tagged.push({ response_id: r.id, error_type: parsed.error_type });
      } catch (e) {
        console.error("Tag error for response:", r.id, e);
      }
    }

    return new Response(JSON.stringify({ tagged: tagged.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tag-mistake error:", e);
    return new Response(JSON.stringify({ error: "Failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
