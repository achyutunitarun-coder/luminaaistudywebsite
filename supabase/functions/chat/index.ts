import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callWithFallback, getModelsForIntent, getSystemPromptForIntent, MODELS_LONG_CTX } from "../_shared/models.ts";
import { LuminaModeOrchestrator } from "../_shared/mode-orchestrator.ts";
import { ModeRouter, formatModeRoutes } from "../_shared/mode-router.ts";
import { classifyBudget, getBudgetForMode } from "../_shared/tool-budget.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BUDGET_MS = 150_000;
const modeRouter = new ModeRouter();
const STATUS_MAP: Record<string, string> = {
  slides: "Creating slide deck...",
  writing: "Creating document...",
  coding: "Creating files...",
  research: "Researching...",
  data: "Creating spreadsheet...",
  computer: "Processing...",
};
const MAX_CONTINUATION_ROUNDS = 20;
const CONT_SHORT = "The response was cut short. Continue from where you stopped. Output ONLY the continuation \u2014 no prefixes, no explanations, no markdown.";
const CONT_LONG = "Continue exactly where you left off. Do NOT repeat ANYTHING already written. Do NOT summarize. Resume mid-sentence, mid-code, or mid-JSON if needed. Output ONLY the direct continuation \u2014 no prefixes, no explanations.";

function buildSystem(intent: string, mode: string, effort: string, isComputer: boolean): string {
  if (isComputer) {
    const detailed = getSystemPromptForIntent(mode === "mun" ? "mun" : "computer", false, false);
    return `${detailed}\n\nEffort: ${effort}`;
  }
  const base = "You are Lumina AI, an elite study assistant. Format beautifully with markdown headings, bold terms, lists, and code blocks. Write like a great teacher.";
  if (intent === "coding") return `${base}\nProvide working code with explanation.`;
  if (intent === "study") return `${base}\nExplain with examples and analogies.`;
  if (intent === "greeting") return `${base}\nBe warm and brief.`;
  if (intent === "research") return `${base}\nConduct thorough analysis. Use multiple sources and cite them.`;
  if (intent === "slides") return `${base}\nCreate well-structured slide content with clear narrative flow.`;
  if (intent === "data") return `${base}\nWork with data to create structured spreadsheets and charts.`;
  if (intent === "writing") return `${base}\nWrite comprehensive, well-formatted documents.`;
  return base;
}

function renderLuminaOutput(result: any): string {
  const ro = result.output as any;
  if ("body" in ro && typeof ro.body === "string") return ro.body;
  if ("summary" in ro && typeof ro.summary === "string") return ro.summary;
  if ("slides" in ro && Array.isArray(ro.slides)) {
    return ro.slides.map((sl: any) => `## ${sl.heading}\n\n${sl.body}${sl.notes ? `\n\n> ${sl.notes}` : ""}${sl.visual ? `\n\n*Visual: ${sl.visual.type} \u2014 ${sl.visual.description}*` : ""}`).join("\n\n---\n\n");
  }
  if ("tables" in ro && Array.isArray(ro.tables)) {
    return ro.tables.map((t: any) => {
      const h = t.headers || []; const rows = t.rows || [];
      return `### ${ro.title}\n\n| ${h.join(" | ")} |\n| ${h.map(() => "---").join(" | ")} |\n${rows.map((r: any) => `| ${h.map((c: string) => r[c] ?? "").join(" | ")} |`).join("\n")}`;
    }).join("\n\n");
  }
  if ("files" in ro && Array.isArray(ro.files)) {
    return ro.files.map((f: any) => `FILE: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join("\n\n");
  }
  return typeof ro === "string" ? ro : JSON.stringify(ro, null, 2);
}

async function streamContinuation(
  convo: { role: string; content: string }[],
  models: string[],
  maxTokens: number,
  tag: string,
  delta: (t: string) => void,
): Promise<string> {
  let accumulated = "";
  for (let rounds = 0; rounds < MAX_CONTINUATION_ROUNDS; rounds++) {
    const msgs = rounds === 0 ? convo : [
      ...convo,
      { role: "assistant", content: accumulated },
      { role: "user", content: (accumulated.length / 4) < maxTokens * 0.30 ? CONT_SHORT : CONT_LONG },
    ];
    const { response } = await callWithFallback(msgs, models, maxTokens, 0.7, BUDGET_MS, `${tag}${rounds > 0 ? `/cont${rounds}` : ""}`, { stream: true });
    if (!response.body) break;
    const reader = response.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let finishReason: string | null = null;
    let roundContent = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const raw = buf.slice(0, nl); buf = buf.slice(nl + 1);
          const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
          if (!line.startsWith("data: ")) continue;
          const js = line.slice(6).trim();
          if (!js || js === "[DONE]") continue;
          try {
            const p = JSON.parse(js);
            if (p.lumina_meta || p.lumina_usage) continue;
            const d = p?.choices?.[0]?.delta?.content;
            if (typeof d === "string" && d) { roundContent += d; delta(d); }
            if (p?.choices?.[0]?.finish_reason) finishReason = p.choices[0].finish_reason;
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch { /* connection dropped — use what we have */ }
    accumulated += roundContent;
    if (!roundContent || roundContent.trim().length === 0) break;
    const estimatedTokens = Math.round(accumulated.length / 4);
    if (finishReason !== "length" && estimatedTokens >= maxTokens * 0.85) break;
  }
  return accumulated;
}

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

    const budget = isLuminaMode ? getBudgetForMode(lumina_mode) : classifyBudget(messages);
    const maxTokens = isComputer ? (effortLvl === "quick" ? 16384 : 32768) : 8192;
    const system = buildSystem(intent.intent, mode, effortLvl, isComputer);

    if (budget.tier === "lightweight") {
      const systemExt = "\n\nNote: This is a quick conversation. Keep responses brief and direct \u2014 under 150 words. Do not generate files or undertake multi-step tasks unless the user explicitly asks.";
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

        try {
          if (isLuminaMode) {
            const sessionId = body.session_id || `${user.id}_${Date.now()}`;
            const orchestrator = new LuminaModeOrchestrator(sessionId);

            if (Array.isArray(uploadedFiles)) {
              for (const f of uploadedFiles) {
                orchestrator.getStore().addFile({ id: crypto.randomUUID(), sessionId, name: f.name, type: f.type || "unknown", size: f.content?.length || 0, content: f.content || "", createdAt: Date.now() });
              }
            }

            if (lumina_mode === "auto") {
              const routes = await modeRouter.suggestModes(query);
              const sorted = routes.sort((a, b) => b.confidence - a.confidence);
              delta(`### Mode Suggestion\n\n${formatModeRoutes(sorted)}\n\n---\n\n`);
            }

            let modeToRun = lumina_mode === "auto" ? intent.mode : lumina_mode;
            const store = orchestrator.getStore();
            const researchArtifact = store.list(sessionId, "research").slice(-1)[0];
            const sheetArtifact = store.list(sessionId, "sheet").slice(-1)[0];
            let sourceId: string | undefined;
            if (modeToRun === "slide" && researchArtifact) sourceId = researchArtifact.id;
            else if (modeToRun === "doc" && sheetArtifact) sourceId = sheetArtifact.id;
            else if (modeToRun === "doc" && researchArtifact) sourceId = researchArtifact.id;
            else if (modeToRun === "slide" && sheetArtifact) sourceId = sheetArtifact.id;

            delta(`\n**${modeToRun.charAt(0).toUpperCase() + modeToRun.slice(1)} Mode**\n\n`);
            const result = await orchestrator.executeMode(modeToRun as any, query, (statusMsg) => delta(`_${statusMsg}_\n\n`), sourceId);

            if (result.handoffTo && result.handoffTo !== modeToRun) {
              delta(`\n\n**Handing off to ${result.handoffTo} mode...**\n\n`);
              const handoffResult = await orchestrator.crossModeHandoff(result.mode, result.handoffTo, query, (statusMsg) => delta(`_${statusMsg}_\n\n`));
              result.mode = handoffResult.mode;
              result.output = handoffResult.output;
            }

            delta(`\n\n${renderLuminaOutput(result)}`);
            if ("verificationNotes" in result.output && (result.output as any).verificationNotes?.length > 0) {
              delta(`\n\n> **Verification:** ${(result.output as any).verificationNotes.join("; ")}`);
            }
            delta(`\n\n_Session: ${orchestrator.getSessionSummary()}_`);
          } else {
            const modeLabel = isComputer ? "computer" : "chat";
            send({ lumina_meta: { model: modeLabel, intent: intent.intent, is_computer: isComputer } });
            const statusMsg = STATUS_MAP[intent.intent] || "";
            if (statusMsg) delta(`_${statusMsg}_\n\n`);

            const models = isComputer ? MODELS_LONG_CTX : (getModelsForIntent(intent.intent as any) || MODELS_LONG_CTX);
            const convo = [{ role: "system", content: system }, ...messages];
            const tag = isComputer ? "computer" : intent.intent;
            await streamContinuation(convo, models, maxTokens, tag, delta);
          }
        } catch (e) { delta(`\n**Error:** ${e instanceof Error ? e.message : String(e)}\n`); }
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
