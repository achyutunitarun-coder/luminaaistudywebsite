// Lumina Computer — Craft Skill System
// A library of short, opinionated craft documents that augment generation
// quality. The Skill Router meta-prompt selects relevant skills based on
// the request's actual communication problem, not keyword matching.

export interface CraftSkill {
  name: string;
  description: string;
  conviction: string;
  tell: string;
  craft: string;
  calibration: string;
}

// ── THE SKILL ROUTER (meta-prompt) ────────────────────────────────
export const SKILL_ROUTER_PROMPT = `
Before you plan or write anything, consult the craft skills below. Skills are short, opinionated documents — each one exists because someone sat with a specific kind of content long enough to learn what actually separates excellent work from competent-but-forgettable work in that domain. Reading the relevant ones first is not a formality. It is the difference between output that sounds like every other AI-generated deck, doc, or page, and output that sounds like someone who actually understood the assignment made it.

HOW TO SELECT
Read every skill's description. A skill's description names both a craft problem and a conviction about how to solve it — recognizing when THIS request has that problem is a judgment call, not a keyword match. A request to "make something for my grandmother's 80th" will never contain the trigger vocabulary of a narrative-craft skill, but it's exactly what that skill is for. Read past the surface request to the actual communication problem underneath it — the same instinct the master prompt already asks you to use for structure, now applied to craft.

More than one skill can and often should apply. A persuasive investor deck with a real data section draws on persuasive-writing and data-honesty at once. A visually ambitious, information-dense site draws on visual-restraint and instructional-clarity together. Don't stop at the first match.

If nothing in the library genuinely fits, don't force one. Proceed on your own judgment, per the adaptive prompts already governing this pipeline. A skill augments good judgment — it is never the only source of it, and an ill-fitting skill forced onto a request does more damage than no skill at all.

Once you've identified the relevant skill(s), let them actually change your approach, not just your vocabulary. If your output would be identical whether or not you'd read the skill, you didn't really use it.

Do not narrate this process to the user. Select silently, apply what you learned, produce the output — the way a genuinely skilled person doesn't announce which part of their training they're drawing on mid-sentence.
`;

// ── SKILL DEFINITIONS ─────────────────────────────────────────────

export const CRAFT_SKILLS: CraftSkill[] = [
  // C1
  {
    name: "narrative-emotional-craft",
    description: "For content whose job is to make someone feel something — tributes, retrospectives, personal milestones, anything heartwarming or reflective. AI-generated emotional writing defaults to generic sentiment instead of the one specific detail that actually moves someone.",
    conviction: "The thing that makes people feel something is never the abstract claim — it's the one specific, concrete, slightly odd detail that only someone who was actually there would know. Specificity is what makes emotional writing land. General sentiment, however sincere, reads as generic because it could be said about anyone.",
    tell: "Abstract superlatives stacked without one concrete anchor underneath any of them: 'we are so grateful,' 'an incredible journey,' 'words cannot express,' 'truly special.' Also drifting toward relentless positivity — real tributes hold complexity, and flattening that into pure uplift is itself a tell.",
    craft: "Lead with a specific moment or image, not a summary statement. Show one life touched specifically and let the reader generalize themselves. Use plain declarative sentences for the heaviest emotional beats — ornate language undercuts sincerity. Cut intensifiers ('so very,' 'truly,' 'incredibly'). If there's real complexity or bittersweetness, don't sand it down — admitting something was hard makes a piece more trustworthy. Direct address can create more intimacy than third-person narration when the audience actually knew the subject.",
    calibration: "Generic: 'Throughout her career, Priya was known for her dedication and passion, always going above and beyond for her team.' | This skill: 'Priya answered emails at 6 AM. Not because anyone asked her to — because she liked being the first thing in your inbox that wasn't bad news.'",
  },

  // C2
  {
    name: "persuasive-writing",
    description: "For content asking someone to do something — approve a budget, sign a check, say yes to a proposal, change their mind. AI-generated persuasive writing defaults to asserting confidence instead of earning it with a specific, checkable fact.",
    conviction: "Persuasion doesn't come from stating the conclusion more forcefully — it comes from handing the reader one specific, verifiable fact and letting them do the multiplication themselves. The reader's own conclusion, reached with their own arithmetic, is worth ten of yours.",
    tell: "Stacked unverifiable superlatives ('massive market opportunity,' 'unparalleled solution,' 'game-changing') — claims that could be pasted into a pitch for a completely different product without anyone noticing. Asking for belief before trust has been earned.",
    craft: "Every claim of scale or importance needs a number, a name, or a comparison in the same sentence — or it doesn't get made at all. Address the strongest objection yourself before the reader raises it. The ask itself is one specific, unambiguous sentence — not 'let's explore synergies' but 'I need your sign-off on the ₹32L spend by Friday.' Restraint on adjectives is itself persuasive; a pitch that doesn't need to tell you it's exciting, because the facts already are, reads as more credible.",
    calibration: "Generic: 'Our platform offers a revolutionary solution to a massive, underserved market.' | This skill: 'Small bakeries lose an average of 12% of ingredients to spoilage every month. Our inventory tool cut that to 3% for the 40 bakeries already using it.'",
  },

  // C3
  {
    name: "data-quantitative-honesty",
    description: "For any content where numbers are the actual point — dashboards, reports, sheets, data-heavy slides. AI-generated data writing tends to either bury a real finding under a sentence that just restates the chart, or manufacture false precision.",
    conviction: "A number that needs a sentence to restate what it already says wasn't presented well — the sentence should say something the number can't: why it matters, what it's being compared to, what's surprising about it. A number's stated confidence should never outrun what actually generated it.",
    tell: "Restating the visual instead of interpreting it ('As you can see from the chart below, X increased'). False precision (a rough estimate presented to three decimal places). Comparison-free numbers — a big number alone leaves the reader unable to tell if it's actually significant.",
    craft: "Every number worth including needs a comparison — against last period, a target, a competitor, zero. State precision honestly; round a rough estimate to reflect how rough it actually is. Lead with the finding, not the process ('Revenue grew 30%' beats 'we analyzed revenue across Q1-Q4 and found it grew 30%'). If a number is flat or doesn't support the story, say so plainly — spinning every metric positively loses trust on the metrics that matter.",
    calibration: "Generic: 'As shown in the chart, user engagement has seen a significant increase this quarter.' | This skill: 'Daily active users are up 22% quarter over quarter — and growth is now outpacing new signups, meaning existing users are coming back more, not just more people showing up once.'",
  },

  // C4
  {
    name: "visual-restraint",
    description: "For any visual output — slides, websites, artifacts, generated documents with real layout. AI-generated visual design defaults to decorating instead of organizing — extra icons, colors, flourishes added because they're available, not because the content needed them.",
    conviction: "Every visual element should be able to answer 'what would be lost if you removed me?' A color, icon, or shadow that can't answer that question is noise — and noise is what separates AI-generated visual output from something a real designer would ship. Restraint isn't the absence of design decisions; it's the presence of many decisions to leave things out.",
    tell: "A palette using more than 2-3 real colors plus neutrals. Icons attached to list items that would be exactly as clear as plain text. Multiple font weights doing the job one would do. Drop shadows and gradients applied by default rather than because depth is meaningful in that specific layout.",
    craft: "Pick a type scale before writing any layout code — 4-5 sizes is enough for almost anything. Pick a spacing scale (multiples of 4 or 8px) and use only those values everywhere — inconsistent spacing is a common tell of AI-generated design. One primary color, one accent, and a neutral range is enough for any single artifact. Whitespace is a design decision, not empty space waiting to be filled. When in doubt, cut the newest addition first.",
    calibration: "Generic: a dashboard card with a gradient background, three accent colors, a large icon, and a badge — all for a single number. | This skill: the number, large, in the biggest weight of the type scale, on a plain background, one word of label beneath it in a muted neutral. Nothing else. The number was always the whole point.",
  },

  // D1 — Instructional & Reference Clarity
  {
    name: "instructional-clarity",
    description: "For notes, guided lessons, documentation, how-tos, and reference content where the reader needs to understand and retain. AI-generated instructional content often explains correctly but doesn't organize for how people actually learn — it dumps everything at once instead of building understanding progressively.",
    conviction: "The difference between content that teaches and content that merely informs is structural patience — a willingness to hold one idea in view until it's solid before introducing the next. A reference document's job is different from a tutorial's, and the mistake is treating them the same way: a reference organizes for lookup, a tutorial organizes for sequence, and the structure must fit the mode.",
    tell: "Every section getting the same depth of treatment regardless of importance. Concepts introduced without establishing why they matter first. Terminology used before it's defined. A flat list of facts presented as teaching — no hierarchy of what's foundational versus what's a detail.",
    craft: "Lead with why the concept matters before what it is — motivation gates attention. Define every term before using it in an explanation. One concept per section — if a section has two ideas that could stand alone, split them. For tutorials: each step must produce visible progress. For references: self-contained sections with clear headings so readers can jump to what they need, and the heading should describe what's inside, not just 'Overview.' End each section with a one-sentence summary of what was covered.",
    calibration: "Generic: 'Photosynthesis is the process by which plants convert light energy into chemical energy. It occurs in chloroplasts. The light-dependent reactions produce ATP and NADPH. The Calvin cycle uses these to fix carbon.' | This skill: 'Plants need to eat, but they can't move to find food. So they do something no animal can: turn sunlight into sugar. The machinery for this lives inside chloroplasts, and it works in two shifts — one that captures solar energy and stores it in battery molecules (ATP, NADPH), and another that uses those batteries to build sugar from thin air.'",
  },

  // D2 — Assessment Design
  {
    name: "assessment-design",
    description: "For exams, tests, flashcards, and anything that measures understanding. The most common failure in AI-generated assessments is testing recall of isolated facts rather than the ability to apply, compare, or reason with the material.",
    conviction: "A question that can be answered from a highlighted sentence in the source material isn't testing understanding — it's testing whether the student noticed that sentence was there. The best assessment questions look simple on the surface but require genuine engagement with the material to answer correctly, often by forcing a choice between two plausible answers that differ in a meaningful distinction only someone who actually understands would spot.",
    tell: 'Questions that begin with "What is" or "Define" — pure recall prompts. Multiple-choice options where three are obviously wrong and one is trivially right. Every question at the same cognitive level regardless of the material\'s actual difficulty structure.',
    craft: "Mix question types to match the material's actual cognitive demands: recall for terminology that genuinely must be memorized, application for concepts that must be used, comparison where the material has meaningful contrasts. Every distractor in a multiple-choice question should reflect a specific, real misconception — not a random wrong answer. For flashcards: front-load with the scenario or problem, not just the term. Define partial credit in answer keys where a partially correct answer is possible. The best questions make the student hesitate between two answers that feel right, forcing them to retrieve the distinction.",
    calibration: "Generic: 'What is Newton's second law? A) F=ma B) E=mc² C) PV=nRT D) a²+b²=c²' | This skill: 'A 2 kg cart and a 5 kg cart are pushed with equal force for the same distance. Which has more kinetic energy at the end? A) The 2 kg cart — same force means same momentum, and momentum scales with mass B) The 5 kg cart — more mass means more force was needed, so more work was done C) They have equal kinetic energy — the lighter cart accelerates more and covers the distance faster, and the extra velocity exactly compensates for the lower mass D) It depends on the surface friction'",
  },

  // D3 — Structural Compression
  {
    name: "structural-compression",
    description: "For summaries, quick-study, TL;DRs, and any content where brevity is the point. AI-generated summaries often either cut everything down to a one-size-fits-all generic statement or fail to actually compress — they produce a shorter version that still includes structural padding.",
    conviction: "Good compression isn't writing less — it's knowing what to leave out, which requires understanding what the reader actually needs from the compressed version. A summary for someone who hasn't read the original needs different things than a refresher for someone who has. The question isn't 'how do I say this shorter' but 'what does this specific reader actually need to take away.'",
    tell: 'A summary that starts with "This document covers" — describing the content instead of delivering it. A compressed version that keeps every section from the original but with fewer words per section, preserving the same structure rather than finding a new, more compact one. A quick-study that gives equal space to every topic regardless of importance.',
    craft: 'Lead with the single most important thing the reader needs to know — the summary is already the compressed version, don\'t pad the front. Group related ideas under one unifying statement rather than listing them separately. Cut structural language ("first," "additionally," "in conclusion") — the compression is the structure. For exam revision: organize by what\'s most testable, not by the original material\'s section order. For executive summaries: lead with the recommendation or finding, not the methodology. If something can be said in three words instead of ten, it should be — but not at the cost of precision.',
    calibration: "Generic: 'This document covers the key concepts of cellular respiration including glycolysis, the Krebs cycle, and the electron transport chain. Glycolysis breaks down glucose into pyruvate. The Krebs cycle processes the products further. The electron transport chain produces the most ATP.' | This skill: 'Three steps turn glucose into usable energy: glycolysis (splits glucose, small ATP yield), Krebs cycle (extracts electrons, no direct ATP), and the electron transport chain (uses those electrons to pump protons and drive massive ATP production — ~90% of your energy comes from this last step).'",
  },

  // D4 — Audio & Spoken Rhythm
  {
    name: "audio-spoken-rhythm",
    description: "For podcast scripts, narration, dialogue, and any content meant to be heard rather than read. AI-generated spoken content often reads like written text read aloud — correct grammar, but missing the rhythms and informalities that make speech feel natural and engaging.",
    conviction: "Writing for the ear is a different craft than writing for the page. A sentence that looks fine on screen can feel stilted when spoken. The best spoken content uses short sentences, varied pacing, and deliberate repetition — the same devices that feel redundant in writing create emphasis and clarity when heard. Listeners can't re-read a sentence, so the meaning must land on first pass.",
    tell: 'Overly complex sentences with multiple dependent clauses — fine in writing, exhausting to hear. A script that reads like a formal essay with speaker labels added. Every speaker having the same sentence structure and vocabulary. No conversational markers ("look," "honestly," "here\'s the thing") that give speech its natural texture.',
    craft: 'Read every sentence aloud as you write it. If it trips your tongue, rewrite it. Vary sentence length — a short punchy sentence after a longer one lands harder. Use contractions everywhere — "don\'t" not "do not," "it\'s" not "it is" — unless you want deliberate emphasis. For dialogue: give each speaker a distinct rhythm and vocabulary. Use rhetorical questions to engage the listener. Leave room for pauses — silence in audio does the work of paragraphs in text. Repeat key phrases for emphasis; what feels redundant in writing reads as clarity when heard.',
    calibration: "Generic: 'The CRISPR-Cas9 system represents a revolutionary advancement in genetic engineering. It allows scientists to make precise modifications to DNA sequences with unprecedented accuracy. The system consists of two main components: a guide RNA that targets a specific genomic location, and the Cas9 protein that creates a double-strand break at that location.' | This skill: 'So CRISPR. You've probably heard about it — gene editing, designer babies, all that. Here's what it actually is: a pair of molecular scissors with a GPS attached. The GPS is a piece of RNA that says 'cut here.' The scissors are a protein called Cas9 that does exactly what the GPS says. That's it. That's the revolution — not that we can cut DNA, we've been doing that, but that we can tell it EXACTLY where to cut.'",
  },

  // D5 — Sheet Formula Validity
  {
    name: "sheet-formula-validity",
    description: "For spreadsheet generation where a broken formula is worse than no formula. AI-generated sheets often use plausible-sounding but actually invalid formula syntax because the model doesn't verify references against the actual built sheet.",
    conviction: "A formula that references a range that doesn't exist, or uses a function name the target format doesn't recognize, isn't 'close enough' — it's a broken cell that the user has to debug manually, which is worse than leaving the cell empty with a note. Every formula must be verified against the actual sheet structure before finalizing. This is the one domain where precision beats adaptiveness on every axis.",
    tell: "Formulas referencing sheet names or column letters that don't exist in the output. Using Excel-only functions in a Google Sheets target (or vice versa). ARRAYFORMULA wrapped around functions that already handle arrays natively. Hardcoded values inside formulas where a cell reference is safer ('50' instead of 'B2').",
    craft: "Before writing any formula, verify that every cell and range it references exists in the sheet as built. For cross-sheet references, confirm the sheet name is spelled exactly as it appears in the tab definition. Use named ranges for constants that might change. For conditional logic, test the edge cases — an IF that doesn't handle N/A or blank values will produce misleading results. Use IFERROR around divide operations. For target format: Google Sheets uses different array syntax than Excel; optimize for the user's stated format.",
    calibration: "Generic: '=SUM(Income!A:A) - SUM(Expenses!B:B)' where the sheet is actually named 'Revenue' and the column is 'C'. | This skill: First confirms the sheet has a tab named 'Revenue' and the column is 'C', then writes: '=SUM(Revenue!C:C) - SUM(Expenses!D:D)' with IFERROR wrappers.",
  },

  // D6 — Slide Rendering Constraints
  {
    name: "slide-rendering-constraints",
    description: "For slide generation where a slide that overflows or renders incorrectly is unusable. AI-generated slides often produce content that doesn't fit the canvas, or doesn't account for the constraints of presentation software rendering.",
    conviction: "A slide that looks right in markdown preview but overflows when rendered in pptxgenjs or Google Slides isn't 'almost right' — it's unusable. Slide rendering has hard constraints (text size, container limits, font availability) that must be respected at generation time because there's no 'reflow' step between the model's output and the user's presentation.",
    tell: "More than 6-7 bullet points on a single slide. Text content that doesn't account for font metrics (very long words, dense tables). Slide layouts that reference absolute positioning without checking available space. Speaker notes longer than the slide content.",
    craft: "Limit bullet points to 5 max per slide for readability at presentation distance. For tables: max 5 columns, 8 rows. For text containers: allow minimum 24pt font for body text, 36pt for headlines. Assume the presentation will be projected, not viewed on a screen — test contrast at projection distance. For pptxgenjs specifically: text boxes have max height that truncates silently; test text fit before finalizing. Prefer simple layouts over complex ones — they render more reliably across presentation software.",
    calibration: "Generic: A slide with 11 bullet points, each 2-3 lines long, in 18pt font. | This skill: The same content split across two slides, each with 4-5 points, main point in 36pt heading, supporting text in 24pt. Slide 1 covers the problem, Slide 2 covers the solution. Each point is a single line. The audience can actually read it from the back of the room.",
  },

  // D7 — Docs Export Reliability
  {
    name: "docs-export-reliability",
    description: "For document generation that must survive export to PDF, Word, or other formats. AI-generated documents often contain malformed markdown structures that cause downstream export tools to fail silently — producing a blank or corrupted file with no error message.",
    conviction: "A document that renders perfectly in the editor but breaks at export time is broken, full stop. Export failure is often caused by subtle structural issues — unclosed markdown tags, inconsistent heading levels, malformed tables — that the model never sees because it doesn't run the export itself. The generation prompt is the only defense; it must produce structurally sound output on the first pass.",
    tell: "Headings that skip levels (h1 to h3 with no h2). Unclosed code fences or table delimiters. Tables with mismatched column counts between header and body rows. Content that relies on being read in order but has no structural markers — if the export tool chokes midway through, the reader gets nothing after the choke point.",
    craft: "Verify every markdown construct is properly closed before finalizing — code fences, table pipes, list indentation, bold markers. Use consistent heading hierarchy: never skip from h1 to h3, never use h1 more than once, always nest h3 under h2. For tables: ensure every row has the same number of columns as the header. For code blocks: specify the language after the opening fence. Test-parse the output in your head as if you were a renderer — if any construct is ambiguous, a renderer will interpret it differently than you intended. Keep a mental checklist of the constructs most likely to break: unclosed fences, mismatched table columns, nested formatting inside table cells.",
    calibration: "Generic: '# Title\n\n## Section\n\n| Col A | Col B |\n|-------|\n| Data  | More  |\n' — the table has 2 header columns but the separator row only has 1, which will break most markdown renderers. | This skill: '# Title\n\n## Section\n\n| Col A | Col B |\n|-------|-------|\n| Data  | More  |\n' — matching columns throughout, consistent heading hierarchy, all fences closed.",
  },
];

// ── SKILL SELECTION ───────────────────────────────────────────────

interface SkillMatch {
  skill: CraftSkill;
  relevance: "primary" | "secondary";
}

const CRAFT_TRIGGERS: { keywords: string[]; skillName: string }[] = [
  { keywords: ["tribute", "heartwarming", "retrospective", "personal", "milestone", "reflect", "story", "narrative", "grandmother", "birthday", "anniversary", "memorial", "fond", "grateful", "nostalgia"], skillName: "narrative-emotional-craft" },
  { keywords: ["pitch", "persuade", "argument", "convince", "proposal", "budget", "approve", "sign-off", "yes", "investor", "sell", "ask", "objection", "roi"], skillName: "persuasive-writing" },
  { keywords: ["chart", "graph", "data", "statistic", "dashboard", "metric", "number", "percentage", "report", "analysis", "qoQ", "YoY", "revenue", "growth rate"], skillName: "data-quantitative-honesty" },
  { keywords: ["design", "layout", "ui", "visual", "slide", "website", "theme", "color", "font", "typography", "component", "beautiful", "clean", "minimal"], skillName: "visual-restraint" },
  { keywords: ["note", "study note", "guide", "tutorial", "reference", "how to", "explain", "learn", "teach", "documentation", "handbook", "cheatsheet"], skillName: "instructional-clarity" },
  { keywords: ["exam", "test", "flashcard", "quiz", "question", "practice", "assess", "multiple choice", "mcq", "mark scheme", "answer key", "rubric"], skillName: "assessment-design" },
  { keywords: ["summary", "quick study", "tl;dr", "brief", "overview", "recap", "condense", "compression", "short", "key takeaway", "revision", "cram"], skillName: "structural-compression" },
  { keywords: ["podcast", "script", "narration", "dialogue", "spoken", "audio", "host", "conversation", "talk", "voiceover", "transcript"], skillName: "audio-spoken-rhythm" },
  { keywords: ["sheet", "spreadsheet", "excel", "google sheets", "formula", "cell", "tab", "workbook", "calculation", "data table"], skillName: "sheet-formula-validity" },
  { keywords: ["slide", "presentation", "deck", "pptx", "keynote", "ppt", "powerpoint", "slide deck"], skillName: "slide-rendering-constraints" },
  { keywords: ["export", "pdf", "doc", "word", "print", "render", "download", "file", "markdown"], skillName: "docs-export-reliability" },
];

export function selectCraftSkills(request: string): SkillMatch[] {
  const lower = (request || "").toLowerCase();
  const matched: SkillMatch[] = [];
  const seen = new Set<string>();

  for (const trigger of CRAFT_TRIGGERS) {
    const hits = trigger.keywords.filter((k) => lower.includes(k)).length;
    if (hits > 0) {
      if (!seen.has(trigger.skillName)) {
        const skill = CRAFT_SKILLS.find((s) => s.name === trigger.skillName);
        if (skill) {
          matched.push({
            skill,
            relevance: hits >= 2 ? "primary" : "secondary",
          });
          seen.add(trigger.skillName);
        }
      }
    }
  }
  return matched;
}

// ── BUILD SKILL BLOCK ─────────────────────────────────────────────

export function buildCraftSkillsBlock(skills: SkillMatch[]): string {
  if (skills.length === 0) return "";
  const parts = skills.map((m) => {
    const s = m.skill;
    return `━━━ ${s.name} (${m.relevance}) ━━━
${s.description}

THE CONVICTION
${s.conviction}

THE TELL
${s.tell}

THE CRAFT
${s.craft}

CALIBRATION
${s.calibration}`;
  });
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTIVE CRAFT SKILLS — read these before generating
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${parts.join("\n\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF CRAFT SKILLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}
