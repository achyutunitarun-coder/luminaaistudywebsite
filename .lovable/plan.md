# Plan: Canvas Mode, Lumina Documents, Computer Upgrades

Three additive features. Nothing existing gets touched: no nav rail, sidebar, chat shell, mode chips, history, or routes other than two new ones.

## Scope guardrails

- Only modify: `src/App.tsx` (add 2 routes), `src/features/chat/ChatPage.tsx` (mount Canvas overlay after AI finishes), `src/pages/LuminaComputer.tsx` (additive: files panel + pipeline strip + input polish), and `supabase/functions/chat/index.ts` (persona + routing additions).
- Everything else lives in new files under `src/features/canvas/`, `src/pages/Documents.tsx`, `src/features/documents/`, `src/features/computer/pipeline/`, and `src/lib/openrouterRouting.ts`.
- Artifact viewer redesign: rewrite `src/features/chat/components/ArtifactViewer.tsx` only (Claude-style chrome, no behavior regressions).

## 1. Model Routing Engine — `src/lib/openrouterRouting.ts`

- `classifyIntent(text)` → calls `deepseek/deepseek-v4-flash:free` with JSON-only system prompt, returns `{type, complexity}`.
- `pickModel({type, complexity, modeChip})` → returns primary model id from the routing table in the brief.
- `streamOpenRouter({model, messages, onToken, onMeta})` → POST to `https://openrouter.ai/api/v1/chat/completions` with required headers, `stream:true`, `max_tokens:4096`. SSE parser (reuse pattern from `src/lib/aiStream.ts`).
- Universal fallback chain: `primary → openrouter/free → deepseek/deepseek-v4-flash:free`. Retry once after 800 ms, toast "Switched to backup model" 2.5 s via sonner.
- Key: read `VITE_OPENROUTER_KEY` from `import.meta.env`. (Need user to add this to env if not present — flag during build.)

## 2. Feature 1 — Canvas Mode (inside existing /chat)

New files:
- `src/features/canvas/CanvasPanel.tsx` — 54% slide-in panel, header, iframe, code overlay, version scrubber.
- `src/features/canvas/useCanvasDetector.ts` — after stream completes, regex the message for the LAST ```html|jsx|svg fenced block. If found, emits `{code, lang}`.
- `src/features/canvas/canvasDebug.ts` — runs generated code through `poolside/laguna-m.1:free` (fallback `laguna-xs.2:free`) with the debug system prompt and returns cleaned code.
- `src/features/canvas/canvasState.ts` — Zustand store: `{isOpen, name, versions[], activeIndex}` (max 20).

Wiring in `ChatPage.tsx`:
- Subscribe to "message stream complete" event. Run detector → debug pass → push version → open panel.
- Chat column wrapped so width transitions 100% → 46% with the documented cubic-bezier.
- Panel renders to right with 40 ms-delayed slide-in. X reverses both.
- "Export → Lumina Docs": writes `localStorage.lumina_canvas_export = currentHTML`, navigates `/documents`.

Iframe injection: extract raw string, prepend `<!doctype html><html><head><meta charset="utf-8"></head><body>` + code + `</body></html>` only when missing. `sandbox="allow-scripts allow-same-origin"`. Bg `#ffffff`.

## 3. Feature 2 — Lumina Documents (`/documents`)

New route added to `src/App.tsx` (does NOT use ProtectedLayout — full-screen standalone per brief).

New files:
- `src/pages/Documents.tsx` — page shell: header 56px, ribbon 44px, editor flex:1, AI panel 240px, footer 36px.
- `src/features/documents/Editor.tsx` — contenteditable wrapper with 740 px max-width, autosave (300 ms debounce) → `localStorage.lumina_doc_content`. Reads `lumina_canvas_export` / `lumina_doc_import` on mount and clears keys.
- `src/features/documents/Ribbon.tsx` — B/I/U/H1-3/lists/code/table/slides/✦ AI buttons; uses `document.execCommand` (acknowledged legacy but matches spec) for formatting. Slide card and table inserted via `insertHTML`.
- `src/features/documents/AISidePanel.tsx` — 240 px chat: streams `minimax/minimax-m2.5:free`, each token via `execCommand("insertText", false, token)` at cursor. Fallbacks: `qwen/qwen3-next-80b-a3b-instruct:free` (complex), `cognitivecomputations/dolphin-mistral-24b-venice-edition:free` (creative), `meta-llama/llama-3.2-3b-instruct:free` (quick).
- `src/features/documents/exports.ts` — PDF via `window.print()` with `@media print` styles in `src/features/documents/print.css`; HTML wrapped in standalone template; Markdown via simple DOM walker (h1-3, strong, em, li, pre). All via Blob + `URL.createObjectURL`.
- `src/features/documents/PreviewMode.tsx` — read-only div, runs `hljs.highlightAll()` and KaTeX over `$...$` / `$$...$$`. (KaTeX + highlight.js already in deps.)

Footer counters: live debounced 80 ms — words/chars/lines exactly per the formulas in the brief.

## 4. Feature 3 — Lumina Computer improvements (additive only)

Edit `src/pages/LuminaComputer.tsx` to mount three new components without touching existing layout:
- `src/features/computer/FilesPanel.tsx` — reactive list. Subscribes to agent output stream; pushes `{name, type, content, sizeKB}` to a Zustand `filesStore`. Icon by type, truncate name, size right. HTML rows: "Open in Canvas" → write `lumina_canvas_import` + navigate `/chat`. All rows: "→ Docs" → write `lumina_doc_import` + navigate `/documents`.
- `src/features/computer/pipeline/PipelineStrip.tsx` — 6 nodes (Planner, Router, Executor, Debug, Verify, Polish). Always rendered above the activity log. State machine driven by the agent runner. Active = teal fill + glow + 900 ms scale pulse. Done = purple + ✓. Error = `#dc2626` + ✗. Below each, 11 px italic log line.
- `src/features/computer/InputArea.tsx` (refactor existing input only): attach icon 32 px, rounded textarea matching chat input tokens, teal 32 px circle send. Prompt cards restyled to `#0f0f17` + ✦/↗.

Agent runner (`src/features/computer/agent.ts`, new): orchestrates Planner → Router → Executor[*] → Debug → Verify → Polish using the updated model assignments. Planner and Router use the exact JSON-only system prompts from the brief. Executor selects per-step model via the routing table.

## 5. Artifact Viewer redesign — `src/features/chat/components/ArtifactViewer.tsx`

Claude-style chrome: rounded card, title bar with filename + lang chip, copy + download + expand buttons, monospace code with JetBrains Mono, gradient header. HTML artifacts: tabs "Preview / Code", iframe sandboxed without `allow-same-origin` (keep current XSS hardening). Visual tokens from the design system. Behavior unchanged.

## 6. Lumina persona

Update `supabase/functions/chat/index.ts` to prepend the **Lumina Intellectual Companion** system prompt (full text from the brief) to every non-Computer-mode chat. Keep Computer agentic prompt as-is. Add small per-feature personas:
- Canvas debug prompt as specified.
- Documents AI side panel writing assistant prompt as specified.
- Planner / Router prompts wired into agent runner.

## 7. Routing additions in `src/App.tsx`

Only add:
```
<Route path="/documents" element={<Documents />} />
```
inside the existing `<Routes>` (outside `ProtectedLayout` since the brief says no nav/sidebar). `/computer` already exists — untouched.

## 8. State bridges

- `lumina_canvas_export` — Canvas → Documents
- `lumina_canvas_import` — Computer → Canvas (ChatPage reads on mount, opens canvas with that code)
- `lumina_doc_import` — Computer → Documents
- `lumina_doc_content` — Documents autosave

## 9. Mobile <768 px

- Canvas: tabs (Chat | Canvas) instead of split.
- Documents ribbon collapses behind a "Format ▾" dropdown.
- Computer: stack files / pipeline / chat vertically.

## 10. Open questions before build

1. **OpenRouter key**: brief says `VITE_OPENROUTER_KEY` (client-side). The project today uses server-side `OPENROUTER_API_KEY` via edge functions. Exposing the key client-side is a security risk. **Recommendation**: route all OpenRouter calls through a new `supabase/functions/openrouter-proxy` edge function using the existing server key, keep the routing logic client-side, stream SSE back. Confirm before I build it client-direct.
2. **Documents route**: brief says "no nav rail, no sidebar" → it'll be mounted outside `ProtectedLayout`. That also removes auth gating. OK, or should it stay behind auth (still hide chrome)?
3. **`execCommand`** is deprecated but matches the brief exactly. OK to proceed?

## Technical notes (non-user-facing)

- Reuse `src/lib/aiStream.ts` SSE parser; add a thin OpenRouter-specific wrapper.
- Zustand stores: `canvasStore`, `filesStore`, `pipelineStore` — co-located with their features.
- All new components consume design tokens from `index.css` / `tailwind.config.ts`; no hardcoded hex outside the explicit values listed in the brief.
- Highlight.js and KaTeX already installed; reuse.
- No DB migrations required.
- No new secrets unless we keep `VITE_OPENROUTER_KEY` client-side (see Q1).
