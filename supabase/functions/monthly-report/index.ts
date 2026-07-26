import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { callAIText, MODELS_FAST } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const _auth = await requireUser(req, corsHeaders);
    if ("error" in _auth) return _auth.error;
    const body = await req.text();
    if (body.length > 1_000_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { userData } = JSON.parse(body);

    const text = await callAIText(
      [
        { role: "system", content: `You are generating a monthly report from the underlying data. Let the actual data determine what's worth highlighting — genuinely significant changes, trends, or outliers should get real attention; flat, unremarkable metrics don't need equal-length coverage just because they're part of a fixed report template. If a month was genuinely unremarkable on most fronts, a shorter report reflecting that honestly is more useful than padding to match previous months' length. Return ONLY JSON: {"headline":"...","total_study_minutes":0,"total_study_hours":0,"average_test_score":0,"tests_taken":0,"xp_earned":0,"strengths":[{"topic":"...","detail":"..."}],"weaknesses":[{"topic":"...","detail":"..."}],"recommendations":["tip"],"overall_grade":"A/B/C/D"}. Do NOT include thinking tags.` },
        { role: "user", content: `Monthly report from:\n\n${JSON.stringify(userData)}` },
      ],
      MODELS_FAST, 1500, 0.5, 40_000, "report"
    );
    const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return new Response(JSON.stringify(JSON.parse(match[0])), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: "Failed to parse report" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
