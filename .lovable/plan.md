# Lumina Chat — Fix artifacts + Claude-parity upgrades (scoped)

## What's actually broken (confirmed from logs)

Edge function logs for `chat-artifact-v2` show:

```
✓ openai/gpt-oss-120b:free (key 1)         ← model succeeded
ERROR Http: connection closed before message completed   ← client aborted
```

Translation: the model **does** generate, but the client `AbortController` fires at **120s** while the server budget is **170s**. When the primary model is slow or one fallback is tried first, the client kills the request right before the server returns the HTML. Result: "Generation failed — no credits charged" every time.

Two other smaller bugs in the same path:
- `singleAttempt` per-attempt timeout = 120s, and we do up to **3 attempts** sequentially → wall-clock can exceed any reasonable wait.
- Validation requires `<!doctype` / `<html`, fine for notes/exam/slides, but `code` artifacts may legitimately be a `<html>` snippet and currently pass — kept as-is.

## What I will NOT do from your big spec

The spec asks to put `VITE_OPENROUTER_API_KEY` in the **frontend** and call OpenRouter directly from the browser. I will not do this — it exposes the key to anyone who opens DevTools, lets randoms drain your account, and bypasses your credits/auth. All model calls stay in the existing edge functions (`chat`, `chat-artifact-v2`) which already do key rotation, racing, and fallback.

I will also not delete the working server model roster in `_shared/models.ts` to swap in the spec's roster — several IDs in the spec are dead on OpenRouter today (`qwen/qwq-32b:free`, `qwen/qwen2.5-vl-72b-instruct:free`, `liquid/lfm-40b:free`, `bytedance-research/ui-tars-72b:free`, `tngtech/deepseek-r1t-chimera:free`, `mistralai/devstral-small:free` as free, `nousresearch/hermes-3-llama-3.1-405b:free`). The current server roster was just verified live last turn. I'll **add** the few good ones from your spec that resolve, not replace the whole list.

## Plan

### 1. Fix the artifact timeout (root cause)

`src/features/chat/utils/generationWrapper.ts`:
- Raise per-attempt `timeoutMs` default to **180_000** (server budget is 170s + network).
- Drop `maxRetries` default from 2 → **1** (server already races 4 models internally; client retries just multiply wall-clock).
- Keep credit-on-success-only logic untouched.

`supabase/functions/chat-artifact-v2/index.ts`:
- Lower `HARD_BUDGET_MS` from 170_000 → **150_000** so it always returns before the new client deadline.
- Lower per-model cap inside the loop from 90_000 → **70_000** so a slow model can't eat the whole budget.
- Trim `HTML_MODELS` to the 5 verified-working free models, ordered by observed quality:
  `openai/gpt-oss-120b:free`, `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen3-next-80b-a3b-instruct:free`, `google/gemma-3-27b-it:free`, `openai/gpt-oss-20b:free`.
- Keep the `200 OK + { error }` shape so client wrapper handles failures gracefully.

`src/features/chat/ChatPage.tsx`:
- Pass the new 180s timeout into `attemptGeneration`.
- Update the loading-stage rotation in `LoadingStages.tsx` so users see meaningful progress over the longer wait (no logic change to credits).

### 2. Selective Claude-parity upgrades (UI only, no API rewrite)

These are the high-value pieces from your spec that don't require exposing keys or rebuilding routing. All scoped to `/src/features/chat/`.

**a. Stop button (already works) + Regenerate + Edit user message**
`MessageBubble.tsx`:
- On hover of an assistant text message: show Copy / Regenerate / 👍 / 👎 row (icons from lucide-react, already installed).
- On hover of a user message: show ✎ Edit. Edit replaces the bubble with a textarea + Submit/Cancel; Submit truncates messages from that point and re-sends.

`ChatPage.tsx`:
- Add `editMessage(id, newText)` and wire `regenerate(id)` per message (currently it only regenerates the last user message).

**b. Mode pill bar above input (Auto / Reasoning / Study / Coding / Deep Dive / Creative / Fast)**
`ModelSelector.tsx`: replace the existing dropdown with a horizontal pill bar matching the spec's look. The `mode` value already flows to the `chat` edge function via `getModelsForMode` — no server change needed.

**c. `<think>...</think>` collapsible block**
`MessageBubble.tsx` / `MarkdownRenderer.tsx`: when reasoning models emit `<think>` tags, extract them into a collapsed "🧠 Thinking process" panel above the answer. Uses the existing `MarkdownRenderer` (no new markdown library).

**d. Auto-grow input + Shift+Enter newline + char counter**
`InputBar.tsx`: textarea grows to max 240px; Enter sends, Shift+Enter newlines; show counter when length > 1000.

**e. Send/Stop swap + cursor blink while streaming**
`InputBar.tsx`: if `isLoading`, render Stop button (already present); ensure visual swap is clean. `MessageBubble.tsx`: append a `▋` blinking cursor at the end of a streaming assistant message.

### 3. Files touched (exhaustive)

```
src/features/chat/utils/generationWrapper.ts        edit  – timeout + retry tuning
src/features/chat/ChatPage.tsx                      edit  – edit/regenerate per message, longer timeout
src/features/chat/components/MessageBubble.tsx      edit  – hover actions, edit mode, think block, cursor
src/features/chat/components/InputBar.tsx           edit  – auto-grow, counter, Shift+Enter
src/features/chat/components/ModelSelector.tsx      edit  – pill bar UI
src/features/chat/components/LoadingStages.tsx      edit  – longer-wait copy
supabase/functions/chat-artifact-v2/index.ts        edit  – budget + model list
```

Nothing outside `/src/features/chat/`, `/src/features/credits/`, and the one edge function is touched. No DB migrations. No new dependencies. No frontend OpenRouter key.

## Why this fixes "artifacts failing all the time"

The server-side log proof shows the model returns successfully — only the client gives up too early. Aligning the timeouts (server 150s < client 180s) eliminates the abort race that's currently failing every generation. The model-list trim removes 4 dead IDs that were silently burning ~10s each on 404 lookups before the working primary even got tried.

## Open question

Your spec wants **session-only** chat persistence (cleared on tab close, like Claude). Today messages live only in React state (also cleared on refresh). Want me to add `sessionStorage` persistence so a refresh keeps the current conversation, or leave it cleared on refresh? I'll default to leaving it as-is unless you say otherwise.
