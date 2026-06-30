import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OWL, MODEL_FREE_ROUTER } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const FALLBACK_CHAIN = [OWL, MODEL_FREE_ROUTER, "meta-llama/llama-3.3-70b-instruct:free", "openai/gpt-oss-20b:free"];

const CHAT_KEYS: string[] = [
  Deno.env.get("OPENROUTER_API_KEY"),
  Deno.env.get("OPENROUTER_KEY_2"),
  Deno.env.get("OPENROUTER_KEY_3"),
  Deno.env.get("OPENROUTER_KEY_4"),
  Deno.env.get("OPENROUTER_KEY_5"),
  Deno.env.get("OPENROUTER_KEY_6"),
  Deno.env.get("OPENROUTER_KEY_7"),
].filter(Boolean) as string[];

const KEY_COOLDOWN_MS = 45_000;
const KEY_BAD_COOLDOWN_MS = 10 * 60_000;
const _cooledUntil: number[] = CHAT_KEYS.map(() => 0);
let _cursor = 0;

function nextKey(): number {
  for (let step = 0; step < CHAT_KEYS.length; step++) {
    const i = (_cursor + step) % CHAT_KEYS.length;
    if (_cooledUntil[i] <= Date.now()) {
      _cursor = (i + 1) % CHAT_KEYS.length;
      return i;
    }
  }
  let best = 0, bestUntil = Infinity;
  for (let i = 0; i < CHAT_KEYS.length; i++) {
    if (_cooledUntil[i] < bestUntil) { best = i; bestUntil = _cooledUntil[i]; }
  }
  _cursor = (best + 1) % CHAT_KEYS.length;
  return best;
}

function coolKey(i: number, ms: number) {
  const until = Date.now() + ms;
  if (until > _cooledUntil[i]) _cooledUntil[i] = until;
}

function classifyIntent(text: string) {
  const t = text.toLowerCase();
  if (/code|build|create|app|website|function|bug|error/.test(t)) return "coding";
  if (/explain|what|how|why|teach|learn/.test(t)) return "study";
  if (/hi|hey|hello|sup/.test(t)) return "greeting";
  return "general";
}

// ── PREMIUM SYSTEM PROMPT FOR LUMINA COMPUTER ──
// Single-file, museum-grade, minimalist output.
const COMPUTER_SYSTEM = `You are LUMINA COMPUTER — an elite product designer + senior front-end engineer hybrid. You ship ONE single, self-contained, production-ready \`index.html\` for every request. Nothing else.

══ NON-NEGOTIABLE OUTPUT CONTRACT ══
Your entire reply MUST be exactly this shape, with no prose before or after:

FILE: index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{specific, descriptive title}</title>
  <style>
    /* all CSS inline here — design tokens, layout, components, motion */
  </style>
</head>
<body>
  <!-- semantic, accessible markup -->
  <script>
    // all JS inline here — vanilla ES2022, no build step
  </script>
</body>
</html>
END FILE

Rules:
• No code fences. No backticks. No \`\`\`html. No commentary, no preamble, no postscript.
• Exactly ONE file. Everything inline. No external CSS, no external JS, no <link rel="stylesheet">, no <script src="...">.
• External assets allowed ONLY when essential: Google Fonts <link>, Unsplash/Picsum images, public CDN libs (Three.js, Chart.js, GSAP) via <script src>. Prefer pure CSS/SVG/Canvas when possible.
• Always close every tag. Always write \`END FILE\` on its own line at the very end.

══ DESIGN BAR — "STUNNING & MINIMALIST" ══
Every output must look like it shipped from a top design studio (Linear / Vercel / Apple / Stripe / Rauno / Arc). If it looks generic, you have failed.

Aesthetic principles you ALWAYS follow:
1. Restraint. One accent color max. Massive whitespace. Calm, confident typography.
2. Typography: import a real typeface (Inter, Geist, Manrope, Instrument Serif, Fraunces, JetBrains Mono). Set tracking, line-height, optical sizes. Use type scale 12 / 14 / 16 / 20 / 28 / 40 / 64 / 96.
3. Color: deep neutrals + ONE signal color. Avoid candy/pastel default palettes. Use OKLCH or carefully tuned HSL. Examples of good directions: ink-black on warm bone; graphite on porcelain; near-black on cream with single ember accent.
4. Layout: generous padding (clamp), max-width 1200px, 8px spatial grid, hairline 1px borders at 8% opacity.
5. Motion: tasteful only. Subtle fades, 200–400ms ease-out, spring physics for drag, intersection-observer reveals. Never bouncy/playful unless requested.
6. Detail: focus rings, hover states, disabled states, empty states, loading states, micro-copy. Real content, never lorem ipsum.
7. Light AND dark mode via \`prefers-color-scheme\` unless one is clearly correct for the brief.
8. Responsive from 360px to 1920px. Touch targets ≥ 44px. Use \`clamp()\`, container queries where useful.
9. Accessibility: semantic HTML, alt text, aria-labels, keyboard nav, visible focus, color contrast ≥ 4.5:1.
10. Performance: no jank. Use transform/opacity for animation. Lazy-load heavy work.

ANTI-PATTERNS — never ship these:
✗ Purple-to-pink gradients on white. ✗ Generic "AI startup" hero. ✗ Three feature cards with emoji icons. ✗ Drop shadows like \`0 4px 6px rgba(0,0,0,0.1)\`. ✗ Default system-ui without weight/spacing care. ✗ Lorem ipsum. ✗ Placeholder.com images. ✗ Bootstrap-feel buttons. ✗ Tailwind-default-spaced layouts. ✗ Emoji as decoration.

══ EXECUTION ══
• Read the user prompt carefully. Identify what kind of artifact best serves it (landing page, dashboard, tool, game, simulation, editor, visualization, learning lab, etc.).
• Write a brief mental plan, then execute fully. Do NOT output the plan as prose.
• Make it FEEL like the subject. A calculus lab should feel scholarly + precise. A pomodoro should feel calm + focused. A finance dashboard should feel sharp + data-dense. Match form to content.
• Include real interactivity: state, animation, useful behaviour. Not a static mockup.
• Aim for 400–1500 lines of dense, intentional code. Never pad. Never abandon halfway.
• If you reach the end of available tokens mid-file, KEEP GOING — your output will be auto-continued. Do not announce stopping. Just continue writing the file where you left off when prompted.

Begin now. Output ONLY the FILE: index.html block.`;

function buildSystemPrompt(intent: string, mode: string, effort: string, isComputer: boolean) {
  if (isComputer) return COMPUTER_SYSTEM + `\n\nEffort tier: ${effort.toUpperCase()}`;

  const base = `You are Lumina AI, an elite study assistant. Help students learn, explain concepts, generate practice problems, and build study materials.\n\nMode: ${mode}\nEffort: ${effort}`;
  if (intent === "coding") return base + "\n\nProvide clear, well-commented code examples.";
  if (intent === "study") return base + "\n\nExplain concepts clearly with examples.";
  if (intent === "greeting") return base + "\n\nRespond warmly and ask how you can help.";
  return base;
}

interface StreamCallResult {
  text: string;
  finishReason: string | null;
}

async function callOpenRouterCollect(
  messages: any[],
  maxTokens: number,
  temperature: number,
  signal: AbortSignal,
  onDelta: (chunk: string) => void,
  modelOverride?: string,
): Promise<StreamCallResult & { usedModel: string }> {
  const chain = modelOverride ? [modelOverride, ...FALLBACK_CHAIN.filter((m) => m !== modelOverride)] : FALLBACK_CHAIN;
  let lastErr = "";

  if (CHAT_KEYS.length === 0) {
    throw new Error("OPENROUTER_API_KEY not configured — add it to your Supabase project env vars");
  }
  for (const model of chain) {
    const maxKeyAttempts = Math.min(CHAT_KEYS.length, 3);
    for (let k = 0; k < maxKeyAttempts; k++) {
      const keyIdx = nextKey();
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${CHAT_KEYS[keyIdx]}`,
            "HTTP-Referer": "https://luminaai.co.in",
            "X-Title": "Lumina AI",
          },
          body: JSON.stringify({
            model,
            messages,
            stream: true,
            max_tokens: maxTokens,
            max_completion_tokens: maxTokens,
            temperature,
            top_p: 0.95,
          }),
          signal,
        });

        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let collected = "";
          let finishReason: string | null = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buf.indexOf("\n")) !== -1) {
              let line = buf.slice(0, nl);
              buf = buf.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (!json || json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const delta = parsed?.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta.length > 0) {
                  collected += delta;
                  onDelta(delta);
                }
                const fr = parsed?.choices?.[0]?.finish_reason;
                if (fr) finishReason = fr;
              } catch {
                buf = line + "\n" + buf;
                break;
              }
            }
          }

          return { text: collected, finishReason, usedModel: model };
        }

        if (res.status === 429) { coolKey(keyIdx, KEY_COOLDOWN_MS); continue; }
        if (res.status === 401 || res.status === 403) { coolKey(keyIdx, KEY_BAD_COOLDOWN_MS); continue; }
        lastErr = `${res.status} ${await res.text().catch(() => "")}`.slice(0, 200);
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
  }

  throw new Error(`All models failed. Last error: ${lastErr}`);
}

/** Detect if computer-mode output is complete (single index.html ending with END FILE). */
function isComputerOutputComplete(text: string): boolean {
  const t = text.trimEnd();
  if (!/FILE:\s*index\.html/i.test(t)) return false;
  if (/\nEND FILE\s*$/.test(t)) return true;
  return /<\/html>\s*$/i.test(t);
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
    const isComputer = requestedMode === "computer" || requestedMode === "mun";

    const systemPrompt = buildSystemPrompt(intent, requestedMode, effortLevel, isComputer);

    const maxTokens = isComputer
      ? (effortLevel === "beast" ? 65536 : effortLevel === "quick" ? 16384 : 32768)
      : (intent === "coding" ? 8192 : requestedMode === "deepDive" ? 8192 : 4096);
    const temperature = isComputer ? 0.25 : intent === "coding" ? 0.3 : 0.7;

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        const send = (obj: any) => ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        const sendDelta = (text: string) => send({ choices: [{ delta: { content: text } }] });

        const abortCtrl = new AbortController();
        req.signal.addEventListener("abort", () => abortCtrl.abort());

        try {
          let convo: any[] = [{ role: "system", content: systemPrompt }, ...messages];
          let totalText = "";
          let activeModel = OWL;
          // Server-side auto-continue: up to 4 passes for computer mode, 1 otherwise.
          const maxPasses = isComputer ? 4 : 1;

          for (let pass = 0; pass < maxPasses; pass++) {
            const { text, finishReason, usedModel } = await callOpenRouterCollect(
              convo,
              maxTokens,
              temperature,
              abortCtrl.signal,
              (delta) => sendDelta(delta),
            );
            activeModel = usedModel;
            if (pass === 0) send({ lumina_meta: { model: activeModel, intent, is_computer: isComputer, tier_target: "TIER_1" } });
            totalText += text;

            if (!isComputer) break;
            const truncated = finishReason === "length" || !isComputerOutputComplete(totalText);
            if (!truncated) break;
            if (pass === maxPasses - 1) {
              // last pass — surface a clean tail close if the model didn't.
              if (!/\nEND FILE\s*$/.test(totalText.trimEnd())) {
                const closer = /<\/html>\s*$/i.test(totalText.trimEnd()) ? "\nEND FILE\n" : "\n</body>\n</html>\nEND FILE\n";
                sendDelta(closer);
                totalText += closer;
              }
              break;
            }

            // Build continuation turn: feed the model its own partial output and ask it to keep writing.
            send({ choices: [{ delta: { content: "" } }], lumina_meta: { auto_continue: pass + 1 } });
            const tailHint = totalText.slice(-1800);
            convo = [
              { role: "system", content: systemPrompt },
              ...messages,
              { role: "assistant", content: totalText },
              {
                role: "user",
                content:
                  "Your previous reply was cut off by the token limit. CONTINUE writing the same index.html EXACTLY where you stopped — do not repeat any character you already wrote, do not restart, do not apologise. Just emit the next characters of the file. When the file is complete, close </body></html> and write a final line containing only: END FILE\n\nTAIL OF YOUR LAST OUTPUT (for context — do not repeat):\n" +
                  tailHint,
              },
            ];
          }

          send({ choices: [{ finish_reason: "stop", delta: {} }] });
          ctrl.enqueue(encoder.encode("data: [DONE]\n\n"));
          ctrl.close();
        } catch (e) {
          console.error("[chat] stream error:", e);
          try { send({ error: e instanceof Error ? e.message : "stream_error" }); } catch (_) { /* noop */ }
          try { ctrl.close(); } catch (_) { /* noop */ }
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
