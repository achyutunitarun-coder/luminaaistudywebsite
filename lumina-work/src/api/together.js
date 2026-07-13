import { Provider } from './providers.js';

export class TogetherProvider extends Provider {
  constructor(config) {
    super(config);
    this.baseUrl = 'https://api.together.xyz/v1';
  }

  async _f(path, opts = {}) {
    const r = await fetch(this.baseUrl + path, {
      headers: { 'Authorization': 'Bearer ' + this.config.apiKey, 'Content-Type': 'application/json' },
      ...opts
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async validateKey() {
    try { await this._f('/models'); return true; }
    catch (err) { throw new Error(err.message); }
  }

  async listModels() {
    const d = await this._f('/models');
    return d.map(m => m.id || m.name).sort();
  }

  async chat(messages, opts = {}) {
    this.abortController = new AbortController();
    const r = await fetch(this.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + this.config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model || this.config.departments?.ceo?.model,
        messages, stream: true,
        max_tokens: opts.maxTokens || 512
      }),
      signal: this.abortController.signal
    });
    if (!r.ok) throw new Error(await r.text());
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let full = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data: ')) continue;
        const d = t.slice(6);
        if (d === '[DONE]') continue;
        try {
          const p = JSON.parse(d);
          const delta = p.choices?.[0]?.delta?.content || '';
          if (delta && opts.onToken) opts.onToken(delta);
          full += delta;
        } catch {}
      }
    }
    return full;
  }
}
