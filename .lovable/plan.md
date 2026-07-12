# Lumina Computer — Build Plan

The spec is 6 phases. I'll do this in waves, verifying each before moving on. This response confirms the plan; on approval I start Wave 1 immediately.

## Wave 1 — Foundation (DB + router + Docs mode + streaming rail)
**DB migration** (`lc_projects`, `lc_blocks`, `lc_generation_log`, `lc_model_routing`, `lc_model_cooldowns`) with GRANTs + RLS. Seed `lc_model_routing` with the 6 roles from §3.

**Edge functions**
- `llm-router` — role-based routing, cooldown-aware, SSE **streaming** passthrough from OpenRouter, per-token forwarding, logs on completion. Uses `OPENROUTER_API_KEY` (already set).
- `agent-plan` — one orchestrator call, returns block plan JSON.

**UI** — replace `src/pages/LuminaComputer.tsx` with:
- Command bar + 5 mode chips + project list
- Split view: **build-trace rail** (left) with live rows `[status dot • title • model badge • status word • elapsed ms]`, artifact preview (right)
- Streaming: tokens append into the active block's content live; rail row pulses while generating
- **Progress log** panel below rail: "Planning blocks…", "Creating block 1/6: Introduction", "Streaming from kimi-k2.6…", "Block ready (1420ms)", "Regenerating block 3…" — timestamped, auto-scroll
- Regenerate-block on hover, scoped to one block
- Docs mode fully wired end-to-end

## Wave 2 — Slides mode
Block schema with `visual` field. Separate content + visual regeneration. `pptxgenjs` export with `addChart` for native charts, rasterized SVG for illustrations.

## Wave 3 — Sheets mode
Tab/columns/rows/formulas schema, HTML grid preview with `fx` indicator, `exceljs` export writing real formula objects.

## Wave 4 — Websites mode
Sandboxed iframe preview, click-to-select via `postMessage`, scoped section regeneration, single-file HTML download.

## Wave 5 — Agent mode
Mixed block types in one project, bounded concurrency (3), queue visualization in rail.

## Wave 6 — Admin + polish
Routing/cooldown admin view, security audit (no client OpenRouter, no localStorage), a11y (focus rings, `prefers-reduced-motion`), mobile responsive.

## Cross-cutting non-negotiables (§2)
- OpenRouter key only in edge function
- No localStorage/sessionStorage
- Every block shows model badge
- One retry then visible "needs retry" — never silent empty content
- Stable block IDs; regen never re-renders siblings

## Verification per wave
Playwright against `/lumina-computer`: submit goal → observe build-trace rail streams tokens → block completes → export downloads a valid file. Screenshots saved for each.

## Explicit deferrals
- Website hosting/publish (v2 per spec)
- Paid model fallbacks (§9)
- Image generation (none free — using code-rendered visuals)

Approve to start Wave 1.
