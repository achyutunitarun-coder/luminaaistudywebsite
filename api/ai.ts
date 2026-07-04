export const config = {
  runtime: "nodejs",
};

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:3b";
const REQUEST_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 45000);
const decoder = new TextDecoder();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeError(message: string, code: string) {
  return jsonResponse({ error: message, code }, 502);
}

async function postToOllama(payload: Record<string, unknown>, stream = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody || "Ollama request failed");
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out while waiting for Ollama.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: Request) {
  if (req.method === "GET") {
    return jsonResponse({
      ok: true,
      model: DEFAULT_MODEL,
      message: "Ollama backend is ready.",
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { prompt, model = DEFAULT_MODEL, stream = false } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return jsonResponse({ error: "A prompt is required." }, 400);
    }

    if (stream) {
      const response = await postToOllama({ model, prompt, stream: true }, true);

      const encoder = new TextEncoder();
      const streamBody = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          try {
            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split(/\n/);
              buffer = parts.pop() || "";

              for (const part of parts) {
                const line = part.trim();
                if (!line) continue;

                try {
                  const parsed = JSON.parse(line) as { response?: string; done?: boolean; error?: string };
                  if (parsed.error) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: parsed.error })}\n\n`));
                    continue;
                  }

                  if (typeof parsed.response === "string" && parsed.response.length) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.response })}\n\n`));
                  }

                  if (parsed.done) {
                    break;
                  }
                } catch {
                  // ignore malformed streaming chunks
                }
              }
            }
          } catch (error) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Streaming failed" })}\n\n`));
          } finally {
            reader.releaseLock();
            controller.close();
          }
        },
      });

      return new Response(streamBody, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const response = await postToOllama({ model, prompt, stream: false }, false);
    const payload = await response.json();

    return jsonResponse({
      text: payload?.response || "",
      model: payload?.model || model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
      return normalizeError("Ollama is not running at http://localhost:11434.", "OLLAMA_OFFLINE");
    }

    if (message.includes("model") && message.toLowerCase().includes("not found")) {
      return normalizeError(`The model ${DEFAULT_MODEL} is not installed locally.`, "MODEL_NOT_FOUND");
    }

    if (message.includes("timed out")) {
      return normalizeError("The request to Ollama timed out.", "REQUEST_TIMEOUT");
    }

    return normalizeError(message, "OLLAMA_REQUEST_FAILED");
  }
}
