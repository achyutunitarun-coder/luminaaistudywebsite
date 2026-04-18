// ─────────────────────────────────────────────────────────────────
// extract-memory  ·  Distills user-stated facts/preferences/goals
// from a recent chat exchange and upserts them into user_memory.
// Called fire-and-forget after each AI turn.
// ─────────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIText } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYS = `You extract durable facts about a STUDENT from a chat exchange.
Output STRICT JSON: {"memories":[{"type":"fact|preference|goal|pattern|milestone","key":"snake_case_id","value":"short statement","confidence":0-1}]}
Rules:
- Only extract things that will still matter in 1+ weeks (name, exam, grade, target school, learning style preference, struggling subjects, milestones).
- Skip greetings, one-off questions, transient context.
- Max 3 memories. If nothing durable, return {"memories":[]}.
- Keep "value" under 140 chars. Be specific.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { userMessage, assistantMessage } = await req.json();
    if (!userMessage || typeof userMessage !== "string") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: corsHeaders });
    }

    const userText = userMessage.slice(0, 2000);
    const aiText = (assistantMessage || "").slice(0, 1500);

    const prompt = `STUDENT MESSAGE:\n${userText}\n\nAI REPLY (for context):\n${aiText}\n\nExtract durable memories as JSON.`;

    const raw = await callAIText(
      [{ role: "system", content: SYS }, { role: "user", content: prompt }],
      ["google/gemma-3-4b-it:free", "meta-llama/llama-3.2-3b-instruct:free", "google/gemma-3-12b-it:free"],
      400, 0.2, 20000, "extract-memory",
    ).catch(() => "{}");

    const m = raw.match(/\{[\s\S]*\}/);
    let parsed: any = {};
    try { parsed = JSON.parse(m?.[0] || "{}"); } catch { parsed = { memories: [] }; }
    const memories = Array.isArray(parsed?.memories) ? parsed.memories.slice(0, 3) : [];

    if (memories.length === 0) {
      return new Response(JSON.stringify({ ok: true, count: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Service-role upsert (bypasses RLS to write reliably)
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let saved = 0;
    for (const mem of memories) {
      if (!mem?.type || !mem?.key || !mem?.value) continue;
      const type = ["fact", "preference", "goal", "pattern", "milestone"].includes(mem.type) ? mem.type : "fact";
      const key = String(mem.key).slice(0, 80);
      const value = String(mem.value).slice(0, 500);
      const confidence = Math.max(0, Math.min(1, Number(mem.confidence) || 0.7));

      // Upsert by (user_id, key)
      const { data: existing } = await admin
        .from("user_memory")
        .select("id")
        .eq("user_id", user.id)
        .eq("key", key)
        .maybeSingle();
      if (existing) {
        await admin.from("user_memory").update({ value, confidence, memory_type: type, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await admin.from("user_memory").insert({ user_id: user.id, key, value, confidence, memory_type: type });
      }
      saved++;
    }

    return new Response(JSON.stringify({ ok: true, count: saved }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("extract-memory error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
