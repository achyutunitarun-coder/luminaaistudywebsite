import { encode } from 'gpt-tokenizer';

export function countTokens(text, model) {
  if (!text) return 0;
  try { return encode(text).length; }
  catch { return Math.ceil(text.length / 4); }
}

export function approximateTokens(text) {
  if (!text) return 0;
  let c = 0;
  for (const ch of text) {
    if (/[\x00-\x7F]/.test(ch)) c += 1;
    else if (/[\u0080-\u07FF]/.test(ch)) c += 2;
    else if (/[\u0800-\uFFFF]/.test(ch)) c += 3;
    else c += 4;
  }
  return Math.ceil(c / 4);
}
