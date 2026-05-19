# Lumina Computer — Agentic Substrate Rebuild

## Goals
1. Reliable artifact rendering — no broken HTML, no truncation.
2. Substrate-style cyberpunk workspace (matches reference): left file explorer + INITIALIZE_NODE, center tabbed Source Code / Manifest View, bottom Neural Link Protocol log, right realtime preview panel.
3. Agentic abilities — Lumina can create/edit multiple files, stream code live into the editor, and navigate the user to other Lumina pages.
4. OWL Alpha as primary model, OpenRouter free models as fallback.
5. `max_tokens = 65000`, streaming continues until the model finishes — never cut mid-output.

---

## 1. Backend — `supabase/functions/chat/index.ts`

- When `mode === "computer"`: force model list to `["openrouter/owl-alpha", ...MODELS_LONG_CTX, ...MODELS_QUALITY]` (de-duped). OWL Alpha first, free fallback after.
- Set `maxTokens = 65000` for computer mode (override the 131072/1200 branch).
- Bump `timeoutMs` to 240_000 for computer mode so long artifacts complete.
- Inject a new **AGENTIC SYSTEM PROMPT** for computer mode that instructs the model to emit a strict machine-parseable format:

  ```
  <lumina:plan>short plan in markdown</lumina:plan>
  <lumina:file path="index.html" lang="html">
  ...full file contents, no truncation...
  </lumina:file>
  <lumina:file path="styles.css" lang="css">...</lumina:file>
  <lumina:navigate to="/tests" reason="..."/>   (optional)
  <lumina:final>final summary for the user</lumina:final>
  ```

  Rules in prompt: always close every tag; never truncate; one full file per `<lumina:file>`; emit at least one file when the user asks for code/artifact; HTML files must be complete `<!doctype html>` documents; the editor will render whatever is inside file tags.

- Keep existing live web research block for computer/mun/deep.

## 2. Streaming Parser — new `src/features/computer/parser.ts`

- Incremental parser that consumes the streamed token buffer and emits events:
  - `plan` (markdown chunk)
  - `file` `{path, lang, content, done}` — fires on every delta so editor updates live
  - `navigate` `{to, reason}`
  - `final` (markdown summary)
- Tolerates partial tags mid-stream (buffer until tag closes for attributes; stream body deltas live).
- Fallback: if no `<lumina:*>` tags appear, treat the whole stream as a single virtual file `response.md` so legacy responses still render.

## 3. Frontend — rewrite `src/pages/LuminaComputer.tsx` (Substrate layout)

Layout (CSS grid, full viewport, dark `#05060d`, cyan `#22d3ee` + violet accents, mono font for chrome):

```text
┌──────────────────────── Topbar: THE SUBSTRATE • tabs • status ───────────────────────┐
│ Sidebar (260px)   │ Center: tabs SOURCE_CODE | MANIFEST_VIEW       │ Preview (480px)│
│  • Workspace card │   • Live code editor (read-only, line numbers, │  • Big iframe   │
│  • ROOT_EXPLORER  │     syntax tint, auto-scroll as tokens stream) │    preview of   │
│    file list      │   • Tab per file Lumina generates              │    active HTML  │
│  • ACTIVE_TABS    │   • Manifest view = rendered markdown plan     │    file         │
│  • INITIALIZE_    │ ────────────────────────────────────────────── │  • Fullscreen + │
│    NODE button    │   NEURAL_LINK_PROTOCOL log (auto-scroll)       │    download     │
│                   │   COMMAND_SUBSTRATE_ input (prompt bar)        │                 │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Behaviour:
- File explorer lists every `<lumina:file>` the model emits, with a live dot when streaming.
- Clicking a file switches the editor tab. Editor uses a lightweight virtualized `<pre>` with line numbers (no Monaco needed) and a typing caret while streaming.
- Preview panel auto-selects the first HTML file and re-renders the iframe each time that file's content updates (debounced 250ms). Big — fills the right column; fullscreen toggle expands to full viewport.
- Log feed prints timestamped lines: `[SYNC] routing → owl-alpha`, `[FILE] index.html +1.2KB`, `[NAV] /tests`, `[DONE] 3 files · 12.4s`.
- Navigation tool: when a `<lumina:navigate>` event fires, show a confirm toast "Open /tests?" → on accept call `useNavigate()`.
- Prompt bar pinned bottom with capability suggestion chips for first-run ("Build a calculus visualiser", "Deep research: ...", "Take me to flashcards and generate 20 on derivatives").

## 4. Capabilities & "best of Lumina" panel

Onboarding empty state inside the editor area: 3 columns of capability cards (study guides, deep research, MUN, code artifacts, multi-file apps, page navigation), each click pre-fills the prompt bar.

## 5. Robust artifact rendering rules

- Editor never truncates: store full text in state, render via virtualized slice when > 2000 lines.
- iframe uses `sandbox="allow-scripts allow-forms allow-popups allow-modals"` and `srcDoc` rebuilt from the full file text.
- If a file is CSS or JS, the preview combines it with the active HTML file (inject `<style>`/`<script>` if HTML doesn't already reference it).
- Markdown / non-HTML files render in MANIFEST_VIEW tab with `MarkdownRenderer`.

## 6. Cleanup

- Remove the duplicate `ChatBubble`/single-message UX from current `LuminaComputer.tsx` — replaced by workspace UX above. Keep `/chat` page untouched.
- No backend schema changes, no new edge functions.

## 7. Files changed

- `supabase/functions/chat/index.ts` — computer-mode routing, 65k tokens, agentic prompt.
- `src/features/computer/parser.ts` — NEW streaming tag parser.
- `src/features/computer/useComputerStream.ts` — NEW hook (fetch + parser + state).
- `src/features/computer/components/{Sidebar,Editor,PreviewPanel,LogFeed,PromptBar,TopBar}.tsx` — NEW.
- `src/pages/LuminaComputer.tsx` — rewrite to compose the workspace.

## Technical notes (for devs)
- Editor is a `<div>` of pre-rendered lines with `font-variant-ligatures:none`, color-tinted by file extension (no heavy syntax highlighter — keeps it fast under streaming).
- Preview iframe key includes `${activeFile}:${contentHash}` so React remounts cleanly on each meaningful change but not on every token.
- Owl Alpha + free fallback is enforced server-side; client never picks the model.
- All `<lumina:*>` tags are stripped from any user-visible markdown so raw tags never leak into the UI.
