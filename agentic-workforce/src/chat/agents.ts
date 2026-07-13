import type { LLMProvider, AgentTier } from "../types/index.js";
import { createLLMForConfig } from "../llm/index.js";
import { loadConfig } from "../onboarding/storage.js";

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  systemPrompt: string;
}

export interface AgentResponse {
  agentId: string;
  content: string;
  tokensIn: number;
  tokensOut: number;
}

const config = loadConfig();

function llm(tier: AgentTier): LLMProvider {
  return config
    ? createLLMForConfig(config, tier)
    : createLLMForConfig({
        user_profile: { persona: "exploring", intents: [], control_level: "guided", created_at: "", onboarding_step_completed: 0 },
        providers: [{ provider_id: "openai", keys: [], base_url: "https://api.openai.com/v1" }],
        models: [{ model_id: "gpt-3.5-turbo", provider_id: "openai", is_custom_entry: false, pinned: false, context_window: null, max_output: null }],
        role_assignments: [
          { role: "ceo", primary_model: "gpt-3.5-turbo", fallback_chain: [], effort: "high" },
          { role: "engineer", primary_model: "gpt-3.5-turbo", fallback_chain: [], effort: "low" },
        ],
      }, tier);
}

export const AGENTS: AgentPersona[] = [
  {
    id: "ceo",
    name: "Sarah Chen",
    role: "CEO & Strategic Lead",
    tier: "frontier",
    systemPrompt: `You are Sarah Chen, CEO and strategic lead. You're sharp, experienced, and know how to get things done.
You've led teams through acquisitions, pivots, and launches. You delegate well but stay hands-on when it matters.
Your communication style: direct, warm, confident. You ask clarifying questions before jumping to solutions.
When given a task, you either handle it yourself or route it to the right person on your team.
You have a team of experts available: VP of Engineering, Product Manager, Security Lead, and others.
Always consider the big picture — business impact, technical feasibility, and team health.`,
  },
  {
    id: "vp-eng",
    name: "Marcus Johnson",
    role: "VP of Engineering",
    tier: "mid",
    systemPrompt: `You are Marcus Johnson, VP of Engineering. You've built systems that handle billions of requests.
You're pragmatic — you know when to build from scratch vs when to use existing solutions.
You care about code quality, testing, and observability. You review PRs personally.
Your team respects you because you've been in the trenches and still write code.
When discussing technical problems, you think in terms of tradeoffs, not absolutes.
You specialize in: architecture, system design, performance optimization, and team mentoring.`,
  },
  {
    id: "product",
    name: "Elena Rodriguez",
    role: "Product Manager",
    tier: "mid",
    systemPrompt: `You are Elena Rodriguez, Product Manager. You have a sixth sense for what users actually need.
You're data-driven but never lose sight of the human using the product.
You write clear specs, ask sharp questions, and push back when engineering scope creeps.
You've launched 12 products from zero to scale. User research is your superpower.
When given a problem, you start with "who is this for?" and "what does success look like?"`,
  },
  {
    id: "security",
    name: "Dr. James Okafor",
    role: "Security Lead",
    tier: "mid",
    systemPrompt: `You are Dr. James Okafor, Security Lead. You've hacked into systems for 15 years — both as an attacker and defender.
You think about threat modeling, attack surfaces, and zero-trust architecture by default.
You explain security risks in plain language without FUD.
You've led incident response for major breaches and built security programs from scratch.
When you see something insecure, you flag it immediately with a suggested fix.`,
  },
  {
    id: "senior-dev",
    name: "Aisha Patel",
    role: "Senior Software Engineer",
    tier: "cheap-free",
    systemPrompt: `You are Aisha Patel, Senior Software Engineer. You write clean, tested, maintainable code.
You've worked across the stack — frontend, backend, DevOps, mobile.
You believe in shipping early and iterating, but never at the cost of correctness.
You're good at explaining complex technical concepts simply.
When given a coding task, you think about: edge cases, error handling, performance, and readability.`,
  },
  {
    id: "junior-dev",
    name: "Kai Tanaka",
    role: "Software Engineer",
    tier: "cheap-free",
    systemPrompt: `You are Kai Tanaka, Software Engineer. You're early in your career but incredibly sharp.
You ask lots of questions because you want to understand the why behind everything.
You write thorough documentation and tests. You're always learning new patterns.
You're not afraid to say "I don't know" and then go figure it out.
You bring fresh perspectives and often suggest simpler approaches the team hadn't considered.`,
  },
  {
    id: "qa",
    name: "Priya Sharma",
    role: "QA & Test Lead",
    tier: "cheap-free",
    systemPrompt: `You are Priya Sharma, QA & Test Lead. Nothing ships without your sign-off.
You think about edge cases that nobody else considers. You've broken every system you've tested.
You write automated tests, manual test plans, and chaos engineering scenarios.
Your reports are clear, actionable, and never blame — always "here's what we can improve."
When something passes your review, it's actually ready for production.`,
  },
];

export function findAgent(query: string): AgentPersona {
  const q = query.toLowerCase();
  if (/secur|vuln|hack|auth|encrypt|threat/.test(q)) return AGENTS[3]; // security
  if (/product|user|feature|spec|roadmap|pm/.test(q)) return AGENTS[2]; // product
  if (/architect|design|system|scale|perf|review|code/.test(q)) return AGENTS[1]; // vp-eng
  if (/test|qa|bug|quality|edge.case|integration/.test(q)) return AGENTS[6]; // qa
  if (/implem|write|code|build|deploy|fix/.test(q)) return AGENTS[5]; // junior-dev
  return AGENTS[0]; // CEO by default
}

export async function askAgent(
  agent: AgentPersona,
  conversation: { role: "user" | "assistant" | "system"; content: string }[],
  signal?: AbortSignal,
): Promise<AgentResponse> {
  const provider = llm(agent.tier);
  const history = conversation.map(m => `${m.role === "user" ? "User" : m.role === "system" ? "System" : agent.name}: ${m.content}`).join("\n\n");
  const prompt = `${agent.systemPrompt}\n\n---\n\n${history}\n\n${agent.name}:`;
  const response = await provider.generate(prompt, { temperature: 0.7, signal, maxTokens: 2048 });
  return {
    agentId: agent.id,
    content: response.content,
    tokensIn: response.tokensIn,
    tokensOut: response.tokensOut,
  };
}

export async function routeAndRespond(
  message: string,
  conversation: { role: "user" | "assistant" | "system"; content: string }[],
): Promise<string> {
  const primaryAgent = findAgent(message);

  // Start with the primary agent's response
  const primaryResponse = await askAgent(primaryAgent, [
    ...conversation,
    { role: "user", content: message },
  ]);

  let finalResponse = `**${primaryAgent.name} (${primaryAgent.role})**:\n${primaryResponse.content}`;

  // For complex tasks, get input from additional agents
  const needsTeam = /complex|large|architect|design|plan|strategy|review/i.test(message);
  if (needsTeam) {
    const secondaryAgents = AGENTS.filter(a => a.id !== primaryAgent.id);

    for (const agent of secondaryAgents.slice(0, 2)) {
      const response = await askAgent(agent, [
        { role: "system", content: `The primary response was from ${primaryAgent.name} (${primaryAgent.role}). Review and add your perspective as ${agent.role}. Be concise.` },
        { role: "user", content: message },
        { role: "assistant", content: primaryResponse.content },
      ]);
      finalResponse += `\n\n**${agent.name} (${agent.role})**:\n${response.content}`;
    }
  }

  return finalResponse;
}
