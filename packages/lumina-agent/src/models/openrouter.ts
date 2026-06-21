const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ModelResponse {
  choices: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        id?: string;
        type?: 'function';
        function?: { name?: string; arguments?: string };
      }>;
    };
    message?: {
      content?: string;
      tool_calls?: ToolCall[];
    };
  }>;
  usage?: { total_tokens: number };
}

export async function callModel(
  apiKey: string,
  model: string,
  messages: Message[],
  tools?: object[],
  onChunk?: (text: string) => void,
): Promise<{ content: string; toolCalls: ToolCall[]; tokens: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://luminaai.co.in',
    'X-Title': 'Lumina Code',
  };

  // Try primary key, fall back to env
  const keys = [apiKey, ...(process.env.OPENROUTER_API_KEY ? [process.env.OPENROUTER_API_KEY] : [])].filter(Boolean);
  
  for (const key of keys) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { ...headers, Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: messages.map(m => {
            if (m.role === 'tool') {
              return { role: 'tool' as const, content: m.content, tool_call_id: m.tool_call_id };
            }
            return { role: m.role as 'system' | 'user' | 'assistant', content: m.content };
          }),
          tools: tools || undefined,
          stream: true,
          max_tokens: 32000,
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        console.error(`Model ${model} error ${res.status}: ${err.slice(0, 200)}`);
        continue;
      }

      const reader = res.body?.getReader();
      if (!reader) continue;

      const decoder = new TextDecoder();
      let buf = '';
      let content = '';
      let toolCalls: ToolCall[] = [];
      let tokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') continue;
          try {
            const parsed: ModelResponse = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              content += delta.content;
              onChunk?.(delta.content);
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = toolCalls.length;
                if (!toolCalls[idx]) {
                  toolCalls[idx] = { id: tc.id || '', type: 'function', function: { name: tc.function?.name || '', arguments: '' } };
                }
                if (tc.function?.arguments) {
                  toolCalls[idx].function.arguments += tc.function.arguments;
                }
              }
            }
            if (parsed.usage?.total_tokens) tokens = parsed.usage.total_tokens;
          } catch { /* skip malformed */ }
        }
      }

      if (content || toolCalls.length > 0) {
        return { content, toolCalls, tokens };
      }
    } catch (e) {
      console.error(`Model ${model} failed:`, e);
      continue;
    }
  }

  throw new Error('All models failed');
}
