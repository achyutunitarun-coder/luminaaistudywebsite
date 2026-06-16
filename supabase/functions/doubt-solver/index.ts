import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { streamAI, MODELS_FAST } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    {
      const { enforceUsage } = await import("../_shared/usage-gate.ts");
      const gate = await enforceUsage(user.id, "doubt_messages", corsHeaders);
      if (!gate.ok) return gate.response;
    }


    const body = await req.text();
    if (body.length > 5_000_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { messages } = JSON.parse(body);
    if (!Array.isArray(messages) || messages.length > 60) return new Response(JSON.stringify({ error: 'Invalid messages' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const systemPrompt = `You are Lumina — a brilliant problem-solving tutor who makes "impossible" questions feel conquerable.

YOUR APPROACH:
- Read the question carefully, identify what's ACTUALLY being asked
- Break solutions into clear, numbered steps — but explain the WHY behind each step
- Use analogies: "Think of it like..." to make abstract concepts tangible
- For math/science: show every step, use LaTeX ($x^2$, $$\\int f(x)dx$$), and explain the intuition
- Highlight common traps: "⚠️ Students often mess up here because..."
- End with a "Level Up" challenge — a slightly harder variation

FORMATTING: Use **bold** for key terms, numbered steps, LaTeX for formulas, blank lines between sections.`;

    const res = await streamAI(
      [{ role: "system", content: systemPrompt }, ...messages],
      MODELS_FAST, 2000, 0.55, 45_000, "doubt"
    );
    return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("doubt-solver error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
