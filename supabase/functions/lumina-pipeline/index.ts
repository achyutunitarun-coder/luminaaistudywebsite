// ───────────────────────────────────────────────────────────────────
// Lumina v2 — Sequential 6-agent pipeline (Computer Mode).
//
// Streams stage events as SSE:
//   data: {"stage":"planner","status":"working"}
//   data: {"stage":"planner","status":"done","summary":"..."}
//   data: {"stage":"final","status":"done","output":"<full text>"}
// ───────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIText } from "../_shared/models.ts";
import { preFlight } from "../_shared/preflight.ts";
import { detectSkills, buildSkillsBlock } from "../_shared/skills.ts";
import { selectCraftSkills, buildCraftSkillsBlock } from "../_shared/craft-skills.ts";
import { requireUser } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Stage =
  | "planner" | "router" | "research" | "architect" | "builder" | "validator" | "debugger" | "runner" | "assembler" | "final";

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
    stage: "planner",
    label: "Thinking",
    models: ["nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-20b:free", "nvidia/nemotron-3-ultra-550b-a55b:free"],
    maxTokens: 4096, temperature: 0.4,
    systemPrompt: () =>
      `You are the planning stage of this pipeline. Your only job is to take the user's request and produce a clear statement of what needs to be built and why — not how, not the structure, just a precise understanding of the actual goal that every later stage can work from. Read past the surface request to the real intent (what is this FOR, who is it FOR). If the request is ambiguous in a way that would meaningfully change what gets built, flag the ambiguity rather than silently picking an interpretation. Output a concise goal statement — a sentence or two — not a plan, not a structure. That belongs to the architect stage, not you.`,
  },
  {
    stage: "router",
    label: "Routing",
    models: ["nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-20b:free"],
    maxTokens: 4096, temperature: 0.4,
    systemPrompt: () =>
      `You are the routing stage. Given the planner's goal statement, decide which output type and downstream pipeline path actually serves this goal — deck, doc, site, sheet, research, or some combination. Base this decision on what the goal actually needs to accomplish, not on which output type the user's phrasing most superficially resembles ("deck" in the request doesn't automatically mean a business slide deck if the actual goal is better served by a document). If a goal genuinely spans multiple output types, say so rather than forcing a single-path decision. Output only the routing decision and a one-line justification — the actual build happens downstream.`,
  },
  {
    stage: "research",
    label: "Research",
    models: ["nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-20b:free", "google/gemma-4-31b-it:free"],
    maxTokens: 8192, temperature: 0.4,
    systemPrompt: () =>
      `You are the research stage. Your job is to gather whatever factual grounding the downstream build will need — and only that. Read the planner's goal statement and identify what claims, data, or context the final output will need to be accurate and specific rather than generic. Depth should match what the goal actually requires — a light creative request may need little to no research, a data-driven analysis needs real depth. Do not editorialize or start shaping how findings should be presented — that's the writer's job downstream. Output findings as clearly sourced, organized information the next stage can draw on directly.`,
  },
  {
    stage: "architect",
    label: "Architecture",
    models: ["nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-20b:free"],
    maxTokens: 8192, temperature: 0.35,
    systemPrompt: () =>
      `You are the architect stage. Given the goal and any research gathered, decide the structure of the final piece — how many parts it has and what each part's job is. This is the stage that decides shape, and shape must come from the specific content and goal in front of you, not from a template for "what a deck/doc/site usually looks like." A retirement tribute and a product pitch might both arrive as "decks" but should never get the same shape. For each part you define, state its purpose in one specific sentence — vague purposes like "overview" mean you haven't actually done the architectural thinking yet. Do not write any actual content — that's the builder's job.`,
  },
  {
    stage: "builder",
    label: "Coding",
    models: ["cohere/north-mini-code:free", "nvidia/nemotron-3-super-120b-a12b:free", "poolside/laguna-s-2.1:free", "openai/gpt-oss-20b:free"],
    maxTokens: 65536, temperature: 0.55,
    systemPrompt: () =>
      `You are the builder stage. Given the architect's structure, write or generate the actual content and/or code for each part. Match voice, format, and depth to what each part's stated purpose actually calls for — an emotional part reads differently than a data part, even within the same piece. Do not silently revise the architect's structure; if a part's specified shape genuinely doesn't work once you're building it, flag that rather than quietly building something else. Hold your output to the real design/writing quality bar (specific, considered, no generic filler) — not just technical completion of the assigned part.`,
  },
  {
    stage: "validator",
    label: "Evaluating",
    models: ["nvidia/nemotron-3-super-120b-a12b:free", "cohere/north-mini-code:free", "openai/gpt-oss-20b:free"],
    maxTokens: 4096, temperature: 0.3,
    systemPrompt: () =>
      `You are the validation stage. Check the builder's output against two things only: (1) does it structurally work in its target format — valid JSON where JSON is required, valid formula syntax in sheets, valid markdown/HTML that won't break downstream rendering or export, closed tags and brackets everywhere; and (2) does it actually fulfill the purpose the architect assigned to this part. You are not a style editor — don't flag content for being unconventional if it's unconventional ON PURPOSE because it fits the goal. Flag genuine defects: broken syntax, a part that doesn't do the job it was assigned, factual claims unsupported by the research stage. Output a pass/fail per part with specific, actionable detail on any failure — vague failure notes ("could be better") aren't useful to the debugger stage.`,
  },
  {
    stage: "debugger",
    label: "Debugging",
    models: ["cohere/north-mini-code:free", "nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-20b:free", "poolside/laguna-s-2.1:free"],
    maxTokens: 65536, temperature: 0.45,
    systemPrompt: () =>
      `You are the debugging stage. You receive specific, validated defects from the validator — your only job is to fix exactly those defects without introducing new ones or unnecessarily rewriting parts that passed validation. Fix syntax errors precisely. Fix content that doesn't meet its stated purpose by revising toward that purpose, not by replacing it with something generically safer. Do not use this stage to impose your own stylistic preferences on parts that validated cleanly — scope discipline here keeps the pipeline predictable.`,
  },
  {
    stage: "runner",
    label: "Running",
    models: ["nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-20b:free"],
    maxTokens: 2048, temperature: 0.2,
    systemPrompt: () =>
      `You are the execution stage. Take the validated, debugged output and actually assemble/render/export it into its final form — generate the actual file, render the actual page, produce the actual output artifact. Verify the output you produce actually opens/renders/parses correctly before considering this stage complete — an export that silently produces a blank or corrupted file is a runner-stage failure, not something to pass downstream and hope gets caught later. If the export step fails, that failure needs to surface clearly, not be swallowed.`,
  },
  {
    stage: "assembler",
    label: "Assembling",
    models: ["nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-20b:free"],
    maxTokens: 65536, temperature: 0.42,
    systemPrompt: () =>
      `You are the assembly stage. Combine the individually-built and validated parts into the single coherent final piece — this means checking that transitions between parts make sense, that the whole reads as one considered piece rather than a stitched-together sequence of independently-generated fragments, and that nothing contradicts across parts (a stat mentioned in part 2 shouldn't be contradicted by a different figure in part 5). Do not rewrite content wholesale at this stage — your job is coherence and connective tissue, not re-authoring what the builder already produced.`,
  },
];

/**
 * Detect whether builder/assembler output looks truncated (mid-HTML, mid-code-fence,
 * mid-sentence at the buffer cap). Returns true if we should ask the model to continue.
 */
function looksTruncated(out: string): boolean {
  if (!out) return true;
  const trimmed = out.trim();
  const lower = trimmed.toLowerCase();
  // HTML doc that never closed
  if (lower.includes("<!doctype") || lower.startsWith("<html")) {
    if (!lower.includes("</html>")) return true;
  }
  // Unbalanced fenced code blocks
  const fences = (trimmed.match(/```/g) || []).length;
  if (fences % 2 === 1) return true;
  // No real terminal punctuation in last 4 chars (likely mid-word / mid-tag)
  const tail = trimmed.slice(-6);
  if (/[a-zA-Z0-9_/\-]$/.test(tail) && !/[.!?>}\]`]/.test(tail.slice(-1))) {
    // Hint: model likely hit max_tokens
    return trimmed.length > 8000;
  }
  return false;
}

/** Stitch two outputs intelligently, dropping any overlap the model echoed back. */
function stitch(prev: string, next: string): string {
  if (!next) return prev;
  const trimmedNext = next.replace(/^```(?:html|tsx|jsx|ts|js)?\s*/i, "").trim();
  // Drop any leading repetition: find longest suffix of prev that is a prefix of next
  const maxOverlap = Math.min(prev.length, trimmedNext.length, 400);
  for (let i = maxOverlap; i > 24; i--) {
    if (prev.endsWith(trimmedNext.slice(0, i))) {
      return prev + trimmedNext.slice(i);
    }
  }
  return prev + trimmedNext;
}

function sseLine(obj: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const auth = await requireUser(req, cors);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    // Plan-tier enforcement (server authoritative)
    {
      const { enforceUsage } = await import("../_shared/usage-gate.ts");
      const gate = await enforceUsage(user.id, "lumina_computer", cors);
      if (!gate.ok) return gate.response;
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

    // Detect technical skills + craft skills
    const activeSkills = detectSkills(userRequest);
    const skillsBlock = buildSkillsBlock(activeSkills);
    const activeCrafts = selectCraftSkills(userRequest);
    const craftBlock = buildCraftSkillsBlock(activeCrafts);

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
          let artifactOutput = "";

          for (const stage of STAGES) {
            ctrl.enqueue(sseLine({ stage: stage.stage, status: "working", label: stage.label }));
            // Inject skills + TIER directive into the stages that shape the product.
            const stageCraftAddon =
              stage.stage === "architect" || stage.stage === "builder" || stage.stage === "assembler"
                ? `\n\n${craftBlock}`
                : "";
            const stageSkillsAddon =
              stage.stage === "planner" || stage.stage === "builder" || stage.stage === "debugger" || stage.stage === "assembler"
                ? `\n\n${skillsBlock}${stageCraftAddon ? "\n\n" + stageCraftAddon : ""}`
                : stageCraftAddon;
            const artifactContext = artifactOutput
              ? `CURRENT ARTIFACT DRAFT:\n${artifactOutput}\n\n`
              : "";
            const messages = [
              { role: "system", content: stage.systemPrompt(userRequest) + stageSkillsAddon },
              { role: "user", content:
                `ORIGINAL REQUEST:\n${userRequest}\n\n` +
                artifactContext +
                (prevOutput ? `PREVIOUS STAGE OUTPUT:\n${prevOutput}\n\n` : "") +
                (stage.stage === "builder" && flight.systemAddon ? flight.systemAddon : "") +
                (stage.stage === "assembler" ? `\n\nPUSH_TO_TIER_1: Identify the current tier of the draft above. If TIER 2 or below, elevate it to TIER 1. Add ONE memorable detail. Strip placeholders and generic language. Output ONLY the improved artifact.\n` : "")
              },
            ];

            try {
              let out = await callAIText(
                messages, stage.models, stage.maxTokens, stage.temperature,
                stage.stage === "builder" || stage.stage === "debugger" || stage.stage === "assembler" ? 240_000 : 90_000,
                `pipeline/${stage.stage}`,
              );

              // Auto-continuation for the heavy stages so massive code/HTML never
              // gets truncated at the model's max_tokens ceiling.
              if (stage.stage === "builder" || stage.stage === "debugger" || stage.stage === "assembler") {
                let continuations = 0;
                while (continuations < 4 && looksTruncated(out)) {
                  continuations++;
                  ctrl.enqueue(sseLine({
                    stage: stage.stage, status: "working",
                    label: `${stage.label} (continuing ${continuations}/4)`,
                  }));
                  const tail = out.slice(-1800);
                  try {
                    const more = await callAIText(
                      [
                        { role: "system", content: stage.systemPrompt(userRequest) + stageSkillsAddon },
                        { role: "user", content:
                          `ORIGINAL REQUEST:\n${userRequest}\n\nThe previous response was cut off at the model's output limit. CONTINUE EXACTLY where it stopped. Do NOT repeat anything already written. Do NOT restart. Do NOT add commentary. Output only the remaining content so the document/code is complete and properly closed (e.g. </html>, closing braces, closing fences).\n\nLAST 1800 CHARACTERS WRITTEN:\n${tail}` },
                      ],
                      stage.models, stage.maxTokens, stage.temperature,
                      180_000, `pipeline/${stage.stage}-cont${continuations}`,
                    );
                    if (!more || more.trim().length < 20) break;
                    out = stitch(out, more);
                  } catch (e) {
                    console.warn(`[pipeline] continuation ${continuations} failed:`, e);
                    break;
                  }
                }
              }

              prevOutput = out;
              if (stage.stage === "builder" || stage.stage === "debugger" || stage.stage === "assembler") artifactOutput = out;
              if (stage.stage === "assembler") {
                ctrl.enqueue(sseLine({ stage: "meta", status: "done", tier_achieved: "TIER_1" }));
              }

              // One repair pass if validation rejects.
              if (stage.stage === "validator") {
                let needsRevision = false;
                try {
                  const cleaned = out.replace(/```(?:json)?/g, "").trim();
                  const m = cleaned.match(/\{[\s\S]*\}/);
                  if (m) {
                    const parsed = JSON.parse(m[0]);
                    if (parsed.status === "revision_needed") needsRevision = true;
                  }
                } catch { /* treat as approved */ }

                if (needsRevision && artifactOutput) {
                  ctrl.enqueue(sseLine({ stage: "debugger", status: "working", label: "Debugging (repair)" }));
                  const fixMessages = [
                    { role: "system", content: STAGES.find((s) => s.stage === "debugger")!.systemPrompt(userRequest) + `\n\n${skillsBlock}` },
                    { role: "user", content:
                      `ORIGINAL REQUEST:\n${userRequest}\n\nFIRST DRAFT:\n${artifactOutput}\n\nVALIDATOR NOTES:\n${out}\n\nPatch the minimal broken modules and output the improved artifact in the same format.`,
                    },
                  ];
                  try {
                    const debuggerStage = STAGES.find((s) => s.stage === "debugger")!;
                    const fixed = await callAIText(
                      fixMessages, debuggerStage.models, debuggerStage.maxTokens, debuggerStage.temperature,
                      240_000, "pipeline/debugger-repair",
                    );
                    artifactOutput = fixed;
                    prevOutput = fixed;
                    ctrl.enqueue(sseLine({ stage: "debugger", status: "done", label: "Debugging (repaired)" }));
                  } catch (e) {
                    ctrl.enqueue(sseLine({ stage: "debugger", status: "error", label: "Debugging", error: String(e) }));
                  }
                }
              }

              ctrl.enqueue(sseLine({ stage: stage.stage, status: "done", label: stage.label }));
            } catch (e) {
              ctrl.enqueue(sseLine({ stage: stage.stage, status: "error", label: stage.label, error: String(e) }));
              // continue with whatever we have so far
            }
          }

          ctrl.enqueue(sseLine({ stage: "final", status: "done", output: artifactOutput || prevOutput }));
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
