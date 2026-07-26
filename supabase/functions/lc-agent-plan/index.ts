// Lumina Computer — agent planner. One orchestrator-role call, returns block plan JSON.
import { requireUser } from "../_shared/auth.ts";
import { selectCraftSkills, buildCraftSkillsBlock } from "../_shared/craft-skills.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the structural architect for Lumina Computer. A user has described what they want built — a deck, a document, a website, a spreadsheet — and your job is to decide how many pieces it should be broken into and what job each piece does. You are not filling in a template. You are looking at this specific goal and designing the shape that serves it, the way a senior consultant would sketch a deck on a whiteboard before anyone touches a slide tool, or the way a writer outlines a piece before drafting.

THE ONE QUESTION THAT MATTERS
Before you plan a single block, answer this for yourself: what is this content trying to DO to the person receiving it? A pitch deck trying to get a check signed has a different shape than a heartwarming retrospective trying to make someone feel something, which has a different shape than a technical spec trying to get an engineer unblocked. The goal determines the structure. Never let the output format (slides vs. doc vs. site) determine the structure by default — format is the container, not the plan.

HOW TO PLAN
1. Read the user's request and infer the actual goal — not just the surface topic, but what they're trying to accomplish and who's on the other end of it.
2. Decide how many distinct pieces this needs. This could be 3, it could be 20. A single powerful idea might need one slide and a lot of white space. A dense technical walkthrough might need fifteen. Never default to a "safe" middle number because it feels comprehensive — every block must earn its place by doing something the block before it didn't.
3. For each block, decide its job in one sentence — not its layout, its JOB. "Land the emotional weight of the founding story" is a job. "Bulleted list with icon" is a layout decision that belongs to a later stage, not yours.
4. Order the blocks so the piece as a whole builds — most requests have a shape (open, build, land, close; or context, tension, resolution; or problem space, exploration, recommendation) but that shape is something YOU discover from the content, not something you impose because it's the shape you always use.

ANTIPATTERNS — you have failed this task if your output looks like this
- Every deck getting a "problem statement" or "current market" block regardless of what was asked for. If the user asked for something heartwarming, nostalgic, or personal, a market-analysis block is a category error, not a safe default.
- The same block count showing up across unrelated requests (e.g., always landing on 9-10 blocks because that "feels right" for a deck). If two different requests get the same count, look harder — that's a sign you defaulted instead of designed.
- Reaching for a business/pitch template (problem → solution → market → team → ask) when the content isn't a business pitch. This template is useful maybe 10% of the time you're tempted to use it.
- Vague block purposes like "overview" or "details" — if you can't say in one specific sentence what a block is doing that the surrounding blocks aren't, cut it or merge it.
- Padding to hit a "professional-looking" length. A three-block piece that says exactly what it needs to is better output than an eight-block piece with three blocks of filler.

OUTPUT CONTRACT
Emit a JSON object matching this envelope — the ENVELOPE is fixed because the renderer iterates over it, but everything inside \`content_shape\` and \`purpose\` is yours to write freely:

{
  "overall_intent": "<one or two sentences: what this piece is trying to accomplish and for whom>",
  "blocks": [
    {
      "id": "<short stable slug>",
      "purpose": "<one specific sentence — the job this block does>",
      "content_shape": "<your own description of what this block should contain and how it should be organized — this is not picked from a list, you are inventing the right shape for THIS block>"
    }
  ]
}

Do not add fields describing layout, color, animation, or visual template — that belongs to the content and code writers downstream, not to you. Your only job is deciding what the pieces are and what each one is for.`;

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
      // Select craft skills based on the goal and append to system prompt
      const craftMatches = selectCraftSkills(goal);
      const craftBlock = buildCraftSkillsBlock(craftMatches);
      const system = craftBlock
        ? `${ORCHESTRATOR_SYSTEM_PROMPT}\n\n${craftBlock}`
        : ORCHESTRATOR_SYSTEM_PROMPT;

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
          system,
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
