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
    const res = await fetch(routerUrl, {
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
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return new Response(JSON.stringify({ error: "planner_failed", detail: t.slice(0, 300) }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const raw = data.content ?? "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* */ } }
    }
    if (!parsed?.blocks || !Array.isArray(parsed.blocks)) {
      return new Response(JSON.stringify({ error: "plan_parse_failed", raw: raw.slice(0, 400) }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const blocks = parsed.blocks
      .filter((b: any) => b && b.title && b.block_type)
      .map((b: any, i: number) => ({
        block_type: String(b.block_type),
        title: String(b.title).slice(0, 200),
        prompt_seed: String(b.prompt_seed ?? "").slice(0, 600),
        order_index: Number.isFinite(b.order_index) ? b.order_index : i,
      }));

    return new Response(JSON.stringify({ blocks, model_used: data.model_used }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
