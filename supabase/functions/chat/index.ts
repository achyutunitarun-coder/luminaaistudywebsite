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
    return `You are LUMINA COMPUTER. Create stunning, production-grade websites.

OUTPUT FORMAT — Use this EXACT format for EVERY file. You MUST generate MULTIPLE files. Never stop after one file.

FILE: path/to/file.ext
<complete file content>
END FILE

MANDATORY: Generate ALL of these files for every website project:
1. FILE: index.html — Complete HTML5 document with structure, content, and semantic markup
2. FILE: style.css — Complete CSS with variables, layout, animations, and responsive design
3. FILE: script.js — Complete JavaScript with interactivity, event handlers, and logic

For complex projects ALSO add:
4. FILE: README.md — Brief description of the project
5. Additional component files as needed (e.g., FILE: components/navbar.js)

EXAMPLE of correct output (you MUST follow this pattern with 3+ files):

FILE: index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header><h1>Welcome</h1></header>
  <main><p>Content here</p></main>
  <script src="script.js"></script>
</body>
</html>
END FILE

FILE: style.css
:root {
  --primary: #6366f1;
  --bg: #0f172a;
  --text: #e2e8f0;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}
header {
  padding: 2rem;
  text-align: center;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
}
main { padding: 2rem; max-width: 800px; margin: 0 auto; }
END FILE

FILE: script.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('App initialized');
  // Add interactivity here
  const header = document.querySelector('header');
  header.addEventListener('click', () => {
    document.body.style.background = '#1e293b';
    setTimeout(() => {
      document.body.style.background = '';
    }, 300);
  });
});
END FILE

CRITICAL RULES:
- You MUST generate at LEAST 3 files: index.html, style.css, script.js
- Every file must be COMPLETE — no placeholders, no TODOs, no truncation, no "..." or "rest of code here"
- After writing END FILE for one file, immediately write FILE: for the next file
- Do NOT stop generating until ALL files are complete
- Modern HTML5, CSS3 (grid, flexbox, custom properties, animations), ES6+ JavaScript
- Three.js from CDN if needed: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
- Beautiful, cinematic, production-quality, deployable as-is
- The project must work when opened directly in a browser

Effort: ${effort}`;
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
      maxTokens = effortLevel === 'beast' ? 16384 : effortLevel === 'quick' ? 8192 : 12288;
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
