import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["qwen/qwen3.6-plus:free", "nvidia/nemotron-3-super-120b-a12b:free", "meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free"];

async function callAI(apiKey: string, messages: any[], maxTokens = 2000): Promise<string> {
  for (const model of MODELS) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const res = await fetch(OPENROUTER_URL, { method: "POST", signal: c.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.6 }) });
      clearTimeout(t);
      if (!res.ok) { const e = await res.text(); console.error(`[notebook] ${model} ${res.status}: ${e.slice(0,200)}`); continue; }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) { console.log(`[notebook] ✓ ${model}`); return content; }
    } catch (e) { console.error(`[notebook] ${model}:`, e); }
  }
  throw new Error("All models failed");
}

async function streamAI(apiKey: string, messages: any[], maxTokens = 2500): Promise<Response> {
  for (const model of MODELS) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const res = await fetch(OPENROUTER_URL, { method: "POST", signal: c.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.6, stream: true }) });
      clearTimeout(t);
      if (!res.ok) { const e = await res.text(); console.error(`[notebook] ${model} ${res.status}: ${e.slice(0,200)}`); continue; }
      console.log(`[notebook] stream ✓ ${model}`);
      return res;
    } catch (e) { console.error(`[notebook] ${model}:`, e); }
  }
  throw new Error("All models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.text();
    if (body.length > 100_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { fileContent, fileName, mode, language } = JSON.parse(body);
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const prompts: Record<string, { system: string; user: string }> = {
      notes: { system: `Create study notes that feel like a brilliant tutor wrote them — not a textbook. Use headings, **bold** terms, real-world analogies, formulas, and a "Quick Review" summary. Make concepts click, not just list them.`, user: `Create notes from "${fileName}":\n\n${fileContent}` },
      flowchart: { system: `Return ONLY JSON (no fences): {"nodes": [{"id": "1", "label": "Title", "description": "Brief", "type": "start", "status": "completed"}], "edges": [{"from": "1", "to": "2", "label": "relationship"}]}. 6-12 nodes.`, user: `Create concept flowchart for "${fileName}":\n\n${fileContent}` },
      overview: { system: `Create overview in ${language || "Spanish"}. Make it engaging and insightful — include key concepts, bullets, conclusion. Keep technical terms in parentheses.`, user: `Create overview in ${language || "Spanish"} of "${fileName}":\n\n${fileContent}` },
    };
    const p = prompts[mode];
    if (!p) throw new Error("Invalid mode");
    const msgs = [{ role: "system", content: p.system }, { role: "user", content: p.user }];

    if (mode === "flowchart") {
      const text = await callAI(OPENROUTER_API_KEY, msgs, 2000);
      const match = text.match(/\{[\s\S]*\}/);
      return new Response(JSON.stringify({ content: match ? match[0] : text.trim() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const streamRes = await streamAI(OPENROUTER_API_KEY, msgs, 2500);
    return new Response(streamRes.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("smart-notebook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
