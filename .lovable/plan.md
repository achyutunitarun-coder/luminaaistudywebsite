# Lumina Computer v2 — Core Architecture Refactor

A focused refactor of the Lumina Computer pipeline to fix the four critical failures: unreliable orchestration, reasoning leaking into code, single-file preview, and missing memory.

## P0 — Persistent Session Memory

**Storage**: New `lumina_sessions` table (sessionId, user_id, conversation_history jsonb, project_files jsonb, agent_logs jsonb, architecture_decisions jsonb, updated_at).

**Client**: `useLuminaSession` hook — loads/saves session by ID (URL param `/computer/:sessionId`), keeps `sessionState` in zustand, debounced 1s persist to Supabase.

**Server (`lumina-pipeline`)**: Accept `sessionId` + `request`. Load full session from DB before any agent call. Every agent prompt receives:
- Current request
- Existing file tree (paths + truncated contents)
- Last N conversation turns
- Architecture decisions
- Recent agent logs

After run completes, append turn + write updated files back to DB.

**File-aware editing**: Builder receives a `mode: "edit" | "create"` flag. If existing project files exist, default to `edit` and instruct the model to output ONLY changed/new files (full content of those files), preserving the rest. Server merges patch into the project tree rather than replacing it.

## P0 — Debugger Gate (Mandatory)

Strict state machine in `lumina-pipeline/index.ts`:

```text
Orchestrator → Planner → Researcher → Builder → Debugger → Optimiser → Output
                                          ↑          ↓
                                          └── fail ──┘ (max 3 loops)
```

Each agent returns:
```ts
{ status: "success" | "failure", output: string, nextAgent: string, logs?: string[] }
```

- Driver function `runAgent(stage)` enforces sequence; no stage may be skipped.
- Debugger runs syntax checks (parse JS/TS/HTML/CSS via lightweight validators), missing-import detection, and a model-based code review pass. Returns `{ status, errors[] }`.
- On `failure`: feedback string fed back into Builder with the broken files, regenerate, revalidate. Max 3 iterations, then surface error to user — **never render unvalidated code**.
- All debugger runs streamed as stage events and stored in `agent_logs`.

## P1 — Output Separation (Reasoning vs Code)

**Two channels in SSE stream**:
- `channel: "activity"` → planning, research, debug notes, optimisation rationale → rendered in `AgentPipelinePanel` / new `AgentActivityLog`.
- `channel: "code"` → only file writes (path + content) → rendered in `FilesPanel` / preview.

**System prompt addition** (prepended to every agent in `_shared/lumina-persona.ts`):
> "You are forbidden from placing planning notes, reasoning, debugging logs, explanations, or meta-commentary into generated source files. Source files must contain only production-ready code. Reasoning belongs in your `output` field, never in file contents."

**Parser hardening** (`features/computer/parser.ts`): strip leading/trailing prose, reject files that are pure markdown/explanation, drop `<thinking>`-style blocks.

## P1 — Multi-File Preview Engine

Refactor `LuminaComputer` preview to mount the **entire file tree**, not just `index.html`.

**HTML projects**:
- Build a virtual filesystem from `sessionState.projectFiles`.
- Use a service-worker / blob-URL strategy: rewrite `<link href="styles.css">`, `<script src="script.js">`, `<img src="assets/x.png">` to blob URLs created from the in-memory tree.
- Implementation: parse `index.html`, walk all relative `href`/`src`, replace with `URL.createObjectURL(new Blob([fileContent], { type: mime }))`.

**React/Vite projects**:
- Use Sandpack (`@codesandbox/sandpack-react`) with `files` prop fed from `projectFiles`. Supports multi-file, JSX, Tailwind, React Router out of the box.
- Auto-detect React by presence of `package.json` with `react` dep or `.jsx/.tsx` entry.

**Preview component**: new `MultiFilePreview.tsx` that picks HTML strategy vs Sandpack based on detected project kind.

## File-Level Changes

**New**:
- `supabase/migrations/<ts>_lumina_sessions.sql` — table + RLS + grants.
- `src/features/computer/useLuminaSession.ts` — session load/save hook.
- `src/features/computer/MultiFilePreview.tsx` — blob-URL HTML + Sandpack React.
- `src/features/computer/buildVirtualHtml.ts` — rewrite asset URLs.
- `src/features/computer/AgentActivityLog.tsx` — Channel A renderer.
- `supabase/functions/_shared/agentStateMachine.ts` — typed agent runner.
- `supabase/functions/_shared/codeValidators.ts` — syntax/import checks.

**Edited**:
- `supabase/functions/lumina-pipeline/index.ts` — state machine, debugger loop, session load/save, two-channel SSE.
- `supabase/functions/_shared/lumina-persona.ts` — anti-reasoning-in-code clause.
- `src/hooks/useLuminaPipeline.ts` — accept sessionId, split `activity` vs `code` events, expose `files` map.
- `src/pages/LuminaComputer.tsx` — route `/computer/:sessionId?`, integrate session hook, swap preview.
- `src/features/computer/parser.ts` — strip prose / meta blocks.
- `src/features/computer/filesStore.ts` — merge-patch semantics for edits.

## Dependencies
- Add `@codesandbox/sandpack-react` for React preview.

## Acceptance Verification (manual after build)
1. Create HTML project with `index.html` + `styles.css` + `script.js` + `assets/`. Preview renders styled and interactive.
2. Create React project. Preview renders compiled app.
3. Send 20 unrelated messages, then "fix the navbar" — server logs show existing navbar file loaded and only that file edited.
4. Force a Builder syntax error (mock) → Debugger blocks, retries, never renders broken code.
5. Inspect generated files — zero prose/planning text inside.

## Out of Scope (P2, deferred)
- Optimiser improvements beyond current behaviour.
- New agent capabilities or tools.
- UI redesign of the Computer page beyond the activity panel and preview swap.

## Risks
- Sandpack bundle size (~500KB) — lazy-loaded only on React projects.
- Blob URL lifecycle — revoke on file change to avoid leaks.
- Debugger loop cost — capped at 3 iterations with per-iteration model = fast tier.
