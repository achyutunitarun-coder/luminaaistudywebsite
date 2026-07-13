import Anthropic from '@anthropic-ai/sdk';
import { Provider } from './providers.js';

const MODELS = ['claude-3-5-sonnet-20241022','claude-3-5-haiku-20241022','claude-3-opus-20240229','claude-3-haiku-20240307'];

export class AnthropicProvider extends Provider {
  constructor(config) {
    super(config);
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async validateKey() {
    try {
      await this.client.messages.create({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] });
      return true;
    } catch (err) { if (err.status === 401) throw new Error(err.message); return true; }
  }

  async listModels() { return MODELS; }

  async chat(messages, opts = {}) {
    this.abortController = new AbortController();
    const sys = messages.find(m => m.role === 'system');
    const chat = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    const stream = await this.client.messages.create({
      model: opts.model || this.config.departments?.ceo?.model,
      max_tokens: opts.maxTokens || 512,
      system: sys?.content || undefined,
      messages: chat, stream: true
    });
    let full = '';
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta?.text) {
        if (opts.onToken) opts.onToken(ev.delta.text);
        full += ev.delta.text;
      }
    }
    return full;
  }
}
