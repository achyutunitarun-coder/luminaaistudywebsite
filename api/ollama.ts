export const config = {
  runtime: "nodejs",
};

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:3b";
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || "120000");

export interface OllamaGenerateRequest {
  prompt: string;
  model?: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export async function checkOllamaStatus(): Promise<{
  healthy: boolean;
  message: string;
  modelLoaded: boolean;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { healthy: false, message: "Ollama API returned error", modelLoaded: false };
    }

    const data = await res.json();
    const models = data?.models || [];
    const modelLoaded = models.some((m: any) => m.name === OLLAMA_MODEL);

    if (!modelLoaded) {
      return {
        healthy: true,
        message: `Model ${OLLAMA_MODEL} not loaded. Run: ollama pull ${OLLAMA_MODEL}`,
        modelLoaded: false,
      };
    }

    return { healthy: true, message: "Ready", modelLoaded: true };
  } catch (error) {
    return {
      healthy: false,
      message: `Ollama not reachable at ${OLLAMA_URL}. Start Ollama first: ollama serve`,
      modelLoaded: false,
    };
  }
}

export async function generateResponse(
  prompt: string,
  options?: { temperature?: number; topP?: number }
): Promise<string> {
  const status = await checkOllamaStatus();
  if (!status.healthy || !status.modelLoaded) {
    throw new Error(status.message);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        temperature: options?.temperature ?? 0.3,
        top_p: options?.topP ?? 0.9,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Ollama error ${res.status}: ${error}`);
    }

    const data = (await res.json()) as OllamaGenerateResponse;
    return data.response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Ollama request timed out after ${OLLAMA_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

export async function* streamResponse(
  prompt: string,
  options?: { temperature?: number; topP?: number }
): AsyncGenerator<string, void, unknown> {
  const status = await checkOllamaStatus();
  if (!status.healthy || !status.modelLoaded) {
    throw new Error(status.message);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: true,
        temperature: options?.temperature ?? 0.3,
        top_p: options?.topP ?? 0.9,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}`);
    }

    if (!res.body) {
      throw new Error("No response body from Ollama");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line) as OllamaGenerateResponse;
          if (json.response) {
            yield json.response;
          }
        } catch {
          // Ignore JSON parse errors for malformed lines
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Ollama request timed out after ${OLLAMA_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}
