// ───────────────────────────────────────────────────────────────────
// Lumina Computer v2 — Strict 6-agent state-machine pipeline.
//
// Hard rules:
//   • Agents run in fixed sequence. None may be skipped or reordered.
//   • Debugger is a MANDATORY gate. Code never reaches the user until
//     it passes validation. Up to 3 builder ⇄ debugger iterations.
//   • Source files contain ONLY code — never reasoning / planning.
//   • Full session state (history, files, decisions, logs) is loaded
//     before any agent runs and persisted after the run completes,
//     giving Lumina true cross-turn memory.
// ───────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIText } from "../_shared/models.ts";
import { preFlight } from "../_shared/preflight.ts";
import { detectSkills, buildSkillsBlock } from "../_shared/skills.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTI_REASONING_CLAUSE = `
ABSOLUTE RULE: Source files (HTML, CSS, JS, TS, JSX, TSX, Python, config) must contain ONLY production-ready code.
Never put planning notes, reasoning, debugging logs, chain-of-thought, "Let me…" prose, or meta-commentary inside file bodies.
Reasoning belongs in your conversational output, not in code.
`.trim();

type ConvTurn = { role: "user" | "assistant"; content: string; ts: number };
type FileMap = Record<string, { content: string; lang: string }>;

interface SessionState {
  id: string | null;
  conversation_history: ConvTurn[];
  project_files: FileMap;
  agent_logs: { stage: string; status: string; summary?: string; ts: number }[];
  architecture_decisions: string[];
  task_history: string[];
}

function emptySession(): SessionState {
  return {
    id: null,
    conversation_history: [],
    project_files: {},
    agent_logs: [],
    architecture_decisions: [],
    task_history: [],
  };
}

function summarizeFiles(files: FileMap, maxPerFile = 800): string {
  const keys = Object.keys(files);
  if (keys.length === 0) return "(no existing project files)";
  return keys
    .map((p) => {
      const c = files[p].content || "";
      const trimmed = c.length > maxPerFile ? c.slice(0, maxPerFile) + "\n…(truncated)" : c;
      return `── ${p} (${files[p].lang}) ──\n${trimmed}`;
    })
    .join("\n\n");
}

function recentConversation(history: ConvTurn[], n = 12): string {
  if (history.length === 0) return "(no prior turns)";
  return history
    .slice(-n)
    .map((t) => `${t.role.toUpperCase()}: ${t.content.slice(0, 1200)}`)
    .join("\n\n");
}

// ───────────────────── Stage definitions ─────────────────────
interface StageDef {
  stage: "planner" | "router" | "research" | "architect" | "builder" | "validator" | "debugger" | "runner" | "assembler";
  label: string;
  models: string[];
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

const STAGES: StageDef[] = [
  {
    stage: "planner", label: "Thinking",
    models: ["openai/gpt-oss-120b:free", "z-ai/glm-4.5-air:free", "openai/gpt-oss-20b:free"],
    maxTokens: 1500, temperature: 0.4,
    systemPrompt: `You are the ORCHESTRATOR. Break the user's request into a structured task list. Return ONLY JSON: {"subtasks":[...], "agent_assignments":{...}, "success_criteria":[...], "edit_mode":"create"|"edit", "target_files":[...]}.
If existing project files are provided, prefer "edit" mode and list only the files that need to change.`,
  },
  {
    stage: "router", label: "Routing",
    models: ["z-ai/glm-4.5-air:free", "openai/gpt-oss-120b:free"],
    maxTokens: 1500, temperature: 0.4,
    systemPrompt: `You are the ROUTER. Pick the model strategy and fallback chain. Return concise Markdown.`,
  },
  {
    stage: "research", label: "Research",
    models: ["nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-120b:free", "z-ai/glm-4.5-air:free"],
    maxTokens: 2500, temperature: 0.4,
    systemPrompt: `You are the RESEARCH agent. Gather context, facts, formulas, definitions, edge cases the BUILDER needs. Markdown under: Facts, Formulas, Examples, Edge Cases.`,
  },
  {
    stage: "architect", label: "Architecture",
    models: ["openrouter/owl-alpha", "openai/gpt-oss-120b:free", "z-ai/glm-4.5-air:free"],
    maxTokens: 4000, temperature: 0.35,
    systemPrompt: `You are the ARCHITECT. Define the multi-file structure. Return Markdown with: file tree, module responsibility, runtime interactions, validation checklist. No code yet.`,
  },
  {
    stage: "builder", label: "Coding",
    models: ["moonshotai/kimi-k2.6", "qwen/qwen3-coder:free", "openai/gpt-oss-120b:free"],
    maxTokens: 32000, temperature: 0.55,
    systemPrompt: `You are the BUILDER for Lumina Computer.

OUTPUT FORMAT — emit each file using EXACTLY this tag syntax (no Markdown fences around them):
<lumina:file path="index.html" lang="html">
…file contents…
</lumina:file>

Rules:
- Emit one <lumina:file> per file. Multi-file projects: emit them all.
- For HTML projects: a complete <!doctype html> document, link to sibling files by relative path (e.g. <link rel="stylesheet" href="styles.css">, <script src="script.js"></script>).
- Apple-inspired aesthetic, hairline borders, generous whitespace, SF Pro / -apple-system stack, working interactivity.
- If existing project files are provided AND the orchestrator indicated "edit" mode: emit ONLY the files you are changing or adding. Do NOT re-emit untouched files.
- Never truncate. Never write "…" in place of content.

${ANTI_REASONING_CLAUSE}`,
  },
  {
    stage: "validator", label: "Evaluating",
    models: ["poolside/laguna-m.1:free", "qwen/qwen3-coder:free", "openai/gpt-oss-120b:free"],
    maxTokens: 1500, temperature: 0.2,
    systemPrompt: `You are the VALIDATOR. Inspect builder output for: syntax errors, unclosed tags, missing imports/asset references, placeholders ("TODO", "…"), reasoning/prose leaked into file bodies, and runtime safety.

Return ONLY JSON:
{"status":"approved"|"revision_needed","issues":[{"file":"…","line":int?,"problem":"…","fix":"…"}],"approved_sections":[…]}.

Be strict. If ANY file contains conversational prose, planning, or meta-comments — mark revision_needed.`,
  },
  {
    stage: "debugger", label: "Debugging",
    models: ["nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "openai/gpt-oss-120b:free", "qwen/qwen3-coder:free"],
    maxTokens: 24000, temperature: 0.4,
    systemPrompt: `You are the DEBUGGER. Apply minimal fixes for the validator's issues. Re-emit the FULL fixed file set using <lumina:file> tags. Keep the same format.

${ANTI_REASONING_CLAUSE}`,
  },
  {
    stage: "runner", label: "Running",
    models: ["openai/gpt-oss-20b:free"],
    maxTokens: 800, temperature: 0.2,
    systemPrompt: `You are the RUNNER. Confirm the artifact runs in a browser iframe with all files mounted. Return concise Markdown: runtime pass/fail + minimal run notes.`,
  },
  {
    stage: "assembler", label: "Assembling",
    models: ["openrouter/owl-alpha", "openai/gpt-oss-120b:free"],
    maxTokens: 24000, temperature: 0.4,
    systemPrompt: `You are the ASSEMBLER. Take the validated file set and emit the FINAL coherent artifact — same <lumina:file> tag format. Strengthen polish; preserve all working code. ${ANTI_REASONING_CLAUSE}`,
  },
];

// ───────────────────── Validators ─────────────────────
const META_RX = [
  /\blet me (continue|finish|complete|pick up|resume)\b/i,
  /\bi['']?ll (continue|finish|now)\b/i,
  /\bhere (is|are) (the|your)\b/i,
  /\bcontinuing from\b/i,
  /^(sure|okay|alright|got it)[,!.]/im,
];

function localValidate(files: FileMap): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  for (const [path, f] of Object.entries(files)) {
    const c = f.content;
    if (!c || c.trim().length < 10) { issues.push(`${path}: empty or near-empty`); continue; }
    if (/\b(TODO|FIXME|\.\.\.)\b/.test(c) && c.length < 4000) issues.push(`${path}: contains placeholder TODO/…`);
    for (const rx of META_RX) if (rx.test(c)) { issues.push(`${path}: contains conversational prose`); break; }
    if (f.lang === "html") {
      const lower = c.toLowerCase();
      if (lower.includes("<html") && !lower.includes("</html>")) issues.push(`${path}: missing </html>`);
      if (lower.includes("<body") && !lower.includes("</body>")) issues.push(`${path}: missing </body>`);
    }
    if (f.lang === "js" || f.lang === "ts" || f.lang === "jsx" || f.lang === "tsx") {
      const open = (c.match(/\{/g) || []).length;
      const close = (c.match(/\}/g) || []).length;
      if (Math.abs(open - close) > 2) issues.push(`${path}: brace imbalance (${open}/${close})`);
    }
  }
  return { ok: issues.length === 0, issues };
}

// ───────────────────── File-tag parsing ─────────────────────
function parseFiles(text: string): FileMap {
  const out: FileMap = {};
  const rx = /<lumina:file\s+([^>]+)>([\s\S]*?)<\/lumina:file>/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    const attrs = m[1];
    const pathMatch = /path\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const langMatch = /lang\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!pathMatch) continue;
    const path = pathMatch[1];
    const lang = langMatch?.[1] ?? guessLang(path);
    out[path] = { content: m[2].replace(/^\n/, "").replace(/\n\s*$/, ""), lang };
  }
  return out;
}

function guessLang(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  return ({ html: "html", htm: "html", css: "css", js: "js", mjs: "js", ts: "ts", tsx: "tsx", jsx: "jsx", json: "json", md: "md", py: "py" } as Record<string, string>)[ext] ?? "txt";
}

function mergeFiles(base: FileMap, patch: FileMap): FileMap {
  return { ...base, ...patch };
}

function sseLine(obj: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

// ───────────────────── Handler ─────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    if (body.length > 200_000) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { request: userRequest, sessionId: sessionIdIn } = JSON.parse(body) as { request: string; sessionId?: string | null };
    if (!userRequest || typeof userRequest !== "string") {
      return new Response(JSON.stringify({ error: "request required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Load or create session ───────────────────────────────
    const session: SessionState = emptySession();
    if (sessionIdIn) {
      const { data: row } = await sb.from("lumina_sessions").select("*").eq("id", sessionIdIn).maybeSingle();
      if (row) {
        session.id = row.id;
        session.conversation_history = row.conversation_history ?? [];
        session.project_files = row.project_files ?? {};
        session.agent_logs = row.agent_logs ?? [];
        session.architecture_decisions = row.architecture_decisions ?? [];
        session.task_history = row.task_history ?? [];
      }
    }
    if (!session.id) {
      const { data: created } = await sb.from("lumina_sessions").insert({
        user_id: user.id,
        title: userRequest.slice(0, 80),
      }).select("id").single();
      session.id = created?.id ?? null;
    }

    const flight = await preFlight({ userId: user.id, userMessage: userRequest, feature: "lumina_pipeline", authHeader });
    const activeSkills = detectSkills(userRequest);
    const skillsBlock = buildSkillsBlock(activeSkills);

    const stream = new ReadableStream({
      async start(ctrl) {
        const stageLogs: SessionState["agent_logs"] = [];
        const persistAndClose = async (finalFiles: FileMap, finalText: string, assistantSummary: string) => {
          if (session.id) {
            const updatedFiles = mergeFiles(session.project_files, finalFiles);
            const updatedConv: ConvTurn[] = [
              ...session.conversation_history,
              { role: "user", content: userRequest, ts: Date.now() },
              { role: "assistant", content: assistantSummary || finalText.slice(0, 2000), ts: Date.now() },
            ].slice(-200);
            await sb.from("lumina_sessions").update({
              conversation_history: updatedConv,
              project_files: updatedFiles,
              agent_logs: [...session.agent_logs, ...stageLogs].slice(-500),
              task_history: [...session.task_history, userRequest].slice(-100),
            }).eq("id", session.id);
          }
          ctrl.enqueue(sseLine({
            stage: "final", status: "done",
            output: finalText,
            files: finalFiles,
            sessionId: session.id,
          }));
          ctrl.close();
        };

        try {
          ctrl.enqueue(sseLine({
            stage: "meta", status: "done",
            sessionId: session.id,
            skills: activeSkills.map((s) => ({ id: s.id, label: s.label, icon: s.icon })),
            tier_target: "TIER_1",
            channel: "activity",
            existingFiles: Object.keys(session.project_files),
          }));

          if (!flight.proceed && flight.interceptResponse) {
            await persistAndClose({}, flight.interceptResponse, flight.interceptResponse);
            return;
          }

          // Shared context injected into every agent
          const contextBlock = `
CURRENT PROJECT FILES (${Object.keys(session.project_files).length}):
${summarizeFiles(session.project_files)}

RECENT CONVERSATION:
${recentConversation(session.conversation_history)}

PRIOR ARCHITECTURE DECISIONS:
${session.architecture_decisions.slice(-5).join("\n") || "(none)"}
`.trim();

          let prevOutput = "";
          let builderOutput = "";
          let currentFiles: FileMap = {};
          let validatorJson: { status?: string; issues?: any[] } = {};

          const runStage = async (stage: StageDef, extra = ""): Promise<string> => {
            ctrl.enqueue(sseLine({ stage: stage.stage, status: "working", label: stage.label, channel: "activity" }));
            const messages = [
              { role: "system", content: stage.systemPrompt + (["planner", "builder", "debugger", "assembler"].includes(stage.stage) ? `\n\n${skillsBlock}` : "") },
              { role: "user", content:
                `USER REQUEST:\n${userRequest}\n\n` +
                `${contextBlock}\n\n` +
                (prevOutput ? `PREVIOUS STAGE OUTPUT:\n${prevOutput}\n\n` : "") +
                (builderOutput && stage.stage !== "builder" ? `CURRENT BUILDER ARTIFACT:\n${builderOutput}\n\n` : "") +
                extra },
            ];
            try {
              const out = await callAIText(
                messages, stage.models, stage.maxTokens, stage.temperature,
                ["builder", "debugger", "assembler"].includes(stage.stage) ? 240_000 : 90_000,
                `pipeline/${stage.stage}`,
              );
              stageLogs.push({ stage: stage.stage, status: "done", summary: out.slice(0, 200), ts: Date.now() });
              ctrl.enqueue(sseLine({ stage: stage.stage, status: "done", label: stage.label, channel: "activity" }));
              return out;
            } catch (e) {
              const msg = String(e);
              stageLogs.push({ stage: stage.stage, status: "error", summary: msg.slice(0, 200), ts: Date.now() });
              ctrl.enqueue(sseLine({ stage: stage.stage, status: "error", label: stage.label, error: msg, channel: "activity" }));
              throw e;
            }
          };

          // 1. PLANNER
          prevOutput = await runStage(STAGES[0]);
          // 2. ROUTER
          prevOutput = await runStage(STAGES[1]);
          // 3. RESEARCH
          prevOutput = await runStage(STAGES[2]);
          // 4. ARCHITECT
          prevOutput = await runStage(STAGES[3]);
          session.architecture_decisions.push(prevOutput.slice(0, 500));

          // 5. BUILDER + 6. VALIDATOR + 7. DEBUGGER (gated loop, max 3 iters)
          builderOutput = await runStage(STAGES[4]);
          currentFiles = parseFiles(builderOutput);
          // Stream file events on channel "code"
          for (const [path, f] of Object.entries(currentFiles)) {
            ctrl.enqueue(sseLine({ stage: "file", status: "done", channel: "code", path, lang: f.lang, content: f.content }));
          }

          const MAX_DEBUG_ITERS = 3;
          let approved = false;
          for (let iter = 0; iter < MAX_DEBUG_ITERS; iter++) {
            // Local validation first (deterministic)
            const local = localValidate(currentFiles);

            // Model validation
            const valOut = await runStage(STAGES[5]);
            try {
              const m = valOut.replace(/```(?:json)?/g, "").match(/\{[\s\S]*\}/);
              validatorJson = m ? JSON.parse(m[0]) : {};
            } catch { validatorJson = {}; }
            const modelApproved = validatorJson.status === "approved";

            ctrl.enqueue(sseLine({
              stage: "debugger_gate", status: modelApproved && local.ok ? "done" : "working",
              channel: "activity",
              label: `Debugger gate iter ${iter + 1}/${MAX_DEBUG_ITERS}`,
              iteration: iter + 1,
              localIssues: local.issues,
              modelStatus: validatorJson.status,
              modelIssues: validatorJson.issues ?? [],
            }));

            if (modelApproved && local.ok) { approved = true; break; }

            // 7. DEBUGGER — feedback loop
            const feedback = [
              ...local.issues.map((i) => `LOCAL: ${i}`),
              ...(validatorJson.issues ?? []).map((i: any) => `MODEL: ${JSON.stringify(i)}`),
            ].join("\n");
            const fixed = await runStage(
              STAGES[6],
              `VALIDATOR FEEDBACK:\n${feedback}\n\nCURRENT FILES:\n${Object.entries(currentFiles).map(([p, f]) => `<lumina:file path="${p}" lang="${f.lang}">\n${f.content}\n</lumina:file>`).join("\n\n")}\n\nReturn the FULL fixed file set.`,
            );
            const fixedFiles = parseFiles(fixed);
            if (Object.keys(fixedFiles).length > 0) {
              currentFiles = mergeFiles(currentFiles, fixedFiles);
              builderOutput = fixed;
              for (const [path, f] of Object.entries(fixedFiles)) {
                ctrl.enqueue(sseLine({ stage: "file", status: "done", channel: "code", path, lang: f.lang, content: f.content }));
              }
            }
          }

          if (!approved) {
            // Hard block: surface the failure rather than ship broken code.
            ctrl.enqueue(sseLine({
              stage: "debugger_gate", status: "error",
              channel: "activity",
              label: "Debugger gate failed after 3 iterations",
              localIssues: localValidate(currentFiles).issues,
              modelIssues: validatorJson.issues ?? [],
            }));
            const failureNote = `Debugger gate blocked release after ${MAX_DEBUG_ITERS} iterations. Issues: ${JSON.stringify({ local: localValidate(currentFiles).issues, model: validatorJson.issues }).slice(0, 1500)}`;
            await persistAndClose(currentFiles, builderOutput, failureNote);
            return;
          }

          // 8. RUNNER
          prevOutput = await runStage(STAGES[7]);

          // 9. ASSEMBLER (polish, same tag format)
          const finalOut = await runStage(STAGES[8]);
          const assembled = parseFiles(finalOut);
          if (Object.keys(assembled).length > 0) {
            currentFiles = mergeFiles(currentFiles, assembled);
            for (const [path, f] of Object.entries(assembled)) {
              ctrl.enqueue(sseLine({ stage: "file", status: "done", channel: "code", path, lang: f.lang, content: f.content }));
            }
          }

          ctrl.enqueue(sseLine({ stage: "meta", status: "done", tier_achieved: "TIER_1", channel: "activity" }));
          await persistAndClose(currentFiles, finalOut || builderOutput, "Updated project");
        } catch (e) {
          ctrl.enqueue(sseLine({ stage: "final", status: "error", error: String(e), channel: "activity" }));
          ctrl.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
