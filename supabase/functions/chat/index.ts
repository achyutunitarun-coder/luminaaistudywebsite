import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { streamAI, classifyIntent, getSystemPromptForIntent, getModelsForIntent } from "../_shared/models.ts";

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
    if (body.length > 50_000) return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { messages } = JSON.parse(body);
    if (!Array.isArray(messages) || messages.length > 50) return new Response(JSON.stringify({ error: "Invalid or too many messages" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Adaptive intent classification
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const queryText = lastMsg?.content || "";
    const hasFiles = queryText.includes("--- ATTACHED FILES ---");
    const intent = hasFiles ? "study" as const : classifyIntent(queryText);

    let systemPrompt = getSystemPromptForIntent(intent);
    if (hasFiles) systemPrompt += `\n\nThe user has attached files (after "--- ATTACHED FILES ---"). Read ALL file content thoroughly and respond based on it.`;

    const models = getModelsForIntent(intent);
    const maxTokens = intent === "greeting" || intent === "conversational" ? 200 : intent === "deep" ? 3000 : 2000;

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    const res = await streamAI(aiMessages, models, maxTokens, 0.65, 30000, `chat/${intent}`);
    return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
