import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWL = "openrouter/owl-alpha";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function classifyIntent(text: string) {
  const t = text.toLowerCase();
  if (/code|build|create|app|website|function|bug|error/.test(t)) return "coding";
  if (/explain|what|how|why|teach|learn/.test(t)) return "study";
  if (/hi|hey|hello|sup/.test(t)) return "greeting";
  return "general";
}

function buildSystemPrompt(intent: string, mode: string, effort: string, isComputer: boolean) {
  if (isComputer) {
    return "You are LUMINA COMPUTER. Create a complete website.\n\n" +
      "OUTPUT FORMAT - follow exactly:\n\n" +
      "FILE: index.html\n" +
      "<!DOCTYPE html>\n<html lang=\"en\">\n<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"><title>App</title><link rel=\"stylesheet\" href=\"style.css\"></head>\n<body><h1>Content</h1><script src=\"script.js\"></script></body>\n</html>\n" +
      "END FILE\n" +
      "FILE: style.css\n" +
      ":root{--p:#6366f1;--bg:#0f172a;--t:#e2e8f0}*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:var(--bg);color:var(--t);min-height:100vh}\n" +
      "END FILE\n" +
      "FILE: script.js\n" +
      "document.addEventListener('DOMContentLoaded',()=>{console.log('ready')})\n" +
      "END FILE\n\n" +
      "RULES:\n" +
      "- Replace ALL placeholders with REAL code for the user's request\n" +
      "- Generate EXACTLY 3 files: index.html, style.css, script.js\n" +
      "- Each file appears ONCE only\n" +
      "- NO code blocks, NO backticks, NO truncation\n" +
      "- Keep CSS and JS concise but complete\n\n" +
      "Effort: " + effort;
  }

  const base = `You are Lumina AI, an elite study assistant. Help students learn, explain concepts, generate practice problems, and build study materials.

Mode: ${mode}
Effort: ${effort}`;

  if (intent === "coding") return base + "\n\nProvide clear, well-commented code examples.";
  if (intent === "study") return base + "\n\nExplain concepts clearly with examples.";
  if (intent === "greeting") return base + "\n\nRespond warmly and ask how you can help.";
  return base;
}

async function callOpenRouter(messages: any[], maxTokens: number, temperature: number, extraParams: Record<string, unknown> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
        "HTTP-Referer": "https://luminaai.co.in",
        "X-Title": "Lumina AI",
      },
      body: JSON.stringify({
        model: OWL,
        messages,
        stream: true,
        max_tokens: maxTokens,
        max_completion_tokens: maxTokens,
        temperature,
        top_p: 0.95,
        presence_penalty: 0.2,
        frequency_penalty: 0.1,
        ...extraParams,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`API error ${res.status}: ${err.slice(0, 200)}`);
    }

    if (!res.body) throw new Error("No response body");
    return res.body;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

function pipeStreamWithMeta(resBody: ReadableStream, meta: Record<string, unknown>): ReadableStream {
  const encoder = new TextEncoder();
  const metaEvent = `data: ${JSON.stringify({ lumina_meta: { ...meta, tier_target: "TIER_1" } })}\n\n`;

  return new ReadableStream<Uint8Array>({
    async start(ctrl) {
      ctrl.enqueue(encoder.encode(metaEvent));
      try {
        const reader = resBody.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          ctrl.enqueue(value);
        }
        ctrl.close();
      } catch (e) {
        console.error("[chat] stream error:", e);
        ctrl.close();
      }
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.text();
    if (body.length > 5_000_000) {
      return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { messages, mode, effort } = JSON.parse(body);
    if (!Array.isArray(messages) || messages.length > 60) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const queryText = typeof lastMsg?.content === "string" ? lastMsg.content : "";
    const intent = classifyIntent(queryText);
    const requestedMode = typeof mode === "string" ? mode : "auto";
    const effortLevel = typeof effort === "string" && ["quick", "normal", "beast"].includes(effort) ? effort : "normal";
    const isComputer = requestedMode === "computer" || requestedMode === "mun" || intent === "computer" || intent === "mun";

    const systemPrompt = buildSystemPrompt(intent, requestedMode, effortLevel, isComputer);

    let maxTokens: number;
    if (isComputer) {
      maxTokens = effortLevel === 'beast' ? 65536 : effortLevel === 'quick' ? 16384 : 32768;
    } else if (intent === "coding") {
      maxTokens = 8192;
    } else if (requestedMode === "deepDive") {
      maxTokens = 8192;
    } else {
      maxTokens = 4096;
    }

    const temperature = isComputer ? 0.1 : intent === "coding" ? 0.3 : 0.7;

    const resBody = await callOpenRouter(
      [{ role: "system", content: systemPrompt }, ...messages],
      maxTokens,
      temperature
    );

    const stream = pipeStreamWithMeta(resBody, { model: OWL, intent, is_computer: isComputer });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (e) {
    console.error("[chat] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
