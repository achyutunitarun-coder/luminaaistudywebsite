import { encode } from 'gpt-tokenizer';

export function countTokens(text, model = 'gpt-4o-mini') {
  if (!text) return 0;
  try {
    const tokens = encode(text);
    return tokens.length;
  } catch {
    return approximateTokens(text);
  }
}

export function approximateTokens(text) {
  if (!text) return 0;
  let count = 0;
  for (const char of text) {
    if (/[\x00-\x7F]/.test(char)) {
      count += 1;
    } else if (/[\u0080-\u07FF]/.test(char)) {
      count += 2;
    } else if (/[\u0800-\uFFFF]/.test(char)) {
      count += 3;
    } else {
      count += 4;
    }
  }
  return Math.ceil(count / 4);
}
