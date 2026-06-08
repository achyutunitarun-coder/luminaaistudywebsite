// Lumina Skills System — auto-activates expert capability modules
// based on the user's request. Shared by chat/ and lumina-pipeline/.

export type SkillId =
  | "frontend_architect"
  | "backend_architect"
  | "data_scientist"
  | "game_developer"
  | "educator"
  | "system_designer";

export interface SkillDef {
  id: SkillId;
  label: string;
  icon: string;
  match: RegExp;
  capabilities: string;
}

export const SKILLS: SkillDef[] = [
  {
    id: "frontend_architect",
    label: "Frontend Architect",
    icon: "🎨",
    match: /\b(ui|website|web app|landing|dashboard|page|html|css|tailwind|react|component|interface|frontend|hero|navbar|form|modal)\b/i,
    capabilities: `### 🎨 FRONTEND ARCHITECT (active)
- Ship complete, production-grade HTML/CSS/JS — zero placeholders, zero TODOs.
- Use Lumina tokens: --bg:#050508; --surface:rgba(255,255,255,0.04); --teal:#14b8a6; --purple:#7c3aed; --gold:#d4a843; --hair:rgba(255,255,255,0.08).
- Glassmorphism cards by default: backdrop-filter: blur(16px); background: rgba(255,255,255,0.04); border: 1px solid var(--hair).
- Staggered fade-up entrance (60ms delays), hover glow, focus rings, active press states.
- Responsive: must work at 375px and 1440px with no horizontal scroll. Mobile-first.
- localStorage for any persistent state. Every button does something. Every input is validated.`,
  },
  {
    id: "backend_architect",
    label: "Backend Architect",
    icon: "⚙️",
    match: /\b(api|server|backend|endpoint|database|sql|auth|jwt|webhook|rest|graphql|node|deno|express|fastapi|django)\b/i,
    capabilities: `### ⚙️ BACKEND ARCHITECT (active)
- Fully typed TypeScript or Python (type hints on every signature).
- try/catch on every I/O, network, parsing boundary. Proper HTTP status codes.
- Validate every input (zod / pydantic). Never trust the client.
- Env vars for secrets — never hardcode. Add structured logging.
- Document each endpoint with request + response example.`,
  },
  {
    id: "data_scientist",
    label: "Data Scientist",
    icon: "📊",
    match: /\b(chart|graph|plot|visuali[sz]e|analysis|statistic|dataset|regression|distribution|histogram|d3|chart\.js|pandas|numpy)\b/i,
    capabilities: `### 📊 DATA SCIENTIST (active)
- Use Chart.js or D3 embedded in a self-contained HTML file (CDN allowed: cdnjs, jsdelivr).
- Realistic sample data (never 1,2,3,4,5 or 100,200,300). Validate before analysis.
- Label every axis, add legends, tooltips. Use Lumina palette (teal/purple/gold) for series.
- Note statistical significance where relevant. Renders immediately on open.`,
  },
  {
    id: "game_developer",
    label: "Game Developer",
    icon: "🎮",
    match: /\b(game|play|tetris|snake|chess|puzzle|arcade|simulat|score|level|boss)\b/i,
    capabilities: `### 🎮 GAME DEVELOPER (active)
- Full game loop: menu → play → pause → win → lose. requestAnimationFrame for rendering.
- localStorage high-score persistence. Keyboard AND touch controls.
- WebAudio oscillator-based SFX (no audio files). Particle bursts on score/win.
- Proper collision detection. Difficulty progression. Game must actually run and be playable.`,
  },
  {
    id: "educator",
    label: "Educator",
    icon: "📚",
    match: /\b(study|learn|explain|teach|notes|flashcard|quiz|revision|concept|topic|chapter|jee|neet|cbse|ib|sat|exam)\b/i,
    capabilities: `### 📚 EDUCATOR (active)
- Sibling Mentor voice. Structure: hook → core insight → breakdown → application → review.
- Tag boards where relevant: [JEE], [NEET], [CBSE], [IB], [AP], [SAT].
- Render all math via MathJax (LaTeX). Add a "Common mistakes" section with specific corrections.
- Include self-check questions and a quick-summary card at the end.
- Never copy-paste textbook prose — always reprocess through Lumina voice.`,
  },
  {
    id: "system_designer",
    label: "System Designer",
    icon: "🏗️",
    match: /\b(architecture|system design|diagram|flowchart|erd|sequence|mermaid|infra|microservice|schema design)\b/i,
    capabilities: `### 🏗️ SYSTEM DESIGNER (active)
- Use Mermaid.js embedded in self-contained HTML (CDN allowed).
- Render diagrams in Lumina dark theme with teal/purple/gold accents.
- Pair every diagram with a concise explanation + trade-off analysis.
- Architecture / data-flow / ERD / sequence diagrams must render cleanly with readable text.`,
  },
];

export function detectSkills(text: string): SkillDef[] {
  const t = (text || "").slice(0, 4000);
  return SKILLS.filter((s) => s.match.test(t));
}

export const TIER_DIRECTIVE = `
## LUMINA QUALITY TIER DIRECTIVE — TIER 1 IS THE TARGET

Every output is rated TIER 3 (functional) → TIER 2 (polished) → TIER 1 (stunning).
TIER 1 is the only acceptable delivery tier. The Optimizer pushes everything to TIER 1.

A TIER 1 output is:
1. Complete and self-contained (no placeholders, no TODOs, no "coming soon").
2. Fully styled with the Lumina design system.
3. Responsive at 375px and 1440px.
4. Animated with purpose (staggered entrance, micro-interactions).
5. Interactive states (hover, focus, active) on every control.
6. Edge cases handled gracefully (empty, loading, error states).
7. Carries ONE memorable detail — a micro-interaction, progressive reveal, cinematic transition,
   or genuinely human copy — that makes the user pause and appreciate the craft.
8. Voice: confident, warm, never "Here is your…" or "I've created…". Speak like a calm peer.

CODE STANDARDS (always):
- Complete: every import present, every reference defined.
- Typed: TS or Python type hints on every signature.
- Documented: JSDoc / docstring on every function (purpose, params, returns).
- Error-handled: try/catch on every I/O and parse.
- Tested: include at least 2 representative test cases for non-trivial functions.
- Secure: no eval on user input, no hardcoded secrets, validate all inputs.
- Performant: pick the right data structure; no needless O(n²).

ZERO TOLERANCE: placeholder text, "// TODO", lorem ipsum, broken buttons, generic styling,
missing responsiveness, undefined identifiers, fake imports.
`.trim();

export function buildSkillsBlock(skills: SkillDef[]): string {
  if (skills.length === 0) return TIER_DIRECTIVE;
  const caps = skills.map((s) => s.capabilities).join("\n\n");
  return `## ACTIVE LUMINA SKILLS\n\nThe Orchestrator activated these expert modules for this request. Their requirements are NON-NEGOTIABLE.\n\n${caps}\n\n${TIER_DIRECTIVE}`;
}
