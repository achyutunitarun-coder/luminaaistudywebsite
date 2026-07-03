/**
 * Skill file loader for Lumina modes.
 *
 * Loads domain-specific skill scaffolding (for Docs, Sheets, Websites)
 * or persona replacement (for Slides) into the mode's context.
 *
 * Skill scaffolding (Docs, Sheets, Websites):
 *   Thorough domain file read before any task starts.
 *   Contains format compatibility, conventions, and validation checklist.
 *
 * Persona replacement (Slides):
 *   Identity replacement document, not a procedural manual.
 *   Embodies the taste the work requires.
 */

export type SkillType = "skill" | "persona";

export interface SkillFile {
  type: SkillType;
  path: string;
  content: string;
}

const SKILL_FILES: Record<string, string> = {
  "docs": "./skills/docs/SKILL.md",
  "sheets": "./skills/sheets/SKILL.md",
  "webapp": "./skills/webapp/SKILL.md",
  "slides": "./skills/slides/PERSONA.md",
};

const skillCache = new Map<string, string>();

/**
 * Load a skill file for a given mode.
 * Reads from disk on first access, caches thereafter.
 */
export async function loadSkill(mode: string): Promise<SkillFile | null> {
  const relPath = SKILL_FILES[mode];
  if (!relPath) return null;

  const cached = skillCache.get(relPath);
  if (cached !== undefined) {
    return {
      type: mode === "slides" ? "persona" : "skill",
      path: relPath,
      content: cached,
    };
  }

  try {
    const content = await Deno.readTextFile(new URL(relPath, import.meta.url));
    skillCache.set(relPath, content);
    return {
      type: mode === "slides" ? "persona" : "skill",
      path: relPath,
      content,
    };
  } catch {
    return null;
  }
}

/**
 * Get the context prefix to prepend to system prompts for a given mode.
 * Returns empty string if no skill file or persona exists for the mode.
 */
export async function getSkillContext(mode: string): Promise<string> {
  const skill = await loadSkill(mode);
  if (!skill) return "";

  if (skill.type === "persona") {
    return `\n\n[PERSONA — read and embody this for the entire task]\n${skill.content}\n[/PERSONA]`;
  }

  return `\n\n[SKILL FILE — read this in full before starting]\n${skill.content}\n[/SKILL FILE]\n\nIMPORTANT: You must complete the validation checklist at the end of the skill file before declaring your output done.`;
}
