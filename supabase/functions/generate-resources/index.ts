import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { AI_GATEWAY_URL, MODELS_BALANCED, getApiKey, fetchWithTimeout } from "../_shared/models.ts";

function buildPrompts(type: string, curriculum: string, subject: string, topic: string, count?: number) {
  const cur = curriculum || "general";
  if (type === "notes") return { system: `Generate comprehensive study notes in Markdown for ${cur} curriculum. Use headings, bold terms, tables, LaTeX, worked examples, exam tips, and summary.`, user: `Notes for: ${subject} - ${topic} (${cur})` };
  if (type === "flashcards") return { system: `Generate 15 flashcards. Return ONLY JSON: [{"front":"question","back":"answer"}]`, user: `Flashcards for: ${subject} - ${topic} (${cur})` };
  if (type === "questions") return { system: `Generate 10 mixed-difficulty questions. Return ONLY JSON: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","difficulty":"Easy|Medium|Hard"}]`, user: `Questions for: ${subject} - ${topic} (${cur})` };
  if (type === "test") return { system: `Generate 10 exam-style questions for ${cur}. Return ONLY JSON: [{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]`, user: `Practice test: ${subject} - ${topic} (${cur})` };
  return { system: `Generate ${count||10} quiz questions. Return ONLY JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"answer":0}]}`, user: `${count||10} quiz questions about: ${topic || subject}` };
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
    const { curriculum, subject, topic, type, userId, regenerate, count } = await req.json();
    if (!subject || !topic || !type || !userId) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (type !== "game_questions" && !regenerate) {
      const { data: existing } = await sb.from("resources").select("*").eq("user_id", userId).eq("curriculum", curriculum || "general").eq("subject", subject).eq("topic", topic).eq("resource_type", type).maybeSingle();
      if (existing) return new Response(JSON.stringify({ content: existing.content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompts = buildPrompts(type, curriculum, subject, topic, count);
    const apiKey = getApiKey();

    let rawContent = "";
    for (const model of MODELS_BALANCED) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 20000);
        const res = await fetch(AI_GATEWAY_URL, { method: "POST", signal: c.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "system", content: prompts.system }, { role: "user", content: prompts.user }], max_tokens: type === "notes" ? 8000 : 4000, temperature: 0.7 }) });
        clearTimeout(t);
        if (!res.ok) { const e = await res.text(); console.error(`[resources] ${model} ${res.status}: ${e.slice(0,200)}`); continue; }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content && content.trim().length > 20) { rawContent = content; console.log(`[resources] ✓ ${model}`); break; }
      } catch (e) { console.error(`[resources] ${model}:`, e); }
    }
    if (!rawContent) throw new Error("All models are busy — please try again in a moment");

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
