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
  'artifact on', 'artifact for', 'study guide', 'revision guide',
  'cheat sheet', 'formula sheet', 'visual notes', 'worksheet',
  'learning pack', 'exam pack', 'mind map', 'mindmap', 'concept map',
  'infographic', 'one pager', 'one-pager', 'make an artifact', 'create an artifact',
];

const EXAM_PHRASES = [
  'exam paper', 'question paper', 'test paper', 'practice paper',
  'mock test', 'mock paper', 'past paper',
  'create exam', 'generate exam', 'make exam', 'make a test',
  'make an exam', 'build an exam', 'create a test',
  'exam on', 'questions on',
  'worksheet questions', 'practice questions', 'quiz me', 'make a quiz',
  'generate quiz', 'question bank', 'marks scheme', 'mark scheme',
];

const SLIDES_PHRASES = [
  'slides', 'slide deck', 'slide show', 'slideshow', 'presentation',
  'powerpoint', 'ppt on', 'ppt about', 'ppt for',
  'create slides', 'make slides', 'make a presentation', 'create a presentation',
  'pptx', 'keynote',
  'deck on', 'deck about', 'pitch deck', 'lecture deck', 'class presentation',
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
  'interactive artifact', 'html artifact', 'single html', 'frontend',
  'frontend design', 'ui', 'dashboard', 'simulator', 'visualizer',
  'visualiser', 'playground', 'interactive demo', 'mini app', 'web tool',
  'timer', 'pomodoro', 'tracker', 'converter', 'generator', 'arcade',
];

const CONNECTOR_ACTION_RE = /\b(send|email|gmail|calendar|schedule|meeting|event|timetable|remind|google drive|drive|google doc|docs|notion|page|workspace|search my|find my|read my|open my|add .* calendar|put .* calendar|create .* doc|save .* notion)\b/i;

const QUICK_STUDY_PHRASES = [
  'quick study', 'quick revision', 'rapid revision', 'fast notes',
  'quick recap', 'brief overview', 'revision on',
  '10 minute', 'ten minute', '10-minute',
];

function countHits(text: string, phrases: string[]): number {
  let n = 0;
  for (const p of phrases) {
    if (/^[a-z0-9 ]+$/.test(p)) {
      const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) n++;
    } else if (text.includes(p)) {
      n++;
    }
  }
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

  // Connector requests are handled by the LLM agent planner before this fallback.
  // Keep deterministic fallback conservative so we do not turn external actions into artifacts.
  if (CONNECTOR_ACTION_RE.test(message) && !/\b(artifact|html|website|app|game|slides|presentation|notes|exam|quiz|worksheet|study guide)\b/i.test(message)) {
    return { intent: 'CHAT', confidence: 1, topic: message.trim() };
  }

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

  // If artifact-like language is present, resolve ties by product priority instead of dropping to chat.
  const tied = (Object.values(scores) as number[]).filter((v) => v === max).length;
  if (tied > 1) {
    if (/\b(artifact|interactive|html|build|create|make|generate|design)\b/i.test(message)) {
      const priority: Array<Exclude<Intent, 'CHAT'>> = /\b(quiz|worksheet|question|exam|test|paper|mark scheme)\b/i.test(message)
        ? ['EXAM_ARTIFACT', 'CODE_ARTIFACT', 'NOTES_ARTIFACT', 'SLIDES_ARTIFACT', 'QUICK_STUDY']
        : /\b(slide|deck|presentation|ppt|keynote)\b/i.test(message)
          ? ['SLIDES_ARTIFACT', 'CODE_ARTIFACT', 'NOTES_ARTIFACT', 'EXAM_ARTIFACT', 'QUICK_STUDY']
          : /\b(note|study guide|revision|cheat sheet|mind ?map|concept map|infographic|one-?pager)\b/i.test(message)
            ? ['NOTES_ARTIFACT', 'CODE_ARTIFACT', 'EXAM_ARTIFACT', 'SLIDES_ARTIFACT', 'QUICK_STUDY']
            : ['CODE_ARTIFACT', 'SLIDES_ARTIFACT', 'EXAM_ARTIFACT', 'NOTES_ARTIFACT', 'QUICK_STUDY'];
      winner = priority.find((k) => scores[k] === max) ?? winner;
    } else {
    return { intent: 'CHAT', confidence: 1, topic: message.trim() };
    }
  }

  return {
    intent: winner,
    confidence: 0.95,
    topic: extractTopic(message, winner),
  };
}
