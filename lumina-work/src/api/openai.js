import OpenAI from 'openai';
import { Provider } from './providers.js';

export class OpenAIProvider extends Provider {
  constructor(config) {
    super(config);
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl || undefined });
  }

  async validateKey() {
    try { await this.client.models.list(); return true; }
    catch (err) { throw new Error(err.message); }
  }

  async listModels() {
    const r = await this.client.models.list();
    return r.data.filter(m => m.id.startsWith('gpt') || m.id.startsWith('o1') || m.id.startsWith('o3')).map(m => m.id).sort();
  }

  async chat(messages, opts = {}) {
    this.abortController = new AbortController();
    const stream = await this.client.chat.completions.create({
      model: opts.model || this.config.departments?.ceo?.model,
      messages, stream: true,
      max_tokens: opts.maxTokens || 512,
      signal: this.abortController.signal
    });
    let full = '';
    for await (const chunk of stream) {
      const d = chunk.choices?.[0]?.delta?.content || '';
      if (d && opts.onToken) opts.onToken(d);
      full += d;
    }
    return full;
  }
}
