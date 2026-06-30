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

    if (req.method === "GET") {
      const { data, error } = await sb
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create defaults
      const defaults = {
        user_id: user.id,
        theme: "dark",
        language: "en",
        notifications_enabled: true,
        preferred_model: "meta-llama/llama-3.3-70b-instruct:free",
        metadata: {},
      };
      const { data: created, error: createErr } = await sb
        .from("user_preferences")
        .insert(defaults)
        .select("*")
        .single();

      if (createErr) throw createErr;
      return new Response(JSON.stringify(created), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const updates = {
        ...(body.theme !== undefined && { theme: body.theme }),
        ...(body.language !== undefined && { language: body.language }),
        ...(body.notifications_enabled !== undefined && { notifications_enabled: body.notifications_enabled }),
        ...(body.preferred_model !== undefined && { preferred_model: body.preferred_model }),
        ...(body.metadata !== undefined && { metadata: body.metadata }),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await sb
        .from("user_preferences")
        .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" })
        .select("*")
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("memory-preferences error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
