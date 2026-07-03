/**
 * Generic tool-call event system (Section 9 of the architecture spec).
 *
 * Every tool call emitted by the agent is categorized into one of these
 * stable categories. This ensures that adding a new tool later requires
 * only correct categorization, not new handling logic throughout the system.
 *
 * Test: Add a placeholder tool outside the current tool set and confirm
 * it's handled correctly by category alone.
 */

export const TOOL_CATEGORIES = [
  "file_operations",
  "code_execution",
  "browser_actions",
  "reasoning_narration",
  "generation",
  "verification",
  "sub_agent_spawns",
  "external_mcp",
] as const;

export type ToolCategory = typeof TOOL_CATEGORIES[number];

/**
 * Test that a category is valid.
 * Used as a type guard and validation when registering new tools.
 */
export function isValidCategory(c: string): c is ToolCategory {
  return (TOOL_CATEGORIES as readonly string[]).includes(c);
}

/**
 * A generic tool-call event.
 * All agent tool calls should be reduced to this shape for logging/UI.
 */
export interface ToolEvent {
  id: string;
  timestamp: number;
  category: ToolCategory;
  toolName: string;
  input: string;
  output?: string;
  status: "pending" | "running" | "success" | "error";
  errorMessage?: string;
  durationMs?: number;
}

/**
 * Creates a ToolEvent from a tool call.
 * Accepts any tool name — the category is derived from the name.
 */
export function createToolEvent(toolName: string, input: string): ToolEvent {
  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    category: categorizeTool(toolName),
    toolName,
    input,
    status: "pending",
  };
}

/**
 * Tool name → Category mapping.
 * This is the single function to update when adding new tools.
 */
export function categorizeTool(toolName: string): ToolCategory {
  const lower = toolName.toLowerCase();

  // File operations
  if (/^(read|write|edit|delete|move|copy|list|search|glob|grep|find|file)/.test(lower)) {
    return "file_operations";
  }

  // Code execution
  if (/^(bash|shell|exec|run|python|node|deno|pip|npm|yarn|bun)/.test(lower)) {
    return "code_execution";
  }

  // Browser actions
  if (/^(navigate|click|type|scroll|wait|screenshot|evaluate|browser|page)/.test(lower)) {
    return "browser_actions";
  }

  // Reasoning / narration (agent thinking out loud)
  if (/^(think|reason|plan|analyze|reflect|observe)/.test(lower)) {
    return "reasoning_narration";
  }

  // Generation (content creation)
  if (/^(generate|write|create|build|compose|draft|summarize|translate)/.test(lower)) {
    return "generation";
  }

  // Verification / validation
  if (/^(verify|validate|check|test|lint|review|audit|inspect)/.test(lower)) {
    return "verification";
  }

  // Sub-agent spawns
  if (/^(spawn|fork|delegate|subtask|agent|child)/.test(lower)) {
    return "sub_agent_spawns";
  }

  // External / MCP calls
  if (/^(mcp|external|api|fetch|webhook|plugin|extension)/.test(lower)) {
    return "external_mcp";
  }

  // Default: reasoning/narration for unknown tools
  return "reasoning_narration";
}

/**
 * In-memory event log (session-scoped).
 */
export class ToolEventLog {
  private events: ToolEvent[] = [];
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  push(event: ToolEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxSize) {
      this.events = this.events.slice(-this.maxSize);
    }
  }

  update(id: string, partial: Partial<ToolEvent>): void {
    const idx = this.events.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.events[idx] = { ...this.events[idx], ...partial };
    }
  }

  getAll(): ToolEvent[] {
    return [...this.events];
  }

  getByCategory(category: ToolCategory): ToolEvent[] {
    return this.events.filter((e) => e.category === category);
  }

  getRecent(n: number): ToolEvent[] {
    return this.events.slice(-n);
  }

  clear(): void {
    this.events = [];
  }

  getSummary(): Record<ToolCategory, number> {
    const summary: Record<string, number> = {};
    for (const cat of TOOL_CATEGORIES) summary[cat] = 0;
    for (const e of this.events) summary[e.category]++;
    return summary as Record<ToolCategory, number>;
  }
}

/**
 * Singleton instance for the current session.
 */
export const toolEventLog = new ToolEventLog();

/**
 * Placeholder tool registration test.
 * Uncomment and run to verify the system handles new tools by category alone:
 *
 * const testTool = createToolEvent("fetch_weather", "New York");
 * console.assert(testTool.category === "external_mcp", "fetch_weather should be external_mcp");
 *
 * const bashTool = createToolEvent("bash", "ls -la");
 * console.assert(bashTool.category === "code_execution", "bash should be code_execution");
 *
 * const navTool = createToolEvent("navigate", "https://example.com");
 * console.assert(navTool.category === "browser_actions", "navigate should be browser_actions");
 */
