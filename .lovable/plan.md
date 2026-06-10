## Scope (grouped)

### 1. Lumina Computer — agentic, multi-file, Kimi K2.6 primary
- Force `moonshotai/kimi-k2-thinking` (K2.6) as the ONLY model for `/computer` route. Route via `KIMI_API_KEY` direct call in `_shared/models.ts`. Other features keep current routing.
- Add an **agent loop status strip**: "Planning → Coding → Evaluating → Re-evaluating → Optimizing → Done" streamed live above the chat, driven by stage tags emitted by `lumina-pipeline`.
- **Conversation memory**: persist full thread in `chats` + `chat_messages` (already exist). Load last N=40 messages on mount, send rolling window (truncated by tokens) so AI doesn't "forget".
- **File tree sidebar** (left panel in `LuminaComputer.tsx`): hierarchical from `useComputerFiles` paths (`src/components/Foo.tsx`), expand/collapse folders, click → opens in editor/preview, active highlight.
- **Download as ZIP**: button in files panel uses `jszip` to bundle all `ComputerFile`s preserving paths.
- **Code check stage**: after build, AI runs a self-review pass (syntax balance, imports resolved, entry file exists) and surfaces issues inline before "Done".
- Continue button stays; verify stitching across files.

### 2. Artifacts — proper topic-aware notes
- `ChatPage.tsx` `artifactNote` currently generic. Pass the user's request topic to a small note-generator that returns: **What it is** (1 line about the topic), **How to use**, **Customize** — all referencing the actual subject (e.g., "Photosynthesis flashcards"), not boilerplate.
- Introduce **Lumina font system**: add `@fontsource` packs (Geist, Geist Mono, Instrument Serif, Space Grotesk) to `index.css`, expose CSS vars `--font-display`, `--font-body`, `--font-mono`, `--font-editorial`. Aesthetic styles in `aestheticStyles.ts` reference these vars instead of generic stacks.
- **Math/exponents rendering fix**: ensure KaTeX runs on artifact + chat. In `MarkdownRenderer.tsx` confirm `remarkMath` before `remarkGfm` and `rehypeKatex` mounted; add KaTeX CSS import; handle `x^2`, `H_2O` inline auto-wrapping with a small preprocessor.

### 3. Performance + Weakness Radar — topic-level, not test-level
- `Performance.tsx` + `WeaknessRadar.tsx`: aggregate `mistakes` and `question_responses` by `topic` (not by `test_id`). Add SQL view-style query grouping: `SELECT topic, COUNT(*) wrong, AVG(score)` per user. Update charts and `InsightBox` copy.

### 4. Tests — generation speed
- `generate-test/index.ts`: switch to `MODELS_FAST` racing 2 providers in parallel, lower `maxTokens` to question budget, stream questions one-by-one so UI renders progressively (skeleton → live).

### 5. Doubt Solver — speed
- `doubt-solver/index.ts`: race FAST models, stream SSE, drop unused context blocks. Frontend already streams; add immediate skeleton.

### 6. Lecture AI — podcast 401
- `generate-podcast-script/index.ts` returns 401: caller in `LecturePodcast.tsx` likely missing `Authorization` header from session. Fix client to always pass `(await supabase.auth.getSession()).data.session.access_token`. Verify `verify_jwt` flow in `requireUser`.

### 7. Game Modes
- Audit `GameModes.tsx` + `generate-boss` function: surface errors, fix broken handlers/routes. Likely auth or model timeout. Add retry + fast model.

### 8. Removals
- Delete `Squad.tsx`, squad components, `squads/squad_*` UI references, route, sidebar entry. Keep DB tables (non-destructive).
- Delete `GuidedLesson.tsx` page, `guided-lesson` function call sites, sidebar entry, route.
- **Disable connectors**: remove `ConnectorHub` route + sidebar entry, hide `ConnectorPlusMenu` in chat input. Keep edge functions dormant.

### 9. Dodo Payments — entitlements sync
- `dodo-webhook/index.ts` already handles `payment.succeeded` / `subscription.*`. Additions:
  - On every active event, after sync, call Dodo API `GET /customers/{id}/entitlements` + `/credit_entitlements` using `DODO_API_KEY`.
  - Upsert into new `user_entitlements` table: `(user_id, entitlement_key, product_id, credits_remaining, status, current_period_end)`.
  - Set `profiles.subscription_status = 'active' | 'canceled'`, store `customer_id`, `subscription_id`, `payment_id` on `subscriptions` row (already partly there).
  - Handle `subscription.canceled` → status `canceled`, entitlements `revoked`.
  - **Do NOT manually add credits** — remove the `sync_dodo_entitlement_for_user` credit-adding path for webhook events (Dodo grants credits itself); only mirror.
- App access checks: update `useSubscription` + `useUsageLimits` to read `subscription_status` + `user_entitlements`.

## Technical Notes

**New files**
- `src/features/computer/FileTree.tsx` — recursive tree from flat file list
- `src/features/computer/downloadZip.ts` — JSZip bundler
- `src/features/computer/AgentStatusStrip.tsx`
- `src/lib/fonts.ts` + font imports in `index.css`
- `supabase/functions/dodo-sync-entitlements/index.ts` (or inline in webhook)
- Migration: `user_entitlements` table + RLS + GRANTs

**Edited**
- `supabase/functions/_shared/models.ts` — Kimi-only routing for `featureName === "computer"`
- `supabase/functions/chat/index.ts` + `lumina-pipeline/index.ts` — emit stage events `<lumina:stage>planning</lumina:stage>` etc.
- `src/pages/LuminaComputer.tsx` — sidebar layout, persistence, stage strip, ZIP button
- `src/features/chat/ChatPage.tsx` — topic-aware artifactNote
- `src/components/MarkdownRenderer.tsx` — math fix
- `src/pages/Performance.tsx`, `src/pages/WeaknessRadar.tsx` — topic aggregation
- `supabase/functions/generate-test`, `doubt-solver`, `generate-boss` — speed
- `src/components/lecture/LecturePodcast.tsx` — auth header
- `src/App.tsx` + `AppSidebarContent.tsx` — remove squads/guided/connectors routes
- `supabase/functions/dodo-webhook/index.ts` — entitlements fetch + mirror, no manual credits

**Deletions**
- `src/pages/Squad.tsx`, `src/pages/GuidedLesson.tsx`, `src/pages/ConnectorHub.tsx` (route only), related sidebar items

## Open Questions
1. Should the **Lumina font system** be a fixed Apple-ish pairing (Instrument Serif + Geist + Geist Mono) or expose a user picker in Settings?
2. For **Dodo entitlements**, do you want a brand-new `user_entitlements` table, or extend existing `subscriptions` + `user_credit_balances`?
3. **Squads & Guided Lesson** — confirm full removal (UI + routes), keep DB tables untouched, OK?
4. **Kimi K2.6** — restrict to `/computer` only, or also use for Lumina Computer-style code generation inside chat artifacts?