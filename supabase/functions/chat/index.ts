import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { streamAI, classifyIntent, getSystemPromptForIntent, getModelsForIntent, getModelsForMode, MODELS_LONG_CTX } from "../_shared/models.ts";
// artifact-prompts intentionally not imported here — artifact generation is handled by generate-html-artifact

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.text();
    if (body.length > 5_000_000) return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { messages, mode } = JSON.parse(body);
    if (!Array.isArray(messages) || messages.length > 60) return new Response(JSON.stringify({ error: "Invalid or too many messages" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Adaptive intent classification
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const queryText = lastMsg?.content || "";
    const hasFiles = queryText.includes("--- ATTACHED FILES ---");
    const intent = hasFiles ? "study" as const : classifyIntent(queryText);

    // Artifact requests (slides / notes / exam) are handled by the dedicated
    // generate-html-artifact pipeline on the client (GenerateSetupCard → ArtifactCard).
    // We deliberately do NOT inline raw HTML in chat — it produced broken UX.
    const artifactFeature: null = null;

    let systemPrompt: string = getSystemPromptForIntent(intent);
    if (hasFiles) systemPrompt += `\n\nThe user has attached files (after "--- ATTACHED FILES ---"). Read ALL file content thoroughly and respond based on it.`;

    // Inject persistent user memory so the AI recalls past context
    try {
      const { data: mems } = await sb
        .from("user_memory")
        .select("memory_type,key,value")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (mems && mems.length > 0) {
        const memBlock = mems.map((m: any) => `- [${m.memory_type}] ${m.key}: ${m.value}`).join("\n");
        systemPrompt += `\n\n## What you remember about this student\n${memBlock}\n\nUse this naturally — don't list it back. Just personalize.`;
      }
    } catch (memErr) {
      console.warn("memory fetch failed:", memErr);
    }

    const requestedMode = typeof mode === "string" ? mode : "auto";
    const models = artifactFeature
      ? MODELS_LONG_CTX
      : (getModelsForMode(requestedMode) ?? getModelsForIntent(intent));
    // NEVER truncate — let the model write to its full window. 131072 per spec.
    const maxTokens =
      intent === "greeting" || intent === "conversational" ? 1200 : 131072;
    const temperature = artifactFeature ? 0.55 : requestedMode === "creative" ? 0.85 : intent === "coding" ? 0.35 : 0.65;
    const timeoutMs = artifactFeature || intent === "coding" || requestedMode === "coding" ? 180_000 : 120_000;

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    const res = await streamAI(aiMessages, models, maxTokens, temperature, timeoutMs, `chat/${requestedMode}/${artifactFeature ?? intent}`);
    return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});