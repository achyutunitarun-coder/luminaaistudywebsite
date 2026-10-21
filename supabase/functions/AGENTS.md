# Edge functions (supabase/functions)

## Build check
- No Deno locally: `npx --no-install esbuild <fn>/index.ts --bundle --loader:.ts=ts --outdir=<tmp> --log-level=error` must exit 0 before deploying (alternative: `bunx bun build <fn>/index.ts --no-bundle`).

## Lumina Computer wiring
- Skill library: `_shared/computer-skill-library.ts` aggregates `_shared/skill-library/skills/category-{1..8}.ts` (each exports `CATEGORY_N: ComputerSkill[]`) into `COMPUTER_SKILLS`; exports `COMPUTER_SKILL_ROUTER_PROMPT`, `selectComputerSkills(request, {limit,minScore})`, `buildComputerSkillsBlock(matches)`.
  - WARNING: `_shared/skills/` (docs/sheets/slides/webapp) is a SEPARATE, unrelated dir — imports must point at `./skill-library/skills/category-N.ts`.
- System prompts: `chat/index.ts` buildSystem — computer → `COMPUTER_SYSTEM_PROMPT`, study → `TEACHER_SYSTEM_PROMPT`, mun → `getSystemPromptForIntent("mun")`; `doubt-solver` → `DOUBT_SOLVER_SYSTEM_PROMPT`; `lc-agent-plan` uses `selectComputerSkills`/`buildComputerSkillsBlock`. `_shared/craft-skills.ts` and `_shared/skills.ts` are legacy (no longer imported by these paths).

## Model routing
- `lc-llm-router` ignores the `model` override — it uses the routing role. Content → `nemotron-3-super-120b:free` (+gemma fallbacks), code → `north-mini-code:free`. No dead 550B slugs anywhere. `lc-agent-plan` needs `{message}`, not `goal`.
- OPEN ISSUE: `generate-boss` returns 502 "Failed to generate boss" — MODELS_FAST weak first model likely returns prose the JSON parse rejects.

## Deployment
- Live bundle `index-CZ_EBZoT.js` (retry loop) is live at `luminaai.co.in` after `vercel deploy --prebuilt --prod`.
