import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { streamAI, MODELS_BALANCED } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const _auth = await requireUser(req, corsHeaders);
    if ("error" in _auth) return _auth.error;
    {
      const { enforceUsage } = await import("../_shared/usage-gate.ts");
      const gate = await enforceUsage(_auth.user.id, "podcast_generation", corsHeaders);
      if (!gate.ok) return gate.response;
    }
    const body = await req.text();
    if (body.length > 4_000_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { notes } = JSON.parse(body);

    const res = await streamAI(
      [
        { role: "system", content: `You are writing a podcast-style script from source material. Write for the ear, not the page — this means real spoken rhythm, natural transitions, and a genuine sense of pacing, not a written article with speaker labels bolted on. Structure should follow the material's own narrative logic (what's the throughline, where's the natural hook, where does it build) rather than a fixed segment template (intro/three-topics/outro) applied regardless of what the material actually supports. Format as a conversation between ALEX (expert explainer) and SAM (curious challenger). Every line starts with "ALEX: " or "SAM: ". NO markdown, NO stage directions, NO emojis.` },
        { role: "user", content: `Turn these notes into a podcast episode:\n\n${notes}` },
      ],
      MODELS_BALANCED, 4000, 0.75, 75_000, "podcast"
    );
    return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("generate-podcast-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
