// ─── User Profile (§2) ───

export type Persona = "solo_builder" | "student_researcher" | "small_team_lead" | "exploring";
export type Intent = "code" | "research" | "content" | "full_team" | `other:${string}`;
export type ControlLevel = "guided" | "tuning" | "full_control";

export interface UserProfile {
  persona: Persona;
  intents: Intent[];
  control_level: ControlLevel;
  created_at: string;
  onboarding_step_completed: number;
}

// ─── Providers (§8) ───

export type ValidationStatus = "valid" | "rate_limited" | "invalid" | "unvalidated";

export interface ProviderKey {
  label: string;
  key_ref: string;
  validated_at: string;
  validation_status: ValidationStatus;
}

export interface ProviderEntry {
  provider_id: string;
  keys: ProviderKey[];
  base_url?: string;
  custom_headers?: Record<string, string>;
}

// ─── Models (§8) ───

export interface ModelEntry {
  model_id: string;
  provider_id: string;
  is_custom_entry: boolean;
  pinned: boolean;
  context_window: number | null;
  max_output: number | null;
}

// ─── Role Assignments (§8) ───

export interface RoleAssignment {
  role: string;
  primary_model: string;
  fallback_chain: string[];
  effort: "low" | "medium" | "high";
}

// ─── Full Config (§8) ───

export interface AppConfig {
  user_profile: UserProfile;
  providers: ProviderEntry[];
  models: ModelEntry[];
  role_assignments: RoleAssignment[];
}

// ─── Known Providers (§3) ───

export interface KnownProvider {
  id: string;
  name: string;
  description: string;
  cost: string;
  needsApiKey: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  knownModels: string[];
  speedClass: "fast" | "standard" | "slow";
  recommendedFor: string;
}

export const KNOWN_PROVIDERS: KnownProvider[] = [
  {
    id: "groq",
    name: "Groq",
    description: "Fastest inference available, good default for speed-sensitive work",
    cost: "Free tier",
    needsApiKey: true,
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    knownModels: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it", "deepseek-r1-distill-llama-70b"],
    speedClass: "fast",
    recommendedFor: "Worker-tier tasks, real-time apps",
  },
  {
    id: "google",
    name: "Google AI Studio",
    description: "Long context, reliable free tier",
    cost: "Free tier",
    needsApiKey: true,
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    knownModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-pro"],
    speedClass: "standard",
    recommendedFor: "Research, long-document tasks",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    description: "Highest free daily volume",
    cost: "Free tier",
    needsApiKey: true,
    defaultBaseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama3.1-8b",
    knownModels: ["llama3.1-8b", "llama-3.3-70b"],
    speedClass: "fast",
    recommendedFor: "High-volume worker tasks",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "One key, access to many models incl. DeepSeek/MiniMax/GLM",
    cost: "Pay-per-use, cheap",
    needsApiKey: true,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o",
    knownModels: ["openai/gpt-4o", "anthropic/claude-sonnet-4", "google/gemini-2.5-flash", "deepseek/deepseek-chat"],
    speedClass: "standard",
    recommendedFor: "Multi-provider access, testing",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Cheapest paid tier, strong coding quality",
    cost: "Pay-per-use",
    needsApiKey: true,
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    knownModels: ["deepseek-chat", "deepseek-reasoner"],
    speedClass: "standard",
    recommendedFor: "Coding tasks, cost-sensitive workloads",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Frontier-tier quality, higher cost",
    cost: "Pay-per-use",
    needsApiKey: true,
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    knownModels: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    speedClass: "standard",
    recommendedFor: "Frontier tasks, complex reasoning",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Frontier-tier quality, higher cost",
    cost: "Pay-per-use",
    needsApiKey: true,
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    knownModels: ["claude-sonnet-4-20250514", "claude-haiku-3-5", "claude-opus-4-20250514"],
    speedClass: "standard",
    recommendedFor: "Frontier tasks, safety-critical applications",
  },
  {
    id: "custom",
    name: "Custom Endpoint",
    description: "Any OpenAI-compatible API you already have",
    cost: "Varies",
    needsApiKey: false,
    defaultBaseUrl: "",
    defaultModel: "",
    knownModels: [],
    speedClass: "standard",
    recommendedFor: "Self-hosted, proxies, enterprise",
  },
];

// ─── Defaults ───

export function defaultConfig(): AppConfig {
  return {
    user_profile: {
      persona: "exploring",
      intents: [],
      control_level: "guided",
      created_at: new Date().toISOString(),
      onboarding_step_completed: 0,
    },
    providers: [],
    models: [],
    role_assignments: [
      { role: "ceo", primary_model: "", fallback_chain: [], effort: "high" },
      { role: "vp_engineering", primary_model: "", fallback_chain: [], effort: "medium" },
      { role: "product_manager", primary_model: "", fallback_chain: [], effort: "medium" },
      { role: "security_lead", primary_model: "", fallback_chain: [], effort: "high" },
      { role: "senior_engineer", primary_model: "", fallback_chain: [], effort: "medium" },
      { role: "engineer", primary_model: "", fallback_chain: [], effort: "low" },
      { role: "qa_lead", primary_model: "", fallback_chain: [], effort: "medium" },
    ],
  };
}
