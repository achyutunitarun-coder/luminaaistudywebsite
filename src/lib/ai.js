/**
 * Lumina AI — Streaming Chat Library
 * Handles all AI communication via OpenRouter with SSE streaming.
 * 
 * Usage:
 *   import { streamChat } from '@/lib/ai';
 *   
 *   await streamChat({
 *     messages: [{ role: 'user', content: 'Hello' }],
 *     mode: 'auto',
 *     onToken: (token) => appendToMessage(token),
 *     onDone: () => setStreaming(false),
 *     onError: (err) => showError(err),
 *     signal: abortController.signal,
 *   });
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPTS = {
  auto: 'You are Lumina, an adaptive AI tutor for students. Be concise, clear, and pedagogically sound. Address the user by first name when known. Use markdown for formatting.',
  reasoning: 'You are Lumina in reasoning mode. Think step by step. Show your work. Explain each logical step clearly.',
  study: 'You are Lumina in study mode. Use the Feynman technique — explain as if to a bright 16-year-old. Use analogies, examples, and checkpoints.',
  coding: 'You are Lumina in coding mode. Write clean, commented code. Explain each section. Use markdown code blocks with language tags.',
  'deep-dive': 'You are Lumina in deep dive mode. Go comprehensive. Cover edge cases, nuances, historical context, and connections to other concepts.',
  creative: 'You are Lumina in creative mode. Be imaginative. Use storytelling, metaphors, and memorable frameworks.',
  fast: 'You are Lumina in fast mode. Answer in 2-3 sentences max. Be direct. No preamble.',
};

/**
 * Stream a chat completion from OpenRouter.
 * @param {Object} params
 * @param {Array} params.messages - Array of {role, content} messages
 * @param {string} params.mode - One of: auto, reasoning, study, coding, deep-dive, creative, fast
 * @param {Function} params.onToken - Called with each text chunk
 * @param {Function} params.onDone - Called when stream completes
 * @param {Function} params.onError - Called on error
 * @param {AbortSignal} params.signal - AbortController signal for cancellation
 */
export async function streamChat({ messages, mode = 'auto', onToken, onDone, onError, signal }) {
  const apiKey = import.meta.env.VITE_OPENROUTER_KEY;
  
  if (!apiKey) {
    onError?.(new Error('OpenRouter API key not configured. Set VITE_OPENROUTER_KEY in .env'));
    return;
  }

  const response = await fetch(OPENROUTER_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Lumina AI Tutor',
    },
    body: JSON.stringify({
      model: 'openrouter/quasar-alpha',
      stream: true,
      max_tokens: 4096,
      temperature: mode === 'fast' ? 0.3 : 0.7,
      top_p: 0.9,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.auto },
        ...messages,
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const error = new Error(err?.error?.message || `OpenRouter error: ${response.status}`);
    onError?.(error);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) onToken?.(delta);
        } catch {
          // skip malformed SSE lines
        }
      }
    }
    onDone?.();
  } catch (err) {
    if (err.name !== 'AbortError') {
      onError?.(err);
    }
  }
}

/**
 * Non-streaming chat (for simple use cases).
 * Returns the full response string.
 */
export async function chat({ messages, mode = 'auto' }) {
  let result = '';
  await new Promise((resolve, reject) => {
    streamChat({
      messages,
      mode,
      onToken: (token) => { result += token; },
      onDone: resolve,
      onError: reject,
    });
  });
  return result;
}
