// ════════════════════════════════════════════════════════════════════
// Client-side intent classifier + model picker. All actual HTTP goes
// through the `openrouter-proxy` edge function (server holds the key).
// ════════════════════════════════════════════════════════════════════
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openrouter-proxy`;

export type IntentType =
  | "chat" | "code" | "build" | "reason" | "research"
  | "plan" | "vision" | "data" | "agent" | "creative";
export type Complexity = "low" | "medium" | "high";
export type ModeChip =
  | "auto" | "study" | "coding" | "reasoning" | "deepDive"
  | "creative" | "fast" | "general";

const ROUTING: Record<string, string> = {
  "chat-low": "openai/gpt-oss-20b:free",
  "chat-medium": "meta-llama/llama-3.3-70b-instruct:free",
  "chat-high": "nvidia/nemotron-3-super-120b-a12b:free",
  "code": "qwen/qwen3-coder:free",
  "build": "qwen/qwen3-coder:free",
  "reason": "openai/gpt-oss-120b:free",
  "research": "nvidia/nemotron-3-super-120b-a12b:free",
  "plan": "openai/gpt-oss-120b:free",
  "creative": "nousresearch/hermes-3-llama-3.1-405b:free",
  "vision": "google/gemma-4-31b-instruct:free",
  "data": "qwen/qwen3-next-80b-a3b-instruct:free",
  "agent": "openrouter/owl-alpha",
};

const MODE_OVERRIDE: Record<ModeChip, string | null> = {
  auto: null,
  study: "meta-llama/llama-3.3-70b-instruct:free",
  coding: "qwen/qwen3-coder:free",
  reasoning: "openai/gpt-oss-120b:free",
  deepDive: "nvidia/nemotron-3-super-120b-a12b:free",
  creative: "nousresearch/hermes-3-llama-3.1-405b:free",
  fast: "openai/gpt-oss-20b:free",
  general: "meta-llama/llama-3.3-70b-instruct:free",
};

export function pickModel(opts: {
  type: IntentType;
  complexity?: Complexity;
  modeChip?: ModeChip;
}): string {
  const override = opts.modeChip ? MODE_OVERRIDE[opts.modeChip] : null;
  if (override) return override;
  if (opts.type === "chat") {
    const c = opts.complexity ?? "medium";
    return ROUTING[`chat-${c}`];
  }
  return ROUTING[opts.type] ?? ROUTING["chat-medium"];
}

async function authHeader(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token =
    session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return `Bearer ${token}`;
}

export async function classifyIntent(
  text: string,
): Promise<{ type: IntentType; complexity: Complexity }> {
  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: await authHeader() },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b:free",
        stream: false,
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content:
              'Classify this message. Return JSON only: {"type":"chat|code|build|reason|research|plan|vision|data|agent|creative","complexity":"low|medium|high"}',
          },
          { role: "user", content: text.slice(0, 1000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return {
      type: (parsed.type as IntentType) ?? "chat",
      complexity: (parsed.complexity as Complexity) ?? "medium",
    };
  } catch {
    return { type: "chat", complexity: "medium" };
  }
}

export interface StreamOpts {
  model: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  onToken: (t: string) => void;
  onMeta?: (meta: { model: string; fallback: boolean }) => void;
}

export async function streamOpenRouter(opts: StreamOpts): Promise<string> {
  const msgs = opts.systemPrompt
    ? [{ role: "system", content: opts.systemPrompt }, ...opts.messages]
    : opts.messages;

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: await authHeader() },
    body: JSON.stringify({
      model: opts.model,
      messages: msgs,
      stream: true,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let acc = "";
  let toastedFallback = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const p = JSON.parse(json);
        if (p?.lumina_meta) {
          opts.onMeta?.(p.lumina_meta);
          if (p.lumina_meta.fallback && !toastedFallback) {
            toastedFallback = true;
            toast.info("Switched to backup model", { duration: 2500 });
          }
          continue;
        }
        const delta = p?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length) {
          acc += delta;
          opts.onToken(delta);
        }
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  return acc;
}
