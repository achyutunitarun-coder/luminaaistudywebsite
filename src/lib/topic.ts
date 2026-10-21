/**
 * Topic name hygiene — keeps analytics "weakness" labels readable.
 *
 * Model-provided topic labels pass through unchanged when clean; anything that
 * looks like a sentence fragment (raw question text) collapses to a fallback.
 */

const TRAILING_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'of', 'and', 'or', 'with',
  'for', 'to', 'in', 'on', 'at', 'by', 'from', 'into', 'onto', 'that',
  'which', 'but', 'has', 'have', 'had', 'its', 'their', 'his', 'her',
  'your', 'my', 'our', 'be', 'been', 'being', 'as', 'than', 'then', 'so',
  'against', 'while', 'when', 'because', 'very', 'also',
]);

const cleanWhitespace = (value: string) =>
  (value || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

/** True when the text reads like a question fragment, not a topic label. */
export function looksLikeSentenceFragment(name: string): boolean {
  const words = name.split(' ').filter(Boolean);
  // Question fragments usually start with an article followed by more prose
  if (/^(a|an|the)\b/i.test(name) && words.length >= 4) return true;
  // Subject-verb copulas mid-phrase ("...massive is your biggest...")
  if (/\b(is|are|was|were|has|have|had|do|does|did)\b/i.test(name)) return true;
  return false;
}

/**
 * Sanitize a topic label. Falls back when the input is empty, sentence-like,
 * or turns empty after trimming dangling stopwords.
 */
export function sanitizeTopicName(raw: string, fallback = 'General Concept'): string {
  let name = cleanWhitespace(raw);
  if (!name) return fallback;
  if (looksLikeSentenceFragment(name)) return fallback;

  let words = name.split(' ');
  while (words.length > 1 && TRAILING_STOPWORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  name = words.join(' ').replace(/[.,;:!?]+$/, '').trim();

  if (!name || TRAILING_STOPWORDS.has(name.toLowerCase())) return fallback;
  if (name.length > 48) {
    name = name.split(' ').slice(0, 5).join(' ');
    if (name.length > 48) name = name.slice(0, 48).trim();
  }
  return name || fallback;
}

/**
 * Choose the mistake topic for a test question. Per the QA report (DEF-02),
 * we never derive topics from raw question text — a model-provided topic is
 * preferred, otherwise the test subject is used.
 */
export function deriveMistakeTopic(
  question: { topic?: string | null } | null | undefined,
  subject?: string | null,
): string {
  const fallback = cleanWhitespace(subject || '') || 'General Concept';
  if (question?.topic) {
    const cleaned = sanitizeTopicName(question.topic, '');
    if (cleaned) return cleaned;
  }
  return sanitizeTopicName(fallback, 'General Concept');
}
