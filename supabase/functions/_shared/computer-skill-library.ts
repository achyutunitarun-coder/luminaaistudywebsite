// Lumina Computer — Skill Library types + selector + router instruction.
// Category data lives in ./skills/*.ts and is aggregated here.
export interface ComputerSkill {
  id: string;          // stable slug
  category: number;    // 1..8
  title: string;       // skill name
  trigger: string[];   // trigger vocabulary used by the selector
  conviction: string;  // the stated belief that drives every choice
  do: string[];        // concrete moves the conviction produces
  never: string;       // the failure mode this skill prevents
  weight?: number;     // confidence-softer per skill (optional)
}

import { CATEGORY_1 } from "./skill-library/skills/category-1.ts";
import { CATEGORY_2 } from "./skill-library/skills/category-2.ts";
import { CATEGORY_3 } from "./skill-library/skills/category-3.ts";
import { CATEGORY_4 } from "./skill-library/skills/category-4.ts";
import { CATEGORY_5 } from "./skill-library/skills/category-5.ts";
import { CATEGORY_6 } from "./skill-library/skills/category-6.ts";
import { CATEGORY_7 } from "./skill-library/skills/category-7.ts";
import { CATEGORY_8 } from "./skill-library/skills/category-8.ts";

export const COMPUTER_SKILLS: ComputerSkill[] = [
  ...CATEGORY_1, ...CATEGORY_2, ...CATEGORY_3, ...CATEGORY_4,
  ...CATEGORY_5, ...CATEGORY_6, ...CATEGORY_7, ...CATEGORY_8,
];

// ── The Skill Router meta-instruction ─────────────────────────────
// Injected so the model reads the ACTIVE skills block and applies the
// RIGHT skills to the RIGHT part of the task, and does not narrate them.
export const COMPUTER_SKILL_ROUTER_PROMPT = `
Before you plan or build anything, read the ACTIVE SKILLS attached below. Each active skill carries a conviction — a stated belief about what good work looks like in that domain and the specific Do / Never moves it produces. Let those actually change your approach, not just your vocabulary. If your output would be identical whether or not you'd read them, you didn't really use them.

HOW TO APPLY THEM
- Apply each active skill to the part of the task it owns. Compose freely — a persuasive investor deck with a real data section draws on persuasive-writing AND data-honesty AND presentation skills at once. Apply every skill the router selected; do not switch in skills that were not matched unless the library's own trigger vocabulary clearly calls for it.
- A skill is a conviction, not a template. Let it shape your judgment, not fill slots.
- Do not narrate your selection. Apply silently, produce the output.`.trim();

export interface SkillMatch {
  skill: ComputerSkill;
  score: number;
  relevance: "primary" | "secondary";
}

// ── Selector: match the right skill for a task ────────────────────
// Scores every skill by how many of its trigger tokens appear in the
// request (word-boundary aware). Returns ranked matches, dropping weak
// hits below threshold. This replaces "random skill" selection with a
// deterministic relevance ranking aligned to the library's own triggers.
const tokenize = (s: string): Set<string> => {
  return new Set((s || "").toLowerCase().match(/[a-z][a-z0-9]*/g) ?? []);
};

export function selectComputerSkills(
  request: string,
  opts: { limit?: number; minScore?: number } = {},
): SkillMatch[] {
  const { limit = 4, minScore = 1 } = opts;
  const reqTokens = tokenize(request);
  if (reqTokens.size === 0) return [];

  const scored: SkillMatch[] = [];
  for (const skill of COMPUTER_SKILLS) {
    const trigTokens = tokenize(skill.trigger.join(" "));
    let hits = 0;
    for (const t of trigTokens) {
      if (reqTokens.has(t)) hits++;
    }
    if (hits === 0) continue;
    const score = hits / Math.min(trigTokens.size, 6) + Math.min(hits, 3) * 0.15;
    if (score < 0.18) continue;
    scored.push({
      skill,
      score,
      relevance: score >= 0.6 || hits >= 3 ? "primary" : "secondary",
    });
  }

  scored.sort((a, b) => b.score - a.score);
  // Cap per-category so a single verbose category doesn't crowd out others.
  const seenCat = new Map<number, number>();
  const picked: SkillMatch[] = [];
  for (const m of scored) {
    if (picked.length >= limit) break;
    const catCount = seenCat.get(m.skill.category) ?? 0;
    if (catCount < 2) {
      picked.push(m);
      seenCat.set(m.skill.category, catCount + 1);
    }
  }
  return picked;
}

// ── Build the ACTIVE SKILLS block that gets injected into the prompt ─
export function buildComputerSkillsBlock(matches: SkillMatch[]): string {
  if (matches.length === 0) return "";
  const parts = matches.map((m) => {
    const s = m.skill;
    return `### ${s.title} (${m.relevance})
CONVICTION: ${s.conviction}
DO: ${s.do.map((d) => `- ${d}`).join("\n")}
NEVER: ${s.never}`;
  });
  return `
━━━ ACTIVE CRAFT SKILLS — read and apply these to this task ━━
${parts.join("\n\n")}
━━━ END OF ACTIVE SKILLS ━━`;
}