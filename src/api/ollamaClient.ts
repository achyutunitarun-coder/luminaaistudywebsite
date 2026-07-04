const API_BASE = import.meta.env.VITE_OLLAMA_API_BASE || "/api/ai";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function checkStatus(): Promise<{
  healthy: boolean;
  message: string;
  modelLoaded: boolean;
}> {
  try {
    const res = await fetch(API_BASE, { method: "GET" });
    if (!res.ok) {
      return {
        healthy: false,
        message: `Status check failed (${res.status})`,
        modelLoaded: false,
      };
    }
    const data = await res.json();
    // Normalize responses from both Vite proxy and Vercel serverless
    if (data.healthy !== undefined) return data;
    return {
      healthy: data.ok === true,
      message: data.message || (data.ok ? "Ready" : "Not ready"),
      modelLoaded: data.ok === true,
    };
  } catch {
    return {
      healthy: false,
      message: "Backend not reachable",
      modelLoaded: false,
    };
  }
}

export async function* streamChat(
  prompt: string,
  temperature: number = 0.3
): AsyncGenerator<string, void, unknown> {
  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, temperature, stream: true }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    if (!res.body) {
      throw new Error("No response body");
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
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") return;

        try {
          const json = JSON.parse(data);
          if (json.error) throw new Error(json.error);
          if (json.token) yield json.token;
          else if (json.text) yield json.text;
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }
  } catch (error) {
    throw error;
  }
}

export async function generateResponse(
  prompt: string,
  temperature: number = 0.3
): Promise<string> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, temperature, stream: false }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.text || data.response || "";
}
