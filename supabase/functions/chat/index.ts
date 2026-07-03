import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LuminaModeOrchestrator } from "../_shared/mode-orchestrator.ts";
import { ModeRouter, formatModeRoutes } from "../_shared/mode-router.ts";
import { classifyBudget, getBudgetForMode } from "../_shared/tool-budget.ts";
import {
  callWithFallback,
  getModelsForIntent,
  STREAM_TOTAL_BUDGET_MS,
  CONTINUATION_MAX_ROUNDS,
  CONTINUATION_PROMPT_LENGTH,
  CONTINUATION_PROMPT_SHORT,
  MODELS_LONG_CTX,
} from "../_shared/models.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function* streamGen(
  messages: any[],
  maxTokens: number,
  temperature: number,
  signal: AbortSignal,
  models: string[],
  tag: string,
) {
  let accumulatedContent = "";
  let rounds = 0;

  while (rounds <= CONTINUATION_MAX_ROUNDS) {
    if (signal.aborted) return;

    const convoMessages = rounds === 0
      ? messages
      : [
          ...messages,
          { role: "assistant", content: accumulatedContent },
          { role: "user", content: accumulatedContent.trim().length < maxTokens * 0.30 ? CONTINUATION_PROMPT_SHORT : CONTINUATION_PROMPT_LENGTH },
        ];

    let response: Response | undefined;
    let attempt = 0;
    while (attempt < 2) {
      attempt++;
      try {
        const result = await callWithFallback(
          attempt === 1 ? convoMessages : [...convoMessages.slice(0, -1), { role: "user", content: "Write more. Expand on every point above. Add details, examples, and specific content. Do NOT repeat anything already written." }],
          models,
          maxTokens,
          temperature,
          STREAM_TOTAL_BUDGET_MS,
          `${tag}/stream${rounds > 0 ? `/cont${rounds}` : ""}`,
          { stream: true },
        );
        response = result.response;
        break;
      } catch (e) {
        if (rounds === 0) {
          yield `[ERROR: ${e instanceof Error ? e.message : String(e)}]\n`;
          return;
        }
        if (attempt >= 2) {
          console.warn(`[streamGen] cont round ${rounds} failed after retry`);
          break;
        }
        console.warn(`[streamGen] cont round ${rounds} failed, retrying with simpler prompt`);
      }
    }
    if (!response) break;

    const reader = response.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let roundContent = "";
    let finishReason: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const raw = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const p = JSON.parse(jsonStr);
          const d = p?.choices?.[0]?.delta?.content;
          if (typeof d === "string" && d) {
            roundContent += d;
            yield d;
          }
          const fr = p?.choices?.[0]?.finish_reason;
          if (fr) finishReason = fr;
        } catch {
          buf = line + "\n" + buf;
          break;
        }
      }
    }

    accumulatedContent += roundContent;

    if (signal.aborted) return;

    const estimatedTokens = Math.round(accumulatedContent.length / 4);
    // MINIMUM OUTPUT SAFETY: if first round produced fewer than 2000 chars for
    // a substantive task, always continue — the model likely stubbed the response.
    const minOutput = rounds === 0 ? Math.min(maxTokens * 0.20, 500) : 0;
    if (finishReason !== "length" && estimatedTokens >= maxTokens * 0.85 && accumulatedContent.length >= minOutput * 4) break;
    if (!roundContent || roundContent.trim().length === 0) {
      rounds++;
      if (rounds >= CONTINUATION_MAX_ROUNDS) break;
      continue;
    }

    rounds++;
  }
}

const COMPUTER_PROMPT = `You are Lumina Computer. You help with research, code, documents, and multi-step tasks. Voice: direct and capable. Use FILE: blocks for files, markdown for reports. Never truncate output.`;

function buildSystem(intent: string, mode: string, effort: string, isComputer: boolean): string {
  if (isComputer) return `${COMPUTER_PROMPT}\nEffort: ${effort}`;
  const base = `You are Lumina AI, an elite study assistant. Format beautifully with markdown headings, bold terms, lists, and code blocks. Write like a great teacher.`;
  if (intent === "coding") return `${base}\nProvide working code with explanation.`;
  if (intent === "study") return `${base}\nExplain with examples and analogies.`;
  if (intent === "greeting") return `${base}\nBe warm and brief.`;
  if (intent === "research") return `${base}\nConduct thorough analysis. Use multiple sources and cite them.`;
  if (intent === "slides") return `${base}\nCreate well-structured slide content with clear narrative flow.`;
  if (intent === "data") return `${base}\nWork with data to create structured spreadsheets and charts.`;
  if (intent === "writing") return `${base}\nWrite comprehensive, well-formatted documents.`;
  return base;
}

const modeRouter = new ModeRouter();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ue } = await sb.auth.getUser();
    if (ue || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

    const body = JSON.parse(await req.text());
    const { messages, mode, effort, lumina_mode, files: uploadedFiles } = body;
    if (!Array.isArray(messages)) return new Response(JSON.stringify({ error: "Invalid messages" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });

    const isComputer = mode === "computer" || mode === "mun";
    const isLuminaMode = ["research", "doc", "sheet", "slide", "website", "auto"].includes(lumina_mode);
    const effortLvl = ["quick", "normal", "beast"].includes(effort) ? effort : "normal";
    const query = messages.filter((m: any) => m.role === "user").pop()?.content || "";
    const intent = modeRouter.detectIntent(query);

    const budget = isLuminaMode
      ? getBudgetForMode(lumina_mode)
      : classifyBudget(messages);
    const maxTokens = isComputer
      ? (effortLvl === "quick" ? 16384 : 32768)
      : 8192;

    const system = buildSystem(intent.intent, mode, effortLvl, isComputer);
    if (budget.tier === "lightweight") {
      const systemExt = `\n\nNote: This is a quick conversation. Keep responses brief and direct — under 150 words. Do not generate files or undertake multi-step tasks unless the user explicitly asks.`;
      const lastUserIdx = messages.length - 1 - [...messages].reverse().findIndex((m: any) => m.role === "user");
      if (lastUserIdx >= 0 && lastUserIdx < messages.length) {
        messages[lastUserIdx] = { ...messages[lastUserIdx], content: messages[lastUserIdx].content + systemExt };
      }
    }

    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        const send = (o: any) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        const delta = (t: string) => send({ choices: [{ delta: { content: t } }] });
        const abort = new AbortController();
        req.signal.addEventListener("abort", () => abort.abort());

        async function runStreamingChat() {
          const convo = [{ role: "system", content: system }, ...messages];
          const models = isComputer ? MODELS_LONG_CTX : getModelsForIntent(intent.intent);
          if (!models || models.length === 0) {
            delta("**Error:** No models available for this request.\n");
            return;
          }
          for await (const chunk of streamGen(convo, maxTokens, 0.7, abort.signal, models, intent.intent)) {
            delta(chunk);
          }
        }

        try {
          if (isLuminaMode) {
            const userId = user.id;
            const sessionId = body.session_id || `${userId}_${Date.now()}`;
            const orchestrator = new LuminaModeOrchestrator(sessionId);

            if (Array.isArray(uploadedFiles)) {
              for (const f of uploadedFiles) {
                orchestrator.getStore().addFile({
                  id: crypto.randomUUID(),
                  sessionId,
                  name: f.name,
                  type: f.type || "unknown",
                  size: f.content?.length || 0,
                  content: f.content || "",
                  createdAt: Date.now(),
                });
              }
            }

            if (lumina_mode === "auto") {
              const routes = await modeRouter.suggestModes(query);
              const sorted = routes.sort((a, b) => b.confidence - a.confidence);
              delta(`### Mode Suggestion\n\n${formatModeRoutes(sorted)}\n\n---\n\n`);
            }

            let modeToRun = lumina_mode === "auto" ? intent.mode : lumina_mode;

            const researchArtifact = orchestrator.getStore().list(sessionId, "research").slice(-1)[0];
            const docArtifact = orchestrator.getStore().list(sessionId, "doc").slice(-1)[0];
            const sheetArtifact = orchestrator.getStore().list(sessionId, "sheet").slice(-1)[0];
            const slideArtifact = orchestrator.getStore().list(sessionId, "slide").slice(-1)[0];

            let sourceId: string | undefined;
            if (modeToRun === "slide" && researchArtifact) sourceId = researchArtifact.id;
            else if (modeToRun === "doc" && sheetArtifact) sourceId = sheetArtifact.id;
            else if (modeToRun === "doc" && researchArtifact) sourceId = researchArtifact.id;
            else if (modeToRun === "slide" && sheetArtifact) sourceId = sheetArtifact.id;

            delta(`\n**${modeToRun.charAt(0).toUpperCase() + modeToRun.slice(1)} Mode**\n\n`);

            const result = await orchestrator.executeMode(
              modeToRun as any,
              query,
              (statusMsg) => delta(`_${statusMsg}_\n\n`),
              sourceId,
            );

            if (result.handoffTo && result.handoffTo !== modeToRun) {
              delta(`\n\n**Handing off to ${result.handoffTo} mode...**\n\n`);
              const handoffResult = await orchestrator.crossModeHandoff(
                result.mode,
                result.handoffTo,
                query,
                (statusMsg) => delta(`_${statusMsg}_\n\n`),
              );
              result.mode = handoffResult.mode;
              result.output = handoffResult.output;
            }

            let outputBody = "";
            if ("body" in result.output) outputBody = (result.output as any).body;
            else if ("summary" in result.output) outputBody = (result.output as any).summary;
            else if ("files" in result.output) {
              outputBody = (result.output as any).files.map((f: any) => `--- ${f.path} ---\n\`\`\`${f.language}\n${f.content.slice(0, 2000)}\n\`\`\``).join("\n\n");
            }

            delta(`\n\n${outputBody.slice(0, 15000)}`);

            if ("verificationNotes" in result.output && (result.output as any).verificationNotes?.length > 0) {
              delta(`\n\n> **Verification:** ${(result.output as any).verificationNotes.join("; ")}`);
            }

            delta(`\n\n_Session: ${orchestrator.getSessionSummary()}_`);
          } else if (isComputer) {
            send({ lumina_meta: { model: "computer", intent: intent.intent, is_computer: true } });
            const statusMsg = ({
              slides: "Creating slide deck...",
              writing: "Creating document...",
              coding: "Creating files...",
              research: "Researching...",
              data: "Creating spreadsheet...",
              computer: "Processing...",
            } as Record<string, string>)[intent.intent] || "";
            if (statusMsg) delta(`_${statusMsg}_\n\n`);
            await runStreamingChat();
          } else {
            send({ lumina_meta: { model: "chat", intent: intent.intent, is_computer: false } });
            const statusMsg = ({
              slides: "Creating slide deck...",
              writing: "Creating document...",
              coding: "Creating files...",
              research: "Researching...",
              data: "Creating spreadsheet...",
            } as Record<string, string>)[intent.intent] || "";
            if (statusMsg) delta(`_${statusMsg}_\n\n`);
            await runStreamingChat();
          }
        } catch (e) {
          delta(`\n**Error:** ${e instanceof Error ? e.message : String(e)}\n`);
        }
        send({ choices: [{ finish_reason: "stop", delta: {} }] });
        ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
        ctrl.close();
      },
    });

    return new Response(stream, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
