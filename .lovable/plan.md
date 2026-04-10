

## Plan: Complete Model Routing Overhaul + Lumina Hub Redesign

### PART 1: Model Routing — Full Free Model Pool

**File: `supabase/functions/_shared/models.ts`**

Replace the current 5-model tiers with the full 24-model pool, organized into 6 smart tiers:

- **FAST** (80% traffic): `google/gemma-3n-e2b-it:free`, `google/gemma-3n-e4b-it:free`, `google/gemma-3-4b-it:free`, `meta-llama/llama-3.2-3b-instruct:free`, `arcee-ai/trinity-large-preview:free`
- **BALANCED** (study/notes/flashcards): `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen3-next-80b-a3b-instruct:free`, `google/gemma-4-31b-it:free`, `openai/gpt-oss-20b:free`, `z-ai/glm-4.5-air:free`
- **QUALITY** (deep reasoning): `openai/gpt-oss-120b:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `google/gemma-3-27b-it:free`, `nousresearch/hermes-3-llama-3.1-405b:free`, `google/gemma-3-12b-it:free`
- **CODING**: `qwen/qwen3-coder-480b:free`, `cognitivecomputations/dolphin-mistral-24b-venice-edition:free`
- **LONG CONTEXT**: `minimax/minimax-m2.5:free`, `meta-llama/llama-3.3-70b-instruct:free`, `google/gemma-3-12b-it:free`
- **VISION/OCR**: `google/gemma-4-31b-it:free`, `google/gemma-4-26b-a4b-it:free`, `nvidia/nemotron-nano-12b-v2-vl:free`
- **Extra fallbacks**: `nvidia/nemotron-3-nano-30b-a3b:free`, `nvidia/nemotron-nano-9b-v2:free`, `liquid/lfm-2.5-1.2b-thinking:free`, `liquid/lfm-2.5-1.2b-instruct:free`, `upstage/solar-pro-3:free`
- **Nuclear fallback**: `openrouter/free`

Keep existing `callWithFallback` race logic (3-model parallel race then sequential). No structural changes needed — just update the model arrays.

All 16 edge functions already import from `_shared/models.ts` — they get the new models automatically.

---

### PART 2: Lumina Hub — Complete UI Redesign + New Modules

**File: `src/pages/LuminaHub.tsx`** — Full rewrite

**New modules to add** (total: 10 modules, up from 7):
8. **Pomodoro Timer** — Built-in 25/5 min timer with custom lengths, tracks sessions
9. **Mind Mapping** — AI generates structured mind map outlines from topics
10. **SQ3R Method** — Survey, Question, Read, Recite, Review — guided reading technique

**UI Redesign — "Brain Command Center" aesthetic:**
- Dark premium background with subtle grid pattern overlay
- Hero section: Large animated brain icon with pulsing neural glow, title "Lumina Hub", subtitle "Your neurocognitive brain gym — 10 science-backed engines to supercharge learning"
- Each module card: Full glassmorphic style with gradient icon container, "Science-backed" pill badge, hover glow effect with module-specific color, smooth scale/lift animation
- Neural Learning Loop visualization bar (Encode → Retrieve → Struggle → Correct → Reinforce → Space → Mix → Reflect)
- PRO+ upsell banner with Crown icon for non-subscribers
- Module cards in a responsive 3-column grid with staggered entrance animations

**New usage limits** in `src/hooks/useUsageLimits.tsx`:
- `pomodoro_timer: 5/day`
- `mind_mapping: 3/day`
- `sq3r_method: 2/day`

**System prompts** for new modules added to the SYSTEM_PROMPTS object in LuminaHub.tsx.

---

### PART 3: Dashboard — Enhanced "Brain Hub" Impact

**File: `src/pages/Dashboard.tsx`**

Redesign to make the value proposition immediately clear:
- Hero greeting with personalized neural insight (Observation → Interpretation → Action)
- Animated "Readiness Ring" showing XP progress with glow effect
- Prominent stat cards: Streak, XP, Level, Study Minutes — glassmorphic with gradient borders
- Quick-access grid to Lumina Hub, AI Chat, Tests, Flashcards with hover animations
- "What you get with PRO+" section for free users — showcasing Hub modules as premium value

---

### Technical Details

- All edge functions remain unchanged (they import tiers from `_shared/models.ts`)
- Pomodoro Timer is client-side only (no AI call needed), uses `setInterval`
- Mind Mapping and SQ3R use the existing `CHAT_URL` endpoint with custom system prompts
- No database changes needed — usage tracking already handles arbitrary feature keys via `increment_usage` function

**Files to modify:**
1. `supabase/functions/_shared/models.ts` — Update all model tier arrays
2. `src/pages/LuminaHub.tsx` — Complete redesign with 3 new modules
3. `src/pages/Dashboard.tsx` — Enhanced impact design
4. `src/hooks/useUsageLimits.tsx` — Add limits for 3 new Hub modules

