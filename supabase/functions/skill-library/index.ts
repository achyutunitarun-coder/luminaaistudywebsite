// ═══════════════════════════════════════════════════════════════════
// Lumina Computer — Skill Library API
//
// CRUD for reusable macros (recorded multi-step flows).
// GET  /skill-library        — list all skills
// POST /skill-library        — create a skill
// GET  /skill-library/match?q=...  — find best matching skill
// DELETE /skill-library?id=...     — delete a skill
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findMatchingSkill, listSkills, recordSkill, deleteSkill } from "../_shared/skill-library.ts";

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

    // GET /skill-library/match?q=...
    if (method === "GET" && url.pathname.includes("/match")) {
      const query = url.searchParams.get("q");
      if (!query) {
        return new Response(JSON.stringify({ error: "query param 'q' required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const match = await findMatchingSkill(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, query);
      return new Response(JSON.stringify({ ok: true, match }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /skill-library — list all
    if (method === "GET") {
      const skills = await listSkills(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      return new Response(JSON.stringify({ ok: true, skills }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /skill-library — create
    if (method === "POST") {
      const body = await req.json();
      const skill = await recordSkill(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, body);
      if (!skill) {
        return new Response(JSON.stringify({ error: "Failed to record skill" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, skill }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE /skill-library?id=...
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "query param 'id' required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const ok = await deleteSkill(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, id);
      return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
