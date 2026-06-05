/**
 * Lumina Premium Artifact Prompts.
 * 20 exam-pack grade templates. Every artifact is a single self-contained
 * HTML file with the Lumina design system, particles, dot nav, progress bar,
 * scroll reveal, and template-specific interactivity.
 *
 * Public API (unchanged): buildPromptForType(type, topic) -> string
 */

export type ArtifactType = "notes" | "exam" | "slides" | "code";

export type TemplateKey =
  | "notes_pack"
  | "exam_paper"
  | "slides"
  | "code_tutorial"
  | "flashcards"
  | "mindmap"
  | "quiz"
  | "formulas"
  | "essay"
  | "history"
  | "concept"
  | "literature"
  | "maths"
  | "vocabulary"
  | "planner"
  | "chemistry"
  | "business"
  | "code_project"
  | "revision"
  | "full_pack";

/* ──────────────────────────────────────────────────────────────────────────
 * GLOBAL WRAPPER — injected at the top of every artifact prompt
 * ────────────────────────────────────────────────────────────────────────── */
const GLOBAL_WRAPPER = `
You are Lumina's Artifact Engine. Generate ONE complete, beautiful, self-contained HTML study artifact that a senior product designer at Linear, Vercel or Raycast would be proud to ship.

HARD OUTPUT CONTRACT (must follow):
- Output ONLY raw HTML starting with <!DOCTYPE html>. No markdown fences. No commentary. Nothing before or after.
- Single self-contained file. Inline CSS + JS only. No external scripts. Google Fonts is fine (and required).
- FINISH the file. Close every tag. End with </html>. Never write TODO, "rest of content here", "...", or any placeholder. Length is a feature.
- All content must be REAL, accurate, curriculum-grade for the topic. No lorem. No filler.
- All JS inside DOMContentLoaded. Defensive — never crash, never reference undefined globals.

──────────────────────────────────────────────────────────
DESIGN SYSTEM (NON-NEGOTIABLE — every artifact follows this)
──────────────────────────────────────────────────────────

FONTS (load via <link> in <head>, NEVER use Inter/Roboto/Arial/system-ui as the primary face):
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@400;500;600;700&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

- Display headings: 'Instrument Serif' — large, generous, editorial. h1 60–96px, h2 40–56px.
- UI / labels / buttons: 'Space Grotesk' 500/600, tracked 0.02em on small caps.
- Body prose: 'Inter Tight' 400/500, 16–18px, line-height 1.7.
- Code / data: 'JetBrains Mono' 400/500.
- Hierarchy is mandatory: hero → section header → subhead → body → caption. NEVER ship a doc where everything is 14/16px.

COLOR TOKENS (define on :root, use ONLY these — no ad-hoc colors):
:root {
  --bg: #05050B;
  --bg-2: #0A0A14;
  --surface: rgba(18,18,30,0.72);
  --surface-2: rgba(28,28,46,0.55);
  --border: rgba(255,255,255,0.07);
  --border-strong: rgba(255,255,255,0.14);
  --text: #ECECF2;
  --text-2: rgba(236,236,242,0.62);
  --muted: rgba(236,236,242,0.38);
  --p: #7C5CFF;       /* primary violet */
  --a: #2DD4A0;       /* mint accent */
  --a2: #F472B6;      /* pink accent */
  --a3: #F5A623;      /* warm accent */
  --gold: #D4A843;
}

Commit to ONE dominant accent per artifact (pick from --p / --a / --a2 / --gold based on topic mood). Use the others only as sparing highlights. NEVER ship an evenly distributed rainbow palette.

BACKGROUND & DEPTH (never a flat solid):
- Body bg: layered. Base = var(--bg). Add on body::before: fixed radial-gradient meshes (2–3 soft accent orbs at 18% opacity, blur 80px, slowly drifting via @keyframes 'drift' over 40s).
- Add an SVG feTurbulence noise overlay at 3% opacity on body::after (fixed, pointer-events:none) for tactile grain.
- Subtle dot-grid or 1px hairline grid via repeating-linear-gradient at 4% opacity on hero sections.

TYPOGRAPHY EXECUTION:
- Hero h1: Instrument Serif italic optional, gradient text fill (var(--text) → accent), 0.95 line-height, -0.02em tracking.
- Eyebrow labels: Space Grotesk 11px, uppercase, tracked 0.18em, var(--muted).
- Pull quotes: Instrument Serif italic, 28–40px, indented, accent left-border 2px.
- Numbers/stats: JetBrains Mono, tabular-nums, weighted 500.

LAYOUT & RHYTHM:
- Section vertical padding: 96–140px. Never default 16/24px section margins.
- Max content width: 1180px; reading prose: 720px. Generous left/right gutters.
- Break the grid intentionally: asymmetric heroes, overlapping cards, content that bleeds to one edge while the other holds whitespace. Avoid the bland centered-everything middle.
- Use CSS Grid with named areas for complex sections, not nested flex soup.

COMPONENTS:
- Cards: var(--surface) with backdrop-filter: blur(16px) saturate(140%), 1px var(--border), border-radius 18px, padding 28–36px, layered shadow (0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px rgba(0,0,0,0.35)). On hover: translateY(-3px), border → var(--border-strong), accent glow.
- Buttons: NEVER plain blue rectangles with border-radius:4px. Use one of: (a) gradient fill var(--p)→var(--a2) with subtle inner highlight; (b) outline that fills on hover with a sliding accent bar; (c) pill with letter-spaced Space Grotesk label and an arrow that translates on hover. Hover must feel deliberate — never just opacity:0.8.
- Inputs: underline-only OR pill with animated focus ring (box-shadow expanding to var(--accent-glow)).
- Tables: never unstyled. Header row tinted, hover row highlight, monospace numeric columns, divider hairlines at 6% white.
- Code blocks: macOS-style window chrome — 3 traffic-light dots (#ff5f57 / #febc2e / #28c840), filename pill in JetBrains Mono, copy button on hover, gradient hairline border, syntax tokens via <span class="kw|str|num|fn|com|attr"> with explicit token colors (kw #c084fc, str #86efac, fn #7dd3fc, num #fb923c, attr #fbbf24, com #64748b italic). Add a gutter with line numbers in var(--muted).

MOTION (every artifact ships with at least these):
- Page load: staggered fade-up reveals (IntersectionObserver, opacity 0→1 + translateY 16px→0, 600ms cubic-bezier(.16,1,.3,1), animation-delay stagger 60ms per child).
- Ambient: background mesh orbs drift slowly (@keyframes drift, 30–50s, ease-in-out, infinite alternate).
- Hover micro-interactions on every interactive element (scale 1.02 / border glow / arrow translate / underline grow).
- Scroll-driven top progress bar (3px, gradient, position:fixed top).
- Custom scrollbar: 6px, gradient thumb (var(--p) → var(--a)), transparent track.

INTERACTIVITY (real, never fake):
- MCQs: lock on click, mark correct ✓ green / wrong ✗ red+shake, reveal explanation, running score.
- Flashcards: 3D flip via perspective + rotateY, mark known/review (in-memory window.__lumina state — sandbox blocks localStorage).
- Checklists: persistent in window.__lumina, animated progress bar, confetti at 100%.
- Tabs/accordions: smooth height transitions, never instant snap.
- Keyboard nav where it matters (arrow keys for slides/cards).

ANTI-PATTERNS — ABSOLUTELY FORBIDDEN:
- Inter/Roboto/Arial/system-ui as the primary heading face.
- Pure #ffffff or #000000 backgrounds. Use warm off-whites or deep near-blacks.
- Default browser blue buttons (#007bff, #0000ff) or plain border-radius:4px rectangles.
- The "AI slop" purple→blue gradient hero on a white card grid.
- Flat gray cards with no depth, no hover, no border treatment.
- Unstyled <table>, <pre>, <hr>, <details>.
- "Lorem ipsum", "TODO", "// rest here", "Content goes here", placeholder shimmers without real content.
- Stock-illustration vibes (generic isometric people, blob shapes with timid pastels).
- Centered-everything single-column layouts with 16px margins.
- localStorage / sessionStorage (sandbox blocks them — use window.__lumina).

INTERNAL CHECKLIST — run silently before emitting the final </html>:
1. Would a senior designer at Linear/Vercel/Raycast ship this?
2. Is there at least ONE unexpected, intentional design decision (a typographic moment, an asymmetric break, an unusual color pairing, a delightful micro-interaction)?
3. Does the typography create a clear hierarchy across at least 4 sizes?
4. Is the palette committed to ONE accent — not evenly rainbow?
5. Is there motion or depth that makes it feel alive (background drift + scroll reveals + hover states)?
6. Is every section fully written with real content, every code block runnable, every interaction wired?

If any answer is no — revise before outputting. Length is correct. Completeness is correct.
`.trim();

const slugHint = (topic: string) =>
  topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "artifact";

/* ──────────────────────────────────────────────────────────────────────────
 * TEMPLATE DETECTION
 * ────────────────────────────────────────────────────────────────────────── */
const TEMPLATE_KEYWORDS: Record<TemplateKey, string[]> = {
  full_pack:    ["chapter", "unit", "module", "complete", "full pack", "exam pack", "jee", "neet", "all topics"],
  exam_paper:   ["exam paper", "question paper", "test paper", "past paper", "mock paper", "mock test"],
  slides:       ["slides", "presentation", "ppt", "slide deck", "keynote"],
  flashcards:   ["flashcards", "flash cards", "flip cards", "revision cards"],
  mindmap:      ["mind map", "mindmap", "concept map", "brain map"],
  quiz:         ["quiz", "mcq", "questions only", "test me", "quiz battle"],
  formulas:     ["formula sheet", "formulas", "equations", "reference sheet", "cheat sheet"],
  essay:        ["essay", "long answer", "extended writing", "analytical essay"],
  history:      ["history", "timeline", "revolution", "war", "dynasty", "period of"],
  chemistry:    ["reaction", "organic chem", "inorganic", "titration", "chemistry"],
  literature:   ["literature", "novel", "poem", "play", "shakespeare", "language analysis"],
  vocabulary:   ["vocabulary", "vocab", "definitions list", "glossary", "terminology"],
  planner:      ["planner", "assignment plan", "project plan", "study plan"],
  business:     ["business", "economics", "marketing", "finance", "accounting", "swot", "pestle"],
  revision:     ["revision sprint", "30 minute", "quick revision", "rapid revision", "sprint"],
  maths:        ["calculus", "algebra", "geometry", "trigonometry", "statistics", "probability", "math"],
  concept:      ["explain", "concept", "how does", "what is", "deep dive"],
  code_project: ["build app", "build a", "project: ", "full project", "web app", "build me", "make a game"],
  code_tutorial:["python", "javascript", "typescript", "react", "algorithm", "data structure", "coding tutorial", "function", "class "],
  notes_pack:   [], // default
};

const PRIORITY: TemplateKey[] = [
  "full_pack", "exam_paper", "slides", "flashcards", "mindmap",
  "quiz", "formulas", "essay", "revision", "history", "chemistry",
  "literature", "vocabulary", "planner", "business",
  "maths", "concept", "code_project", "code_tutorial", "notes_pack",
];

export function detectTemplate(type: ArtifactType, topic: string): TemplateKey {
  const t = (topic || "").toLowerCase();

  // Hard routing by explicit type
  if (type === "exam") return "exam_paper";
  if (type === "slides") return "slides";
  if (type === "code") {
    for (const k of ["code_project", "code_tutorial"] as TemplateKey[]) {
      if (TEMPLATE_KEYWORDS[k].some((w) => t.includes(w))) return k;
    }
    return "code_tutorial";
  }

  // Notes: pick best matching specialist; default to full_pack for broad topics, else notes_pack
  for (const k of PRIORITY) {
    if (k === "notes_pack" || k === "exam_paper" || k === "slides" || k === "code_tutorial" || k === "code_project") continue;
    if (TEMPLATE_KEYWORDS[k].some((w) => t.includes(w))) return k;
  }
  // Heuristic: short/specific topic → notes_pack; broad → full_pack
  const wc = t.split(/\s+/).filter(Boolean).length;
  return wc <= 4 ? "full_pack" : "notes_pack";
}

/* ──────────────────────────────────────────────────────────────────────────
 * TEMPLATE BUILDERS
 * Each returns the *body* of the prompt (sections + per-template rules).
 * The wrapper is prepended in buildPromptForType.
 * ────────────────────────────────────────────────────────────────────────── */

const REVEAL_SECTIONS = `Wrap each major section in <section class="lp-reveal" id="..."> with a unique id (used for dot nav).`;

function tplNotesPack(topic: string): string {
  return `
TEMPLATE: EXAM PACK NOTES — TOPIC: "${topic}"
Slug for in-memory state: '${slugHint(topic)}'.

${REVEAL_SECTIONS}
Sections in order — every one MUST appear with rich, accurate content:

1. COVER (#cover) — full-viewport hero. Animated radial purple+cyan glow orbs that drift (CSS @keyframes). Shimmer title with the topic name. Subtitle: one-line value prop. Stat counter row (4 stats) — Questions, Flashcards, Topics, Hours of revision. Animated count-up with requestAnimationFrame from 0 to target. Bouncing ↓ arrow.
2. HOW TO USE (#use) — 4 numbered step cards in a grid; circle-numbered badges connected by → on desktop (CSS pseudo). Each card explains one workflow step.
3. SYLLABUS MAP (#syllabus) — chip cloud of every subtopic (real ones). Below: list of chapters with animated coverage bars (width transitions from 0 → target % when revealed).
4. MASTER NOTES (#notes) — the educational core. At minimum 650 words of actual notes. Use:
   - Concept mini-cards grid (3-up).
   - Formula boxes: dark card with radial-gradient glow at center, equation centered, large.
   - Pull quotes: italic, accent border-left 3px var(--a).
   - Diagrams via inline SVG where useful.
5. FORMULA SHEET (#formulas) — searchable grid (live-filter <input>). Each card: equation big & glowing, variable legend pills underneath, units, "Copy" button.
6. COMPARISON TABLES (#tables) — at least 2 two-column comparison tables, headers tinted purple/cyan, hover row highlight.
7. TIMELINE (#timeline) — vertical line down center; alternating event nodes left/right; dot nodes scale 1.4 on hover; date badge + event title + 1-2 sentence detail.
8. CASE STUDY (#case) — narrative card; one highlighted pull quote in middle; "What This Teaches Us" checklist (5 items) below.
9. MCQ (#mcq) — 10 questions. Two tabs: Attempt | Review. In Attempt mode: each option is a real <button>. On click — lock options, mark correct green, wrong red+shake, reveal 2-line explanation. Running score top of section. In Review mode: all answers + explanations always visible.
10. SHORT ANSWER ACCORDION (#short) — 6 questions. Click to expand; inside: model answer, key terms chips row, common-mistake amber callout.
11. FLASHCARDS (#flash) — grid of 12 CSS 3D flip cards (perspective 1000px). Front: question. Back: answer + "Known" / "Review" buttons (saved to window.__lumina memory). Controls: Shuffle, Filter (All/Review/Known), Reset.
12. EXAMINER'S SECRETS (#secrets) — 6 gold-bordered cards. Each shows "SECRET #N" badge in top-right gradient amber→pink. Reveal hidden insights real examiners look for.
13. COMMON MISTAKES (#mistakes) — 6 cards with 4px left-border (alternating var(--a2) pink and var(--a3) amber). "Mistake → Fix" format.
14. HALL OF FAME (#fame) — top 5 most-tested subtopics. Each: title, frequency %, 5-star rating (filled by frequency), 3 example subtopics chips.
15. SPEED DRILL (#drill) — 60-second countdown ring (SVG circle, stroke-dashoffset animates). 10 quick text-input questions, advance on Enter. End screen awards: <70% Bronze, ≥70% Silver, ≥85% Gold, =100% Elite — with confetti for Gold/Elite.
16. LAST-MINUTE CHECKLIST (#checklist) — 12 checkboxes saved to window.__lumina memory. Animated progress bar. At 100%: confetti burst + banner "You're Exam Ready!".
17. SUMMARY CARD (#summary) — single big gradient purple card; bullet recap of every previous section in 1 line each.
18. CALLOUT BANK (#callouts) — exactly 8 callouts in a 2-col grid: 2× danger (pink left-border + ⚠ icon), 2× warning (amber + ⚡), 2× tip (cyan + 💡), 2× insight (purple + 🧠). Each 2-3 sentences.

Each section MUST have a unique id and be added to dot nav automatically.
Use real, accurate content for "${topic}". Never use lorem.
`.trim();
}

function tplExamPaper(topic: string): string {
  return `
TEMPLATE: EXAM PAPER — TOPIC: "${topic}"
DESIGN OVERRIDE (this template only): print-feel.
- Body bg #fdfdf8 (cream), text #1a237e for headings, #111 for content.
- Content font: 'Times New Roman', serif. UI chrome (toolbar, buttons): Inter.
- Still inject the global particle canvas + progress bar + dot nav, BUT particles are very faint (alpha 0.05) and disabled in @media print.
- Print stylesheet @media print { #lp-particles, #lp-progress, #lp-dots, #lp-top, .toolbar, .timer { display:none !important; } body { background:#fff } }

LAYOUT:
- Top toolbar (sticky): Lumina Academy logo (text), countdown timer (mm:ss), progress "X / N attempted", Print button, Save button.
- Header card: "Lumina Academy Examination" title, Subject: ${topic}, Date: ____, Candidate Name + Number boxes (input fields), Time Allowed, Total Marks.
- Instructions box: bordered, serif, bullet rules.
- SECTION A — Multiple Choice (1 mark each, minimum 12 questions). Each option is a clickable <button class="bubble">. window.__lumina stores answers (key: 'lumina:exam:${slugHint(topic)}:answers'). Visual chosen state.
- SECTION B — Short Answer (3-5 marks each, minimum 6 questions). Below each: <textarea> with ruled-line background (CSS repeating-linear-gradient at 1.6em).
- SECTION C — Long Answer (10-15 marks each, minimum 2 questions). <textarea> with graph-paper background (CSS grid via two repeating-linear-gradients at 24px).
- MARK SCHEME — hidden by default. Toggle button "Reveal Mark Scheme". Reveals per-question full working with mark allocations.

INTERACTIVE:
- Countdown timer starts at total time. Amber under 10 min, red + pulse under 5 min.
- Auto-save textareas to window.__lumina every 1500ms.
- Print button → window.print() with clean stylesheet.
- All MCQ/short answer must be REAL questions for "${topic}" with curriculum-grade difficulty and plausible distractors.
`.trim();
}

function tplSlides(topic: string): string {
  return `
TEMPLATE: SLIDES PRESENTATION — TOPIC: "${topic}"
Each slide = 100vw × 100vh, only one visible (.slide:not(.active){display:none}). Subtle dot-grid bg.
Min 12 slides. Real content for every slide.

SLIDE TYPES TO INCLUDE (mix them):
- Hero (slide 1): big shimmer title, subtitle, glow orbs.
- Agenda (slide 2): numbered list of every other slide title.
- Content slides: split layout (text left, visual/diagram right) and centered layout — alternate.
- Code slide(s): syntax-highlighted via <span class="kw|str|num|fn|com"> with token CSS colors (kw #c084fc, str #86efac, fn #7dd3fc, num #fb923c, com #475569 italic).
- Diagram slide: pure CSS boxes + arrows (border + ::after triangle) explaining a process.
- Comparison slide: 2-column table, gradient headers.
- Quote slide: huge italic centered text on accent-tinted bg.
- Summary slide: 5 bullet takeaways.
- Resources slide: links/topics for further study.

NAVIGATION (mandatory):
- ArrowRight / Space → next; ArrowLeft → prev.
- Click right 60% of viewport → next; left 40% → prev (but not on interactive elements).
- Touch swipe (touchstart/touchend dx > 40).
- Bottom progress bar = (currentSlide / total) * 100%.
- Slide counter "3 / 12" bottom-right.
- F → fullscreen toggle; ESC → exit.
- G → grid overview (transform-scale tiles all slides into a 4-col grid; click tile to jump).
`.trim();
}

function tplCodeTutorial(topic: string): string {
  return `
TEMPLATE: CODING TUTORIAL — TOPIC: "${topic}"
${REVEAL_SECTIONS}

SECTIONS:
1. CONCEPT OVERVIEW (#overview) — what it is, when to use, "What you'll learn" badge row.
2. INTERACTIVE EDITOR (#editor) — <textarea> with monospace font, "Run" button. Below: <pre id="output"> that simulates execution by parsing the code (for JS use new Function safely with try/catch; for Python, simulate via simple eval of supported subset OR show expected output cards). Always sandboxed and never throws.
3. STEP-BY-STEP (#steps) — numbered cards, each with annotated code block + plain-English explanation.
4. COMMON PATTERNS (#patterns) — tabbed interface (≥4 tabs). Each tab shows one pattern with code + explanation.
5. DEBUGGING CHALLENGES (#debug) — 4 cards with broken code. "Show Fix" button reveals corrected version with the diff highlighted.
6. COMPLEXITY ANALYSIS (#big-o) — table of operations with Time + Space Big-O notation. Color-tagged: O(1) green, O(log n) cyan, O(n) amber, O(n²)+ pink.
7. PRACTICE PROBLEMS (#practice) — 6 problems, each expandable. Inside: problem, hint (further click), solution.
8. CHEATSHEET (#cheat) — searchable grid of code snippets. Live filter input.

All code must compile/work for the language indicated by "${topic}". Use real syntax. Add line numbers to code blocks.
`.trim();
}

function tplFlashcards(topic: string): string {
  return `
TEMPLATE: FLASHCARD DECK — TOPIC: "${topic}"
Full-screen flashcard study app. Min 24 cards.

LAYOUT:
- Center stage: one card at a time, 420px × 300px, perspective 1200px, 3D flip on click (.flipped).
- Front: question / term, subtle "Hint" button (opens tooltip without flipping).
- Back: answer + 2 buttons "Mark Known" (green) and "Review Again" (amber). Updates window.__lumina in-memory state.
- Below stage: progress bar + counter "Card X of Y", "Studied" stats (Known / Review / Unseen).
- Bottom controls: ← Prev, Flip (Space), Next →, Shuffle, Restart, Filter (All / Unknown / Review / Known).
- Spaced-repetition hint: after marking Review, show "Next review: Tomorrow"; after Known, show "Next review: in 3 days".
- Completion screen (when all cards marked Known): SVG pie chart Known vs Reviewed, confetti burst, "Share Score" button (copies "I mastered ${topic} on Lumina ⚡" to clipboard).

KEYBOARD: ← → for nav, Space to flip, K = Known, R = Review.
State: window.__lumina.flash = { cardId: 'known' | 'review' | 'unseen' }.
`.trim();
}

function tplMindMap(topic: string): string {
  return `
TEMPLATE: MIND MAP — TOPIC: "${topic}"
${REVEAL_SECTIONS}

LAYOUT:
- Hero: shimmer title + small toggle "Visual Map" / "List View" / "Copy as Text".
- Visual Map (#map): 800px tall canvas div (relative). Central node (180px circle, glowing var(--p)) absolutely centered with topic name. 6-8 Level-1 branches placed evenly around (transform: rotate(angle) translate(260px) rotate(-angle)). Each branch has 2-4 Level-2 sub-nodes radiating further.
- Connect nodes with inline SVG <line> elements; animate with stroke-dasharray + stroke-dashoffset on load (1.2s ease).
- Each main branch has a unique accent color (var(--p), var(--a), var(--a2), var(--a3), and 4 derived hues).
- Click any node → smoothly opens a detail card below the map showing extended explanation, examples, and links to related concepts.
- List View: nested <ul> mirroring the map, fully accessible.
- "Copy as Text" button: copies an indented text outline to clipboard.

Real branches must reflect actual subtopics of "${topic}" with academically correct hierarchy.
`.trim();
}

function tplQuiz(topic: string): string {
  return `
TEMPLATE: QUIZ BATTLE — TOPIC: "${topic}"
Gamified quiz app. Real curriculum-grade questions for "${topic}".

SCREENS (state machine: setup → playing → result → review):
1. SETUP — title, difficulty selector (Easy/Medium/Hard) as segmented control, question count picker (5/10/15/20). "Begin" button gradient-glow.
2. PLAYING — single question card with entrance animation. Top bar: lives (3 ❤), score, combo multiplier, current Q index. SVG ring timer (15s per question, stroke-dashoffset). 4 options A/B/C/D as buttons with letter badges. Wrong → shake + lose ❤ + reveal correct. Correct → pulse green + score +10 × combo. 3 correct in a row = combo 2× (visible "COMBO ×2!" tag).
3. RESULT — animated count-up to final score. Stats row: accuracy %, time taken, best streak. Topic breakdown bars (which subtopics weak). Badge: <70% Bronze, ≥70% Silver, ≥85% Gold, =100% Elite — with appropriate confetti. "Share Score" button copies summary. "Review Answers" button → review mode.
4. REVIEW — list of all questions with correct answer highlighted + 2-line explanation per question.

Generate at least 20 unique questions; quiz pulls a random subset based on count.
`.trim();
}

function tplFormulas(topic: string): string {
  return `
TEMPLATE: FORMULA REFERENCE — TOPIC: "${topic}"
${REVEAL_SECTIONS}

CONTROLS BAR:
- Live search input (filters by formula name, variable, or category).
- Category tabs (horizontal scroll on mobile).
- Toggle: All | ★ Bookmarked.
- "Quick-fire" mode toggle.

CONTENT:
- Min 24 formula cards. Each card:
  - Big glowing equation (centered, font-size clamp(1.4rem, 2vw, 2rem), text-shadow 0 0 18px var(--p)).
  - Variable legend pills underneath (e.g. v = velocity, t = time).
  - Unit and dimensions line.
  - Worked numeric example (1-2 lines).
  - Buttons: 📋 Copy formula (plain-text), ★ Bookmark (saves to window.__lumina).
  - Accordion "Show Derivation" with full step-by-step derivation.
- Bookmarked Section: floating section at top showing user's bookmarked formulas.
- Quick-fire mode: hides variable definitions; user types meaning into input, gets immediate ✓/✗.

PRINT (@media print): clean 2-column grid, hide chrome.
`.trim();
}

function tplEssay(topic: string): string {
  return `
TEMPLATE: ESSAY GUIDE — TOPIC: "${topic}"
${REVEAL_SECTIONS}

SECTIONS:
1. ESSAY SKELETON (#skeleton) — 5 expandable cards: Hook → Thesis → Body × 3 → Counter-argument → Conclusion. Each shows guidance + word-target + checklist.
2. ARGUMENT BUILDER (#args) — 6 argument cards in a flex row. User can drag (HTML5 drag/drop) to reorder. Order persists in window.__lumina for the session.
3. KEYWORDS TO INCLUDE (#keywords) — glowing chip cloud of 20 advanced lexis terms specific to ${topic}. Click chip → highlight + add to "used" list.
4. SAMPLE PARAGRAPHS (#samples) — for each section (Intro, 3 Body, Conclusion) provide one model paragraph hidden behind "Show Example" toggle.
5. WORD-COUNT ESTIMATOR (#counter) — input current word count per section; visual ring fills toward the target. Total at top.
6. EXAMINER RUBRIC (#rubric) — table of criteria (AO1/AO2/AO3 style), marks, descriptors for full marks vs partial.
7. COMMON MISTAKES (#mistakes) — accordion with 8 essay-specific pitfalls.
8. YOUR DRAFT (#draft) — large rich textarea. Auto-save to window.__lumina every 2s. Live word count.
`.trim();
}

function tplHistory(topic: string): string {
  return `
TEMPLATE: HISTORY TIMELINE — TOPIC: "${topic}"
${REVEAL_SECTIONS}

SECTIONS:
1. HERO (#cover) — shimmer title + animated era badges.
2. ERA FILTER (#filters) — chip buttons (Ancient / Medieval / Early Modern / Modern / Contemporary as relevant). Active chip glows; clicking filters the timeline.
3. TIMELINE (#timeline) — vertical SVG line down center. Inline SVG <path> uses stroke-dasharray + dashoffset animation triggered by IntersectionObserver (line "draws" on scroll). Min 15 events alternating left/right. Each event card: year badge (gradient bg), event title, 2-3 sentence description, "Significance" sub-card. Click event → expands a full detail panel below the timeline with sources/quotes.
4. KEY FIGURES (#figures) — grid of 6-8 profile cards. Avatar circle (initials), name, role, contribution chips.
5. COMPARE EVENTS (#compare) — UI to select any two events from a dropdown; opens a modal showing them side-by-side with diff-style differences and similarities.
6. WORLD MAP (#map) — pure CSS world map (simplified rectangles for each continent) with regions tinted by relevance to the topic.
7. DATE QUIZ (#quiz) — 10 events with hidden dates; reveal button per event; running score.

Real, historically accurate content for "${topic}". No fabrication.
`.trim();
}

function tplConcept(topic: string): string {
  return `
TEMPLATE: SCIENCE CONCEPT DEEP DIVE — TOPIC: "${topic}"
${REVEAL_SECTIONS}

SECTIONS:
1. ANIMATED HERO (#cover) — concept name + a relevant emoji-particle system (e.g. atoms, droplets, lightning) layered above the global particle canvas.
2. ANALOGY (#analogy) — relatable real-world analogy in a pull-quote card.
3. TECHNICAL EXPLANATION (#explain) — rigorous explanation, 600+ words, with concept mini-cards.
4. MATHEMATICAL TREATMENT (#maths) — derivations and equations with glow boxes.
5. INTERACTIVE DIAGRAM (#diagram) — inline SVG diagram. Each clickable part highlights and shows an explanation card next to it.
6. STEP-BY-STEP DERIVATION (#derivation) — collapsed by default. "Show Step 1" → "Show Step 2" buttons reveal sequential math steps.
7. REAL-WORLD APPLICATIONS (#apps) — 6 application cards.
8. MISCONCEPTIONS CRUSHER (#myths) — 5 myth → reality cards (left red, right green).
9. NUMERICAL PROBLEMS (#problems) — 5 worked examples with collapsible solutions and final answer highlighted.
10. CONCEPT MAP (#map) — small inline mind-map linking this concept to related concepts.
`.trim();
}

function tplLiterature(topic: string): string {
  return `
TEMPLATE: LITERATURE / LANGUAGE — TOPIC: "${topic}"
${REVEAL_SECTIONS}

SECTIONS:
1. TEXT ANALYSIS (#analysis) — passages with key phrases <mark> highlighted, hover tooltip explaining significance.
2. THEME EXPLORER (#themes) — accordion per theme. Inside: thesis, supporting quotes, analysis.
3. CHARACTER CARDS (#chars) — flip cards. Front = character name + portrait initial. Back = analysis + 2 key quotes.
4. LITERARY DEVICES (#devices) — searchable glossary cards (alliteration, motif, etc.). Each with definition + example from the text.
5. ESSAY QUESTIONS BANK (#essays) — 10 questions categorised by AO. Each expands to show mark scheme guidance.
6. PLOT TIMELINE (#plot) — horizontal scrolling timeline of plot beats; chips for Act / Chapter.
7. VOCABULARY BUILDER (#vocab) — term → definition → usage flip cards.
8. WRITING FRAMES (#frames) — copy-friendly scaffolds (e.g. PEEL, WhatHowWhy) with inline copy button.

Use academically correct, real content from the work referenced in "${topic}".
`.trim();
}

function tplMaths(topic: string): string {
  return `
TEMPLATE: MATHS PROBLEM SET — TOPIC: "${topic}"
${REVEAL_SECTIONS}

SECTIONS:
1. PREREQUISITES CHECKER (#prereq) — checklist of skills needed; user ticks; if any unchecked, a card recommends what to revise.
2. CORE THEOREMS / RULES (#rules) — formula cards with glow.
3. WORKED EXAMPLES (#worked) — 3 tiers (Basic, Intermediate, Hard). For each: problem, then steps hidden behind "Show Step N" buttons reveal one at a time. Final answer in a green-glow box.
4. PRACTICE PROBLEMS (#practice) — 15 problems with difficulty tags (E/M/H). Each has hint and solution toggles.
5. INLINE CALCULATOR (#calc) — small calculator (number pad + operators + Enter) implemented in pure JS for sanity-checking calculations.
6. GRAPH VISUALISER (#graph) — for geometry/functions topics, render a coordinate plane in <svg> with grid lines, axes, and labelled points/curves derived from worked examples.
7. COMMON ERRORS (#errors) — 6 wrong → right comparisons (red strike-through wrong vs green correct), with one-line explanation.
8. TIMED CHALLENGE (#timed) — 10 questions, 5-minute timer, score tracker, badge result screen.

All maths must be syntactically and semantically correct. Use Unicode math symbols (×, ÷, ², √, π, ∑, ∫, ≤) inline; for complex equations use proper formatting.
`.trim();
}

function tplVocabulary(topic: string): string {
  return `
TEMPLATE: VOCABULARY / LANGUAGE LEARNING — TOPIC: "${topic}"
${REVEAL_SECTIONS}

SECTIONS:
1. WORD CARDS (#words) — grid of 24 word cards. Each card: term (Exo 2 800), part of speech tag, IPA pronunciation, definition, etymology pill.
2. SPACED REPETITION DECK (#srs) — same flip-card system as flashcards template; 24 cards in deck; Known/Review buttons; window.__lumina memory persistence.
3. FILL IN THE BLANK (#fill) — 10 sentences with __ blank. Click blank → 4 options pop up beside it; correct = green, wrong = red.
4. WORD ASSOCIATION MAP (#assoc) — small CSS mind map linking related words.
5. USAGE EXAMPLES (#usage) — 3 sentences per word with the word <mark>highlighted</mark>.
6. MEMORY HOOKS (#hooks) — mnemonic + visual association card per difficult word.
7. DAILY TARGET TRACKER (#daily) — input target (e.g. 10/day); progress bar fills as words marked Known.
8. EXPORT (#export) — "Copy all words" button copies a clean list to clipboard.
`.trim();
}

function tplPlanner(topic: string): string {
  return `
TEMPLATE: PROJECT / ASSIGNMENT PLANNER — TOPIC: "${topic}"
${REVEAL_SECTIONS}

SECTIONS:
1. PROJECT BRIEF (#brief) — title, deadline picker (date input), description, deliverables list.
2. PHASE BREAKDOWN (#phases) — 5-7 phases with time estimates. Each phase = card with subtasks.
3. TASK LIST (#tasks) — full checklist (min 20 tasks). Priority badges (P1/P2/P3) coloured. Drag-to-reorder. Persist to window.__lumina for the session.
4. GANTT TIMELINE (#gantt) — CSS horizontal bars per phase with start/end aligned to a 14-day grid.
5. RESEARCH TRACKER (#research) — input "Add Source"; appends to a list with title + URL + notes; persist.
6. PROGRESS TRACKER (#progress) — current word count / page count input, visual ring fills toward target.
7. SUBMISSION CHECKLIST (#submit) — final QA items (citations, formatting, plagiarism check).
8. NOTES (#notes) — large textarea, autosave every 2s, with word count.
`.trim();
}

function tplChemistry(topic: string): string {
  return `
TEMPLATE: CHEMISTRY REACTIONS — TOPIC: "${topic}"
${REVEAL_SECTIONS}

SECTIONS:
1. PERIODIC TABLE MINI (#periodic) — render a simplified grid of all 118 elements as small squares (CSS grid). Highlight elements relevant to the topic with var(--p) glow. Click an element → small tooltip card with name, atomic number, mass, and role in the topic.
2. REACTION CARDS (#reactions) — min 10 reaction cards. Each: reactants → products with state symbols (s)(l)(g)(aq), conditions (heat/Δ, catalyst, pressure), arrow with conditions written above. Real, balanced equations.
3. MECHANISM STEPS (#mechanism) — for each major mechanism: numbered curly-arrow notation rendered with inline SVG, electron movement annotated.
4. BALANCE EQUATION PRACTICE (#balance) — 5 unbalanced equations with empty inputs for coefficients. "Check" button validates; correct = green glow, wrong = shake red.
5. SAFETY SYMBOLS (#safety) — grid of GHS hazard pictograms (CSS-drawn diamonds) with names + meanings.
6. LAB PROCEDURE (#lab) — numbered steps, equipment list as chips, expected observations.
7. OBSERVATIONS vs EXPLANATIONS (#obs) — two-column comparison table.
8. MCQ (#mcq) — 10 reaction-focused MCQs with explanation reveal.
`.trim();
}

function tplBusiness(topic: string): string {
  return `
TEMPLATE: BUSINESS / ECONOMICS — TOPIC: "${topic}"
${REVEAL_SECTIONS}

SECTIONS:
1. KEY CONCEPTS (#concepts) — definition cards with real-world example + brand example.
2. DATA TABLES (#data) — 2 tables with sortable columns (click header to sort asc/desc, JS sort), hover row highlight.
3. CASE STUDY (#case) — narrative + "Apply the Theory" sub-section with 4 questions and reveal-on-click answers.
4. SUPPLY/DEMAND DIAGRAMS (#diagrams) — inline SVG curves; sliders to shift the curve and see equilibrium move (interactive).
5. CALCULATION PRACTICE (#calc) — 6 calculation problems (e.g. break-even, ROI, elasticity). Each: formula reminder + worked example + your-turn input with check.
6. STAKEHOLDER ANALYSIS (#stake) — grid of stakeholders with interests + power level coloured tags.
7. FRAMEWORKS (#frameworks) — SWOT and PESTLE template cards with editable textareas (autosave).
8. MCQ + SHORT ANSWER (#mcq) — 8 MCQs + 4 short-answer prompts with model answers behind reveal.
`.trim();
}

function tplCodeProject(topic: string): string {
  return `
TEMPLATE: CODING PROJECT — TOPIC: "${topic}"

If "${topic}" implies an actual runnable thing (game, tool, website), produce a SINGLE self-contained working artifact: HTML + CSS + JS inline. The artifact IS the deliverable — it must run immediately when previewed.

REQUIREMENTS:
- The full app/game must work end-to-end. No stubs. Real game loop with requestAnimationFrame for games. Real DOM logic for tools.
- Dark theme, mobile responsive. Keyboard + touch controls for games. Sound effects via Web Audio API where appropriate (no external audio files).
- Juicy feedback: particle bursts on important events, smooth animations, sensible micro-interactions.
- Includes a small "About / How to Play" panel at the top right (collapsible).
- Score persistence in window.__lumina where applicable.

DO NOT output a tutorial. Output the finished, working artifact for "${topic}".
Still inject the global chrome (particles canvas behind, progress bar, etc.) but ensure they don't block gameplay/interactivity (pointer-events:none).
`.trim();
}

function tplRevision(topic: string): string {
  return `
TEMPLATE: REVISION SPRINT (30-MINUTE) — TOPIC: "${topic}"

A single-page, gamified 30-minute revision app. Six 5-minute blocks. Real content for "${topic}".

LAYOUT:
- Sticky top: master 30:00 countdown + per-block 5:00 mini countdown + block indicator (1/6).
- Block 1 — KEY FACTS SPEED READ (#b1): 12 fact cards in a vertical scroll; auto-scrolls slowly; user can tap "Got it" to mark.
- Block 2 — FORMULA RECALL (#b2): 8 formula cards, equation hidden behind "Reveal" button; user self-marks Got It / Need More.
- Block 3 — RAPID MCQ (#b3): 5 MCQs, 30s per question, no explanations until end.
- Block 4 — FLASHCARD FLIP SPRINT (#b4): 10 flip cards, shuffle order, mark Known/Review.
- Block 5 — WRITE FROM MEMORY (#b5): textarea with prompts; live word count; comparison checklist of expected key points (user ticks as they cover them).
- Block 6 — PAST EXAM QUESTION (#b6): 1 long question + a model answer revealed at the end of the block.
- END SCREEN: performance summary (per block %), XP awarded total, weak-area suggestion list, "Restart Sprint" button. Confetti if total score ≥ 80%.

Block transitions auto-advance when timer hits 0; user can also click "Next Block" to skip.
Persist progress in window.__lumina keyed by '${slugHint(topic)}'.
`.trim();
}

function tplFullPack(topic: string): string {
  return `
TEMPLATE: COMPLETE EXAM PACK (FULL SUBJECT) — TOPIC: "${topic}"
This is the ULTIMATE template. Output MUST be 900 lines of HTML or fewer. Do NOT stub. Real content for every section.

${REVEAL_SECTIONS}
SECTIONS — every one MUST appear, in this order, fully populated:

1. COVER (#cover) — animated orb hero, shimmer title, stat counters (Questions, Flashcards, Topics, Hours), bouncing arrow.
2. HOW TO USE (#use) — 4 numbered step cards.
3. SYLLABUS MAP (#syllabus) — chip cloud + animated coverage bars.
4. MASTER NOTES (#notes) — minimum 700 words of accurate notes; concept mini-cards; formula glow boxes; pull quotes; SVG diagrams.
5. FORMULA SHEET (#formulas) — searchable grid + bookmarks.
6. COMPARISON TABLES (#tables) — at least 3 two-column tables.
7. TIMELINE (#timeline) — animated vertical SVG timeline.
8. CASE STUDY (#case) — narrative + "What This Teaches Us" checklist.
9. MCQ BANK (#mcq) — 25 MCQs with attempt + review modes; live score.
10. SHORT ANSWER ACCORDION (#short) — 8 questions.
11. FLASHCARDS (#flash) — 18 flip cards with shuffle/filter/known states.
12. EXAMINER'S SECRETS (#secrets) — 8 gold-bordered secret cards.
13. COMMON MISTAKES (#mistakes) — 8 mistake → fix cards.
14. HALL OF FAME (#fame) — top 6 most-tested topics with frequency + stars.
15. SPEED DRILL (#drill) — 60s, 10 rapid questions, badge end screen.
16. LAST-MINUTE CHECKLIST (#checklist) — 16 items, window.__lumina-saved, confetti at 100%.
17. SUMMARY CARD (#summary) — gradient purple recap of every section.
18. CALLOUT BANK (#callouts) — 10 callouts (3 danger, 3 warning, 2 tip, 2 insight).

Every interactive element from the global wrapper rules MUST work. The dot nav must list every section automatically.
Real, accurate, exam-grade content for "${topic}". No filler.
`.trim();
}

const BUILDERS: Record<TemplateKey, (topic: string) => string> = {
  notes_pack:    tplNotesPack,
  exam_paper:    tplExamPaper,
  slides:        tplSlides,
  code_tutorial: tplCodeTutorial,
  flashcards:    tplFlashcards,
  mindmap:       tplMindMap,
  quiz:          tplQuiz,
  formulas:      tplFormulas,
  essay:         tplEssay,
  history:       tplHistory,
  concept:       tplConcept,
  literature:    tplLiterature,
  maths:         tplMaths,
  vocabulary:    tplVocabulary,
  planner:       tplPlanner,
  chemistry:     tplChemistry,
  business:      tplBusiness,
  code_project:  tplCodeProject,
  revision:      tplRevision,
  full_pack:     tplFullPack,
};

/* ──────────────────────────────────────────────────────────────────────────
 * PUBLIC API
 * ────────────────────────────────────────────────────────────────────────── */
export function buildPromptForType(type: ArtifactType, topic: string): string {
  const key = detectTemplate(type, topic);
  const body = BUILDERS[key](topic);
  return `${GLOBAL_WRAPPER}\n\n${body}`;
}

// Legacy named exports kept in case anything else imports them.
export const buildNotesPrompt  = (t: string) => buildPromptForType("notes",  t);
export const buildExamPrompt   = (t: string) => buildPromptForType("exam",   t);
export const buildSlidesPrompt = (t: string) => buildPromptForType("slides", t);
export const buildCodePrompt   = (t: string) => buildPromptForType("code",   t);
