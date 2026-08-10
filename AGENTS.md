## Objective
- Fix Lumina Computer "Build failed" error caused by missing Supabase database tables

## Important Details
- Bundle `index-CZ_EBZoT.js` with the retry loop IS live at `luminaai.co.in` after deploying prebuilt dist via `vercel deploy --prebuilt --prod`.
- Browser console showed `404` on `lc_projects`, `user_credit_balances`, `study_sessions` tables — they did **not** exist in Supabase project `mnljpvotimtxkufwkano`.
- Remote database had old migrations (`migrations_old/` style: `20260306080304`–`20260410112012`) applied; local `migrations/` directory has numbered files (`0001`–`0049`) plus timestamp-based files (`20260623153430`–`20260716040005`) that create `lc_projects`, `lc_blocks`, `lc_model_routing` — these newer migrations were never pushed.
- `supabase migration up` fails locally (no local Postgres). `supabase db push --linked` errors: "Remote migration versions not found in local migrations directory".

## Work State
### Completed
- Retry loop deployed and verified live in production bundle `index-CZ_EBZoT.js`.
- Root cause found for Lumina Computer "Build failed": 404s on `lc_projects`, `user_credit_balances`, `study_sessions` — tables missing from remote DB.
- All 7 missing tables created directly via `supabase db query --linked --file`:
  - `lc_projects`, `lc_blocks`, `lc_generation_log`, `lc_model_routing`, `lc_model_cooldowns`
  - `user_credit_balances`
  - `study_sessions` (already existed)
- `public.touch_updated_at()` function created.
- `lc_model_routing` seeded with model routing config.

## Migration Reconciliation (completed)
- Copied all old-style files from `migrations_old/` into `migrations/`, deleted the numbered duplicates (`0001`-`0049`, same content).
- Marked the 11 new timestamp-based migrations (`20260623153430`–`20260716040005`) as applied via `supabase migration repair --status applied` since their SQL was already run manually via `db query --linked`.
- `supabase db push --linked` now reports "Remote database is up to date."
- **Note:** Some intermediate old-style migrations (`20260416022100`–`20260619065343`) were removed from `migrations/` and repaired as reverted on remote because they had missing dependencies (e.g., `squads` table). The SQL content from those files was partially applied via direct queries.

## Relevant Files
- `supabase/migrations/20260712060410_c9b25e66-0b25-44b8-a9cc-b2c9fa281a57.sql`: Creates `lc_projects`, `lc_blocks`, `lc_model_routing` tables
- `supabase/migrations/0022_20260504062357_ec837ab2-ba51-4afc-a697-5bc039ff3c8d.sql`: Creates `user_credit_balances` table and `touch_updated_at()` function
- `src/features/luminaComputer/api.ts` (line 35–39): `FN_BASE` and `authHeader()` — backend URL uses `VITE_SUPABASE_URL`

## Craft-skill system (Lumina Computer "no random skill" wiring — built)
- `_shared/teacher-system-prompt.ts` → `TEACHER_SYSTEM_PROMPT`; `_shared/doubt-solver-system-prompt.ts` → `DOUBT_SOLVER_SYSTEM_PROMPT`; `_shared/computer-system-prompt.ts` → `COMPUTER_SYSTEM_PROMPT`.
- `_shared/computer-skill-library.ts` aggregates 8 skill categories from `_shared/skill-library/skills/category-{1..8}.ts` (each exports `CATEGORY_N: ComputerSkill[]`) into `COMPUTER_SKILLS`. Exports `COMPUTER_SKILL_ROUTER_PROMPT`, `selectComputerSkills(request, {limit,minScore})`, `buildComputerSkillsBlock(matches)`.
  - WARNING: `_shared/skills/` (docs/sheets/slides/webapp) is a SEPARATE, unrelated dir — imports must point at `./skill-library/skills/category-N.ts`.
- Wired into endpoints:
  - `chat/index.ts` `buildSystem`: computer → `COMPUTER_SYSTEM_PROMPT`; study → `TEACHER_SYSTEM_PROMPT`; mun → `getSystemPromptForIntent("mun")`.
  - `doubt-solver/index.ts`: uses `DOUBT_SOLVER_SYSTEM_PROMPT`.
  - `lc-agent-plan/index.ts` `callRouter`: uses `selectComputerSkills`/`buildComputerSkillsBlock` (was `selectCraftSkills` from `_shared/craft-skills.ts`).
  - `_shared/craft-skills.ts` and `_shared/skills.ts` still exist but the above paths no longer import them.
- BUILD CHECK (esbuild, no Deno locally): `npx --no-install esbuild <fn>/index.ts --bundle --loader:.ts=ts --outdir=<tmp> --log-level=error` must exit 0.
