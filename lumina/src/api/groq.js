import Groq from 'groq-sdk';
import { Provider } from './providers.js';

export class GroqProvider extends Provider {
  constructor(config) {
    super(config);
    this.client = new Groq({
      apiKey: config.apiKey,
    });
  }

  async validateKey() {
    try {
      await this.client.models.list();
      return true;
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async listModels() {
    const response = await this.client.models.list();
    return response.data.map(m => m.id).sort();
  }

  async chat(messages, options = {}) {
    this.abortController = new AbortController();
    const stream = await this.client.chat.completions.create({
      model: options.model || this.config.defaultModel,
      messages,
      stream: true,
      max_tokens: options.maxTokens || (this.config.tokenBudget === 'unlimited' ? 4096 : this.config.tokenBudget),
    });

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta && options.onToken) {
        options.onToken(delta);
      }
      full += delta;
    }
    return full;
  }
}
