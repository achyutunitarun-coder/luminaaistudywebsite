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
You are Lumina's Premium Artifact Engine. Generate a world-class, production-grade HTML study artifact that feels like a ₹499 product, not a document.

OUTPUT RULES — NON-NEGOTIABLE:
- Output ONLY raw HTML. Start with <!DOCTYPE html>. No markdown fences. No prose. Nothing before or after.
- Single self-contained file. All CSS and JS inline. No external deps except Google Fonts.
- DO NOT truncate. DO NOT stub. DO NOT write "// rest of content here". Output the COMPLETE file.
- Minimum 800 lines for a normal artifact. Minimum 1500 lines for full_pack.
- All content must be REAL, accurate and educationally rich for the topic. No filler. No "lorem".
- All JS wrapped in DOMContentLoaded. Defensive — never crash, never reference undefined globals.

DESIGN SYSTEM — MANDATORY:
- Google Fonts: 'Exo 2' (700/800/900) for headings, 'Nunito' (400/600/700) for body, 'JetBrains Mono' for code
- :root tokens — --bg:#04040E; --bg2:#09091F; --p:#7B61FF; --pl:rgba(123,97,255,0.15); --a:#00F5C4; --a2:#FF6B9D; --a3:#FFB347; --text:#E8E8F5; --muted:rgba(232,232,245,0.45); --card:rgba(17,21,38,0.85); --border:rgba(255,255,255,0.07);
- Body: linear-gradient(180deg,var(--bg) 0%,var(--bg2) 100%), color var(--text), font-family Nunito.
- Headings: Exo 2 800/900, letter-spacing -0.02em.
- Cards: background var(--card), backdrop-filter blur(16px), border 1px solid var(--border), border-radius 16px, padding 24px, transition all .25s ease. Hover: translateY(-6px), box-shadow 0 8px 40px rgba(0,0,0,.6), border-color rgba(123,97,255,.4).
- Section heading: position relative, padding-left 18px. ::before { content:''; position:absolute; left:0; top:6px; bottom:6px; width:4px; border-radius:2px; background:linear-gradient(180deg,var(--p),var(--a)); box-shadow:0 0 12px var(--p); }
- Mobile responsive at 640px breakpoint.
- Custom scrollbar: ::-webkit-scrollbar{width:6px} thumb:linear-gradient(var(--p),var(--a)).

EVERY ARTIFACT MUST INCLUDE THESE SHARED CHROME ELEMENTS:
1. <canvas id="lp-particles"> — fixed inset-0, z-index:0, pointer-events:none. JS: 80 particles, mix purple (#7B61FF) and cyan (#00F5C4), float upward + drift + twinkle (alpha sine). requestAnimationFrame loop.
2. <div id="lp-progress"> — fixed top:0; left:0; height:3px; width:0; background:linear-gradient(90deg,var(--p),var(--a)); z-index:1000; box-shadow:0 0 12px var(--p); transition:width .12s linear. JS: scroll handler updates width = (scrollY / (docH - winH)) * 100%.
3. <nav id="lp-dots"> — fixed right:18px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:10px; z-index:900. One <button data-target="#sectionId"> per section, 8x8 round, border 1px solid var(--border). Active: scale(1.6), background var(--p), box-shadow 0 0 18px var(--p). Use IntersectionObserver to set .active.
4. <button id="lp-top"> — fixed bottom:24px; right:24px; width:44px; height:44px; rounded-full; gradient bg p→a; opacity:0; transform:translateY(20px); shows after window.scrollY > 400. Click → window.scrollTo({top:0, behavior:'smooth'}).
5. Scroll reveal: every <section class="lp-reveal"> starts opacity:0; transform:translateY(40px). IntersectionObserver toggles .in → opacity:1; transform:none; transition .7s cubic-bezier(.16,1,.3,1).
6. Shimmer hero title: background:linear-gradient(90deg,var(--text) 0%,var(--p) 25%,var(--a) 50%,var(--p) 75%,var(--text) 100%); background-size:300% 100%; -webkit-background-clip:text; color:transparent; animation:lpShimmer 4s linear infinite. @keyframes lpShimmer { from{background-position:0% 50%} to{background-position:300% 50%} }
7. Confetti helper function spawnConfetti(x,y) — 80 absolutely-positioned divs (3-6px squares, mixed purple/cyan/pink/amber), random velocity, gravity, rotate, opacity fade over 1.6s. Call on completion events.
8. LocalStorage namespace: 'lumina:<artifactSlug>:<key>'. Use a slug derived from the topic (kebab-cased, hashed).
9. All interactive controls keyboard-accessible. Focus rings: outline 2px solid var(--a), outline-offset 2px.
10. Smooth-scroll for hash links: html { scroll-behavior:smooth }.

INTERACTIVITY BAR:
- Every numeric input/button/checkbox MUST do something visible.
- Buttons: hover translateY(-2px), active scale(.97), gradient or border-glow.
- MCQ correct answer: background rgba(0,245,196,.18), border var(--a), small ✓ pulses.
- MCQ wrong: shake 350ms, background rgba(255,107,157,.18), border var(--a2), small ✗.
- After answering, lock all options, reveal explanation slide-down.

NEVER:
- Never use hidden <input type=radio> with CSS-only feedback. Use real <button> elements + JS.
- Never use placeholder strings. Never write TODO. Never stop early.
- Never include external JS libraries (no jQuery, no Chart.js). Pure inline JS only.
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
Slug for localStorage: '${slugHint(topic)}'.

${REVEAL_SECTIONS}
Sections in order — every one MUST appear with rich, accurate content:

1. COVER (#cover) — full-viewport hero. Animated radial purple+cyan glow orbs that drift (CSS @keyframes). Shimmer title with the topic name. Subtitle: one-line value prop. Stat counter row (4 stats) — Questions, Flashcards, Topics, Hours of revision. Animated count-up with requestAnimationFrame from 0 to target. Bouncing ↓ arrow.
2. HOW TO USE (#use) — 4 numbered step cards in a grid; circle-numbered badges connected by → on desktop (CSS pseudo). Each card explains one workflow step.
3. SYLLABUS MAP (#syllabus) — chip cloud of every subtopic (real ones). Below: list of chapters with animated coverage bars (width transitions from 0 → target % when revealed).
4. MASTER NOTES (#notes) — the educational core. At minimum 1200 words of actual notes. Use:
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
11. FLASHCARDS (#flash) — grid of 12 CSS 3D flip cards (perspective 1000px). Front: question. Back: answer + "Known" / "Review" buttons (saved to localStorage). Controls: Shuffle, Filter (All/Review/Known), Reset.
12. EXAMINER'S SECRETS (#secrets) — 6 gold-bordered cards. Each shows "SECRET #N" badge in top-right gradient amber→pink. Reveal hidden insights real examiners look for.
13. COMMON MISTAKES (#mistakes) — 6 cards with 4px left-border (alternating var(--a2) pink and var(--a3) amber). "Mistake → Fix" format.
14. HALL OF FAME (#fame) — top 5 most-tested subtopics. Each: title, frequency %, 5-star rating (filled by frequency), 3 example subtopics chips.
15. SPEED DRILL (#drill) — 60-second countdown ring (SVG circle, stroke-dashoffset animates). 10 quick text-input questions, advance on Enter. End screen awards: <70% Bronze, ≥70% Silver, ≥85% Gold, =100% Elite — with confetti for Gold/Elite.
16. LAST-MINUTE CHECKLIST (#checklist) — 12 checkboxes saved to localStorage. Animated progress bar. At 100%: confetti burst + banner "You're Exam Ready!".
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
- SECTION A — Multiple Choice (1 mark each, minimum 12 questions). Each option is a clickable <button class="bubble">. localStorage saves answers (key: 'lumina:exam:${slugHint(topic)}:answers'). Visual chosen state.
- SECTION B — Short Answer (3-5 marks each, minimum 6 questions). Below each: <textarea> with ruled-line background (CSS repeating-linear-gradient at 1.6em).
- SECTION C — Long Answer (10-15 marks each, minimum 2 questions). <textarea> with graph-paper background (CSS grid via two repeating-linear-gradients at 24px).
- MARK SCHEME — hidden by default. Toggle button "Reveal Mark Scheme". Reveals per-question full working with mark allocations.

INTERACTIVE:
- Countdown timer starts at total time. Amber under 10 min, red + pulse under 5 min.
- Auto-save textareas to localStorage every 1500ms.
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
- Back: answer + 2 buttons "Mark Known" (green) and "Review Again" (amber). Updates localStorage.
- Below stage: progress bar + counter "Card X of Y", "Studied" stats (Known / Review / Unseen).
- Bottom controls: ← Prev, Flip (Space), Next →, Shuffle, Restart, Filter (All / Unknown / Review / Known).
- Spaced-repetition hint: after marking Review, show "Next review: Tomorrow"; after Known, show "Next review: in 3 days".
- Completion screen (when all cards marked Known): SVG pie chart Known vs Reviewed, confetti burst, "Share Score" button (copies "I mastered ${topic} on Lumina ⚡" to clipboard).

KEYBOARD: ← → for nav, Space to flip, K = Known, R = Review.
LocalStorage: 'lumina:flash:${slugHint(topic)}:state' = { cardId: 'known' | 'review' | 'unseen' }.
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
  - Buttons: 📋 Copy formula (plain-text), ★ Bookmark (saves to localStorage).
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
2. ARGUMENT BUILDER (#args) — 6 argument cards in a flex row. User can drag (HTML5 drag/drop) to reorder. Order persists in localStorage.
3. KEYWORDS TO INCLUDE (#keywords) — glowing chip cloud of 20 advanced lexis terms specific to ${topic}. Click chip → highlight + add to "used" list.
4. SAMPLE PARAGRAPHS (#samples) — for each section (Intro, 3 Body, Conclusion) provide one model paragraph hidden behind "Show Example" toggle.
5. WORD-COUNT ESTIMATOR (#counter) — input current word count per section; visual ring fills toward the target. Total at top.
6. EXAMINER RUBRIC (#rubric) — table of criteria (AO1/AO2/AO3 style), marks, descriptors for full marks vs partial.
7. COMMON MISTAKES (#mistakes) — accordion with 8 essay-specific pitfalls.
8. YOUR DRAFT (#draft) — large rich textarea. Auto-save to localStorage every 2s. Live word count.
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
2. SPACED REPETITION DECK (#srs) — same flip-card system as flashcards template; 24 cards in deck; Known/Review buttons; localStorage persistence.
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
3. TASK LIST (#tasks) — full checklist (min 20 tasks). Priority badges (P1/P2/P3) coloured. Drag-to-reorder. Persist to localStorage.
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
- Score persistence in localStorage where applicable.

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
Persist progress in localStorage keyed by '${slugHint(topic)}'.
`.trim();
}

function tplFullPack(topic: string): string {
  return `
TEMPLATE: COMPLETE EXAM PACK (FULL SUBJECT) — TOPIC: "${topic}"
This is the ULTIMATE template. Output MUST be 1500+ lines of HTML. Do NOT stub. Real content for every section.

${REVEAL_SECTIONS}
SECTIONS — every one MUST appear, in this order, fully populated:

1. COVER (#cover) — animated orb hero, shimmer title, stat counters (Questions, Flashcards, Topics, Hours), bouncing arrow.
2. HOW TO USE (#use) — 4 numbered step cards.
3. SYLLABUS MAP (#syllabus) — chip cloud + animated coverage bars.
4. MASTER NOTES (#notes) — minimum 1500 words of accurate notes; concept mini-cards; formula glow boxes; pull quotes; SVG diagrams.
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
16. LAST-MINUTE CHECKLIST (#checklist) — 16 items, localStorage-saved, confetti at 100%.
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
