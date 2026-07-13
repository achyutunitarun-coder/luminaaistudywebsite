import { countTokens } from './utils/tokens.js';

export function shouldSummarize(messages) {
  if (!Array.isArray(messages)) return false;
  const nonSystem = messages.filter(m => m.role !== 'system');
  return nonSystem.length > 0 && nonSystem.length % 10 === 0;
}

export function buildMemoryBlock(summary) {
  return {
    role: 'system',
    content: `[Memory: ${summary}]`,
    isMemory: true
  };
}

export function compressHistory(messages, summary) {
  const memoryBlock = buildMemoryBlock(summary);
  const lastTwo = messages.filter(m => m.role !== 'system').slice(-2);
  const systemMessages = messages.filter(m => m.role === 'system' && !m.isMemory);
  return [...systemMessages, memoryBlock, ...lastTwo];
}

export function generateSummaryPrompt(messages) {
  const text = messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role}: ${m.content}`)
    .join('\n')
    .slice(0, 4000);
  return {
    role: 'user',
    content: `Summarize this conversation in under 100 tokens, capturing the key topics and decisions:\n\n${text}`
  };
}
