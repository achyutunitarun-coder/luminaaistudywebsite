import { describe, it, expect } from 'vitest';
import { sanitizeTopicName, deriveMistakeTopic, looksLikeSentenceFragment } from './topic';

describe('sanitizeTopicName', () => {
  it('collapses raw question fragments to the fallback (DEF-02 regression)', () => {
    expect(sanitizeTopicName('A person pushes against a massive', 'Physics')).toBe('Physics');
  });

  it('rejects sentence fragments with copulas', () => {
    expect(sanitizeTopicName('momentum is conserved in collisions', 'Physics')).toBe('Physics');
  });

  it('keeps clean topic names', () => {
    expect(sanitizeTopicName("Newton's Laws of Motion")).toBe("Newton's Laws of Motion");
    expect(sanitizeTopicName('Quadratic Equations')).toBe('Quadratic Equations');
  });

  it('trims dangling stopwords', () => {
    expect(sanitizeTopicName('Photosynthesis in')).toBe('Photosynthesis');
  });

  it('falls back on empty input', () => {
    expect(sanitizeTopicName('', 'Chemistry')).toBe('Chemistry');
    expect(sanitizeTopicName('   ', 'General Concept')).toBe('General Concept');
  });
});

describe('looksLikeSentenceFragment', () => {
  it('flags article-led multi-word fragments', () => {
    expect(looksLikeSentenceFragment('A person pushes against a massive')).toBe(true);
  });

  it('does not flag short titled topics starting with an article', () => {
    expect(looksLikeSentenceFragment('The OSI Model')).toBe(false);
  });
});

describe('deriveMistakeTopic', () => {
  it('prefers the model-provided topic', () => {
    expect(deriveMistakeTopic({ topic: 'Vectors' }, 'Physics')).toBe('Vectors');
  });

  it('falls back to the subject, never raw question text', () => {
    expect(deriveMistakeTopic({}, 'Biology')).toBe('Biology');
    expect(deriveMistakeTopic(null, 'Mathematics')).toBe('Mathematics');
  });

  it('uses General Concept when neither topic nor subject exists', () => {
    expect(deriveMistakeTopic(undefined, '')).toBe('General Concept');
  });

  it('never returns a question fragment even when passed one as topic', () => {
    expect(deriveMistakeTopic({ topic: 'A person pushes against a massive' }, 'Physics')).toBe('Physics');
  });
});
