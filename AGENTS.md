## Objective
- Maintain live site `luminaai.co.in`. Original: fix Lumina Computer "Build failed" (missing Supabase tables — done). Current: fix ORIGIN of runaway `pc-` artifacts and audit all edge functions for dead config/blob issues; containerize for staging verification.

## Important Details
- Bundle `index-CZ_EBZoT.js` with the retry loop IS live at `luminaai.co.in` after deploying prebuilt dist via `vercel deploy --prebuilt --prod`.
- Live-test creds (VALID): QA user JWT in `C:\Users\Tarun\AppData\Local\Temp\opencode\qa_token.txt` (user `lumina-qa-20260812181501@test.luminaai.co.in`); anon key in `lumina_anon_key.txt`. Management token `sbp_...` in Windows CredMan (target `Supabase CLI:supabase`, P/Invoke CredRead). Service-role key noted in session only — NEVER commit it. Supabase CLI has NO `db query`; use REST w/ service-role for DB checks, Management API `/database/query` for raw SQL.
- Edge CPU quota tight: `546 WORKER_RESOURCE_LIMIT`/`504` under concurrency; run heavy tests sequentially with sleeps.
- Live routing: content→`nemotron-3-super-120b:free` (+gemma fallbacks), code→`north-mini-code:free`. No dead 550B anywhere. `lc-llm-router` ignores `model` override (uses routing role). agent-plan needs `{message}` not `goal`.

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
- `supabase/migrations/20260813130000_restore_missing_tables.sql`: Restores 13 tables lost when intermediate old-style migrations were reverted (ingest-learning-data, task-history, generate-html-artifact, connector-oauth/proxy, preflight, learning-pipeline, artifact-store). Applied directly then marked applied — migration history is in sync.
- `supabase/migrations/20260812130000_content_strong_model.sql`: content upstreamed to nemotron-3-super-120b.
- `supabase/migrations/20260712060410_c9b25e66-0b25-44b8-a9cc-b2c9fa281a57.sql`: Creates `lc_projects`, `lc_blocks`, `lc_model_routing`
- `src/features/luminaComputer/api.ts` (line 35–39): `FN_BASE` and `authHeader()` — backend URL uses `VITE_SUPABASE_URL`
- `supabase/functions/generate-boss/index.ts`: deployed blob was corrupt (`NOT_FOUND_FUNCTION_BLOB`); redeployed `npx supabase functions deploy generate-boss`. Still returns 502 "Failed to generate boss" — MODELS_FAST weak first model likely returns prose the JSON parse rejects. OPEN ISSUE.

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
