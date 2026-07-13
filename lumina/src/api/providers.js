import { encode } from 'gpt-tokenizer';

export class Provider {
  constructor(config) {
    this.config = config;
    this.abortController = null;
  }

  async validateKey() {
    throw new Error('validateKey() must be implemented by subclass');
  }

  async listModels() {
    throw new Error('listModels() must be implemented by subclass');
  }

  async chat(messages, options) {
    throw new Error('chat() must be implemented by subclass');
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  countTokens(text) {
    if (!text) return 0;
    try {
      return encode(text).length;
    } catch {
      return Math.ceil(text.length / 4);
    }
  }
}
