export interface OllamaConnectionStatus {
  connected: boolean;
  modelReady: boolean;
  message: string;
}

export interface OllamaResponse {
  text: string;
  model: string;
  toolCalls?: OllamaToolCall[];
}

export interface OllamaToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OllamaChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_call_id?: string;
}

const OLLAMA_URLS = ["http://127.0.0.1:11434", "http://localhost:11434"];
const DEFAULT_MODEL = "qwen2.5-coder:3b";
const REQUEST_TIMEOUT_MS = 120000;

const NUM_CTX = 32768;
const TEMPERATURE = 0.1;

const TOOLS: OllamaTool[] = [
  {
    type: "function",
    function: {
      name: "create_artifact",
      description: "Generate a structured study artifact: notes, exam, slides, or code. Use when the user asks to create, generate, make, or write study materials.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["notes", "exam", "slides", "code"],
            description: "Type of artifact to generate",
          },
          topic: {
            type: "string",
            description: "The topic or subject for the artifact",
          },
          content: {
            type: "string",
            description: "The full content/markdown of the artifact",
          },
        },
        required: ["type", "topic", "content"],
      },
    },
  },
];

function buildSystemPrompt(): string {
  return `You are Lumina, a brilliant study AI tutor. Be concise, use markdown formatting.

You have access to tools. When the user asks to create study materials (notes, exams, slides, code), use the \`create_artifact\` tool.

Otherwise, respond conversationally with helpful explanations. Use markdown for formatting.`;
}

function buildMessages(history: { role: string; content: string; tool_calls?: OllamaToolCall[]; tool_call_id?: string }[]): OllamaChatMessage[] {
  const msgs: OllamaChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
  ];
  for (const m of history) {
    if (m.role === "user" || m.role === "assistant" || m.role === "tool") {
      const msg: OllamaChatMessage = { role: m.role as OllamaChatMessage["role"], content: m.content };
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      msgs.push(msg);
    }
  }
  return msgs;
}

function buildRequestBody(messages: OllamaChatMessage[], stream: boolean, tools?: OllamaTool[]) {
  const body: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    messages,
    stream,
    options: {
      num_ctx: NUM_CTX,
      temperature: TEMPERATURE,
    },
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }
  return JSON.stringify(body);
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const signal = init.signal
    ? anySignal([init.signal, controller.signal])
    : controller.signal;
  try {
    return await fetch(input, { ...init, signal });
  } catch (err) {
    console.error(`[Ollama] fetchWithTimeout ${input}:`, (err as Error)?.message || err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

async function ollamaFetch(path: string, init?: RequestInit, timeoutMs?: number) {
  const errors: string[] = [];
  for (const base of OLLAMA_URLS) {
    try {
      return await fetchWithTimeout(`${base}${path}`, init, timeoutMs);
    } catch (err) {
      errors.push(`${base}: ${(err as Error)?.message || err}`);
      continue;
    }
  }
  const msg = `Cannot reach Ollama at any address. Errors: ${errors.join("; ")}`;
  console.error("[Ollama]", msg);
  throw new Error(msg);
}

async function tryFetchTags(url: string, signal: AbortSignal): Promise<Response | null> {
  try {
    const res = await fetch(url, { mode: "cors", signal });
    return res;
  } catch (err) {
    console.error(`[Ollama] ${url}:`, (err as Error)?.message || err);
    return null;
  }
}

export async function checkConnection(): Promise<OllamaConnectionStatus> {
  const urls = [
    "http://127.0.0.1:11434/api/tags",
    "http://localhost:11434/api/tags",
  ];

  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await tryFetchTags(url, controller.signal);
    clearTimeout(timeout);

    if (res && res.ok) {
      try {
        const data = await res.json();
        const models: { name: string }[] = data?.models || [];
        const hasModel = models.some((m) => m.name === DEFAULT_MODEL);
        return {
          connected: true,
          modelReady: hasModel,
          message: hasModel ? "Ready" : `Run: ollama pull ${DEFAULT_MODEL}`,
        };
      } catch (err) {
        console.error("[Ollama] failed to parse /api/tags response:", (err as Error)?.message || err);
        return { connected: true, modelReady: false, message: "Connected but could not parse model list." };
      }
    } else if (res) {
      console.warn(`[Ollama] ${url} returned status ${res.status}`);
    }
  }

  return { connected: false, modelReady: false, message: "Cannot reach Ollama. Make sure it's running with OLLAMA_ORIGINS=*" };
}

export async function healthCheckToolCall(): Promise<boolean> {
  try {
    const messages: OllamaChatMessage[] = [
      { role: "system", content: "You have access to tools. Respond with a tool call." },
      { role: "user", content: "Say hello by calling the test tool." },
    ];
    const res = await ollamaFetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buildRequestBody(messages, false, TOOLS),
    }, 15000);
    if (!res.ok) return false;
    const data = await res.json();
    const toolCalls = data?.message?.tool_calls;
    return Array.isArray(toolCalls) && toolCalls.length > 0;
  } catch {
    return false;
  }
}

export async function streamChat(
  history: { role: string; content: string }[],
  onToken?: (token: string) => void,
  options?: { signal?: AbortSignal; tools?: OllamaTool[] },
): Promise<OllamaResponse> {
  const messages = buildMessages(history);
  const useTools = options?.tools ?? TOOLS;

  const response = await ollamaFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: buildRequestBody(messages, true, useTools),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama /api/chat error (${response.status}): ${text.slice(0, 200)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let toolCalls: OllamaToolCall[] | undefined;

  try {
    while (true) {
      if (options?.signal?.aborted) {
        throw Object.assign(new Error("Aborted"), { name: "AbortError" });
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.error) throw new Error(parsed.error);

          const delta = parsed.message;
          if (delta) {
            if (delta.content) {
              text += delta.content;
              onToken?.(delta.content);
            }
            if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
              toolCalls = delta.tool_calls.map((tc: any, i: number) => ({
                id: tc.id || `call_${i}`,
                type: "function" as const,
                function: {
                  name: tc.function?.name || "",
                  arguments: tc.function?.arguments || "{}",
                },
              }));
            }
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            buffer = trimmed + "\n" + buffer;
          } else {
            throw e;
          }
        }
      }
    }
  } finally {
    try { reader.cancel(); } catch { /* reader already closed */ }
  }

  return { text, model: DEFAULT_MODEL, toolCalls };
}

export async function chatOnce(
  history: { role: string; content: string }[],
  options?: { signal?: AbortSignal; tools?: OllamaTool[] },
): Promise<OllamaResponse> {
  const messages = buildMessages(history);
  const useTools = options?.tools ?? TOOLS;

  const response = await ollamaFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: buildRequestBody(messages, false, useTools),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama /api/chat error (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const msg = data?.message || {};
  let text = typeof msg.content === "string" ? msg.content : "";
  let toolCalls: OllamaToolCall[] | undefined;

  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    toolCalls = msg.tool_calls.map((tc: any, i: number) => ({
      id: tc.id || `call_${i}`,
      type: "function" as const,
      function: {
        name: tc.function?.name || "",
        arguments: tc.function?.arguments || "{}",
      },
    }));
  }

  return { text, model: DEFAULT_MODEL, toolCalls };
}

export function extractToolCallFromText(text: string): OllamaToolCall | null {
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.name || parsed.function?.name) {
      return {
        id: `call_extracted_${Date.now()}`,
        type: "function",
        function: {
          name: parsed.name || parsed.function?.name || "",
          arguments: JSON.stringify(parsed.arguments || parsed.parameters || parsed),
        },
      };
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

export const MODEL_NAME = DEFAULT_MODEL;
export { TOOLS };
