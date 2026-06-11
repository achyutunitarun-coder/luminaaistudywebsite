/**
 * Single source of truth for chat routing decisions.
 * Pure deterministic — no AI call, no async.
 */

export type Intent =
  | 'CHAT'
  | 'NOTES_ARTIFACT'
  | 'EXAM_ARTIFACT'
  | 'SLIDES_ARTIFACT'
  | 'CODE_ARTIFACT'
  | 'QUICK_STUDY';

export interface IntentResult {
  intent: Intent;
  confidence: number;
  topic: string;
  subtype?: string;
}

const NOTES_PHRASES = [
  'generate notes', 'create notes', 'make notes', 'write notes',
  'notes on', 'notes for', 'notes about', 'study notes',
  'detailed notes', 'bullet notes', 'notes artifact', 'download notes',
  'summarise', 'summarize',
];

const EXAM_PHRASES = [
  'exam paper', 'question paper', 'test paper', 'practice paper',
  'mock test', 'mock paper', 'past paper',
  'create exam', 'generate exam', 'make exam', 'make a test',
  'make an exam', 'build an exam', 'create a test',
  'exam on', 'questions on',
];

const SLIDES_PHRASES = [
  'slides', 'slide deck', 'slide show', 'slideshow', 'presentation',
  'powerpoint', 'ppt on', 'ppt about', 'ppt for',
  'create slides', 'make slides', 'make a presentation', 'create a presentation',
  'pptx', 'keynote',
];

const CODE_PHRASES = [
  'write code', 'write a program', 'write a function', 'write a script',
  'write a website', 'code for', 'code that', 'code to',
  'build a', 'build me', 'build an', 'build the',
  'create a website', 'create an app', 'create a webpage', 'create a game',
  'create a calculator', 'create a tool',
  'make a website', 'make a webpage', 'make a game', 'make an app',
  'make a calculator', 'make a tool',
  'develop a', 'develop an', 'implement',
  'html file', 'css file', 'react component',
  'video game', 'videogame',
];

const QUICK_STUDY_PHRASES = [
  'quick study', 'quick revision', 'rapid revision', 'fast notes',
  'quick recap', 'brief overview', 'revision on',
  '10 minute', 'ten minute', '10-minute',
];

function countHits(text: string, phrases: string[]): number {
  let n = 0;
  for (const p of phrases) if (text.includes(p)) n++;
  return n;
}

function extractTopic(message: string, intent: Intent): string {
  const lower = message.toLowerCase();
  // Try to extract whatever follows "on", "about", "for"
  const m = message.match(/\b(?:on|about|for|covering)\s+(.+?)(?:[.?!,]|$)/i);
  if (m && m[1].trim().length > 0 && m[1].trim().length < 200) return m[1].trim();
  // Fallback: strip the trigger phrase
  const triggers = [
    'create notes', 'generate notes', 'make notes', 'write notes',
    'create exam paper', 'create exam', 'make exam', 'generate exam',
    'create slides', 'make slides', 'make a presentation', 'create a presentation',
    'build a', 'build me a', 'build an', 'create a', 'make a',
    'quick study', 'quick revision',
  ];
  let t = message.trim();
  for (const tr of triggers) {
    const re = new RegExp('^' + tr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i');
    if (re.test(t)) { t = t.replace(re, ''); break; }
  }
  return t.length > 200 ? t.slice(0, 200) : t || message;
}

export function detectIntent(message: string): IntentResult {
  const text = (message ?? '').toLowerCase();

  if (!text.trim()) {
    return { intent: 'CHAT', confidence: 1, topic: '' };
  }

  const scores: Record<Exclude<Intent, 'CHAT'>, number> = {
    NOTES_ARTIFACT: countHits(text, NOTES_PHRASES),
    EXAM_ARTIFACT: countHits(text, EXAM_PHRASES),
    SLIDES_ARTIFACT: countHits(text, SLIDES_PHRASES),
    CODE_ARTIFACT: countHits(text, CODE_PHRASES),
    QUICK_STUDY: countHits(text, QUICK_STUDY_PHRASES),
  };

  // Pick the winner by hit count
  let winner: Exclude<Intent, 'CHAT'> | null = null;
  let max = 0;
  (Object.keys(scores) as (keyof typeof scores)[]).forEach((k) => {
    if (scores[k] > max) { max = scores[k]; winner = k; }
  });

  // Tie or zero hits → CHAT
  if (!winner || max === 0) {
    return { intent: 'CHAT', confidence: 1, topic: message.trim() };
  }

  // If any tie at the top, prefer CHAT (safety: we never auto-trigger ambiguous artifacts)
  const tied = (Object.values(scores) as number[]).filter((v) => v === max).length;
  if (tied > 1) {
    return { intent: 'CHAT', confidence: 1, topic: message.trim() };
  }

  return {
    intent: winner,
    confidence: 0.95,
    topic: extractTopic(message, winner),
  };
}
