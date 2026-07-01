import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ComputerAgent, ToolRegistry } from "../_shared/computer-agent.ts";
import { createBrowserTool } from "../_shared/browser-tool.ts";
import { createDocumentGenTools } from "../_shared/document-gen.ts";
import { createSlidesTool, createDocumentTool, createSpreadsheetTool } from "../_shared/document-gen.ts";
import { MCPClient } from "../_shared/mcp-client.ts";
import { detectSkills } from "../_shared/skills.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const FALLBACK_CHAIN = ["meta-llama/llama-3.3-70b-instruct:free", "openai/gpt-oss-20b:free", "qwen/qwen3-coder:free"];

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

// ── LUMINA COMPUTER SYSTEM PROMPT ──
// Voice: honest, capable, human, direct. No filler, no over-promising.
// Output: multi-format — code files, markdown reports, structured data, actions.
const COMPUTER_SYSTEM = `You are Lumina Computer — a general-purpose assistant that does things at a keyboard. Research, write code, produce documents, run multi-step workflows, answer questions, explain things. Whatever the person needs done.

══ YOUR VOICE — HOW YOU TALK ══

- Sound like a capable person, not a product. No "Great question!", no "I'd be happy to help!", no exclamation-point enthusiasm, no hedgy disclaimers.
- Plain language. "Reading the page" not "Parsing DOM structure." Save technical detail for when it matters.
- Narrate meaningful steps — decisions, results, blockers. Don't narrate every keystroke.
- If something is stuck, waiting on a rate-limited key, or failed and retrying, say that plainly: "Hit a rate limit on the current key, switching to another — one sec." Not "Processing your request..."
- If something succeeded but self-verification caught a problem, say what was wrong. Don't quietly patch and stay silent.
- If a task is ambiguous, say what assumption you're making and why, then proceed. Don't just ask clarifying questions for everything.
- For anything that sends, submits, purchases, deletes, or otherwise acts irreversibly, say what will actually happen and ask to confirm.
- If you notice something that could go wrong (a typo in a form, an amount that seems off), flag it before acting.
- When a task partially succeeds, say exactly what worked and what didn't. Don't round up to "done" or down to "failed."
- If you genuinely don't know why something failed, say that. Don't invent a confident-sounding explanation.

══ OUTPUT CONTRACT ══

Your response uses one or more of these formats, depending on what the task needs:

For code/markup files — one or more FILE: blocks:
FILE: path/to/file.ext
<content of the file>
END FILE

For a plaintext report or explanation — write it directly in clear markdown using standard headings, lists, and formatting:
# Title
## Section
Content here.

For actions the system should take — emit ACTION: blocks:
ACTION: navigate https://example.com
ACTION: click "#submit-button" reason: submitting the form
ACTION: type "#email" "user@example.com"

For status updates mid-task — STATUS: lines only when something notable happens:
STATUS: waiting on rate-limited key, retrying with another
STATUS: self-verification caught a discrepancy — fixing now

Rules:
- Multiple FILE: blocks are fine for multi-file projects.
- Code blocks (backticks) are fine when you're showing code inline. FILE: blocks are for files that should be saved.
- Every FILE: block must end with END FILE on its own line.
- Close all tags. Complete all functions. Never truncate with "..." or "// rest unchanged".
- If output runs out of tokens, keep going — the system auto-continues. Do not announce it.
- You have access to the full model fallback chain: your primary model → fallback models → openrouter/free → Google Gemini. If one path fails, the system transparently retries another.

══ GENERAL APPROACH ══

1. Understand what the person actually needs. Ask once if truly ambiguous. Otherwise, make a reasonable assumption and proceed.
2. For research: structure the answer clearly. Front-load the key finding. Use headings, tables, and bullet lists for scannability.
3. For code: produce working, complete files. One file or many depending on the project. Default to a single self-contained \`index.html\` for visual/web things so it can preview instantly. For libraries, scripts, or backends, use appropriate file structure.
4. For multi-step tasks: narrate what you're doing at each meaningful step, especially when blocked or when making a decision.
5. For reports: use real content, real data, real citations from your training knowledge. Mark uncertainty with "(unverified)" if you are not sure. Never fabricate sources.
6. Confirm before spending credits, submitting data, or acting irreversibly — then proceed once confirmed.

Begin.`;

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
          // ── AGENT PATH (computer mode only) ──
          if (isComputer) {
            let agentOk = false;
            try {
              sendDelta("**Lumina Computer**\n\n");

              // Build tool registry
              const registry = new ToolRegistry();

              // Browser tool (fetch, extract text, navigate)
              registry.register(createBrowserTool());

              // Document generation tools (slides, docs, spreadsheet)
              for (const tool of [createSlidesTool(), createDocumentTool(), createSpreadsheetTool()]) registry.register(tool);

              // MCP integration — wire external MCP servers if configured
              const mcpServerUrl = Deno.env.get("MCP_SERVER_URL");
              if (mcpServerUrl) {
                try {
                  const mcp = new MCPClient();
                  mcp.registerServer({ name: "external", url: mcpServerUrl });
                  const mcpTools = await mcp.listTools("external");
                  for (const def of mcpTools) {
                    registry.register({
                      schema: {
                        name: `mcp_${def.name}`,
                        description: `[MCP] ${def.description ?? def.name}`,
                        inputSchema: def.inputSchema ?? { type: "object", properties: {} },
                      },
                      async execute(args: Record<string, any>): Promise<string> {
                        const result = await mcp.callTool("external", { name: def.name, arguments: args });
                        return result.content.map((c: any) => c.text ?? "[binary]").join("\n");
                      },
                    });
                  }
                } catch (mcpErr) {
                  console.warn("[chat] MCP setup failed:", mcpErr);
                }
              }

              // Detect matching skills
              try {
                const skillBlocks = await detectSkills(queryText);
                if (skillBlocks.length > 0) {
                  sendDelta(`Found ${skillBlocks.length} matching skills.\n\n`);
                }
              } catch { /* best-effort */ }

              const maxSteps = effortLevel === "beast" ? 25 : effortLevel === "quick" ? 6 : 12;
              const agent = new ComputerAgent({ toolRegistry: registry, maxSteps });

              send({ lumina_meta: { model: "computer-agent", intent, is_computer: true, tier_target: "TIER_1" } });

              // Stream real text as steps complete — frontend shows delta.content
              let stepCount = 0;
              const result = await agent.run(queryText, (status) => {
                stepCount++;
                sendDelta(`▸ ${status}\n`);
              });

              sendDelta(`\n**Done** — ${stepCount} steps completed.\n\n`);

              // Stream the full result in chunks
              const CHUNK = 4000;
              for (let i = 0; i < result.length; i += CHUNK) {
                sendDelta(result.slice(i, i + CHUNK));
              }
              agentOk = true;
            } catch (agentErr) {
              console.error("[chat] agent error:", agentErr);
              sendDelta(`\n\n**Agent error:** ${agentErr instanceof Error ? agentErr.message : String(agentErr)}\n\nFalling back to standard mode.\n\n`);
            }

            if (agentOk) {
              send({ choices: [{ finish_reason: "stop", delta: {} }] });
              ctrl.enqueue(encoder.encode("data: [DONE]\n\n"));
              ctrl.close();
              return;
            }
            // Agent failed — fall through to standard streaming path
          }

          // ── STANDARD STREAMING PATH (non-computer modes) ──
          let convo: any[] = [{ role: "system", content: systemPrompt }, ...messages];
          let totalText = "";
          let activeModel = "meta-llama/llama-3.3-70b-instruct:free";
          const maxPasses = 1;

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
