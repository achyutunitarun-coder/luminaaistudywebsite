import { GoogleGenerativeAI } from '@google/generative-ai';
import { Provider } from './providers.js';

export class GoogleProvider extends Provider {
  constructor(config) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async validateKey() {
    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      await model.generateContent('test');
      return true;
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async listModels() {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1/models?key=' + this.config.apiKey);
      const data = await response.json();
      if (data.models) {
        return data.models
          .filter(m => m.name.startsWith('models/gemini'))
          .map(m => m.name.replace('models/', ''))
          .sort();
      }
    } catch {}
    return ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'];
  }

  async chat(messages, options = {}) {
    this.abortController = new AbortController();
    const model = this.client.getGenerativeModel({
      model: options.model || this.config.defaultModel,
    });

    const chatMessages = messages.filter(m => m.role !== 'system');
    let history = chatMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const lastMsg = chatMessages[chatMessages.length - 1];
    const systemMsg = messages.find(m => m.role === 'system');

    const chat = model.startChat({
      history,
      systemInstruction: systemMsg?.content || undefined,
    });

    const result = await chat.sendMessage(lastMsg.content);
    const response = result.response;
    const text = response.text();

    if (options.onToken) {
      options.onToken(text);
    }
    return text;
  }
}
