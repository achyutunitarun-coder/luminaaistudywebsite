/**
 * Single source of truth for credit costs and plan allocations.
 */

export const CREDIT_COSTS = {
  notes_artifact: 1.5,
  exam_artifact: 1.5,
  slides_artifact: 1.5,
  code_artifact: 1.5,

  lecture_notes_only: 3,
  lecture_notes_flashcards: 5,
  lecture_notes_flashcards_quiz: 7,
  lecture_full_pack: 10,
  lecture_podcast_only: 5,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export const PLAN_CREDITS = {
  free: 5,
  ultimate: 40,
  pro_plus: 150,
} as const;

export const ROLLOVER_CAPS = {
  free: 0,
  ultimate: 80,
  pro_plus: 300,
} as const;

export type PlanTier = keyof typeof PLAN_CREDITS;

export function hasEnoughCredits(action: CreditAction, balance: number): boolean {
  return balance >= CREDIT_COSTS[action];
}

export function costFor(action: CreditAction): number {
  return CREDIT_COSTS[action];
}

/** Map our chat intents to credit-action keys. */
export const INTENT_TO_ACTION: Record<string, CreditAction> = {
  NOTES_ARTIFACT: 'notes_artifact',
  EXAM_ARTIFACT: 'exam_artifact',
  SLIDES_ARTIFACT: 'slides_artifact',
  CODE_ARTIFACT: 'code_artifact',
};
