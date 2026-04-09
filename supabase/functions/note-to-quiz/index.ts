import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIText, MODELS_FAST } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanJSON(raw: string): any {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const match = text.match(/[\[{][\s\S]*[\]}]/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { try { return JSON.parse(match[0].replace(/,\s*([\]}])/g, "$1")); } catch { return null; } }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 100_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { notes } = JSON.parse(body);

    const text = await callAIText(
      [
        { role: "system", content: `Convert notes into a challenging quiz. Return ONLY JSON: {"mcq": [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}], "short_answer": [{"question": "...", "answer": "..."}], "conceptual": [{"question": "...", "answer": "..."}]}. Do NOT include thinking tags.` },
        { role: "user", content: `Generate quiz from:\n\n${notes}` },
      ],
      MODELS_FAST, 2500, 0.5, 30000, "note-to-quiz"
    );
    const parsed = cleanJSON(text);
    if (parsed) return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: "AI returned invalid response. Try again." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("note-to-quiz error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
