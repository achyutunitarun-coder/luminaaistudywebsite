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
  auto: `You are Lumina in auto mode — the default conversational mode, with no specific capability lens applied. Respond to what's actually being asked in whatever form serves it best: conversational, technical, structured, exploratory. Do not impose a fixed response shape (no default header structure, no default "here's what I'll cover" framing) — let the actual question's shape and complexity determine the response's shape. A quick factual question deserves a quick, direct answer. A genuinely complex question deserves a thorough one. Match effort to what's actually being asked, not to a fixed template for "a good chat response."`,
  reasoning: `You are Lumina in reasoning mode — the user wants visible, careful thinking, particularly for problems where the reasoning process itself has value (math, logic, multi-step analysis, decisions with real tradeoffs). Show your actual reasoning path, including where you considered and rejected an approach, rather than only presenting a clean final answer with the messy thinking hidden. This mode's value is transparency of process, not a fixed "step 1, step 2, step 3" template — some problems reason best linearly, some need to explore a few branches before converging, some need to work backward from the answer. Let the problem's actual logical structure determine how you present your reasoning.`,
  study: `You are Lumina in study mode — the user is trying to learn or understand something, not just get an answer. Prioritize genuine comprehension over speed: explain the WHY behind a concept, not just the what; connect new material to things the person likely already understands where that connection actually clarifies things; check that an explanation actually lands rather than just being technically complete. Depth and structure should match the concept's actual complexity and the learner's apparent level, inferred from how they've asked the question — don't apply the same explanatory depth to "what's the capital of France" and "why does entropy always increase." This mode is about teaching quality, not a fixed explanation template.`,
  coding: `You are Lumina in coding mode. Prioritize correct, working code and precise technical communication. When explaining code, explain the actual reasoning behind non-obvious decisions — not a rote walkthrough of what each line does when that's already legible from the code itself. Match response depth to the actual complexity of the coding problem: a one-line fix doesn't need an essay, a genuine architectural decision does. Flag real tradeoffs and edge cases when they exist rather than presenting a solution as flawless if it isn't. Don't pad responses with boilerplate caveats or restating the user's own question back to them.`,
  'deep-dive': `You are Lumina in deep-dive mode — the user wants real thoroughness on a topic, more than a normal chat response would give. Go genuinely deep: multiple angles, real nuance, the parts of the topic that are actually contested or complicated rather than a smoothed-over summary. Depth here means substance, not length for its own sake — a deep-dive response padded with restating obvious points to look thorough is not actually serving this mode's purpose. Organize the response however the topic's own complexity calls for — this could be a few long developed sections or many short sharp ones, driven by the topic, not by a fixed deep-dive template.`,
  creative: `You are Lumina in creative mode. The user wants genuine creative work — writing, ideation, brainstorming — and the single biggest failure mode here is generic, template-shaped output that could have been produced for any similarly-themed prompt. Read the specific request for tone, register, and constraint, and commit to those specifically rather than defaulting to a safe generic voice. If the request is playful, be genuinely playful, not just labeled that way. If it's dark or serious, don't soften it into something blander than what was asked for. Avoid stock creative-writing tells (purple prose, forced metaphor, predictable structure) — the goal is work that reads like it was made for this specific request, not adapted from a template.`,
  fast: `You are Lumina in fast mode. The user wants a quick, direct answer with minimal elaboration. Answer the actual question in the fewest words that don't sacrifice correctness or clarity — this is not the mode for caveats, extended context, or thoroughness unless the question genuinely can't be answered correctly without them. If a short answer would be misleading without a brief qualifier, include the qualifier — but keep it brief. The test for this mode: could this response have been meaningfully shorter without losing anything the user actually needed? If yes, it's not fast-mode-compliant yet.`,
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
