// ───────────────────────────────────────────────────────────────────
// Lumina v2 — Sequential 6-agent pipeline (Computer Mode).
//
// Streams stage events as SSE:
//   data: {"stage":"orchestrate","status":"working"}
//   data: {"stage":"orchestrate","status":"done","summary":"..."}
//   data: {"stage":"final","status":"done","output":"<full text>"}
// ───────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIText } from "../_shared/models.ts";
import { preFlight } from "../_shared/preflight.ts";
import { detectSkills, buildSkillsBlock, TIER_DIRECTIVE } from "../_shared/skills.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Stage =
  | "orchestrate" | "plan" | "research" | "build" | "debug" | "optimize" | "final";

interface StageDef {
  stage: Exclude<Stage, "final">;
  label: string;
  models: string[];
  maxTokens: number;
  temperature: number;
  systemPrompt: (req: string) => string;
}

const STAGES: StageDef[] = [
  {
    stage: "orchestrate",
    label: "Orchestrator",
    models: ["openai/gpt-oss-120b:free", "z-ai/glm-4.5-air:free", "openai/gpt-oss-20b:free"],
    maxTokens: 1500, temperature: 0.4,
    systemPrompt: () =>
      `You are the ORCHESTRATOR for Lumina Computer. Break the user's request into a structured task list. Return ONLY JSON: {"subtasks":[...], "agent_assignments":{...}, "parallel_opportunities":[...], "success_criteria":[...]}. Be concise.`,
  },
  {
    stage: "plan",
    label: "Planner",
    models: ["z-ai/glm-4.5-air:free", "openai/gpt-oss-120b:free"],
    maxTokens: 2000, temperature: 0.4,
    systemPrompt: () =>
      `You are the PLANNER. Produce a numbered execution plan (max 10 steps). For each step list: action, expected_output, dependency, risk. Return as a brief Markdown ordered list.`,
  },
  {
    stage: "research",
    label: "Research",
    models: ["nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-120b:free", "z-ai/glm-4.5-air:free"],
    maxTokens: 3000, temperature: 0.4,
    systemPrompt: () =>
      `You are the RESEARCH agent. Gather all context, facts, formulas, definitions, and edge cases the BUILDER will need. Return a structured Markdown context packet under headings: Facts, Formulas, Examples, Edge Cases, Citations.`,
  },
  {
    stage: "build",
    label: "Builder",
    models: ["moonshotai/kimi-k2.6:free", "qwen/qwen3-coder:free", "openai/gpt-oss-120b:free"],
    maxTokens: 24000, temperature: 0.55,
    systemPrompt: () =>
      `You are the BUILDER for Lumina Computer. Produce the final artifact. If the user wants an interactive UI, output a SINGLE complete <!doctype html> document with inline CSS+JS — Apple-inspired aesthetic, hairline borders, SF Pro / -apple-system font stack, generous whitespace, working interactivity. If the user wants code in another language, output a single fenced code block. If the user wants a report, output clean Markdown. Never truncate. Never write "..." in place of content.`,
  },
  {
    stage: "debug",
    label: "Debug",
    models: ["poolside/laguna-m.1:free", "qwen/qwen3-coder:free", "openai/gpt-oss-120b:free"],
    maxTokens: 1200, temperature: 0.3,
    systemPrompt: () =>
      `You are the DEBUG reviewer. Inspect the builder's output for correctness, completeness, and quality. Return ONLY JSON: {"status":"approved"|"revision_needed","issues":[...],"approved_sections":[...]}.`,
  },
  {
    stage: "optimize",
    label: "Optimizer",
    models: ["nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "openai/gpt-oss-120b:free", "z-ai/glm-4.5-air:free"],
    maxTokens: 24000, temperature: 0.45,
    systemPrompt: () =>
      `You are the OPTIMIZER. Take the debug-approved output and return an improved final. Strengthen clarity, fix any generic language, ensure Lumina's warm, calm voice. Keep the same FORMAT (HTML stays HTML, code stays code, Markdown stays Markdown). Output ONLY the improved artifact — no commentary.`,
  },
];

function sseLine(obj: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

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
    const { request: userRequest } = JSON.parse(body) as { request: string };
    if (!userRequest || typeof userRequest !== "string") {
      return new Response(JSON.stringify({ error: "request required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Pre-flight: crisis short-circuit.
    const flight = await preFlight({
      userId: user.id,
      userMessage: userRequest,
      feature: "lumina_pipeline",
      authHeader,
    });

    // Detect skills + build skills/tier prompt block
    const activeSkills = detectSkills(userRequest);
    const skillsBlock = buildSkillsBlock(activeSkills);

    const stream = new ReadableStream({
      async start(ctrl) {
        try {
          // Surface skills + tier target up-front so the UI can render badges.
          ctrl.enqueue(sseLine({
            stage: "meta",
            status: "done",
            skills: activeSkills.map((s) => ({ id: s.id, label: s.label, icon: s.icon })),
            tier_target: "TIER_1",
          }));

          if (!flight.proceed && flight.interceptResponse) {
            ctrl.enqueue(sseLine({ stage: "final", status: "done", output: flight.interceptResponse, intercepted: true }));
            ctrl.close();
            return;
          }

          let prevOutput = "";
          let buildOutput = "";

          for (const stage of STAGES) {
            ctrl.enqueue(sseLine({ stage: stage.stage, status: "working", label: stage.label }));
            // Inject skills + TIER directive into Builder and Optimizer.
            const stageSkillsAddon =
              stage.stage === "build" || stage.stage === "optimize" || stage.stage === "orchestrate"
                ? `\n\n${skillsBlock}`
                : "";
            const messages = [
              { role: "system", content: stage.systemPrompt(userRequest) + stageSkillsAddon },
              { role: "user", content:
                `ORIGINAL REQUEST:\n${userRequest}\n\n` +
                (prevOutput ? `PREVIOUS STAGE OUTPUT:\n${prevOutput}\n\n` : "") +
                (stage.stage === "build" && flight.systemAddon ? flight.systemAddon : "") +
                (stage.stage === "optimize" ? `\n\nPUSH_TO_TIER_1: Identify the current tier of the draft above. If TIER 2 or below, elevate it to TIER 1. Add ONE memorable detail. Strip placeholders and generic language. Output ONLY the improved artifact.\n` : "")
              },
            ];

            try {
              const out = await callAIText(
                messages, stage.models, stage.maxTokens, stage.temperature,
                stage.stage === "build" || stage.stage === "optimize" ? 240_000 : 90_000,
                `pipeline/${stage.stage}`,
              );
              prevOutput = out;
              if (stage.stage === "build") buildOutput = out;
              if (stage.stage === "optimize") {
                ctrl.enqueue(sseLine({ stage: "meta", status: "done", tier_achieved: "TIER_1" }));
              }

              // One revision pass if debug rejects.
              if (stage.stage === "debug") {
                let needsRevision = false;
                try {
                  const cleaned = out.replace(/```(?:json)?/g, "").trim();
                  const m = cleaned.match(/\{[\s\S]*\}/);
                  if (m) {
                    const parsed = JSON.parse(m[0]);
                    if (parsed.status === "revision_needed") needsRevision = true;
                  }
                } catch { /* treat as approved */ }

                if (needsRevision && buildOutput) {
                  ctrl.enqueue(sseLine({ stage: "build", status: "working", label: "Builder (revision)" }));
                  const fixMessages = [
                    { role: "system", content: STAGES[3].systemPrompt(userRequest) },
                    { role: "user", content:
                      `ORIGINAL REQUEST:\n${userRequest}\n\nFIRST DRAFT:\n${buildOutput}\n\nDEBUG NOTES:\n${out}\n\nProduce the improved artifact in the same format.`,
                    },
                  ];
                  try {
                    const fixed = await callAIText(
                      fixMessages, STAGES[3].models, STAGES[3].maxTokens, STAGES[3].temperature,
                      240_000, "pipeline/build-revision",
                    );
                    buildOutput = fixed;
                    prevOutput = fixed;
                    ctrl.enqueue(sseLine({ stage: "build", status: "done", label: "Builder (revised)" }));
                  } catch (e) {
                    ctrl.enqueue(sseLine({ stage: "build", status: "error", label: "Builder", error: String(e) }));
                  }
                }
              }

              ctrl.enqueue(sseLine({ stage: stage.stage, status: "done", label: stage.label }));
            } catch (e) {
              ctrl.enqueue(sseLine({ stage: stage.stage, status: "error", label: stage.label, error: String(e) }));
              // continue with whatever we have so far
            }
          }

          ctrl.enqueue(sseLine({ stage: "final", status: "done", output: prevOutput }));
          ctrl.close();
        } catch (e) {
          ctrl.enqueue(sseLine({ stage: "final", status: "error", error: String(e) }));
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
