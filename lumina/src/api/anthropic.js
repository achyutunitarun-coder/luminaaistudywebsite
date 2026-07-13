import Anthropic from '@anthropic-ai/sdk';
import { Provider } from './providers.js';

const ANTHROPIC_MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
  'claude-3-sonnet-20240229',
];

export class AnthropicProvider extends Provider {
  constructor(config) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  async validateKey() {
    try {
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      });
      return true;
    } catch (err) {
      if (err.status === 401) throw new Error(err.message);
      return true;
    }
  }

  async listModels() {
    return ANTHROPIC_MODELS;
  }

  async chat(messages, options = {}) {
    this.abortController = new AbortController();
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    const stream = await this.client.messages.create({
      model: options.model || this.config.defaultModel,
      max_tokens: options.maxTokens || (this.config.tokenBudget === 'unlimited' ? 4096 : this.config.tokenBudget),
      system: systemMsg?.content || undefined,
      messages: chatMessages,
      stream: true,
    });

    let full = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        if (options.onToken) options.onToken(event.delta.text);
        full += event.delta.text;
      }
    }
    return full;
  }
}
