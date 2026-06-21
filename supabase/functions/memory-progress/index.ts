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
      const topic = url.searchParams.get("topic");

      let query = sb
        .from("learning_progress")
        .select("*")
        .eq("user_id", user.id)
        .order("last_studied_at", { ascending: false });

      if (topic) {
        query = query.eq("topic", topic);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify(data ?? []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { topic, category, status, score, credits_earned, time_spent_seconds, metadata } = body;

      if (!topic || typeof topic !== "string") {
        return new Response(JSON.stringify({ error: "topic is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if progress exists for this topic
      const { data: existing } = await sb
        .from("learning_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("topic", topic)
        .maybeSingle();

      if (existing) {
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (status !== undefined) updates.status = status;
        if (score !== undefined) updates.score = score;
        if (credits_earned !== undefined) updates.credits_earned = (existing.credits_earned ?? 0) + credits_earned;
        if (time_spent_seconds !== undefined) updates.time_spent_seconds = (existing.time_spent_seconds ?? 0) + time_spent_seconds;
        if (category !== undefined) updates.category = category;
        if (metadata !== undefined) updates.metadata = { ...(existing.metadata ?? {}), ...metadata };
        updates.interactions_count = (existing.interactions_count ?? 0) + 1;
        updates.last_studied_at = new Date().toISOString();
        if (status === "completed" && !existing.completed_at) {
          updates.completed_at = new Date().toISOString();
        }

        const { data, error } = await sb
          .from("learning_progress")
          .update(updates)
          .eq("id", existing.id)
          .select("*")
          .single();

        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const insert = {
          user_id: user.id,
          topic,
          category: category ?? "general",
          status: status ?? "in_progress",
          score: score ?? null,
          credits_earned: credits_earned ?? 0,
          time_spent_seconds: time_spent_seconds ?? 0,
          interactions_count: 1,
          last_studied_at: new Date().toISOString(),
          completed_at: status === "completed" ? new Date().toISOString() : null,
          metadata: metadata ?? {},
        };

        const { data, error } = await sb
          .from("learning_progress")
          .insert(insert)
          .select("*")
          .single();

        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("memory-progress error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
