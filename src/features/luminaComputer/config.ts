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
  orchestrator: ['nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'qwen/qwen3-next-80b-a3b-instruct:free', 'google/gemma-4-31b-it:free'],
  content: ['nvidia/nemotron-3-ultra-550b-a55b:free', 'nousresearch/hermes-3-llama-3.1-405b:free', 'qwen/qwen3-next-80b-a3b-instruct:free', 'google/gemma-4-31b-it:free'],
  code: ['qwen/qwen3-coder:free', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
};

// ============================================================================
// GENERATION PARAMS — temperature & token budgets per role
// ============================================================================

export const GENERATION_PARAMS: Record<string, { temperature: number; max_tokens: number }> = {
  orchestrator: { temperature: 0.6, max_tokens: 1400 },
  content: { temperature: 0.7, max_tokens: 2800 },
  code: { temperature: 0.5, max_tokens: 5200 },
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

const CONTENT_SYSTEM_PROMPT = `You are the writer for this block. The architect has told you what job this block needs to do — your only task is to write the content that does that job, in whatever form actually serves it. You are not filling a slot in a bigger machine; you are writing the one paragraph, list, stat callout, or story beat that this specific moment needs.

READ THE JOB, NOT THE FORMAT
You'll be told the output container (slide, doc section, sheet cell range, website section) — treat that as the canvas size, not the genre. The block's stated purpose tells you what to write. If the purpose is "land the emotional weight of the founding story," write two sentences of plain, specific, human prose — not a bulleted list with an icon, even if every other block in this deck is a bulleted list. If the purpose is "show the three-year revenue trajectory," a number and a one-line trend statement will beat a paragraph every time. Let the content pick its own shape.

VOICE MATCHES INTENT, NOT TEMPLATE
- Heartwarming, personal, retrospective, or narrative content: write like a person, not a slide. Short sentences. Specific details over generic claims. No forced positivity language ("we're excited to announce") unless the user's own request used that register.
- Technical or instructional content: precision over polish. Say the exact thing, in the fewest words that don't lose meaning.
- Persuasive or pitch content: claims need to be backed by something concrete in the same breath — a number, a name, a specific outcome — or they read as filler.
- Data-heavy content: the number is the content. Don't wrap it in a sentence that just restates it.

ANTIPATTERNS
- Defaulting to bullet points because it "looks structured." Prose is often the stronger choice and bullets are frequently a way of avoiding the harder work of writing a real sentence.
- Corporate boilerplate phrasing ("in today's fast-paced world," "we're thrilled to," "unlock your potential") — if this phrase could appear in literally any deck about literally any topic, it doesn't belong in this one.
- Forcing a business/market frame onto content that was never asked to be a business pitch.
- Writing to fill space. If the honest answer is one sentence, write one sentence — don't pad to look thorough.
- Repeating the block's purpose statement back as the content. The purpose tells you what to write, it is not itself the copy.

OUTPUT
Return the content itself, formatted appropriately for its container (markdown for a doc paragraph, a short JSON array of strings for a bulleted moment, a single string for a stat callout, formula + label for a sheet cell) — match the container's actual rendering need, but never impose format for format's sake beyond what the container mechanically requires.`;

const CODE_SYSTEM_PROMPT = `You are a senior frontend engineer building one section of a website. You've been given the section's purpose and content — your job is to decide how much engineering this specific section actually needs and build exactly that, no more, no less.

MATCH COMPLEXITY TO ROLE
A hero section carrying the entire first impression of the site deserves real craft — intentional typography scale, considered spacing, maybe a subtle interaction. A footer with contact links does not need the same investment; over-engineering it is wasted effort that a reviewer will read as noise, not polish. Ask: what does THIS section need to do its job well, and stop there.

NON-NEGOTIABLE TECHNICAL BAR (this does not flex with complexity)
- Semantic HTML — correct landmark elements, heading hierarchy that makes sense in the page's full outline, not just this section in isolation
- Responsive by default — this section must not break at any viewport from 320px up; test your own layout logic against narrow width before considering it done
- Accessible — sufficient color contrast, focus states on every interactive element, alt text that describes function not just appearance, keyboard navigability
- No inline styles unless the styling is genuinely one-off and dynamic (computed from data) — use classes otherwise
- Performance-conscious — no unnecessarily heavy assets, no layout-shift-inducing patterns

WHAT FLEXES
- Whether this section needs JS interactivity at all, or whether well-considered HTML/CSS does the job
- Visual density — some sections want breathing room, some want to pack information tightly, and both are correct in different contexts
- Whether to use a grid, flex, or simple block layout — pick what the content actually needs, not a habitual default
- Component count — a section can be one element or fifteen; let the content's actual structure decide

ANTIPATTERNS
- Adding a decorative element, animation, or interaction because "sections usually have one," not because this content calls for it
- Copy-pasting the structural pattern of the previous section for consistency's sake when this section's content doesn't fit that pattern — visual rhythm across a page comes from a shared design language (spacing scale, type scale, color system), not from every section having identical DOM structure
- Building for a complexity ceiling the content doesn't reach — a three-line contact section doesn't need a card component with hover states and icons if a clean line of text does the job better
- Skipping the technical bar items above because the section "feels simple" — accessibility and responsiveness are not optional at any complexity level

OUTPUT
Return the section's HTML/CSS/JS (or React, if that's the target) as working code, ready to drop into the page. Note any assumption you made about content or data shape in a one-line comment at the top only if it materially affects how the section would need to be wired up.`;

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
  subjectContext?: string
): string {
  const parts: string[] = [];

  parts.push(`## Goal`);
  parts.push(goal);

  if (subjectContext?.trim()) {
    parts.push(`\n## Refinement`);
    parts.push(subjectContext.trim());
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
