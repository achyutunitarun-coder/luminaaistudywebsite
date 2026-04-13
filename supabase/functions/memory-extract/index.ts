import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIText, MODELS_FAST } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { conversation } = await req.json();
    if (!conversation || typeof conversation !== "string") {
      return new Response(JSON.stringify({ error: "Missing conversation" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get existing memories
    const { data: existing } = await sb.from("user_memory").select("key").eq("user_id", user.id);
    const existingKeys = existing?.map((m: any) => m.key).join(", ") || "none";

    const prompt = `You are a memory extraction system for a study AI called Lumina.
Analyze this conversation/interaction and extract facts worth remembering about the student.

Existing memory keys (don't duplicate): ${existingKeys}

Conversation/data:
${conversation.slice(0, 3000)}

Extract memories in this exact JSON format only, no other text:
[
  {
    "memory_type": "fact|preference|pattern|goal|milestone",
    "key": "short_snake_case_key",
    "value": "concise value string",
    "confidence": 0.8
  }
]

Only extract genuinely useful, non-obvious facts. Return [] if nothing meaningful.`;

    const response = await callAIText(
      [{ role: "user", content: prompt }],
      MODELS_FAST,
      500, 0.3, 15000, "memory-extract"
    );

    try {
      const clean = response.replace(/```json|```/g, "").trim();
      const memories = JSON.parse(clean);
      if (!Array.isArray(memories)) throw new Error("Not array");

      for (const mem of memories.slice(0, 5)) {
        if (!mem.key || !mem.value || !mem.memory_type) continue;
        await sb.from("user_memory").upsert({
          user_id: user.id,
          memory_type: mem.memory_type,
          key: mem.key.slice(0, 100),
          value: mem.value.slice(0, 500),
          confidence: Math.min(Math.max(mem.confidence || 0.8, 0), 1),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,key" } as any);
      }

      return new Response(JSON.stringify({ extracted: memories.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ extracted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("memory-extract error:", e);
    return new Response(JSON.stringify({ error: "Failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
