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

const API_BASE = (import.meta.env.VITE_OLLAMA_API_BASE || "/api").replace(/\/$/, "");
const DEFAULT_MODEL = import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5-coder:3b";
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_OLLAMA_TIMEOUT_MS || 45000);

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
  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string") {
      return record.error;
    }
    if (typeof record.message === "string") {
      return record.message;
    }
  }

  return fallback;
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/ai`, { method: "GET" });
    const payload = await response.json();

    if (!response.ok) {
      throw new OllamaError(
        normalizeErrorMessage(payload, "Ollama is unavailable."),
        response.status,
        payload?.code || "OLLAMA_UNAVAILABLE"
      );
    }

    return {
      available: true,
      model: payload.model || DEFAULT_MODEL,
      message: payload.message || "Ollama is ready.",
      details: payload.details,
    };
  } catch (error) {
    if (error instanceof OllamaError) {
      return {
        available: false,
        model: DEFAULT_MODEL,
        message: error.message,
        details: error.code,
      };
    }

    if (error instanceof Error && error.name === "AbortError") {
      return {
        available: false,
        model: DEFAULT_MODEL,
        message: "The request timed out while contacting Ollama.",
        details: "REQUEST_TIMEOUT",
      };
    }

    return {
      available: false,
      model: DEFAULT_MODEL,
      message: error instanceof Error ? error.message : "Unable to reach Ollama.",
      details: "NETWORK_ERROR",
    };
  }
}

export async function generateResponse(prompt: string, options?: { model?: string }) {
  const model = options?.model || DEFAULT_MODEL;
  const response = await fetchWithTimeout(`${API_BASE}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model, stream: false }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new OllamaError(
      normalizeErrorMessage(payload, "The generation request failed."),
      response.status,
      payload?.code || "GENERATION_FAILED"
    );
  }

  return {
    text: payload.text || payload.reply || "",
    model: payload.model || model,
  } satisfies OllamaResponse;
}

export async function streamResponse(
  prompt: string,
  onToken?: (token: string) => void,
  options?: { model?: string; signal?: AbortSignal }
): Promise<OllamaResponse> {
  const model = options?.model || DEFAULT_MODEL;
  const response = await fetchWithTimeout(
    `${API_BASE}/ai`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model, stream: true }),
    },
    REQUEST_TIMEOUT_MS
  );

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}));
    throw new OllamaError(
      normalizeErrorMessage(payload, "The streaming request failed."),
      response.status,
      payload?.code || "STREAM_FAILED"
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    if (options?.signal?.aborted) {
      reader.cancel();
      throw new OllamaError("Generation stopped by the user.", 499, "ABORTED");
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() || "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) {
        continue;
      }

      const payload = line.replace(/^data:\s*/, "");
      if (!payload) {
        continue;
      }

      try {
        const parsed = JSON.parse(payload) as { text?: string; done?: boolean; error?: string };
        if (parsed.error) {
          throw new OllamaError(parsed.error, 502, "STREAM_ERROR");
        }

        if (typeof parsed.text === "string" && parsed.text.length) {
          text += parsed.text;
          onToken?.(parsed.text);
        }
      } catch (error) {
        if (error instanceof OllamaError) {
          throw error;
        }
      }
    }
  }

  if (buffer) {
    const payload = buffer.replace(/^data:\s*/, "").trim();
    if (payload) {
      try {
        const parsed = JSON.parse(payload) as { text?: string };
        if (typeof parsed.text === "string") {
          text += parsed.text;
          onToken?.(parsed.text);
        }
      } catch {
        // ignore malformed trailing data
      }
    }
  }

  return { text, model };
}
