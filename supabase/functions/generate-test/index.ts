import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["openrouter/auto", "google/gemma-3-27b-it:free", "meta-llama/llama-3.3-70b-instruct:free", "nvidia/nemotron-3-super-120b-a12b:free"];

function cleanJSON(raw: string): any {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const start = text.search(/[\[{]/);
  if (start < 0) return null;
  const startChar = text[start];
  const end = text.lastIndexOf(startChar === "[" ? "]" : "}");
  if (end <= start) return null;
  let jsonStr = text.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1");
  try { return JSON.parse(jsonStr); } catch {
    let b = 0, k = 0;
    for (const c of jsonStr) { if (c === "{") b++; if (c === "}") b--; if (c === "[") k++; if (c === "]") k--; }
    while (k > 0) { jsonStr += "]"; k--; }
    while (b > 0) { jsonStr += "}"; b--; }
    try { return JSON.parse(jsonStr); } catch { return null; }
  }
}

type Q = { question: string; options: string[]; correct: number; explanation: string };

function sanitize(payload: any): Q[] {
  const raw = payload?.questions;
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, Q>();
  for (const item of raw) {
    const question = typeof item?.question === "string" ? item.question.trim() : "";
    const options = Array.isArray(item?.options) ? item.options.map((o: any) => String(o ?? "").trim()).filter(Boolean) : [];
    const correct = Number(item?.correct);
    const explanation = typeof item?.explanation === "string" ? item.explanation.trim() : "";
    if (!question || options.length < 2 || !Number.isInteger(correct) || correct < 0 || correct >= options.length || !explanation) continue;
    const key = question.toLowerCase().replace(/\s+/g, " ").trim();
    if (!deduped.has(key)) deduped.set(key, { question, options, correct, explanation });
  }
  return [...deduped.values()];
}

async function callAI(apiKey: string, messages: any[], num: number, maxTokens = 4500): Promise<Q[]> {
  for (const model of MODELS) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 15000);
      const res = await fetch(OPENROUTER_URL, {
        method: "POST", signal: c.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.4, response_format: { type: "json_object" } }),
      });
      clearTimeout(t);
      if (!res.ok) { const e = await res.text(); console.error(`[test] ${model} ${res.status}: ${e.slice(0,200)}`); continue; }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) continue;
      const valid = sanitize(cleanJSON(content));
      if (valid.length >= num) { console.log(`[test] ✓ ${model} (${valid.length}/${num})`); return valid.slice(0, num); }
      if (valid.length > 0) { console.log(`[test] partial ${model} (${valid.length}/${num})`); return valid; }
    } catch (e) { console.error(`[test] ${model}:`, e); }
  }
  throw new Error("All models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.text();
    if (body.length > 50_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { syllabus, subject, numQuestions } = JSON.parse(body);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const num = Math.min(Math.max(Number(numQuestions) || 5, 1), 20);
    const questions = await callAI(OPENROUTER_API_KEY, [
      { role: "system", content: `Generate ${num} challenging MCQ questions. Return ONLY JSON: {"questions": [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]}. Use LaTeX for math ($x^2$).` },
      { role: "user", content: `Subject: ${String(subject||'General').slice(0,200)}\nTopic:\n${String(syllabus||'').slice(0,10000)}` },
    ], num, Math.min(8192, Math.max(3500, num * 900)));

    return new Response(JSON.stringify({ questions }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-test error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
