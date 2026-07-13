import { Provider } from './providers.js';

export class CustomProvider extends Provider {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl?.replace(/\/+$/, '');
  }

  async _fetch(path, options = {}) {
    const url = this.baseUrl ? `${this.baseUrl}${path}` : path;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      ...options
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }
    return response.json();
  }

  async validateKey() {
    try {
      if (this.baseUrl) {
        await this._fetch('/models');
      }
      return true;
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async listModels() {
    if (this.baseUrl) {
      try {
        const data = await this._fetch('/models');
        if (data.data) return data.data.map(m => m.id || m.name).sort();
        if (Array.isArray(data)) return data.map(m => m.id || m.name).sort();
        return Object.values(data).filter(v => typeof v === 'string').sort();
      } catch {}
    }
    return this.config.availableModels || ['custom-model'];
  }

  async chat(messages, options = {}) {
    this.abortController = new AbortController();
    const url = this.baseUrl ? `${this.baseUrl}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || this.config.defaultModel,
        messages,
        stream: true,
        max_tokens: options.maxTokens || (this.config.tokenBudget === 'unlimited' ? 4096 : this.config.tokenBudget),
      }),
      signal: this.abortController.signal
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
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
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta && options.onToken) {
            options.onToken(delta);
          }
          full += delta;
        } catch {}
      }
    }
    return full;
  }
}
