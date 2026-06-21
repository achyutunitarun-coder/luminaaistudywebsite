import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const result = await requireUser(req, corsHeaders);
    if ("error" in result) return result.error;
    const { user, sb } = result;

    const { action, category, description, metadata, page_url } = await req.json();
    if (!action || typeof action !== "string") {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert activity log
    const { error: logErr } = await sb.from("activity_log").insert({
      user_id: user.id,
      action,
      category: category ?? null,
      description: description ?? null,
      metadata: metadata ?? {},
      page_url: page_url ?? null,
    });
    if (logErr) console.error("activity_log insert error:", logErr);

    // If chat/study activity, update learning_progress
    if (/chat|study|practice|test|quiz|flashcard/i.test(action)) {
      const topic = (metadata?.topic) || (category) || "general";
      try {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: existing } = await admin
          .from("learning_progress")
          .select("id, interactions_count")
          .eq("user_id", user.id)
          .eq("topic", topic)
          .maybeSingle();

        if (existing) {
          await admin
            .from("learning_progress")
            .update({
              interactions_count: (existing.interactions_count ?? 0) + 1,
              last_studied_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await admin.from("learning_progress").insert({
            user_id: user.id,
            topic,
            category: category ?? "general",
            status: "in_progress",
            interactions_count: 1,
            last_studied_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error("learning_progress upsert error:", e);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("memory-log error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
