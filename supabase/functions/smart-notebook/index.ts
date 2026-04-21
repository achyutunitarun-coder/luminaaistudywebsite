import { callAIText, streamAI, MODELS_FAST, MODELS_BALANCED } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 4_000_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { fileContent, fileName, mode, language } = JSON.parse(body);

    const prompts: Record<string, { system: string; user: string }> = {
      notes: { system: `Create study notes with headings, **bold** terms, real-world analogies, formulas, and a "Quick Review" summary.`, user: `Create notes from "${fileName}":\n\n${fileContent}` },
      flowchart: { system: `Return ONLY JSON (no fences): {"nodes": [{"id": "1", "label": "Title", "description": "Brief", "type": "start", "status": "completed"}], "edges": [{"from": "1", "to": "2", "label": "relationship"}]}. 6-12 nodes. Do NOT include thinking tags.`, user: `Create concept flowchart for "${fileName}":\n\n${fileContent}` },
      overview: { system: `Create overview in ${language || "Spanish"}. Include key concepts, bullets, conclusion.`, user: `Create overview in ${language || "Spanish"} of "${fileName}":\n\n${fileContent}` },
    };
    const p = prompts[mode];
    if (!p) throw new Error("Invalid mode");
    const msgs = [{ role: "system", content: p.system }, { role: "user", content: p.user }];

    if (mode === "flowchart") {
      const text = await callAIText(msgs, MODELS_FAST, 2000, 0.6, 40_000, "notebook");
      const match = text.match(/\{[\s\S]*\}/);
      return new Response(JSON.stringify({ content: match ? match[0] : text.trim() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const streamRes = await streamAI(msgs, MODELS_BALANCED, 2500, 0.6, 60_000, "notebook");
    return new Response(streamRes.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("smart-notebook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
