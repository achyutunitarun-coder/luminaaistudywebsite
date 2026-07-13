import { GoogleGenerativeAI } from '@google/generative-ai';
import { Provider } from './providers.js';

export class GoogleProvider extends Provider {
  constructor(config) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async validateKey() {
    try { const m = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' }); await m.generateContent('test'); return true; }
    catch (err) { throw new Error(err.message); }
  }

  async listModels() {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1/models?key=' + this.config.apiKey);
      const d = await r.json();
      if (d.models) return d.models.filter(m => m.name.startsWith('models/gemini')).map(m => m.name.replace('models/', '')).sort();
    } catch {}
    return ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'];
  }

  async chat(messages, opts = {}) {
    this.abortController = new AbortController();
    const model = this.client.getGenerativeModel({ model: opts.model || this.config.departments?.ceo?.model });
    const chat = messages.filter(m => m.role !== 'system');
    const hist = chat.slice(0, -1).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const last = chat[chat.length - 1];
    const sys = messages.find(m => m.role === 'system');
    const session = model.startChat({ history: hist, systemInstruction: sys?.content || undefined });
    const result = await session.sendMessage(last.content);
    const text = result.response.text();
    if (opts.onToken) opts.onToken(text);
    return text;
  }
}
