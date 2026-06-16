import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIText, MODELS_FAST } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanJSON(raw: string): any {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const start = text.search(/[\[{]/);
  if (start < 0) return null;
  const startChar = text[start];
  const end = text.lastIndexOf(startChar === "[" ? "]" : "}");
  if (end <= start) return null;
  let jsonStr = text.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1");
  try { return JSON.parse(jsonStr); } catch {
    let b = 0, k = 0;
    for (const c of jsonStr) { if (c === "{") b++; if (c === "}") b--; if (c === "[") k++; if (c === "]") k--; }
    while (k > 0) { jsonStr += "]"; k--; }
    while (b > 0) { jsonStr += "}"; b--; }
    try { return JSON.parse(jsonStr); } catch { return null; }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    {
      const { enforceUsage } = await import("../_shared/usage-gate.ts");
      const gate = await enforceUsage(user.id, "flashcard_sets", corsHeaders);
      if (!gate.ok) return gate.response;
    }


    const body = await req.text();
    if (body.length > 4_000_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { content, title, cardCount = 20 } = JSON.parse(body);
    const count = Math.min(Math.max(Number(cardCount) || 20, 5), 80);

    const text = await callAIText(
      [
        { role: "system", content: `You generate flashcards. RULES:
1. Output EXACTLY ${count} cards — not ${count - 1}, not ${count + 1}, EXACTLY ${count}.
2. Mix types: definition, why, compare, apply, recall.
3. Front = a clear question (≤20 words). Back = a concise, factually accurate answer (≤40 words).
4. Return ONLY this JSON shape, nothing else: {"cards": [{"front":"...","back":"..."}]}
5. No <think> tags, no markdown fences, no commentary.` },
        { role: "user", content: `Create EXACTLY ${count} flashcards for "${String(title||'').slice(0,200)}" from:\n\n${String(content||'').slice(0,120000)}` },
      ],
      MODELS_FAST, 4000, 0.5, 45_000, "flashcards"
    );

    const parsed = cleanJSON(text);
    if (parsed?.cards && Array.isArray(parsed.cards)) {
      // Clamp to exact requested count
      parsed.cards = parsed.cards.slice(0, count);
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "AI returned invalid response. Try again." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-flashcards error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
