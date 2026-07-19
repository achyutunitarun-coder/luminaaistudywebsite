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

A generic block plan is a failure even when every field is syntactically perfect. If your plan for "pitch deck for a climbing gym app" and your plan for "explainer on how vaccines work" would come out the same shape you have failed, no matter how polished the titles sound. A good plan could only have been written for this goal.

This applies to block COUNT too. Don't pad to hit a round number, and don't compress real structure to save blocks.

## block_type vs layout_hint

- \`block_type\` answers "what is this block FOR" — be specific: "big_number_slide" tells more than "slide".
- \`layout_hint\` answers "what SHAPE does it take": big_statement, bulleted, two_column, quote, data_viz, image_led, comparison, timeline, diagram.
- \`narrative_beat\` answers "what job in the arc": hook, context, tension, evidence, turn, resolution, cta.

## When output_type = "slides": think in arc, not sections

Pick an arc: Problem→Agitate→Solution, Question→Investigation→Reveal, Before→Bridge→After, Chronological/journey, Spec→Story, Escalating stakes, or Comparative interleaving. Let the arc set block order, count, and where the weight sits. Use \`narrative_beat\` to mark the arc.

block_type vocabulary: title_slide, big_number_slide, quote_slide, comparison_slide, diagram_slide, timeline_slide, data_slide, story_slide, transition_slide, closing_slide.

## When output_type = "doc": structure follows document TYPE

Decide what KIND of document: technical spec, tutorial, blog post, research report, case study. Don't default to Introduction / Body / Conclusion.

block_type vocabulary: intro_section, context_section, tutorial_step, reference_section, case_study, comparison_section, faq_section, technical_appendix, closing_section.

## When output_type = "sheet": tabs follow spreadsheet LOGIC

Separate raw inputs, calculations, and summary onto different tabs.

block_type vocabulary: raw_data_tab, calculation_tab, summary_tab, scenario_tab, dashboard_tab, reference_tab.

## When output_type = "website": sections follow SITE TYPE

Don't default to Hero/Features/Pricing/Testimonials/Footer. Only include what this specific goal earns.

block_type vocabulary: hero, problem_section, feature_section, how_it_works_section, pricing_section, testimonial_section, faq_section, comparison_section, cta_section, footer.

## When output_type = "agent": plan a task graph

block_type vocabulary: plan_step, act_step, checkpoint, verify_step, fanout_step.

## prompt_seed is the entire brief

A good prompt_seed names the concrete thing this block must say that no other block says. Include specific details so the writer doesn't have to invent generically.

Bad: "Discuss the benefits."
Good: "The single most surprising result from the pilot: 40% of users completed onboarding without opening the help docs."

## Output contract

Return ONLY valid JSON. No preamble, no fences:

{
  "blocks": [
    {
      "block_type": "string",
      "title": "string",
      "prompt_seed": "string",
      "order_index": 0,
      "layout_hint": "optional string",
      "narrative_beat": "optional string"
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
          prompt: `Goal: ${goal}\nOutput type: ${output_type}\nReturn a JSON block plan now.`,
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

    const finalBlocks = blocks
      .filter((b: any) => b && b.title && b.block_type)
      .map((b: any, i: number) => {
        const block: Record<string, unknown> = {
          block_type: String(b.block_type),
          title: String(b.title).slice(0, 200),
          prompt_seed: String(b.prompt_seed ?? "").slice(0, 600),
          order_index: Number.isFinite(b.order_index) ? b.order_index : i,
        };
        const layoutHint = String(b.layout_hint ?? "");
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
