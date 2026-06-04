export type LuminaMeta = {
  model?: string;
  mode?: string;
};

type StreamOptions = {
  onDelta?: (chunk: string) => void;
  onMeta?: (meta: LuminaMeta) => void;
};

function parseSseLine(rawLine: string, options: StreamOptions): 'continue' | 'done' | 'retry' {
  let line = rawLine;
  if (line.endsWith('\r')) line = line.slice(0, -1);
  if (line.startsWith(':') || line.trim() === '') return 'continue';
  if (!line.startsWith('data: ')) return 'continue';

  const jsonStr = line.slice(6).trim();
  if (jsonStr === '[DONE]') return 'done';

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed?.lumina_meta) {
      options.onMeta?.(parsed.lumina_meta);
      return 'continue';
    }

    const content = parsed?.choices?.[0]?.delta?.content;
    if (typeof content === 'string' && content) {
      options.onDelta?.(content);
    }
    return 'continue';
  } catch {
    return 'retry';
  }
}

export async function streamSSE(resp: Response, options: StreamOptions = {}) {
  if (!resp.body) throw new Error('No response stream');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamDone = false;

  const processBuffer = () => {
    let newlineIndex: number;

    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      const result = parseSseLine(line, options);
      if (result === 'done') {
        streamDone = true;
        return;
      }

      if (result === 'retry') {
        buffer = `${line}\n${buffer}`;
        return;
      }
    }
  };

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    processBuffer();
  }

  buffer += decoder.decode();

  if (!streamDone && buffer.trim()) {
    const leftover = buffer;
    buffer = '';

    for (const rawLine of leftover.split('\n')) {
      const result = parseSseLine(rawLine, options);
      if (result === 'done') break;
    }
  }
}

export function createBufferedTextAccumulator(
  onFlush: (text: string) => void,
  flushMs = 16,
) {
  let fullText = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let frame: number | null = null;
  let lastFlushedLength = 0;

  const emit = () => {
    frame = null;
    if (fullText.length === lastFlushedLength) return;
    lastFlushedLength = fullText.length;
    onFlush(fullText);
  };

  const flush = () => {
    timer = null;
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(emit);
      return;
    }

    emit();
  };

  return {
    push(chunk: string) {
      if (!chunk) return;
      fullText += chunk;
      if (timer !== null) return;
      timer = setTimeout(flush, flushMs);
    },
    flushNow() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (frame !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
      emit();
    },
    getText() {
      return fullText;
    },
  };
}