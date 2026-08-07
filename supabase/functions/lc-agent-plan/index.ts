// Lumina Computer — agent planner. One orchestrator-role call, returns block plan JSON.
import { requireUser } from "../_shared/auth.ts";
import { selectCraftSkills, buildCraftSkillsBlock } from "../_shared/craft-skills.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the structural architect for Lumina Computer — a deep, agentic content engine. A user has described what they want built — a deck, a document, a website, a spreadsheet — and your job is to decide how many pieces it should be broken into and what job each piece does. You are designing for DEPTH: this engine's whole value proposition is that it produces exhaustive, comprehensive, agentic deliverables. Plan generously enough that the final artifact genuinely covers the subject.

DEPTH MANDATE
- This is a premium, agentic, deep-dive product. The plan must be comprehensive enough to produce a LONG, thorough deliverable — not a thin sketch. When in doubt between a terse plan and a thorough one, choose thorough.
- Break the subject into all the pieces it genuinely needs: every major facet, section, argument, data angle, and takeaway should get its own block with a precise job. A dense subject should yield 12-20+ blocks; a modest one fewer — but never so few that the output feels thin.
- For documents: plan like a book or definitive report — background/framing, all core sections, worked examples, case studies, data tables, counterpoints/nuance, implementation, risks or limitations, further reading, and a decisive conclusion.
- For decks: plan a full narrative arc (hook → context → depth → evidence → proof → close) with enough slides that each idea gets room to land.
- For websites: plan every section a real launch site needs — hero, problem, solution, features, how-it-works, data/stats, testimonials/proof, pricing or plans, FAQ, team, process, CTA, contact, footer — each fully specified.
- For sheets: plan every tab a real model needs — assumptions, full financial statements, scenarios, KPIs/dashboard, market data, sensitivities.

THE ONE QUESTION THAT MATTERS
Before you plan a single block, answer this for yourself: what is this content trying to DO to the person receiving it? A pitch deck trying to get a check signed has a different shape than a heartwarming retrospective trying to make someone feel something, which has a different shape than a technical spec trying to get an engineer unblocked. The goal determines the structure. Never let the output format (slides vs. doc vs. site) determine the structure by default — format is the container, not the plan.

HOW TO PLAN
1. Read the user's request and infer the actual goal — not just the surface topic, but what they're trying to accomplish and who's on the other end of it.
2. Decide how many distinct pieces this needs. This could be 3, it could be 20+. A single powerful idea might need one slide and a lot of white space. A dense technical walkthrough might need fifteen. Err toward comprehensive: every major facet deserves its own block with a specific job.
3. For each block, decide its job in one sentence — not its layout, its JOB. "Land the emotional weight of the founding story" is a job. "Bulleted list with icon" is a layout decision that belongs to a later stage, not yours.
4. Order the blocks so the piece as a whole builds — most requests have a shape (open, build, land, close; or context, tension, resolution; or problem space, exploration, recommendation) but that shape is something YOU discover from the content, not something you impose because it's the shape you always use.

ANTIPATTERNS — you have failed this task if your output looks like this
- A thin 4-5 block plan that leaves obvious facets uncovered when the subject is dense. Under-planning is a failure for this engine.
- Every deck getting a "problem statement" or "current market" block regardless of what was asked for. If the user asked for something heartwarming, nostalgic, or personal, a market-analysis block is a category error, not a safe default.
- Reaching for a business/pitch template (problem → solution → market → team → ask) when the content isn't a business pitch.
- Vague block purposes like "overview" or "details" — if you can't say in one specific sentence what a block is doing that the surrounding blocks aren't, cut it or merge it.

OUTPUT CONTRACT
Emit a JSON object matching this envelope — the ENVELOPE is fixed because the renderer iterates over it, but everything inside \`content_shape\` and \`purpose\` is yours to write freely:

{
  "overall_intent": "<one or two sentences: what this piece is trying to accomplish and for whom>",
  "blocks": [
    {
      "id": "<short stable slug>",
      "purpose": "<one specific sentence — the job this block does>",
      "content_shape": "<your own description of what this block should contain and how it should be organized — be SPECIFIC and comprehensive: enumerate the sub-sections, examples, data, and depth this block must deliver. This is not picked from a list, you are inventing the right shape for THIS block>"
    }
  ]
}

Do not add fields describing layout, color, animation, or visual template — that belongs to the content and code writers downstream, not to you. Your only job is deciding what the pieces are and what each one is for. Make the plan complete enough that the downstream writer has no reason to stop early.`;

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
          max_tokens: 8000,
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

    // Derive a title from either legacy `title` or new `id`/`purpose` fields.
    const deriveTitle = (b: any, i: number): string => {
      if (b?.title) return String(b.title);
      if (b?.id) {
        return String(b.id)
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
      }
      if (b?.purpose) {
        const s = String(b.purpose).split(/[.!?]/)[0].trim();
        return s.length > 80 ? s.slice(0, 77) + "…" : s;
      }
      return `Block ${i + 1}`;
    };

    const derivePromptSeed = (b: any): string => {
      const parts: string[] = [];
      if (b?.prompt_seed) parts.push(String(b.prompt_seed));
      if (b?.purpose) parts.push(String(b.purpose));
      if (b?.content_shape) parts.push(String(b.content_shape));
      return parts.join("\n\n").slice(0, 1200);
    };

    const finalBlocks = (blocks as any[])
      .filter((b: any) => b && (b.title || b.id || b.purpose || b.content_shape || b.block_type))
      .map((b: any, i: number) => {
        const rawType = String(b.block_type ?? "");
        const canonical = canonicalForOutput(output_type, rawType);
        const block: Record<string, unknown> = {
          block_type: canonical,
          title: deriveTitle(b, i).slice(0, 200),
          prompt_seed: derivePromptSeed(b),
          order_index: Number.isFinite(b.order_index) ? b.order_index : i,
        };
        const layoutHint = String(b.layout_hint ?? "").trim() || (rawType && rawType !== canonical ? rawType : "");
        const narrativeBeat = String(b.narrative_beat ?? b.purpose ?? "");
        if (layoutHint) block.layout_hint = layoutHint;
        if (narrativeBeat) block.narrative_beat = narrativeBeat;
        return block;
      });

    // Safety net: if mapping still yielded nothing, use fallback.
    let outBlocks = finalBlocks;
    if (outBlocks.length === 0) {
      isFallback = true;
      outBlocks = (FALLBACK_BLOCKS[output_type] ?? FALLBACK_BLOCKS.doc).map((b, i) => ({ ...b, order_index: i }));
    }

    return new Response(JSON.stringify({ 
      blocks: outBlocks, 
      model_used: modelUsed ?? "fallback",
      is_fallback: isFallback,
      overall_intent: typeof parsed?.overall_intent === "string" ? parsed.overall_intent : undefined,
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
