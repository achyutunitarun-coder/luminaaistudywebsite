/** Shared types for the Agentic Workforce system */

// ─── Agent Identity ───
export type AgentRoleId =
  | "ceo" | "cto" | "cpo" | "coo" | "cfo" | "cmo" | "chro" | "general-counsel" | "ciso"
  | "vp-engineering" | "vp-product" | "vp-design" | "vp-marketing" | "vp-sales"
  | "vp-customer-success" | "vp-finance"
  | "director-backend" | "director-frontend" | "director-infra" | "director-qa" | "director-data-ml"
  | "director-pm" | "director-ux-research" | "director-product-design" | "director-visual-design"
  | "director-content" | "director-growth" | "director-brand-pr" | "director-fpa" | "director-people-ops"
  | "eng-manager" | "qa-lead" | "ml-lead" | "support-manager"
  | "software-engineer" | "devops-engineer" | "data-engineer" | "ml-engineer"
  | "qa-engineer" | "security-engineer"
  | "product-manager" | "ux-researcher"
  | "product-designer" | "visual-designer"
  | "content-writer" | "growth-specialist" | "pr-specialist"
  | "account-executive" | "customer-support-agent"
  | "financial-analyst" | "accountant"
  | "hr-coordinator" | "legal-analyst"
  | "executive-assistant";

export type AgentTier = "frontier" | "mid" | "cheap-free";
export type LiveMode = "always-on" | "on-demand" | "dormant" | "gate-triggered";

export interface AgentIdentity {
  id: string;
  roleId: AgentRoleId;
  roleName: string;
  tier: AgentTier;
  liveMode: LiveMode;
  reportsTo: AgentRoleId | "user";
}

// ─── Tasks ───
export type TaskStatus = "pending" | "assigned" | "in-progress" | "review" | "blocked" | "done" | "rejected";

export interface Escalation {
  escalatedBy: string;
  escalatedTo: string;
  reason: string;
  resolvedAt?: number;
  resolution?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  status: TaskStatus;
  priority: number; // 1–5
  assignedTo?: string;
  assignedBy: string;
  parentTaskId?: string;
  department: string;
  tags: string[];
  escalation?: Escalation;
  verifyResult?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Artifacts ───
export type ArtifactType = "code" | "spec" | "doc" | "report" | "design" | "test" | "config" | "other";

export interface Artifact {
  id: string;
  taskId: string;
  agentId: string;
  type: ArtifactType;
  title: string;
  content: string;
  filePath?: string;
  createdAt: number;
}

// ─── Decision Log ───
export interface Decision {
  id: string;
  agentId: string;
  agentRole: string;
  decision: string;
  rationale: string;
  taskId?: string;
  createdAt: number;
}

// ─── Org State ───
export interface AgentState {
  identity: AgentIdentity;
  status: "idle" | "active" | "blocked" | "done";
  currentTaskId?: string;
  costSpent: number;
  totalTokens: number;
}

export interface DepartmentState {
  name: string;
  headRole: AgentRoleId;
  activeAgents: number;
  tasksCompleted: number;
  tasksBlocked: number;
}

export interface OrgState {
  agents: Map<string, AgentState>;
  departments: Map<string, DepartmentState>;
  totalCost: number;
  costCap: number;
  startedAt: number;
}

// ─── LLM ───
export interface LLMProvider {
  name: string;
  tier: AgentTier;
  generate(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

// ─── Tools ───
export type ToolName =
  | "create_task" | "assign_task" | "reprioritize" | "escalate" | "log_decision"
  | "read_file" | "write_file" | "run_shell_command" | "web_search" | "web_fetch"
  | "save_artifact" | "get_artifact" | "get_department_status"
  | "decompose_goal" | "final_verify" | "request_user_clarification";

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<unknown>;
}

// ─── Agent Loop ───
export interface AgentContext {
  identity: AgentIdentity;
  task?: Task;
  orgState: OrgState;
  tools: Map<ToolName, ToolDefinition>;
  llm: (tier: AgentTier) => LLMProvider;
  signal?: AbortSignal;
}

export interface AgentOutput {
  artifacts: Artifact[];
  decisions: Decision[];
  newTasks: Task[];
  escalations: Escalation[];
  status: "done" | "blocked" | "needs-review";
  summary: string;
}
