import type { LLMProvider, LLMResponse, LLMOptions, AgentTier } from "../types/index.js";
import type { AppConfig } from "../config/types.js";
import { KNOWN_PROVIDERS } from "../config/types.js";

interface ResolvedProvider {
  id: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

function resolveProvider(config: AppConfig, tier: AgentTier): ResolvedProvider {
  // Map AgentTier to a role for model lookup
  const tierToRole: Record<string, string> = {
    frontier: "ceo",
    mid: "vp_engineering",
    "cheap-free": "engineer",
  };
  const role = tierToRole[tier] ?? "engineer";
  const assignment = config.role_assignments?.find(r => r.role === role);
  const modelId = assignment?.primary_model || config.models?.[0]?.model_id || "";

  // Find which provider has this model
  const modelEntry = config.models?.find(m => m.model_id === modelId);
  const providerEntry = config.providers?.find(p => p.provider_id === modelEntry?.provider_id);
  const providerId = providerEntry?.provider_id || "openai";

  const known = KNOWN_PROVIDERS.find(p => p.id === providerId);
  const baseUrl = providerEntry?.base_url || known?.defaultBaseUrl || `https://api.${providerId}.com`;
  const apiKey = providerEntry?.keys?.[0]?.key_ref || process.env[`${providerId.toUpperCase()}_API_KEY`];
  return {
    id: providerId,
    baseUrl,
    model: modelId,
    apiKey,
  };
}

// ─── OpenAI-compatible (OpenAI, Groq, OpenRouter, Cerebras, etc.) ───

async function generateOpenAI(rp: ResolvedProvider, prompt: string, options?: LLMOptions): Promise<LLMResponse> {
  const url = `${rp.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = {
    model: rp.model,
    messages: [{ role: "user", content: prompt }],
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 4096,
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (rp.apiKey) headers["Authorization"] = `Bearer ${rp.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI-compatible error (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  const choice = data?.choices?.[0];
  return {
    content: choice?.message?.content ?? "",
    model: data?.model ?? rp.model,
    tokensIn: data?.usage?.prompt_tokens ?? 0,
    tokensOut: data?.usage?.completion_tokens ?? 0,
    cost: 0,
  };
}

// ─── Anthropic ───

async function generateAnthropic(rp: ResolvedProvider, prompt: string, options?: LLMOptions): Promise<LLMResponse> {
  const url = `${rp.baseUrl.replace(/\/+$/, "")}/messages`;
  const body = {
    model: rp.model,
    max_tokens: options?.maxTokens ?? 4096,
    messages: [{ role: "user", content: prompt }],
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": rp.apiKey || "",
    "anthropic-version": "2023-06-01",
  };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic error (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  return {
    content: data?.content?.[0]?.text ?? "",
    model: data?.model ?? rp.model,
    tokensIn: data?.usage?.input_tokens ?? 0,
    tokensOut: data?.usage?.output_tokens ?? 0,
    cost: 0,
  };
}

// ─── Google AI Studio ───

async function generateGoogle(rp: ResolvedProvider, prompt: string, options?: LLMOptions): Promise<LLMResponse> {
  const key = rp.apiKey || process.env.GOOGLE_API_KEY || "";
  const url = `${rp.baseUrl.replace(/\/+$/, "")}/models/${rp.model}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: options?.maxTokens ?? 4096,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options?.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google error (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  return {
    content: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    model: rp.model,
    tokensIn: data?.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data?.usageMetadata?.candidatesTokenCount ?? 0,
    cost: 0,
  };
}

// ─── Factory ───

export function createLLMForConfig(config: AppConfig, tier: AgentTier): LLMProvider {
  const rp = resolveProvider(config, tier);
  const generate = async (prompt: string, options?: LLMOptions): Promise<LLMResponse> => {
    switch (rp.id) {
      case "anthropic":
        return generateAnthropic(rp, prompt, options);
      case "google":
        return generateGoogle(rp, prompt, options);
      default:
        // OpenAI-compatible (openai, groq, openrouter, cerebras, custom)
        return generateOpenAI(rp, prompt, options);
    }
  };
  return {
    name: rp.id,
    tier,
    generate,
  };
}

import { loadConfig } from "../onboarding/storage.js";
const _existingConfig = loadConfig();
const _defaultConfig: AppConfig = _existingConfig ?? {
  user_profile: { persona: "exploring", intents: [], control_level: "guided", created_at: "", onboarding_step_completed: 0 },
  providers: [{ provider_id: "openai", keys: [], base_url: "https://api.openai.com/v1" }],
  models: [{ model_id: "gpt-3.5-turbo", provider_id: "openai", is_custom_entry: false, pinned: false, context_window: null, max_output: null }],
  role_assignments: [
    { role: "ceo", primary_model: "gpt-3.5-turbo", fallback_chain: [], effort: "high" },
    { role: "vp_engineering", primary_model: "gpt-3.5-turbo", fallback_chain: [], effort: "medium" },
    { role: "engineer", primary_model: "gpt-3.5-turbo", fallback_chain: [], effort: "low" },
  ],
};

export function createLLMProvider(tier: AgentTier): LLMProvider {
  return createLLMForConfig(_defaultConfig, tier);
}
