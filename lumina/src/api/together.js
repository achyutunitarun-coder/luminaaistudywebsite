import { Provider } from './providers.js';

export class TogetherProvider extends Provider {
  constructor(config) {
    super(config);
    this.baseUrl = 'https://api.together.xyz/v1';
  }

  async _fetch(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
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
      await this._fetch('/models');
      return true;
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async listModels() {
    const data = await this._fetch('/models');
    return data.map(m => m.id || m.name).sort();
  }

  async chat(messages, options = {}) {
    this.abortController = new AbortController();
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
