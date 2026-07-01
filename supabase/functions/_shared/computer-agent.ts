// ═══════════════════════════════════════════════════════════════════
// Lumina Computer — Agent Core
//
// PLAN → ACT → OBSERVE → REFLECT → VERIFY loop with typed tool
// registry, task memory, and resumable execution support.
// ═══════════════════════════════════════════════════════════════════

import { createModelClient, type ModelClient } from "./models.ts";

// ── Tool Types ──────────────────────────────────────────────────────

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  error?: string;
}

export interface Tool {
  schema: ToolSchema;
  execute(args: Record<string, any>): Promise<string>;
}

// ── Task State ──────────────────────────────────────────────────────

export interface TaskStep {
  id: string;
  phase: "plan" | "act" | "observe" | "reflect" | "verify";
  input: string;
  output: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
}

export interface TaskMemory {
  id: string;
  request: string;
  steps: TaskStep[];
  checkpoint: string; // serialized state for resumption
  createdAt: number;
  updatedAt: number;
}

// ── Tool Registry ───────────────────────────────────────────────────

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool) {
    this.tools.set(tool.schema.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  listSchemas(): ToolSchema[] {
    return Array.from(this.tools.values()).map((t) => t.schema);
  }
}

// ── Agent Loop ──────────────────────────────────────────────────────

export type AgentPhase = "plan" | "act" | "observe" | "reflect" | "verify";

export interface AgentOptions {
  modelClient?: ModelClient;
  toolRegistry?: ToolRegistry;
  maxSteps?: number;
}

export class ComputerAgent {
  private client: ModelClient;
  private tools: ToolRegistry;
  private maxSteps: number;

  constructor(opts: AgentOptions = {}) {
    this.client = opts.modelClient ?? createModelClient();
    this.tools = opts.toolRegistry ?? new ToolRegistry();
    this.maxSteps = opts.maxSteps ?? 25;
  }

  // ── Checkpoint helpers ─────────────────────────────────────────────

  private saveCheckpoint(memory: TaskMemory): void {
    memory.checkpoint = JSON.stringify({
      steps: memory.steps,
      request: memory.request,
      completedSteps: memory.steps.filter((s) => s.phase === "act").length,
    });
    memory.updatedAt = Date.now();
  }

  /** Deserialize a checkpoint into partial state */
  private loadCheckpoint(checkpoint: string): { steps: TaskStep[]; request: string; completedSteps: number } | null {
    try {
      return JSON.parse(checkpoint);
    } catch {
      return null;
    }
  }

  // ── Main Run ───────────────────────────────────────────────────────

  async run(request: string, onStatus?: (msg: string) => void): Promise<string> {
    const memory: TaskMemory = {
      id: crypto.randomUUID(),
      request,
      steps: [],
      checkpoint: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onStatus?.(`Planning: ${request.slice(0, 80)}...`);

    // Phase 1: PLAN
    const plan = await this.client.complete(
      [
        { role: "system", content: "You are a task planner. Break the user's request into a sequence of steps. Return a numbered list of 1-8 concrete steps. Be specific about what actions each step requires." },
        { role: "user", content: request },
      ],
      { maxTokens: 2048, temperature: 0.3, tag: "agent/plan" },
    );

    memory.steps.push({
      id: crypto.randomUUID(),
      phase: "plan",
      input: request,
      output: plan,
      timestamp: Date.now(),
    });

    onStatus?.(`Planned ${plan.split("\n").filter(l => /^\d+\./.test(l)).length} steps`);

    // Phase 2-5: ACT → OBSERVE → REFLECT → VERIFY loop for each step
    const planSteps = plan.split("\n").filter((l) => /^\d+\./.test(l)).map((l) => l.replace(/^\d+\.\s*/, "").trim());

    for (let i = 0; i < Math.min(planSteps.length, this.maxSteps); i++) {
      const step = planSteps[i];
      const stepId = crypto.randomUUID();
      onStatus?.(`Step ${i + 1}/${planSteps.length}: ${step.slice(0, 100)}`);

      // ACT — execute the step via model
      const actResult = await this.client.complete(
        [
          { role: "system", content: `You are executing step ${i + 1} of a plan. The overall request is: ${request}\n\nContext so far:\n${memory.steps.map((s) => `[${s.phase}] ${s.output.slice(0, 200)}`).join("\n")}` },
          { role: "user", content: `Execute this step: ${step}\n\nReturn the result of this step. If you need to produce a file, use the FILE: path\ncontent\nEND FILE format.` },
        ],
        { maxTokens: 16384, temperature: 0.3, tag: `agent/step${i + 1}` },
      );

      memory.steps.push({
        id: stepId,
        phase: "act",
        input: step,
        output: actResult,
        timestamp: Date.now(),
      });

      // OBSERVE — examine the output before verifying
      const observe = await this.client.complete(
        [
          { role: "system", content: "You are an observer. Examine the step output and extract: (1) what was produced, (2) any files created, (3) any errors or warnings. Be concise." },
          { role: "user", content: `Step: ${step}\n\nOutput:\n${actResult.slice(0, 3000)}` },
        ],
        { maxTokens: 1024, temperature: 0.2, tag: "agent/observe" },
      );

      memory.steps.push({
        id: crypto.randomUUID(),
        phase: "observe",
        input: `Observe: ${step}`,
        output: observe,
        timestamp: Date.now(),
      });

      // REFLECT — think about whether the output is correct
      const reflect = await this.client.complete(
        [
          { role: "system", content: "You are a reflective assessor. Given the step, the output, and the observation, determine if the step was completed correctly and if there are any gaps. Return REFLECTION: followed by your analysis." },
          { role: "user", content: `Step: ${step}\n\nObservation:\n${observe}` },
        ],
        { maxTokens: 1024, temperature: 0.3, tag: "agent/reflect" },
      );

      memory.steps.push({
        id: crypto.randomUUID(),
        phase: "reflect",
        input: `Reflect: ${step}`,
        output: reflect,
        timestamp: Date.now(),
      });

      // VERIFY — check the result
      const verify = await this.client.complete(
        [
          { role: "system", content: "You are a task verifier. Check if the step output is correct and complete. Reply with PASS or FAIL followed by a short reason." },
          { role: "user", content: `Step: ${step}\n\nOutput:\n${actResult.slice(0, 3000)}\n\nReflection:\n${reflect}` },
        ],
        { maxTokens: 512, temperature: 0.2, tag: "agent/verify" },
      );

      memory.steps.push({
        id: crypto.randomUUID(),
        phase: "verify",
        input: `Verify: ${step}`,
        output: verify,
        timestamp: Date.now(),
      });

      // Save checkpoint after each step
      this.saveCheckpoint(memory);

      if (verify.startsWith("FAIL")) {
        onStatus?.(`Step ${i + 1} failed verification: ${verify.replace("FAIL", "").trim()}. Continuing...`);
      }
    }

    onStatus?.("Done.");

    // Return assembled output
    const outputParts = memory.steps
      .filter((s) => s.phase === "act")
      .map((s) => s.output);
    return outputParts.join("\n\n");
  }

  // ── Resume ─────────────────────────────────────────────────────────

  async resume(request: string, checkpoint: string, onStatus?: (msg: string) => void): Promise<string> {
    const state = this.loadCheckpoint(checkpoint);
    if (!state) {
      onStatus?.("Checkpoint invalid, starting fresh.");
      return this.run(request, onStatus);
    }

    const memory: TaskMemory = {
      id: crypto.randomUUID(),
      request,
      steps: state.steps,
      checkpoint,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const completedCount = state.completedSteps;
    onStatus?.(`Resuming after ${completedCount} completed steps (${state.steps.length} total steps in trace).`);

    // Re-derive plan steps from the plan phase output
    const planOutput = state.steps.find((s) => s.phase === "plan")?.output;
    if (!planOutput) {
      onStatus?.("No plan found in checkpoint, starting fresh.");
      return this.run(request, onStatus);
    }

    const planSteps = planOutput.split("\n").filter((l) => /^\d+\./.test(l)).map((l) => l.replace(/^\d+\.\s*/, "").trim());

    for (let i = completedCount; i < Math.min(planSteps.length, this.maxSteps); i++) {
      const step = planSteps[i];
      const stepId = crypto.randomUUID();
      onStatus?.(`Step ${i + 1}/${planSteps.length}: ${step.slice(0, 100)}`);

      const actResult = await this.client.complete(
        [
          { role: "system", content: `Resuming task. Overall request: ${request}\n\nCompleted steps: ${completedCount}\n\nContext so far:\n${memory.steps.map((s) => `[${s.phase}] ${s.output.slice(0, 200)}`).join("\n")}` },
          { role: "user", content: `Execute this remaining step: ${step}\n\nReturn the result of this step. Use FILE: blocks for files.` },
        ],
        { maxTokens: 16384, temperature: 0.3, tag: `agent/resume_step${i + 1}` },
      );

      memory.steps.push({
        id: stepId,
        phase: "act",
        input: step,
        output: actResult,
        timestamp: Date.now(),
      });

      const observe = await this.client.complete(
        [
          { role: "system", content: "You are an observer. Examine the step output and extract: what was produced, any files created, any errors." },
          { role: "user", content: `Step: ${step}\n\nOutput:\n${actResult.slice(0, 3000)}` },
        ],
        { maxTokens: 1024, temperature: 0.2, tag: "agent/observe_resume" },
      );

      memory.steps.push({
        id: crypto.randomUUID(),
        phase: "observe",
        input: `Observe: ${step}`,
        output: observe,
        timestamp: Date.now(),
      });

      const reflect = await this.client.complete(
        [
          { role: "system", content: "You are a reflective assessor. Determine if the step was completed correctly." },
          { role: "user", content: `Step: ${step}\n\nObservation:\n${observe}` },
        ],
        { maxTokens: 1024, temperature: 0.3, tag: "agent/reflect_resume" },
      );

      memory.steps.push({
        id: crypto.randomUUID(),
        phase: "reflect",
        input: `Reflect: ${step}`,
        output: reflect,
        timestamp: Date.now(),
      });

      const verify = await this.client.complete(
        [
          { role: "system", content: "You are a task verifier. Reply with PASS or FAIL followed by a reason." },
          { role: "user", content: `Step: ${step}\n\nOutput:\n${actResult.slice(0, 3000)}` },
        ],
        { maxTokens: 512, temperature: 0.2, tag: "agent/verify_resume" },
      );

      memory.steps.push({
        id: crypto.randomUUID(),
        phase: "verify",
        input: `Verify: ${step}`,
        output: verify,
        timestamp: Date.now(),
      });

      this.saveCheckpoint(memory);

      if (verify.startsWith("FAIL")) {
        onStatus?.(`Step ${i + 1} failed verification: ${verify.replace("FAIL", "").trim()}. Continuing...`);
      }
    }

    onStatus?.("Resume complete.");
    return memory.steps.filter((s) => s.phase === "act").map((s) => s.output).join("\n\n");
  }
}
