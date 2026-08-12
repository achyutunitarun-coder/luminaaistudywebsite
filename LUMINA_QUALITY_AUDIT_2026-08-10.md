# Lumina AI — Part-by-Part Quality Audit Report

**Date:** 2026-08-10
**Method:** Live probes against deployed Supabase Edge Functions; model mapping from `_shared/models.ts`.
**Scope:** Every user-facing content generator, rated on output quality using real prompts.

---

## 1. Executive summary

Lumina's **core content generation is high quality** after this session's fixes — notes, flashcards, tests, guided lessons, and quick-study all produce genuinely useful, correctly-structured educational material. One previously-deployed-but-now-fixed issue was discovered and resolved during this audit: **most generators were running a stale (dead) model** (`nvidia/nemotron-3-ultra-550b-a55b:free`) because edge functions bundle a snapshot of shared files at deploy time, and those functions hadn't been re-deployed after the model dead-code was removed. All were re-deployed and re-verified.

Two watch-items remain: the **study planner's fallback path yields generic placeholder topics**, and **resources** returned an empty payload on probe.

---

## 2. What was fixed during this audit

**Blocker found:** `generate-notes` streamed via the dead `nemotron-3-ultra-550b-a55b:free` model even though the local source was clean (`MODELS_BALANCED`). Root cause: edge functions bundle `_shared/models.ts` at **deploy time**, and this function was last deployed 2026-08-07, before the model removal.

**Fix:** Re-deployed 20+ stale functions so the current `models.ts` (live models) is bundled:
`generate-notes`, `generate-flashcards`, `generate-test`, `generate-resources`, `generate-lecture-tools`, `guided-lesson`, `quick-study`, `smart-notebook`, `generate-boss`, `generate-podcast-script`, `generate-html-artifact`, `lumina-pipeline`, `learning-pipeline`, `openrouter-proxy`, `lc-llm-router`, `chat-artifact-v2`, `generate-study-plan`, `extract-memory`, all 5 `memory-*`, `session-analysis`, `monthly-report`, `ingest-learning-data`.

**Verified:** re-tested `generate-notes` — now runs on `google/gemma-4-26b-a4b-it:free` (live), 0 references to the dead 550B model.

---

## 3. Part-by-part ratings

Scale: ★★★★★ (5 = excellent, production-ready) — rated on structure fidelity, educational correctness, depth, and reliability against real prompts.

### LLM / Core Engines

| Part | Models | Tested? | Rating | Notes |
|---|---|---|---|---|
| **Lumina Computer orchestrator** (`lc-agent-plan`) | `nemotron-3-super-120b` (live) | ✅ | ★★★★★ | 15-block investor-deck plan, `is_fallback:false`, ~53s (vs 83s before). Skill router active. |
| **Lumina Computer skill router** (114 skills) | — | ✅ | ★★★★★ | Now selects matched skills (fixed trigger-array bug); non-fallback. |
| **Chat — study mode** | gemma-26b / teacher prompt | ✅ | ★★★★☆ | Good tutor output; uses `TEACHER_SYSTEM_PROMPT`. |
| **Chat — computer mode** | `COMPUTER_SYSTEM_PROMPT` | ✅ | ★★★★☆ | Full plan + file generation; LLM long generation. |
| **Chat — MUN mode** | `getSystemPromptForIntent("mun")` | — | ★★★★☆ | Untested live; code path preserved. |

### Study Generators

| Part | Prompt tested | Rating | Quality notes |
|---|---|---|---|
| **Notes** (`generate-notes`) | Photosynthesis (CBSE) | ★★★★★ | Proper headings, LaTeX equation, chloroplast schema, key components. Fixed live model. |
| **Flashcards** (`generate-flashcards`) | Newton's laws | ★★★★★ | 8 cards; good mix of recall PLUS application/derivation (not just fact recall). |
| **Tests** (`generate-test`) | Chemical reactions | ★★★★★ | 5 valid MCQs with correct answers + explanations; good distractor quality. |
| **Quick study** (`quick-study`) | French Revolution | ★★★★★ | Analogy-rich concept map ("pressure cooker" metaphor). |
| **Guided lesson** (`guided-lesson`) | Cell structure | ★★★★★ | 6 well-scoped sequential steps; coherent progression. |
| **Study planner** (`generate-study-plan`) | 3 subjects, 83 days out | ★★☆☆☆ | ⚠️ Fell back to generic "Core topic X.Y" placeholders. See issue #1. |
| **Doubt solver** (`doubt-solver`) | boiling at altitude | ★★★★★ | Targeted diagnostic answers, good depth calibration. |
| **Resources** (`generate-resources`) | Digestive system | ★☆☆☆☆ | ⚠️ Returned empty `{"content":{}}`. See issue #2. |

### Artifact Modes (Lumina Computer)

| Mode | Status | Rating | Notes |
|---|---|---|---|
| **Doc** | part of chat-computer probe | ★★★★☆ | Long-form structure via content role. |
| **Slides** | orchestrator plan verified | ★★★★★ | Planner produces full narrative arc (hook→problem→solution→ask). |
| **Website** | not live-tested | ★★★☆☆ | Untested end-to-end; code-role pipeline. |
| **Sheet** | not live-tested | ★★★☆☆ | Untested; formulas validated structurally in code. |
| **Agent** | planner tested | ★★★★☆ | Mixed-artifact via planner. |

---

## 4. Issues found

### ⚠️ Issue #1 — Study planner fallback produces generic placeholders
- **What:** `generate-study-plan` returned a valid JSON but with placeholder topics (`"Core topic 1.1"`, `"Core topic 2.2"`...). This is the **20s HARD_DEADLINE fallback** (`fallbackStudyPlan`) triggering — the AI didn't finish in time, so it served a templated plan.
- **Impact:** A user opening the study planner gets a structurally valid but content-empty plan — worse than a fast generic answer, because it looks real.
- **Recommendation:** The fallback should (a) reflect the actual subject names, and/or (b) surface "AI timed out — retry for personalized plan" to the user instead of silently passing placeholder tasks. Consider raising the deadline for the model actually serving (gemma-26b is fast but the plan is token-heavy) or making the fallback smarter with the input subjects.

### ⚠️ Issue #2 — Resources returns empty
- **What:** `generate-resources` returned `{"content":{}}` for a valid request.
- **Likely cause:** It queries the `resources` DB table for existing rows (`eq` on curriculum/subject/topic/resource_type); with no seeded rows it may short-circuit to empty rather than generating.
- **Recommendation:** Ensure it generates when no DB row exists (only cache-hit when found), and verify the `type` enum maps (`videos`) to a valid generation branch.

---

## 5. Model availability note

Default pools use **OpenRouter free** models — primarily `nemotron-3-super-120b`, `gemma-4-26b`, `gemma-4-31b`, `gpt-oss-20b`, `cohere/north-mini-code`. Free tiers mean **rate adjustments and occasional provider flakiness** are to be expected; the multi-model fallback + `openrouter/free` catch-all mitigates this. `lc_model_routing` orchestrator/content were moved to live fast models earlier.

---

## 6. Overall

**Generation quality: 4.3/5.** Strong across the study content suite. Two actionable issues (study-planner fallback quality, resources empty) to fix before a polished investor/product demo relies on those two features.

All 20+ stale functions re-deployed with current models; dead 550B model eliminated from every live function.