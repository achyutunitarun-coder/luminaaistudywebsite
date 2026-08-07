/**
 * LUMINA COMPUTER — GENERATION CONFIG
 *
 * System prompts, model routing, generation parameters, and prompt-template
 * builders for the block-based content pipeline.
 */

// ============================================================================
// TYPES
// ============================================================================

export type OutputType = 'slides' | 'doc' | 'sheet' | 'website' | 'agent';

export type Role = 'orchestrator' | 'content' | 'code' | 'visual' | 'perception' | 'router';

export type LayoutHint =
  | 'big_statement'
  | 'bulleted'
  | 'two_column'
  | 'quote'
  | 'data_viz'
  | 'image_led'
  | 'comparison'
  | 'timeline'
  | 'diagram';

export type NarrativeBeat =
  | 'hook'
  | 'context'
  | 'tension'
  | 'evidence'
  | 'turn'
  | 'resolution'
  | 'cta';

export interface Block {
  block_type: string;
  title: string;
  prompt_seed: string;
  order_index: number;
  layout_hint?: LayoutHint;
  narrative_beat?: NarrativeBeat;
}

export interface BlockPlan {
  blocks: Block[];
}

export interface SlideElement {
  type: 'headline' | 'subhead' | 'body' | 'stat' | 'quote' | 'column' | 'data_point' | 'caption';
  text: string;
  value?: string;
  label?: string;
  attribution?: string;
}

export interface SlideContent {
  layout: LayoutHint;
  elements: SlideElement[];
  speaker_notes?: string;
}

export interface SheetTabContent {
  tab_name: string;
  columns: Array<{ key: string; header: string; type: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'formula' }>;
  rows: Array<Record<string, string | number>>;
  formulas?: Array<{ cell: string; formula: string }>;
  notes?: string;
}

export interface WebsiteSectionCopy {
  section_purpose: string;
  headline: string;
  subhead?: string;
  body?: string[];
  cta?: { label: string; intent: string };
  proof_points?: string[];
  items?: Array<{ title: string; description: string }>;
}

// ============================================================================
// MODEL ROUTING — flat model priorities per role
// ============================================================================

export const MODEL_ROUTING: Record<string, string[]> = {
  orchestrator: ['nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'openai/gpt-oss-20b:free', 'google/gemma-4-31b-it:free'],
  content: ['nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'google/gemma-4-31b-it:free'],
  code: ['cohere/north-mini-code:free', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
};

// ============================================================================
// GENERATION PARAMS — temperature & token budgets per role
// ============================================================================

export const GENERATION_PARAMS: Record<string, { temperature: number; max_tokens: number }> = {
  orchestrator: { temperature: 0.6, max_tokens: 4000 },
  content: { temperature: 0.7, max_tokens: 16000 },
  code: { temperature: 0.5, max_tokens: 24000 },
};

// ============================================================================
// ANTI-ECHO GUARD — appended to every system prompt
// ============================================================================

export const ANTI_ECHO_GUARD = `\n\nStart directly with the content. No preamble, no "Here is", no "Sure", no markdown fences, no meta.`;

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the client-side orchestrator deciding how to structure the response to a Lumina Computer request before handing off to generation. Your job is the same as the backend architect's: look at what's actually being asked for and decide the shape that serves it, not a shape pulled from a fixed menu of block types or a target block count.

Do not assume a target range for how many pieces this needs — infer it from the goal. Do not assume a fixed set of block/layout types — describe what each piece needs to do, in your own words, and let that description carry through to generation rather than mapping it onto a predefined enum.

ANTIPATTERNS
- Falling back to a "standard" block count or block-type list because it's fast or safe
- Silently re-imposing structure that the backend architect prompt was specifically redesigned to remove — if you and the backend planner are both making structural decisions, make sure you're not each defaulting to old habits independently and producing a rigid result even though both prompts were individually rewritten to avoid it

OUTPUT
Pass through a goal-driven structural plan in the same open envelope shape as the backend architect — an ordered list of pieces, each with a purpose and content shape you've reasoned about specifically for this request.`;

const CONTENT_SYSTEM_PROMPT = `You are the writer for this block in Lumina Computer — a deep, agentic research-and-writing engine. Your job is to produce exhaustive, substantial, high-quality content that genuinely covers the block's purpose in depth. This is not a quick blurb: the user is paying for a comprehensive agentic deliverable, and short, thin content is a failure. Go long. Go deep. Fill the block with real substance.

DEPTH & LENGTH REQUIREMENTS (non-negotiable)
- Every block must be LONG and COMPLETE — thousands of words where the topic warrants it. Treat a doc section as a full book chapter: opening framing, multiple developed sections with sub-sections, detailed explanations, concrete examples, worked cases, data or specifics where available, nuance, counterpoints, and a strong closing.
- Expand every idea to its full logical extent before moving on. Do not summarize what could be explained. Every claim should be developed: what, why, how, implications, and examples.
- Aim for dense, well-structured long-form writing: multiple H2/H3 sub-sections, developed paragraphs of 4-8 sentences each, bulleted breakdowns where they aid scanning, and inline detail everywhere.
- For technical or instructional content, include the full depth: definitions, mechanisms, step-by-step processes, edge cases, common mistakes, best practices, worked examples, and checklists.
- For persuasive or narrative content, write developed, flowing prose that lands with specificity — concrete numbers, names, outcomes, and scenes — not generic filler.

STYLE & VOICE
- Match the register to the intent (narrative, technical, persuasive, data-heavy) but always remain thorough.
- Write like an expert producing a definitive reference, not a slide deck. Prefer developed prose; use lists only when a list genuinely structures information better.

ANTIPATTERNS
- Short, truncated, or "sketchy" output — if the block reads like an outline or a draft rather than finished content, you have failed.
- Corporate boilerplate ("in today's fast-paced world," "we're thrilled to") — this is filler, not depth.
- Repeating the block's purpose statement as the content.
- Stopping at the first natural break. Continue developing until the block has genuinely exhausted its subject.
- Uneven length: a dense topic must not get the same two-paragraph treatment as a trivial one.

OUTPUT
Return the complete finished content, formatted appropriately for its container (markdown for a doc paragraph or section, a JSON shape for a slide/sheet per the block's job) — complete, polished, and as long as the subject requires. Never truncate. Never leave "and so on" placeholders — write it all out.`;

const CODE_SYSTEM_PROMPT = `You are a senior frontend engineer building a section of a website for Lumina Computer — an agentic build engine. The user expects a polished, production-grade, COMPLETE section, not a stub. Every section must be fully built: real content, full layout, working interactions, complete styling. Never leave placeholders, "..." ellipses, TODO comments, or undecided parts.

COMPLETENESS BAR (non-negotiable)
- Build the ENTIRE section as it would ship: all content written out, all states handled, all interactions wired, responsive at every breakpoint from 320px up.
- No lorem ipsum, no placeholder copy, no "// rest of implementation". Everything the section shows must be real.
- If the section implies data (products, features, testimonials, stats, posts), generate complete, plausible, detailed data — multiple full items with real-sounding specifics, not two half-empty entries.
- Where the section benefits from interactivity (tabs, accordions, carousels, filtering, animated counters, form validation), implement it fully in plain JS with graceful behavior.
- Rich, complete visuals: thoughtful typography scale, intentional spacing rhythm, hover/focus states, subtle transitions, and a coherent design language consistent with the whole page.

TECHNICAL BAR (this never flexes)
- Semantic HTML — correct landmark elements and a heading hierarchy that makes sense in the page's full outline.
- Responsive by default — the section must not break at any viewport from 320px up.
- Accessible — sufficient contrast, focus states on every interactive element, descriptive alt text, keyboard navigability.
- No inline styles unless genuinely dynamic — use classes otherwise.
- Performance-conscious — no heavy assets, no layout-shift-inducing patterns.

ANTIPATTERNS
- Stubs, partial code, or "just enough" implementations. If a reviewer can't ship it as-is, you have failed.
- Repeating the same structural pattern as every other section when this section's content calls for something different.
- Skipping the technical bar because the section "feels simple."

OUTPUT
Return a single valid JSON object with this exact shape (nothing before or after it):
{"html": "<complete section markup>", "css": "<section styles, scoped to this section>", "js": "<section interactivity, or empty string>"}
Inside the JSON, build the section fully as described above — all content written out, all states handled, all interactions wired, complete styling. Never truncate the JSON. Never use "..." placeholders. Every property must be complete.`;

export const SYSTEM_PROMPTS: Record<'orchestrator' | 'content' | 'code', string> = {
  orchestrator: ORCHESTRATOR_SYSTEM_PROMPT,
  content: CONTENT_SYSTEM_PROMPT,
  code: CODE_SYSTEM_PROMPT,
};

// ============================================================================
// VISUAL DIRECTION — design style directives
// ============================================================================

export function styleDirective(styleId: string): string {
  const directives: Record<string, string> = {
    editorial: `VISUAL DIRECTION: Editorial publication style. Type-driven layouts with pull quotes, drop caps, and asymmetric compositions. Palette: warm paper tones, dark ink, one saturated accent. Think Stripe Press, The New Yorker, Vanity Fair.`,
    minimal: `VISUAL DIRECTION: Extreme minimalism. Maximum whitespace, thin borders, monochrome palette with a single muted accent. Small type, generous leading. Think Linear, Raycast, Clean.`,
    bold: `VISUAL DIRECTION: Bold and loud. Oversize type, high-contrast color (dark bg + bright accent or light bg + deep accent), saturated gradients used sparingly. Think Apple keynote, Nike, Stripe Sessions.`,
    technical: `VISUAL DIRECTION: Technical/developer aesthetic. Monospace-heavy, structured grids, code-friendly, subtle color palette with blue or teal accent. Documentation-quality. Think Vercel, Supabase docs, Read the Docs.`,
    warm: `VISUAL DIRECTION: Warm and organic. Earth tones (amber, ochre, warm gray), soft borders, serif display type, generous whitespace. Think meditation app, craft brand, indie publishing.`,
    dark: `VISUAL DIRECTION: Dark mode cyber. Deep #0a0a0d backgrounds, neon accent (cyan, magenta, or lime), glow effects on accent elements, glassmorphism only on overlays. Think synthwave, cyberpunk, dark dashboard.`,
  };
  return directives[styleId] ?? "";
}

// ============================================================================
// PROMPT TEMPLATE HELPERS
// ============================================================================

export function buildGeneratePrompt(
  goal: string,
  blockTitle: string,
  promptSeed: string,
  layoutHint?: string,
  narrativeBeat?: string,
  screenshotUrl?: string,
  designMood?: string,
  subjectContext?: string,
  siteContext?: string
): string {
  const parts: string[] = [];

  parts.push(`## Goal`);
  parts.push(goal);

  if (subjectContext?.trim()) {
    parts.push(`\n## Refinement`);
    parts.push(subjectContext.trim());
  }

  if (siteContext?.trim()) {
    parts.push(`\n## Whole-page plan`);
    parts.push(siteContext.trim());
  }

  parts.push(`\n## Block`);
  parts.push(`Title: ${blockTitle}`);
  parts.push(`Intent: ${promptSeed}`);

  if (layoutHint) parts.push(`Layout: ${layoutHint}`);
  if (narrativeBeat) parts.push(`Narrative role: ${narrativeBeat}`);
  if (designMood) parts.push(`Design mood: ${designMood}`);

  if (screenshotUrl) {
    parts.push(`\n## Reference screenshot`);
    parts.push(`Implement this screenshot pixel-for-pixel as a reference design: ${screenshotUrl}`);
    parts.push(`Your output must match the screenshot's visual decisions — palette, typography, layout proportions, spacing system, visual hierarchy. Do not describe what you see; reproduce it as code.`);
  }

  parts.push(`\nProduce the block now.`);

  return parts.join('\n');
}

// ============================================================================
// SITE CONTEXT — gives every block awareness of the whole page's plan so the
// output is a coherent, single-design artifact instead of isolated sections.
// ============================================================================

export interface SiteBlockRef {
  title: string;
  prompt_seed: string;
  block_type?: string;
}

export function buildSiteContext(overallIntent?: string, blocks?: SiteBlockRef[]): string {
  const lines: string[] = [];

  if (overallIntent?.trim()) {
    lines.push(`Overall intent of the site: ${overallIntent.trim()}`);
  }

  if (blocks && blocks.length) {
    lines.push(`\nThe full page is built from these sections, in order:`);
    blocks.forEach((b, i) => {
      lines.push(`  ${i + 1}. ${b.title} — ${b.prompt_seed}`);
    });
    lines.push(`\nRules:`);
    lines.push(`  - You are building section ${blocks.length > 1 ? `one part of a ${blocks.length}-section page` : `the entire page`}. Match the sections above in voice and design language.`);
    lines.push(`  - Do NOT restate or duplicate the intent of sections you do not own. Only build your own section's content.`);
    lines.push(`  - Reuse the same accent color, font family, spacing rhythm, and border radius across all sections for a consistent look.`);
    lines.push(`  - Make the page feel complete and premium even in isolation: real, specific copy — never lorem ipsum, never "placeholder", never "..." filler.`);
  }

  return lines.join('\n');
}
