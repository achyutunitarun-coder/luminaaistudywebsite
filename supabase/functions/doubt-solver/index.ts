import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PAYLOAD_BYTES = 50_000;
const MAX_MESSAGES = 50;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Verified working free models (2026-03-29)
const ALL_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-3-12b-it:free",
  "z-ai/glm-4.5-air:free",
  "qwen/qwen3-coder:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "arcee-ai/trinity-large-preview:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "minimax/minimax-m2.5:free",
  "stepfun/step-3.5-flash:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3n-e4b-it:free",
  "openrouter/auto",
];

async function searchSerper(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 4, gl: "us", hl: "en" }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    let ctx = "";
    if (data.answerBox) ctx += `Direct Answer: ${data.answerBox.answer ?? data.answerBox.snippet ?? ""}\n`;
    if (data.knowledgeGraph?.description) ctx += `${data.knowledgeGraph.title}: ${data.knowledgeGraph.description}\n`;
    for (const r of (data.organic ?? []).slice(0, 4)) ctx += `${r.title}: ${r.snippet ?? ""}\n`;
    return ctx;
  } catch { return ""; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: _authUser }, error: _authErr } = await _supabase.auth.getUser();
    if (_authErr || !_authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.text();
    if (body.length > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { messages } = JSON.parse(body);

    if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: 'Invalid or too many messages (max 50)' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let searchContext = "";
    if (lastMsg && SERPER_API_KEY) {
      searchContext = await searchSerper(lastMsg.content.slice(0, 120), SERPER_API_KEY);
    }

    const queryText = lastMsg?.content || "";
    const hasFiles = queryText.includes("--- ATTACHED FILES ---");

    let systemPrompt = `You are Lumina AI Doubt Solver — a world-class tutor who makes even the hardest concepts feel intuitive. Built by Tarun Kartikeya.

RULES:
- If the user sends a casual greeting (hi, hello, hey) with no academic question, reply with a warm 2-3 sentence greeting and ask what they need help with. Do NOT lecture about random topics.
- For academic questions: acknowledge the confusion, give crystal-clear explanations with analogies, show step-by-step solutions for math/science, use **bold** for key terms and LaTeX for formulas.
- End academic answers with 1-2 practice questions.

Detect the mode from the message prefix ([SIMPLE], [EXAM], [DEEP]) and adjust depth:
- SIMPLE: Simplest language, lots of analogies, minimal jargon
- EXAM: Exam patterns, common mistakes, scoring tips, model answers
- DEEP: Theoretical depth, proofs, edge cases, advanced implications`;

    if (hasFiles) {
      systemPrompt += `\n\nThe user has attached files. Read ALL the attached content and answer based on it.`;
    }

    if (searchContext) systemPrompt += `\n\nReference data:\n${searchContext}`;

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    for (const model of ALL_MODELS) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: aiMessages,
            max_tokens: 1500,
            temperature: 0.7,
            stream: true,
          }),
        });

        if (!res.ok) { const t = await res.text(); console.error(`${model} error ${res.status}: ${t.slice(0, 200)}`); continue; }

        console.log(`[doubt-solver] Success: ${model}`);

        return new Response(res.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      } catch (e) { console.error(`${model} exception:`, e); }
    }

    throw new Error("All models failed");
  } catch (e) {
    console.error("doubt-solver error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
