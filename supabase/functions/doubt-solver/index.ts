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

// Verified working free models — ordered by quality for doubt solving
const ALL_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1:free",
  "deepseek/deepseek-r1-0528:free",
  "google/gemma-3-12b-it:free",
  "qwen/qwq-32b:free",
  "microsoft/phi-4-reasoning-plus:free",
  "microsoft/phi-4-reasoning:free",
  "microsoft/mai-ds-r1:free",
  "rekaai/reka-flash-3:free",
  "nvidia/llama-3.1-nemotron-ultra-253b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "qwen/qwen3-coder:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "google/gemma-3-4b-it:free",
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
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: _authUser }, error: _authErr } = await _supabase.auth.getUser();
    if (_authErr || !_authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Payload size check
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

    let systemPrompt = `You are Lumina AI Doubt Solver — a world-class tutor who makes even the hardest concepts feel intuitive. Built by Tarun Kartikeya.

Your approach:
- First, acknowledge what the student might be struggling with — show you understand the confusion
- Give a crystal-clear explanation using everyday analogies and vivid mental models
- For math/science: show complete step-by-step solutions with reasoning at EACH step, not just the answer
- For conceptual subjects: build understanding through stories, examples, and connections
- Use markdown formatting: **bold** for key terms, headers for sections, code blocks for formulas
- Include relevant diagrams described in text when helpful
- End with 1-2 targeted practice questions that reinforce the exact concept
- Be encouraging — treat every question as worthy of a thorough answer

Detect the mode from the message prefix ([SIMPLE], [EXAM], [DEEP]) and adjust depth accordingly:
- SIMPLE: Use the simplest possible language, lots of analogies, minimal jargon
- EXAM: Focus on exam-relevant patterns, common mistakes, scoring tips, and model answers
- DEEP: Go into theoretical depth, proofs, edge cases, and advanced implications

IMPORTANT: If the user just says "hello" or "hi", give a brief friendly greeting and ask what they need help with. Do NOT lecture about unrelated topics.`;

    if (searchContext) systemPrompt += `\n\nREFERENCE DATA:\n${searchContext}`;

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
