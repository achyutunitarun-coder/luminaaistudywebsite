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

    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStr = now.toISOString().slice(0, 10);

    // --- Learning progress stats ---
    const { data: progressData, error: progressErr } = await sb
      .from("learning_progress")
      .select("topic, credits_earned, score, status")
      .eq("user_id", user.id);
    if (progressErr) throw progressErr;

    const topics = progressData ?? [];
    const topicsStudied = topics.length;
    const totalCredits = topics.reduce((sum, t) => sum + (t.credits_earned ?? 0), 0);
    const scoredTopics = topics.filter((t) => t.score != null);
    const averageScore = scoredTopics.length > 0
      ? scoredTopics.reduce((sum, t) => sum + Number(t.score), 0) / scoredTopics.length
      : 0;

    // --- Activity log: recent + streak ---
    const { data: recentActivity, error: activityErr } = await sb
      .from("activity_log")
      .select("action, category, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (activityErr) throw activityErr;

    const { data: allActivity, error: allActivityErr } = await sb
      .from("activity_log")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (allActivityErr) throw allActivityErr;

    // Calculate streak: consecutive days with at least 1 activity
    let currentStreak = 0;
    if (allActivity && allActivity.length > 0) {
      const daySet = new Set<string>();
      for (const a of allActivity) {
        if (a.created_at) daySet.add(a.created_at.slice(0, 10));
      }
      const d = new Date(todayStr);
      // Check if today has activity; if not, start from yesterday
      const todayHas = daySet.has(todayStr);
      if (!todayHas) {
        d.setDate(d.getDate() - 1);
      }
      for (let i = 0; i < 365; i++) {
        const ds = d.toISOString().slice(0, 10);
        if (daySet.has(ds)) {
          currentStreak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // --- Recently viewed ---
    const { data: viewedData, error: viewedErr } = await sb
      .from("recently_viewed")
      .select("*")
      .eq("user_id", user.id)
      .order("viewed_at", { ascending: false })
      .limit(10);
    if (viewedErr) throw viewedErr;

    // Deduplicate
    const seen = new Set<string>();
    const recentlyViewed = (viewedData ?? []).filter((item) => {
      const key = `${item.content_type}::${item.content_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);

    // --- Preferences ---
    const { data: prefs, error: prefsErr } = await sb
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (prefsErr && prefsErr.code !== "PGRST116") throw prefsErr;

    return new Response(
      JSON.stringify({
        topicsStudied,
        totalCredits,
        averageScore: Math.round(averageScore * 100) / 100,
        currentStreak,
        recentActivity: recentActivity ?? [],
        recentlyViewed,
        preferences: prefs ?? null,
        weeklyActivityCount: (allActivity ?? []).filter(
          (a) => a.created_at && a.created_at >= sevenDaysAgo,
        ).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("memory-summary error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
