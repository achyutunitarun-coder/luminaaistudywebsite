// Lumina Computer — agent planner. One orchestrator-role call, returns block plan JSON.
import { requireUser } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM: Record<string, string> = {
  slides: "You plan slide decks. Output ONLY valid JSON: {\"blocks\":[{\"block_type\":\"slide\",\"title\":\"...\",\"prompt_seed\":\"one-sentence intent for this slide\",\"order_index\":0}]}. 6–10 slides. Titles are punchy (2–5 words). No prose outside JSON.",
  doc: "You plan documents. Output ONLY valid JSON: {\"blocks\":[{\"block_type\":\"doc_section\",\"title\":\"section heading\",\"prompt_seed\":\"one sentence of intent\",\"order_index\":0}]}. 5–9 sections. No prose outside JSON.",
  sheet: "You plan spreadsheets. Output ONLY valid JSON: {\"blocks\":[{\"block_type\":\"sheet_tab\",\"title\":\"tab name\",\"prompt_seed\":\"what data this tab holds\",\"order_index\":0}]}. 1–4 tabs. No prose outside JSON.",
  website: "You plan single-page websites. Output ONLY valid JSON: {\"blocks\":[{\"block_type\":\"site_section\",\"title\":\"section name eg hero, features, pricing, footer\",\"prompt_seed\":\"one sentence of intent\",\"order_index\":0}]}. 4–7 sections. No prose outside JSON.",
  agent: "You plan mixed artifacts. Decide the best mix of block_type values from ['slide','doc_section','sheet_tab','site_section'] for this goal. Output ONLY valid JSON: {\"blocks\":[{\"block_type\":\"...\",\"title\":\"...\",\"prompt_seed\":\"...\",\"order_index\":0}]}. 4–10 blocks. No prose outside JSON.",
};

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

    const system = SYSTEM[output_type] ?? SYSTEM.doc;
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
          system,
          prompt: `Goal: ${goal}\nOutput type: ${output_type}\nReturn the JSON plan now.`,
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
      .map((b: any, i: number) => ({
        block_type: String(b.block_type),
        title: String(b.title).slice(0, 200),
        prompt_seed: String(b.prompt_seed ?? "").slice(0, 600),
        order_index: Number.isFinite(b.order_index) ? b.order_index : i,
      }));

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
