import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIText, MODELS_FAST } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 200_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { topic } = JSON.parse(body);

    const text = await callAIText(
      [
        { role: "system", content: `Create a quick study lesson. Return ONLY JSON: {"title": "...", "key_concepts": [{"concept": "name", "explanation": "engaging explanation with analogies"}], "practice_questions": [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]}. Do NOT include thinking tags.` },
        { role: "user", content: `Quick study lesson on "${topic}".` },
      ],
      MODELS_FAST, 3000, 0.5, 30000, "quick-study"
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return new Response(JSON.stringify(JSON.parse(jsonMatch[0])), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: "Failed to parse" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("quick-study error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
