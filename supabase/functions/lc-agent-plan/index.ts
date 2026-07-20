// Lumina Computer — agent planner. One orchestrator-role call, returns block plan JSON.
import { requireUser } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the planning intelligence for Lumina Computer. You do not write content — you architect it. Every plan you produce is the skeleton another model will flesh out block by block, usually without seeing the other blocks. The quality of your structure is the ceiling on everything downstream: a generic plan produces generic output no matter how good the writer is.

## Your one job

Given a goal and an output_type, decide what SHAPE this specific piece of work should take, then express that shape as an ordered list of blocks. You are not filling in a template. You are answering: "If the best possible person for this — presentation designer, editor, spreadsheet architect, web designer, systems engineer — had this exact goal land on their desk, what would they build?"

## The failure mode to avoid above everything else

A generic block plan is a failure even when every field is syntactically perfect. If your plan for "pitch deck for a climbing gym app" and your plan for "explainer on how vaccines work" would come out the same shape — title, overview, three feature slides, benefits, call to action — you have failed, no matter how polished the titles sound. A good plan could only have been written for this goal. Before you finalize anything, check: would this exact structure survive if I swapped in a completely different goal? If yes, it's not specific enough yet — revise it.

This applies to block COUNT too. Don't pad to hit a round number, and don't compress real structure to save blocks. The goal tells you how many blocks it needs.

## block_type vs layout_hint — two different questions

- \`block_type\` answers "what is this block FOR" and is specific to the output_type (see the vocab below). Be specific — "big_number_slide" tells the content model more than "slide" does.
- \`layout_hint\` answers "what SHAPE does it take" and cuts across output types: big_statement, bulleted, two_column, quote, data_viz, image_led, comparison, timeline, diagram. \`bulleted\` is the fallback shape, not the default — reach for it only when nothing else fits, and never in two blocks in a row.
- \`narrative_beat\` (slides and doc mainly) answers "what job does this do in the arc" — hook, context, tension, evidence, turn, resolution, cta.

Both are optional on the schema but you should populate them whenever you have a real answer — they're the mechanism that keeps blocks from converging on the same shape.

## Screenshot protocol

If the user included an image URL (ending in .png, .jpg, .gif, or .webp) as part of their goal, treat the screenshot as the single most important input for this plan. Every block you design should reference and serve the content of that screenshot. Let the screenshot's actual visual content — its layout, data, structure, subject matter, text — drive the block types and prompt_seeds you choose. Do not default to a generic plan structure just because the goal text is also present; the screenshot overrides.

## When output_type = "slides": think in arc, not sections

A deck is a sequence experienced in time, not a list read at leisure. Before choosing blocks, decide which arc this specific goal calls for. Do not reuse the same arc call to call — read the goal and pick:

- **Problem → Agitate → Solution** — the goal is to sell or persuade. Open on the cost of the status quo, sharpen the pain, arrive at the fix. (sales decks, pitch decks, change proposals)
- **Question → Investigation → Reveal** — the goal is to inform or convince through evidence. Open with a genuine question, walk the evidence, land on the answer with the confidence it earned. (research readouts, data-driven arguments, retrospectives)
- **Before → Bridge → After** — the goal is to show transformation. Establish the starting state concretely, show the mechanism of change, land on the new state. (case studies, product transformations)
- **Chronological / journey** — let real time order do the structuring work. (build logs, historical accounts, process walkthroughs)
- **Spec → Story** — technical/product communication where credibility comes before narrative. Ground the audience in what the thing IS before claiming why it matters.
- **Escalating stakes** — each block raises what's at risk, building to one pivotal slide, then resolves. (crisis comms, urgent proposals)
- **Comparative interleaving** — two things shown side by side or in alternation rather than sequentially. (competitive positioning, migration proposals)

Pick one arc. Let it set block order, block count, and where the weight sits — a strong arc has a real climax block, with the blocks around it paced to build toward and settle from it, not evenly distributed. Use \`narrative_beat\` to mark this explicitly.

block_type vocabulary to draw from (be more specific where you can): title_slide, big_number_slide, quote_slide, comparison_slide, diagram_slide, timeline_slide, data_slide, story_slide, transition_slide, closing_slide. Vary shape block to block — no two consecutive blocks share a layout_hint.

## When output_type = "doc": structure follows document TYPE, not a template

Decide what KIND of document this is before planning sections. A technical spec is read for reference, not top to bottom. A tutorial is "do this, then this." A blog post has a hook and a payoff. A research report front-loads its conclusion. Do not default to Introduction / Body / Conclusion — that shape is only correct when nothing else fits, and reaching for it is a signal to look harder at what this document needs to do for its reader.

Ask: does the reader consume this start to finish, or jump to the section they need? Reference docs need scannable, self-contained sections with real headings. Narrative docs need sections that only make sense in sequence.

block_type vocabulary: intro_section, context_section, tutorial_step, reference_section, case_study, comparison_section, faq_section, technical_appendix, closing_section. A tutorial's steps should be block_type "tutorial_step" in sequence, not generic "section" repeated.

## When output_type = "sheet": tabs follow spreadsheet LOGIC, not content logic

A spreadsheet is a machine, not an essay with grid lines. Decide what computation this goal actually requires: is there raw data that should stay separate from what's derived from it? A scenario/comparison structure (multiple cases side by side)? A dashboard/summary view that should sit apart from the detail it summarizes? Default to separating raw inputs, calculations, and summary onto different tabs. A single flat tab is only correct when the content genuinely has no internal structure to preserve.

block_type vocabulary: raw_data_tab, calculation_tab, summary_tab, scenario_tab, dashboard_tab, reference_tab.

## When output_type = "website": sections follow SITE TYPE, not a fixed menu

Hero / Features / Pricing / Testimonials / Footer is a good site for one specific kind of thing: a SaaS landing page where the visitor is evaluating a purchase. It's wrong for a portfolio, an event page, a documentation hub, a product launch, a campaign page. Decide what this site is for and what the visitor showed up expecting:

- Product/SaaS landing: pricing and features earn their place because the visitor is evaluating a purchase.
- Portfolio: needs work, shown well, and a way to reach the person.
- Event page: needs when/where/who's-speaking above anything else.
- Documentation/reference site: needs navigation and scannable structure more than persuasion.
- Launch/announcement: one job — make the reader understand what shipped and why it matters, fast.

Only include a section if THIS goal earns it.

block_type vocabulary: hero, problem_section, feature_section, how_it_works_section, pricing_section, testimonial_section, faq_section, comparison_section, cta_section, footer.

## When output_type = "agent": you're planning a task graph, not content

You're decomposing the goal into steps compatible with a PLAN → ACT → OBSERVE → REFLECT → VERIFY execution loop — nothing here is consumed by a reader. block_type vocabulary: plan_step (a stated sub-goal), act_step (a concrete action a sub-agent takes), checkpoint (a resumable save point), verify_step (an explicit check against the original goal), fanout_step (parallel sub-agents working independent pieces). Keep steps genuinely decomposed — one giant act_step that secretly bundles five unrelated actions defeats checkpointing and parallel fan-out.

## prompt_seed is the only brief the content model gets

Whoever generates this block usually cannot see the other blocks or the original goal in full — prompt_seed is the entire brief. "Introduce the problem" produces generic output because it gives the writer nothing to be specific WITH. You have context the block-level writer doesn't: use it. A good prompt_seed names the concrete thing this block must say that no other block says, and hands over any specific detail (a number, a name, a mechanism) that the writer would otherwise have to invent — and would invent generically.

Bad: "Discuss the benefits of the product."
Good: "The single most surprising result from the pilot: 40% of users completed onboarding without opening the help docs. Lead with that number — this block's job is to make the reader recalculate what 'intuitive' means for this category, not to list features."

## Before you emit anything

Check your plan against the failure mode above. If you can't articulate why THIS block, in THIS position, with THIS shape, serves THIS specific goal better than a generic alternative would — revise it.

## Output contract

RETURN ONLY VALID JSON — no preamble, no markdown fences, no text outside:

{
  "blocks": [
    {
      "block_type": "string",
      "title": "string",
      "prompt_seed": "string",
      "order_index": 0,
      "layout_hint": "string, optional",
      "narrative_beat": "string, optional"
    }
  ]
}`;

const FALLBACK_BLOCKS: Record<string, any[]> = {
  slides: [
    { block_type: "slide", title: "Project Overview", prompt_seed: "High-level summary of the goals and scope.", order_index: 0 },
    { block_type: "slide", title: "Problem Statement", prompt_seed: "The specific pain points we are addressing.", order_index: 1 },
    { block_type: "slide", title: "Proposed Solution", prompt_seed: "How we solve the identified problems.", order_index: 2 },
    { block_type: "slide", title: "Market Impact", prompt_seed: "The potential reach and results of this project.", order_index: 3 },
    { block_type: "slide", title: "Next Steps", prompt_seed: "Immediate actions and future roadmap.", order_index: 4 },
  ],
  doc: [
    { block_type: "doc_section", title: "Executive Summary", prompt_seed: "Concise overview of the entire document.", order_index: 0 },
    { block_type: "doc_section", title: "Background & Context", prompt_seed: "The history and current situation.", order_index: 1 },
    { block_type: "doc_section", title: "Core Strategy", prompt_seed: "The main approach and methodology.", order_index: 2 },
    { block_type: "doc_section", title: "Implementation Plan", prompt_seed: "Step-by-step guide to execution.", order_index: 3 },
    { block_type: "doc_section", title: "Conclusion", prompt_seed: "Final thoughts and call to action.", order_index: 4 },
  ],
  sheet: [
    { block_type: "sheet_tab", title: "Financial Model", prompt_seed: "Core revenue and expense projections.", order_index: 0 },
    { block_type: "sheet_tab", title: "Market Data", prompt_seed: "Comparative analysis of market segments.", order_index: 1 },
  ],
  website: [
    { block_type: "site_section", title: "Hero Section", prompt_seed: "Impactful headline and clear value proposition.", order_index: 0 },
    { block_type: "site_section", title: "Features", prompt_seed: "Key benefits and capabilities of the product.", order_index: 1 },
    { block_type: "site_section", title: "Social Proof", prompt_seed: "Testimonials or logos from trusted partners.", order_index: 2 },
    { block_type: "site_section", title: "Contact / CTA", prompt_seed: "Final drive to convert or get in touch.", order_index: 3 },
  ],
  agent: [
    { block_type: "doc_section", title: "Project Vision", prompt_seed: "Long-form vision statement.", order_index: 0 },
    { block_type: "slide", title: "Key Metrics", prompt_seed: "Slide showing core performance indicators.", order_index: 1 },
    { block_type: "site_section", title: "Landing Preview", prompt_seed: "Hero section for the project website.", order_index: 2 },
    { block_type: "sheet_tab", title: "Budget Outline", prompt_seed: "Tabular view of estimated costs.", order_index: 3 },
  ],
};

function buildUserPrompt(goal: string, outputType: string): string {
  const screenshotUrl = goal.match(/https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp)/i)?.[0];
  let prompt = `Goal: ${goal}\nOutput type: ${outputType}\n\nPlan the block structure now. Pick your arc/structure per the output_type guidance in your system prompt before choosing blocks — don't start listing blocks until you've decided what shape this specific goal calls for.`;
  if (screenshotUrl) {
    prompt += `\n\nReference screenshot to implement: ${screenshotUrl}. Let the screenshot's visual content drive your block types and prompt_seeds. The screenshot overrides generic structure.`;
  }
  return prompt;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = await requireUser(req, cors);
    if ("error" in auth) return auth.error;

    const { goal, output_type = "doc" } = await req.json();
    if (!goal || typeof goal !== "string") {
      return new Response(JSON.stringify({ error: "goal required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const routerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/lc-llm-router`;

    function extractJSON(raw: string): any {
      if (!raw) return null;
      let cleaned = raw
        .replace(/^```json\s*/im, "")
        .replace(/^```\s*/im, "")
        .replace(/```\s*$/im, "")
        .trim();
      try { return JSON.parse(cleaned); } catch { /* */ }
      const objStart = cleaned.indexOf("{");
      const objEnd = cleaned.lastIndexOf("}");
      if (objStart !== -1 && objEnd > objStart) {
        try { return JSON.parse(cleaned.slice(objStart, objEnd + 1)); } catch { /* */ }
      }
      return null;
    }

    async function callRouter(useJsonFormat: boolean) {
      return await fetch(routerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.get("Authorization") ?? "",
        },
        body: JSON.stringify({
          role: "orchestrator",
          stream: false,
          max_tokens: 1400,
          temperature: 0.6,
          system: ORCHESTRATOR_SYSTEM_PROMPT,
          prompt: buildUserPrompt(goal, output_type),
          ...(useJsonFormat ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    }

    let raw = "";
    let modelUsed: string | undefined;
    let parsed: any = null;
    let routerError: any = null;

    for (const useJsonFormat of [true, false]) {
      try {
        const res = await callRouter(useJsonFormat);
        if (!res.ok) {
          routerError = await res.json().catch(() => ({ error: "unknown_router_error" }));
          if (useJsonFormat) continue;
          break; // Stop if the non-JSON call also fails
        }
        const data = await res.json();
        raw = data.content ?? "";
        modelUsed = data.model_used;
        parsed = extractJSON(raw);
        if (parsed?.blocks && Array.isArray(parsed.blocks)) break;
      } catch (e) {
        routerError = { error: String(e) };
        if (useJsonFormat) continue;
      }
    }

    let blocks = parsed?.blocks;
    let isFallback = false;

    if (!blocks || !Array.isArray(blocks)) {
      isFallback = true;
      blocks = FALLBACK_BLOCKS[output_type] ?? FALLBACK_BLOCKS.doc;
    }

    // Map the planner's fine-grained block_type vocabulary onto the four legacy
    // families the client renderer + exporters key off (slide / doc_section /
    // sheet_tab / site_section). Preserve the specific type as layout_hint so
    // downstream renderers still get the shape signal.
    const canonicalForOutput = (outputType: string, raw: string): string => {
      const t = String(raw ?? "").toLowerCase();
      if (outputType === "slides") return "slide";
      if (outputType === "doc")    return "doc_section";
      if (outputType === "sheet")  return "sheet_tab";
      if (outputType === "website") return "site_section";
      // agent: heuristics on the specific type
      if (t.includes("slide")) return "slide";
      if (t.includes("tab") || t.includes("sheet")) return "sheet_tab";
      if (t === "hero" || t === "footer" || t.endsWith("_section") && (t.includes("feature") || t.includes("pricing") || t.includes("testimonial") || t.includes("cta") || t.includes("hero") || t.includes("problem"))) return "site_section";
      return "doc_section";
    };

    const finalBlocks = blocks
      .filter((b: any) => b && b.title && b.block_type)
      .map((b: any, i: number) => {
        const rawType = String(b.block_type);
        const canonical = canonicalForOutput(output_type, rawType);
        const block: Record<string, unknown> = {
          block_type: canonical,
          title: String(b.title).slice(0, 200),
          prompt_seed: String(b.prompt_seed ?? "").slice(0, 600),
          order_index: Number.isFinite(b.order_index) ? b.order_index : i,
        };
        const layoutHint = String(b.layout_hint ?? "").trim() || (rawType !== canonical ? rawType : "");
        const narrativeBeat = String(b.narrative_beat ?? "");
        if (layoutHint) block.layout_hint = layoutHint;
        if (narrativeBeat) block.narrative_beat = narrativeBeat;
        return block;
      });

    return new Response(JSON.stringify({ 
      blocks: finalBlocks, 
      model_used: modelUsed ?? "fallback",
      is_fallback: isFallback,
      error_detail: isFallback ? routerError : null
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      blocks: FALLBACK_BLOCKS.doc,
      model_used: "fallback",
      is_fallback: true,
      error_detail: { error: String(e) },
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
