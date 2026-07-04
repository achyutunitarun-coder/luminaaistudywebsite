export interface OllamaStatus {
  available: boolean;
  model: string;
  message: string;
  details?: string;
}

export interface OllamaResponse {
  text: string;
  model: string;
}

const DIRECT_OLLAMA = "http://localhost:11434";
const PROXY_BASE = (import.meta.env.VITE_OLLAMA_API_BASE || "/api").replace(/\/$/, "");
const DEFAULT_MODEL = import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5-coder:3b";
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_OLLAMA_TIMEOUT_MS || 120000);

class OllamaError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "OllamaError";
    this.status = status;
    this.code = code;
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
  }
  return fallback;
}

async function tryDirect(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${DIRECT_OLLAMA}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function getEndpoint(): Promise<string> {
  return (await tryDirect()) ? DIRECT_OLLAMA : PROXY_BASE;
}

function getChatUrl(endpoint: string): string {
  return endpoint === DIRECT_OLLAMA ? `${DIRECT_OLLAMA}/api/generate` : `${PROXY_BASE}/ai`;
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${DIRECT_OLLAMA}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const models = data?.models || [];
      const loaded = models.some((m: any) => m.name === DEFAULT_MODEL);
      return {
        available: true,
        model: DEFAULT_MODEL,
        message: loaded ? "Ready" : `Run: ollama pull ${DEFAULT_MODEL}`,
        details: loaded ? "direct" : "model_not_found",
      };
    }
    return { available: false, model: DEFAULT_MODEL, message: "Ollama responded but with an error.", details: "RESPONSE_ERROR" };
  } catch {
    return { available: false, model: DEFAULT_MODEL, message: "Cannot reach Ollama at localhost:11434. Make sure it's running with OLLAMA_ORIGINS=*", details: "CONNECTION_REFUSED" };
  }
}

export async function generateResponse(prompt: string, options?: { model?: string }) {
  const model = options?.model || DEFAULT_MODEL;
  const endpoint = await getEndpoint();

  if (endpoint === DIRECT_OLLAMA) {
    const res = await fetchWithTimeout(`${DIRECT_OLLAMA}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, temperature: 0.3 }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new OllamaError(`Ollama error: ${err}`, res.status, "GENERATION_FAILED");
    }
    const data = await res.json();
    return { text: data.response || "", model: data.model || model } satisfies OllamaResponse;
  }

  const response = await fetchWithTimeout(`${PROXY_BASE}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model, stream: false }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new OllamaError(normalizeErrorMessage(payload, "Generation failed."), response.status, payload?.code || "GENERATION_FAILED");
  return { text: payload.text || payload.reply || "", model: payload.model || model } satisfies OllamaResponse;
}

export async function streamResponse(
  prompt: string,
  onToken?: (token: string) => void,
  options?: { model?: string; signal?: AbortSignal }
): Promise<OllamaResponse> {
  const model = options?.model || DEFAULT_MODEL;
  const endpoint = await getEndpoint();
  const isDirect = endpoint === DIRECT_OLLAMA;

  const body = isDirect
    ? JSON.stringify({ model, prompt, stream: true, temperature: 0.3 })
    : JSON.stringify({ prompt, model, stream: true });

  const response = await fetchWithTimeout(
    isDirect ? `${DIRECT_OLLAMA}/api/generate` : `${PROXY_BASE}/ai`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body },
    REQUEST_TIMEOUT_MS
  );

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}));
    throw new OllamaError(normalizeErrorMessage(payload, "Streaming request failed."), response.status, payload?.code || "STREAM_FAILED");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    if (options?.signal?.aborted) {
      reader.cancel();
      throw new OllamaError("Generation stopped.", 499, "ABORTED");
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    if (isDirect) {
      // Direct Ollama API: newline-delimited JSON
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as { response?: string; done?: boolean; error?: string };
          if (parsed.error) throw new OllamaError(parsed.error, 502, "STREAM_ERROR");
          if (typeof parsed.response === "string" && parsed.response.length) {
            text += parsed.response;
            onToken?.(parsed.response);
          }
        } catch (error) {
          if (error instanceof OllamaError) throw error;
        }
      }
    } else {
      // Proxy SSE: data: {...}\n\n
      const parts = buffer.split(/\n\n/);
      buffer = parts.pop() || "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.replace(/^data:\s*/, "");
        if (!payload) continue;
        try {
          const parsed = JSON.parse(payload) as { text?: string; done?: boolean; token?: string; error?: string };
          if (parsed.error) throw new OllamaError(parsed.error, 502, "STREAM_ERROR");
          const chunk = parsed.token || parsed.text;
          if (typeof chunk === "string" && chunk.length) {
            text += chunk;
            onToken?.(chunk);
          }
        } catch (error) {
          if (error instanceof OllamaError) throw error;
        }
      }
    }
  }

  return { text, model };
}
