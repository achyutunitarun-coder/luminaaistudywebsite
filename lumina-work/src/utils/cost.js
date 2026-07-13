const PRICING = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'mixtral-8x7b': { input: 0.24, output: 0.24 },
  'llama3-70b': { input: 0.59, output: 0.79 },
  'llama3-8b': { input: 0.06, output: 0.06 },
  'llama-3.3-70b': { input: 0.59, output: 0.79 },
};

export function getPricing(model) {
  for (const [k, p] of Object.entries(PRICING)) {
    if (model.toLowerCase().includes(k)) return p;
  }
  return { input: 1.00, output: 2.00 };
}

export function estimateCost(inputTokens, outputTokens, model) {
  const p = getPricing(model);
  return (inputTokens / 1000000) * p.input + (outputTokens / 1000000) * p.output;
}
