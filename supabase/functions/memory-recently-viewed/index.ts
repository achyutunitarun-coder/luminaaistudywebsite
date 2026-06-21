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
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);

      // Get latest viewed items, deduplicated by content_type+content_id
      const { data, error } = await sb
        .from("recently_viewed")
        .select("*")
        .eq("user_id", user.id)
        .order("viewed_at", { ascending: false })
        .limit(limit * 2); // fetch extra to dedupe

      if (error) throw error;

      // Deduplicate: keep only the latest per (content_type, content_id)
      const seen = new Set<string>();
      const deduped = (data ?? []).filter((item) => {
        const key = `${item.content_type}::${item.content_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, limit);

      return new Response(JSON.stringify(deduped), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { content_type, content_id, title, url, thumbnail_url, metadata } = body;

      if (!content_type) {
        return new Response(JSON.stringify({ error: "content_type is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await sb
        .from("recently_viewed")
        .insert({
          user_id: user.id,
          content_type,
          content_id: content_id ?? null,
          title: title ?? null,
          url: url ?? null,
          thumbnail_url: thumbnail_url ?? null,
          metadata: metadata ?? {},
        })
        .select("*")
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");

      if (!id) {
        return new Response(JSON.stringify({ error: "id query param required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await sb
        .from("recently_viewed")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("memory-recently-viewed error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
