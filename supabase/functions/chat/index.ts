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
    return `You are LUMINA COMPUTER — an elite AI coding agent that creates STUNNING, production-grade websites and applications.

You rival the quality of Linear, Notion, Vercel, Anthropic, and Apple in design and code quality.

CRITICAL RULES:
1. Output COMPLETE files using this EXACT format:
   ---FILE: path/to/file.ext
   [COMPLETE file content — every single line, NO truncation]
   ---END

2. For shell commands:
   ---COMMAND: npm install something
   ---COMMAND: npm run build

3. Create ALL necessary files for a complete, working project
4. Use modern HTML/CSS/JS, Three.js from CDN for 3D
5. Beautiful, cinematic, production-quality code
6. No placeholders, no TODOs, no lorem ipsum, no "// rest unchanged"
7. Every file must be COMPLETE and deployable
8. Think like a senior software engineer — architecture matters
9. You MUST generate at minimum 3-5 files for any website request
10. Each file must be COMPLETE — never truncate or abbreviate code

EFFORT LEVEL: ${effort}
${effort === 'beast' ? 'MAXIMUM QUALITY: Production-grade, comprehensive error handling, tests, accessibility, performance optimization.' : effort === 'quick' ? 'FAST: Working code quickly, skip extras.' : 'BALANCED: Good quality with reasonable scope.'}`;
  }

  const base = `You are Lumina AI, an elite study assistant. You help students learn, explain concepts, generate practice problems, and build study materials.

You are running inside the Lumina study platform. Be helpful, accurate, and encouraging.

Current mode: ${mode}
Effort level: ${effort}`;

  if (intent === "coding") {
    return base + "\n\nThe user wants coding help. Provide clear, well-commented code examples.";
  }
  if (intent === "study") {
    return base + "\n\nThe user wants to learn. Explain concepts clearly with examples.";
  }
  if (intent === "greeting") {
    return base + "\n\nThe user is greeting you. Respond warmly and ask how you can help them study.";
  }
  return base;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse body
    const body = await req.text();
    if (body.length > 5_000_000) {
      return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { messages, mode, effort } = JSON.parse(body);
    if (!Array.isArray(messages) || messages.length > 60) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Classify intent
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const queryText = typeof lastMsg?.content === "string" ? lastMsg.content : "";
    const intent = classifyIntent(queryText);
    const requestedMode = typeof mode === "string" ? mode : "auto";
    const effortLevel = typeof effort === "string" && ["quick", "normal", "beast"].includes(effort) ? effort : "normal";

    // Check if computer mode
    const isComputer = requestedMode === "computer" || requestedMode === "mun" || intent === "computer" || intent === "mun";

    // Build system prompt
    const systemPrompt = buildSystemPrompt(intent, requestedMode, effortLevel, isComputer);

    // Determine max tokens — use reasonable limits for OpenRouter
    let maxTokens: number;
    if (isComputer) {
      maxTokens = effortLevel === 'beast' ? 16384 : effortLevel === 'quick' ? 8192 : 12288;
    } else if (intent === "coding") {
      maxTokens = 8192;
    } else if (requestedMode === "deepDive") {
      maxTokens = 8192;
    } else {
      maxTokens = 4096;
    }

    const temperature = isComputer ? 0.2 : intent === "coding" ? 0.3 : 0.7;

    // Call OpenRouter with streaming
    const controller = new AbortController();
    const timeoutMs = isComputer ? (effortLevel === 'beast' ? 480_000 : 240_000) : 120_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        max_tokens: maxTokens,
        max_completion_tokens: maxTokens,
        temperature,
        top_p: 0.95,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`[chat] API error ${res.status}: ${err.slice(0, 200)}`);
      return new Response(JSON.stringify({ error: `API error ${res.status}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!res.body) {
      return new Response(JSON.stringify({ error: "No response body" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Add meta event at the start
    const encoder = new TextEncoder();
    const metaEvent = `data: ${JSON.stringify({ lumina_meta: { model: OWL, intent, is_computer: isComputer, tier_target: "TIER_1" } })}\n\n`;

    const stream = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        ctrl.enqueue(encoder.encode(metaEvent));
        try {
          const reader = res.body!.getReader();
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
