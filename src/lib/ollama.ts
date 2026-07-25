const OLLAMA_API_URL = import.meta.env.VITE_OLLAMA_API_URL || '/api/ai';
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'qwen2.5-coder:3b';

export type OllamaStatus = {
  status: 'ok' | 'error';
  ollamaRunning: boolean;
  modelAvailable: boolean;
  currentModel: string;
  availableModels: string[];
  message?: string;
};

export type StreamCallbacks = {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
};

let abortController: AbortController | null = null;

export function getModel(): string {
  return OLLAMA_MODEL;
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  try {
    const resp = await fetch(`${OLLAMA_API_URL}/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return {
        status: 'error',
        ollamaRunning: false,
        modelAvailable: false,
        currentModel: OLLAMA_MODEL,
        availableModels: [],
        message: data.message || 'Ollama is not running',
      };
    }
    return await resp.json();
  } catch {
    return {
      status: 'error',
      ollamaRunning: false,
      modelAvailable: false,
      currentModel: OLLAMA_MODEL,
      availableModels: [],
      message: 'Cannot reach Ollama server. Make sure it is running on your machine.',
    };
  }
}

export async function generateResponse(prompt: string): Promise<string> {
  const resp = await fetch(`${OLLAMA_API_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model: OLLAMA_MODEL }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with status ${resp.status}`);
  }
  const data = await resp.json();
  return data.response;
}

export function stopGeneration(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

export async function streamResponse(
  prompt: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  stopGeneration();
  abortController = new AbortController();
  const effectiveSignal = signal || abortController.signal;

  try {
    const resp = await fetch(`${OLLAMA_API_URL}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model: OLLAMA_MODEL }),
      signal: effectiveSignal,
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      callbacks.onError(data.error || `Request failed with status ${resp.status}`);
      return;
    }

    if (!resp.body) {
      callbacks.onError('No response body received');
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const ev of events) {
        for (const line of ev.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              callbacks.onError(data.error);
              return;
            }
            if (data.token) {
              callbacks.onToken(data.token);
            }
            if (data.done) {
              callbacks.onDone();
              return;
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    }

    callbacks.onDone();
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      callbacks.onDone();
      return;
    }
    callbacks.onError((err as Error).message || 'Connection failed');
  } finally {
    abortController = null;
  }
}

export { OLLAMA_API_URL, OLLAMA_MODEL };
