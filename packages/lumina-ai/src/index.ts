// AI Provider abstraction
export interface AIRequest {
  system: string;
  messages: AIMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  maxRetries?: number;
  cacheable?: boolean;
  provider?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface AIResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface AIChunk {
  content: string;
  finishReason?: string;
}

export interface AIProvider {
  complete(request: AIRequest): Promise<AIResponse>;
  stream(request: AIRequest): AsyncIterableIterator<AIChunk>;
  estimateTokens(text: string): number;
}

// OpenRouter provider (default)
export class OpenRouterProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://openrouter.ai/api/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const res = await this.fetchChat(request, false);
    const data = await res.json();
    return this.parseResponse(data);
  }

  async *stream(request: AIRequest): AsyncIterableIterator<AIChunk> {
    const res = await this.fetchChat(request, true);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield { content: delta, finishReason: parsed.choices?.[0]?.finish_reason };
          }
          if (parsed.choices?.[0]?.finish_reason && parsed.choices[0].finish_reason !== 'stop') {
            yield { content: '', finishReason: parsed.choices[0].finish_reason };
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async fetchChat(request: AIRequest, stream: boolean): Promise<Response> {
    const body: any = {
      model: request.model || 'openrouter/owl-alpha',
      messages: [{ role: 'system', content: request.system }, ...request.messages],
      max_tokens: request.maxTokens || 16000,
      temperature: request.temperature ?? 0.15,
      top_p: request.topP ?? 0.95,
      frequency_penalty: request.frequencyPenalty ?? 0.1,
      presence_penalty: request.presencePenalty ?? 0.2,
      stream,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://luminaai.co.in',
        'X-Title': 'Lumina Code',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${err.slice(0, 200)}`);
    }

    return res;
  }

  private parseResponse(data: any): AIResponse {
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content || '',
      finishReason: choice?.finish_reason || 'stop',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      model: data.model || 'unknown',
    };
  }
}

// AI Router with retry and caching
export class AIRouter {
  private provider: AIProvider;
  private cache = new Map<string, AIResponse>();
  private requestCount = 0;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    // Check cache
    if (request.cacheable !== false) {
      const key = this.cacheKey(request);
      const cached = this.cache.get(key);
      if (cached) return cached;
    }

    // Execute with retry
    const response = await this.withRetry(request);

    // Cache
    if (request.cacheable !== false) {
      const key = this.cacheKey(request);
      this.cache.set(key, response);
    }

    this.requestCount++;
    return response;
  }

  async *stream(request: AIRequest): AsyncIterableIterator<AIChunk> {
    yield* this.provider.stream(request);
  }

  private async withRetry(request: AIRequest, attempt = 0): Promise<AIResponse> {
    const maxRetries = request.maxRetries ?? 2;
    try {
      return await this.provider.complete(request);
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        return this.withRetry(request, attempt + 1);
      }
      throw error;
    }
  }

  private cacheKey(request: AIRequest): string {
    return `${request.model}:${request.system.slice(0, 100)}:${JSON.stringify(request.messages.slice(-3))}`;
  }

  getRequestCount(): number {
    return this.requestCount;
  }
}
