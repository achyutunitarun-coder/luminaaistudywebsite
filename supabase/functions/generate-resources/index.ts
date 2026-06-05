import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";
import { callAIText, MODELS_BALANCED, MODELS_LONG_CTX } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildPrompts(type: string, curriculum: string, subject: string, topic: string, count?: number) {
  const cur = curriculum || "general";
  if (type === "notes") return { system: `Generate comprehensive study notes in Markdown for ${cur} curriculum. Use headings, bold terms, tables, LaTeX, worked examples, exam tips, and summary.`, user: `Notes for: ${subject} - ${topic} (${cur})` };
  if (type === "flashcards") return { system: `Generate 15 flashcards. Return ONLY JSON: [{"front":"question","back":"answer"}]. Do NOT include thinking tags.`, user: `Flashcards for: ${subject} - ${topic} (${cur})` };
  if (type === "questions") return { system: `Generate 10 mixed-difficulty questions. Return ONLY JSON: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","difficulty":"Easy|Medium|Hard"}]. Do NOT include thinking tags.`, user: `Questions for: ${subject} - ${topic} (${cur})` };
  if (type === "test") return { system: `Generate 10 exam-style questions for ${cur}. Return ONLY JSON: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]. Do NOT include thinking tags.`, user: `Practice test: ${subject} - ${topic} (${cur})` };
  return { system: `Generate ${count||10} quiz questions. Return ONLY JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"answer":0}]}. Do NOT include thinking tags.`, user: `${count||10} quiz questions about: ${topic || subject}` };
}

function cleanAndParse(raw: string) {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json\s*/gi, "").replace(/```\s*/g, "").replace(/^\s*json\s*/i, "");
  const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { try { return JSON.parse(match[0].replace(/,\s*([\]}])/g, "$1")); } catch { return null; } }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const _auth = await requireUser(req, corsHeaders);
    if ("error" in _auth) return _auth.error;
    const userId = _auth.user.id;

    const { curriculum, subject, topic, type, regenerate, count } = await req.json();
    if (!subject || !topic || !type) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (type !== "game_questions" && !regenerate) {
      const { data: existing } = await sb.from("resources").select("*").eq("user_id", userId).eq("curriculum", curriculum || "general").eq("subject", subject).eq("topic", topic).eq("resource_type", type).maybeSingle();
      if (existing) return new Response(JSON.stringify({ content: existing.content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompts = buildPrompts(type, curriculum, subject, topic, count);
    const models = type === "notes" ? MODELS_LONG_CTX : MODELS_BALANCED;
    const rawContent = await callAIText(
      [{ role: "system", content: prompts.system }, { role: "user", content: prompts.user }],
      models,
      type === "notes" ? 5000 : 2800,
      type === "notes" ? 0.55 : 0.45,
      type === "notes" ? 18_000 : 12_000,
      `resources/${type}`,
    );

    let content: Record<string, unknown> = {};
    if (type === "notes") { content = { notes: rawContent }; }
    else {
      const parsed = cleanAndParse(rawContent);
      if (!parsed) throw new Error("No valid JSON in response");
      if (type === "flashcards") content = { flashcards: Array.isArray(parsed) ? parsed : parsed.flashcards || [] };
      else if (type === "questions") content = { questions: Array.isArray(parsed) ? parsed : parsed.questions || [] };
      else if (type === "test") content = { test: Array.isArray(parsed) ? parsed : parsed.test || [] };
      else if (type === "game_questions") content = { questions: Array.isArray(parsed) ? parsed : parsed.questions || [] };
    }

    if (type !== "game_questions") {
      await sb.from("resources").upsert({ user_id: userId, curriculum: curriculum || "general", subject, topic, resource_type: type, content, updated_at: new Date().toISOString() }, { onConflict: "user_id,curriculum,subject,topic,resource_type" });
    }

    return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
