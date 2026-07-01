// ═══════════════════════════════════════════════════════════════════
// Lumina Computer — Task History & Trace View
//
// Persists task runs with full step-by-step trace for observability.
// GET  /task-history           — list recent tasks
// GET  /task-history?id=...    — get full trace for one task
// DELETE /task-history?id=...  — delete task history
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const method = req.method;
    const taskId = url.searchParams.get("id");

    // GET /task-history?id=...  — full trace for one task
    if (method === "GET" && taskId) {
      const { data, error } = await sb
        .from("lumina_task_history")
        .select("*")
        .eq("id", taskId)
        .eq("user_id", user.id)
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: "Task not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, task: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /task-history — list recent tasks
    if (method === "GET") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);
      const offset = parseInt(url.searchParams.get("offset") ?? "0");
      const { data, error } = await sb
        .from("lumina_task_history")
        .select("id, request, status, step_count, model_used, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, tasks: data ?? [], total: data?.length ?? 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE /task-history?id=...
    if (method === "DELETE" && taskId) {
      const { error } = await sb.from("lumina_task_history").delete().eq("id", taskId).eq("user_id", user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
