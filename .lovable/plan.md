

## Plan: Rebuild Guided Lesson — World-Class Interactive Tutor

### Overview
Complete rewrite of `GuidedLesson.tsx` and `guided-lesson/index.ts` to deliver a premium, Khan Academy/Gizmo-style step-by-step learning experience with rich interactions, adaptive AI, and lesson persistence.

---

### PART 1: Edge Function — Enhanced Lesson AI

**File: `supabase/functions/guided-lesson/index.ts`**

Expand the edge function to handle 5 request types via a `mode` field:

1. **`outline`** (existing, enhanced) — Generate 5-8 step lesson plan with richer metadata (step descriptions, estimated time)
2. **`step`** (existing, enhanced) — Generate step content with new JSON structure:
   - `explanation` (150-250 words, rich with analogies, bold terms)
   - `example` (concrete real-world example)
   - `check_questions` array with mixed MCQ + short_answer types
   - `model_answer` field for short answer questions
3. **`simplify`** (new) — Re-explain the current step at a lower level
4. **`deeper`** (new) — Add more detail/depth to current step
5. **`example`** (new) — Generate a new real-world example for current step
6. **`evaluate`** (new) — AI evaluates a short answer response
7. **`final_quiz`** (new) — Generate 5 questions covering the entire lesson

Each mode uses `MODELS_BALANCED` with fallback to `MODELS_FAST` for speed. The simplify/deeper/example modes use `MODELS_FAST` since they're supplementary.

System prompt enforces: brilliant-friend tone, 150-250 word explanations, analogies by default, structured JSON output.

---

### PART 2: Database — Lesson History

**Migration:** Create `guided_lessons` table:
```sql
CREATE TABLE guided_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  difficulty text DEFAULT 'intermediate',
  steps_completed integer DEFAULT 0,
  total_steps integer DEFAULT 5,
  score numeric DEFAULT 0,
  total_questions integer DEFAULT 0,
  correct_answers integer DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
-- RLS: users can CRUD own lessons
```

---

### PART 3: Frontend — Complete UI Rewrite

**File: `src/pages/GuidedLesson.tsx`** — Full rewrite (~800 lines)

**Phase 1 — Setup Screen:**
- Large centered hero with Brain icon + subtle glow animation
- "What do you want to learn today?" input (large, prominent)
- Collapsible "Options" section: difficulty dropdown + goal text input
- Quick topic chips below input
- Glowing "Start Lesson" CTA button
- Dark academic aesthetic: `#0c0e1a` background feel, teal accents (`#00d4c8`), glassmorphic cards

**Phase 2 — Lesson Roadmap:**
- After outline generates: show visual step tracker (horizontal on desktop, vertical on mobile)
- Each step: number circle + title
- Current step: glowing pulse animation with teal ring
- Completed: green checkmark
- Future: dimmed/locked appearance
- Sticky at top during lesson

**Phase 3 — Lesson Steps (core loop):**

TEACH sub-phase:
- "Step X of Y" small caps label
- Step title as heading
- AI explanation rendered as rich markdown (bold, bullets, analogies)
- "AI-generated" subtle label in corner
- 3 ghost buttons below explanation: "Explain Simpler", "Give Example", "Go Deeper"
- Each button calls the edge function with the appropriate mode, response appears inline below
- "Read Aloud" button using browser `speechSynthesis` API
- After reading, a "Ready for questions" CTA button

CHECK sub-phase:
- 1-2 questions per step (mix MCQ + short answer)
- MCQ: styled answer cards with letter badges, tap to select
- Short answer: text input with "Submit" button
- Short answer evaluation: calls `evaluate` mode on edge function
- Submit locks answers

FEEDBACK sub-phase:
- Correct: card pulses green glow, "Nailed it!" message
- Wrong: gentle CSS shake animation, soft crimson highlight, specific hint from AI
- Retry up to 2 times on wrong answers
- After 2 wrong: AI re-teaches (calls `simplify` mode) then asks a simpler question
- Never says "Wrong" — always explains why and redirects

**Phase 4 — Step Transitions:**
- Content slides out left, new content fades in from right (framer-motion)
- Progress bar fills with glowing leading edge
- Milestone celebrations at 25%, 50%, 75%, 100%

**Phase 5 — Lesson Complete:**
- Expanding ring animation from center
- Summary card: topic, steps, questions answered, accuracy %
- 3 CTAs: "Review Lesson" (scrollable read-only summary), "Take Final Quiz" (5 Qs), "New Lesson"
- Final quiz: 5 mixed questions, scored, with explanations
- Save to `guided_lessons` table on completion

**Layout:**
- Single column, centered, max-width 720px
- Fixed sticky progress tracker at top
- Fixed bottom action bar with primary CTA
- Mobile-first responsive
- Loading: typing indicator (3 animated dots) + skeleton after 3s

**Animations (CSS + framer-motion):**
- `@keyframes shake` for wrong answers
- `@keyframes glowPulse` for active step indicator
- `@keyframes ringExpand` for lesson complete
- Staggered card entrance with framer-motion

---

### PART 4: Deploy + Wire Up

- Deploy updated `guided-lesson` edge function
- Add `guided_lesson` usage limit key (already exists in useUsageLimits)
- Save completed lessons to Supabase

---

### Files to modify/create:
1. `supabase/functions/guided-lesson/index.ts` — Enhanced with 7 modes
2. `src/pages/GuidedLesson.tsx` — Complete rewrite
3. Database migration — `guided_lessons` table

### Files NOT changing:
- `_shared/models.ts` — Already has the correct model tiers
- `App.tsx` — Route already exists
- `AppSidebarContent.tsx` — Link already exists

