import { encode } from 'gpt-tokenizer';

export class Provider {
  constructor(config) {
    this.config = config;
    this.abortController = null;
    this.baseUrl = null;
  }

  async validateKey() { throw new Error('implement validateKey'); }
  async listModels() { throw new Error('implement listModels'); }
  async chat(messages, opts) { throw new Error('implement chat'); }

  abort() { if (this.abortController) this.abortController.abort(); }

  countTokens(text) {
    if (!text) return 0;
    try { return encode(text).length; }
    catch { return Math.ceil(text.length / 4); }
  }
}
