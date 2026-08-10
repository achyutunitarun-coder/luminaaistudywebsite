/**
 * Artifact prompt builder — the craft spec sent to the model.
 * Every artifact gets: a rotated aesthetic direction (so nothing feels samey),
 * a medium-specific structure brief, and a non-negotiable quality bar.
 */

import { styleDirectiveBlock } from "./aestheticStyles";

const CRAFT_BAR = `
NON-NEGOTIABLE CRAFT BAR
1. Typography does the heavy lifting: a display face at clamp(38px,7vw,84px) with tight
   tracking (-0.02em to -0.04em), body at 17–19px, line-height 1.65, measure capped at 68ch.
   At least three distinct type sizes and two weights per screen. Never leave text at browser defaults.
2. Composition: asymmetry over centred stacks. Use a real grid (12-col or 8-col) and let
   elements break it deliberately — an oversized numeral, a full-bleed band, a hanging pull-quote.
3. Depth: layered surfaces, hairline 1px rules at low opacity, one shadow language used consistently.
   No default border-radius everywhere; pick a radius scale and hold it.
4. Colour: use the assigned palette tokens in :root. One accent carries emphasis. No rainbow.
   Contrast must pass WCAG AA for all body text.
5. Motion: one entrance language (staggered 40–70ms), one hover language. Respect
   prefers-reduced-motion with a media query that disables all animation.
6. Detail: an eyebrow/kicker on every major section, a figure/caption pattern, real numbers in
   any stat, and a considered footer. Empty space is a design element — use it.
7. Responsive from 360px to 1600px with no horizontal scroll and no clipped text.
8. Zero emoji as UI. Zero lorem ipsum. Zero "coming soon". Zero placeholder text.
   Every sentence must be real, accurate, specific subject matter.
9. Self-contained: one HTML file, inline <style> and <script>, only Google Fonts + (if truly
   needed) one CDN library. No build steps, no broken image URLs — use inline SVG for graphics.
10. Ship complete: the file must open and work on first paste. Close every tag.
`.trim();

const SPECS: Record<string, (topic: string) => string> = {
  notes: (topic) => `You are Lumina's Notes Engine. Produce an editorial-grade study document on "${topic}".

STRUCTURE (adapt to the material — this is a brief, not a template)
- Hero: kicker, title, one-sentence thesis, meta row (subject · difficulty · read time)
- Orientation: 3–5 sentence summary of what the reader will be able to do afterwards
- Sticky table of contents with IntersectionObserver scroll-spy
- Core explanation built as a progression: intuition → formal definition → mechanism → nuance
- Three worked examples (easy → medium → hard) with numbered, fully shown steps
- Misconception callouts and exam-tip callouts, visually distinct from body text
- A diagram: hand-authored inline SVG that actually illustrates the concept, with a caption
- 6+ practice questions with click-to-reveal answers and short explanations
- Formula/cheatsheet block with monospace typesetting
- Considered footer

INTERACTION: scroll progress bar, copy buttons on code/formula blocks, answer reveal,
theme toggle persisted to localStorage, print stylesheet, back-to-top after 400px.

DEPTH: aim for the density of a well-made textbook chapter — 900+ lines of HTML.`,

  exam: (topic) => `You are Lumina's Exam Engine. Produce a real, sittable exam paper on "${topic}".

STRUCTURE
1. Paper header: board/institution line, subject, paper title, date, duration, total marks
2. Instruction box with unambiguous rules
3. Section A — multiple choice (8–12 × 1 mark), selectable options with clear selected state
4. Section B — short answer (4–6 × 3–5 marks), lined answer areas
5. Section C — extended response (2–3 × 8–15 marks) with live word counters
6. End-of-paper marker
7. Collapsible mark scheme: model answers, mark-by-mark allocation, examiner notes

CRAFT: A4-proportioned page (max-width 794px) that prints beautifully — @media print removes
chrome, avoids page-break-inside on questions, and keeps the mark scheme on its own page.
Countdown timer that turns urgent under 5 minutes, attempted-question progress, answers
auto-saved to localStorage.

QUALITY: Bloom spread ~20% recall / 30% understanding / 30% application / 20% analysis.
Every MCQ distractor must be wrong for a specific, diagnosable reason. Every calculation must
be solvable from the information given. Section totals must sum exactly to the stated total.`,

  slides: (topic) => `You are Lumina's Presentation Engine. Produce a keynote-quality deck on "${topic}".

STRUCTURE
- Title slide: full-bleed, oversized display type, no bullet lists
- 9–13 content slides, ONE idea each, with an action title that states the takeaway
  (write "Photosynthesis converts light to chemical energy in two coupled stages", not "Photosynthesis")
- Closing slide with the three things to remember

LAYOUT VARIETY IS MANDATORY: no two consecutive slides may share a layout. Rotate among
full-bleed statement, split 60/40, three-column comparison, big-number stat, data table,
timeline, inline-SVG diagram, quote slide, code slide, and a matrix/2x2.

NAVIGATION (vanilla JS): arrow keys, space, click zones, touch swipe, slide counter,
progress bar, F for fullscreen, G for grid overview, number + Enter to jump.

MOTION: staggered 60ms fade-up per element on slide enter, GPU-only (transform/opacity),
killed entirely under prefers-reduced-motion.

CONTENT: every slide carries substantive, accurate subject matter — real figures, real
examples, a real takeaway line. No slide may be a heading with three vague bullets.`,

  code: (topic) => `You are Lumina's Code Engine. Build a complete, working "${topic}" as one HTML file.

REQUIREMENTS
- Fully functional: every button, input and state transition works. No stubs, no TODOs.
- Real application architecture: clear state object, pure render function, delegated events.
- Handles edge cases: empty state, invalid input, error state, and a first-run onboarding hint.
- Persists meaningful state to localStorage where it makes sense.
- Keyboard accessible: focus rings, tab order, ARIA labels, Escape closes overlays.
- Interface designed, not defaulted — the assigned aesthetic governs every pixel.
- 60fps interactions; animate only transform and opacity.
- Vanilla JS only unless the feature genuinely requires one CDN library.`,
};

export function buildPromptForType(type: string, topic: string): string {
  const spec = SPECS[type] || SPECS.notes;
  const seed = `${type}::${topic}`;
  return [
    spec(topic),
    "",
    styleDirectiveBlock(seed),
    "",
    CRAFT_BAR,
    "",
    "OUTPUT CONTRACT: reply with ONLY the raw HTML document, starting at <!DOCTYPE html> and",
    "ending at </html>. No markdown fences, no commentary, no preamble, no trailing notes.",
  ].join("\n");
}
