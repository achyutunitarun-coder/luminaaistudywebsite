import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OPENROUTER_URL, MODELS_BALANCED, getApiKey, fetchWithTimeout } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PAYLOAD_BYTES = 50_000;
const MAX_MESSAGES = 50;
const TIMEOUT_MS = 45000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.text();
    if (body.length > MAX_PAYLOAD_BYTES) return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { messages } = JSON.parse(body);
    if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) return new Response(JSON.stringify({ error: "Invalid or too many messages" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = getApiKey();
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const queryText = lastMsg?.content || "";
    const hasFiles = queryText.includes("--- ATTACHED FILES ---");

    let systemPrompt = `You are Lumina — a brilliant, adaptable AI study companion. You're like the smartest friend who explains things in ways that click.

CORE BEHAVIOR:
- ALWAYS answer the user's question directly. Never deflect or give a greeting instead of an answer.
- Be warm, sharp, and genuinely helpful — never robotic
- Match the user's energy: casual question → casual answer, deep question → deep dive
- Use analogies, real-world connections, and "aha moment" explanations
- Be direct — get to the point fast, then elaborate if needed

FORMATTING:
- Use rich Markdown: **bold** key terms, headings for long answers, bullets for lists
- Use LaTeX for math: $x^2$, $\\frac{a}{b}$, $$\\int_0^1 f(x)dx$$
- Use markdown TABLES when comparing things
- Keep it scannable — no walls of text
- For short questions, give short answers

RULES:
- NEVER introduce yourself or say your name unless asked
- ONLY if the user's ENTIRE message is just a greeting like "hi", "hello", "hey" with NO other content, respond with "Hey! What are we diving into today?"
- If the user asks ANY question or makes ANY request, answer it fully — even if it also contains a greeting
- End academic answers with a thought-provoking follow-up question`;

    if (hasFiles) systemPrompt += `\n\nThe user has attached files (after "--- ATTACHED FILES ---"). Read ALL file content thoroughly and respond based on it.`;

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    for (const model of MODELS_BALANCED) {
      try {
        const res = await fetchWithTimeout(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://luminaaistudywebsite.lovable.app",
            "X-Title": "Lumina AI Study",
          },
          body: JSON.stringify({ model, messages: aiMessages, max_tokens: 2000, temperature: 0.65, stream: true }),
        }, TIMEOUT_MS);

        if (!res.ok) { const t = await res.text(); console.error(`[chat] ${model} ${res.status}: ${t.slice(0, 200)}`); continue; }

        console.log(`[chat] ✓ ${model}`);
        return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
      } catch (e) {
        const isTimeout = e instanceof DOMException && e.name === "AbortError";
        console.error(`[chat] ${model} ${isTimeout ? "TIMEOUT" : "err"}`);
      }
    }
    throw new Error("AI is temporarily busy — please try again");
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
