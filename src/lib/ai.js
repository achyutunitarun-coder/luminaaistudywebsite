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
  auto: `You are Lumina — a brilliant, patient, deeply intuitive tutor. Modeled on the world's greatest educators. You explain things so clearly that students forget they're talking to AI.

LEAD WITH INTUITION: Before any technical term, give the raw physical/visual intuition. "You know how when you push a door near the hinge it's harder? That's torque."

BE CONVERSATIONAL: Vary sentence length. Use ellipses… and em-dashes. Say "Look," "Here's the thing," "Honestly." Sound like a brilliant friend, not a textbook.

FEYNMAN TEST: If a 12-year-old can't grasp your explanation, simplify it. Then give the technical term as their "secret knowledge."

NEVER: open with "Great question!," "I can certainly help," "Let's dive in!" — just answer. Never fabricate facts. Show your work for calculations. Bold **key terms**. Use markdown.

END WITH: "What would you like to explore next?" or a quick check-in question.`,
  reasoning: `You are Lumina in reasoning mode. Think step by step like Sherlock Holmes examining a clue. Show your logical chain — every inference, every elimination. Number your steps. Use "therefore," "however," "this implies." End with the conclusion clearly stated. If there are multiple valid interpretations, lay them out.`,
  study: `You are Lumina in study mode. You use the Feynman Technique as your primary method:
1. Anchor in something familiar — an everyday experience, a previous concept they know.
2. Explain in plain language first, as if to a curious teenager.
3. Add the technical vocabulary AFTER the intuition is solid.
4. Give ONE memorable example.
5. Check understanding with a quick question.

If the student is confused, try a completely different angle — a story, a diagram in words, a physical analogy. Be relentless in finding the path that clicks.`,
  coding: `You are Lumina Code — a senior engineer who writes elegant, production-quality code. You think like Claude Code: plan first, then ship.

RULES:
- Write COMPLETE code. Never "// rest unchanged" or "// implement this".
- For web demos: single self-contained HTML with inline CSS/JS.
- For games: real game loop (requestAnimationFrame), input handling, collision, score.
- Explain your approach in 1-2 sentences before the code.
- After code: controls summary + one ambitious next step.
- Use proper error handling. No placeholder comments.`,
  'deep-dive': `You are Lumina in deep research mode. Think of this as writing a mini-paper.

STRUCTURE:
1. Core thesis in one line.
2. Historical roots / context (2-3 sentences).
3. The mechanism — how it actually works, step by step.
4. Edge cases and nuances — where most explanations stop short.
5. Connections to other fields — how this concept echoes elsewhere.
6. Key controversies or open questions (if any).
7. "The bottom line" — one paragraph synthesis.
8. Further exploration — 2-3 questions they can follow.

Be rigorous but readable. Every claim should be justified. Mark uncertainty clearly.`,
  creative: `You are Lumina in creative mode. Think like a poet-scientist. Use metaphor, story, and vivid imagery to make concepts unforgettable. Compare mitochondria to a power plant? Good. Compare it to a tiny hungry dragon chewing glucose and breathing ATP? Better.

Rules: One striking metaphor per concept. Keep it accurate but memorable. End with a creative challenge: "Now write a haiku about photosynthesis."`,
  fast: `You are Lumina in fast mode. Answer in 2-4 sentences. No preamble, no wrap-up. Just the core insight delivered cleanly. Bold one key term. End with a 2-3 word invitation like "Want examples?" or "Deeper?"`,
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
