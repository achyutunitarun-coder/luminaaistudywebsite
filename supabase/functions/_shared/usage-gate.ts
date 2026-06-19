// ═══════════════════════════════════════════════════════════════════
// Server-side usage gate — production enforcement of pricing tiers.
// Mirrors the limit table in src/hooks/useUsageLimits.tsx so a client
// bypass cannot exceed the user's plan.
// ═══════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Period = "daily" | "weekly";
type Plan = "basic" | "ultimate" | "pro_plus";
type TierLimit = { limit: number; period: Period };
type FeatureLimits = Record<Plan, TierLimit>;

// -1 = unlimited. Single source of truth for every plan tier.
// MUST stay in sync with src/hooks/useUsageLimits.tsx.
export const SERVER_LIMITS: Record<string, FeatureLimits> = {
  chat_messages:      { basic: { limit: 60,  period: "daily" }, ultimate: { limit: 200, period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  doubt_messages:     { basic: { limit: 60,  period: "daily" }, ultimate: { limit: 200, period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  notes_generations:  { basic: { limit: 3,   period: "daily" }, ultimate: { limit: 30,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  test_generations:   { basic: { limit: 3,   period: "daily" }, ultimate: { limit: 30,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  flashcard_sets:     { basic: { limit: 3,   period: "daily" }, ultimate: { limit: 30,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  quick_study:        { basic: { limit: 3,   period: "daily" }, ultimate: { limit: 30,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  summaries:          { basic: { limit: 5,   period: "daily" }, ultimate: { limit: 50,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  note_to_quiz:       { basic: { limit: 10,  period: "daily" }, ultimate: { limit: 50,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  study_planners:     { basic: { limit: 15,  period: "daily" }, ultimate: { limit: 60,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  study_sessions:     { basic: { limit: 3,   period: "daily" }, ultimate: { limit: 20,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  quest_games:        { basic: { limit: 10,  period: "daily" }, ultimate: { limit: 50,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  smart_notebook:     { basic: { limit: 5,   period: "daily" }, ultimate: { limit: 30,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  audio_analysis:     { basic: { limit: 5,   period: "daily" }, ultimate: { limit: 30,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  lecture_notes:      { basic: { limit: 6,   period: "daily" }, ultimate: { limit: 40,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  lecture_flashcards: { basic: { limit: 6,   period: "daily" }, ultimate: { limit: 40,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  lecture_quiz:       { basic: { limit: 6,   period: "daily" }, ultimate: { limit: 40,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  podcast_generation: { basic: { limit: 1,   period: "weekly" }, ultimate: { limit: 5,  period: "weekly" }, pro_plus: { limit: -1, period: "weekly" } },
  weakness_radar:     { basic: { limit: 1,   period: "weekly" }, ultimate: { limit: 5,  period: "weekly" }, pro_plus: { limit: -1, period: "weekly" } },
  recall_mode:        { basic: { limit: 20,  period: "daily" }, ultimate: { limit: 100, period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  spaced_scheduler:   { basic: { limit: 5,   period: "daily" }, ultimate: { limit: 30,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  smart_shuffle:      { basic: { limit: 2,   period: "daily" }, ultimate: { limit: 15,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  explain_mode:       { basic: { limit: 2,   period: "daily" }, ultimate: { limit: 15,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  why_engine:         { basic: { limit: 3,   period: "daily" }, ultimate: { limit: 20,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  visualize_mode:     { basic: { limit: 1,   period: "daily" }, ultimate: { limit: 10,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  cognitive_dashboard:{ basic: { limit: 3,   period: "daily" }, ultimate: { limit: 20,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  pomodoro_timer:     { basic: { limit: 5,   period: "daily" }, ultimate: { limit: 30,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  mind_mapping:       { basic: { limit: 3,   period: "daily" }, ultimate: { limit: 20,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  sq3r_method:        { basic: { limit: 2,   period: "daily" }, ultimate: { limit: 15,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  guided_lesson:      { basic: { limit: 5,   period: "daily" }, ultimate: { limit: 30,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  lumina_computer:    { basic: { limit: 5,   period: "daily" }, ultimate: { limit: 30,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
  artifact_generation:{ basic: { limit: 3,   period: "daily" }, ultimate: { limit: 30,  period: "daily" }, pro_plus: { limit: -1, period: "daily" } },
};

const _admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function getPlan(userId: string): Promise<Plan> {
  try {
    const admin = _admin();
    const { data } = await admin
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.status === "active" && (!data.current_period_end || new Date(data.current_period_end) > new Date())) {
      const p = String(data.plan ?? "basic").toLowerCase();
      if (p === "pro_plus" || p === "ultimate") return p;
    }
  } catch { /* fall through to basic */ }
  return "basic";
}

export type EnforceResult =
  | { ok: true; plan: Plan; remaining: number | null }
  | { ok: false; response: Response };

/**
 * Server-side gate. Call near the top of an edge function once the user is
 * authenticated. On limit exceeded returns a 429 Response ready to return.
 * Counts only increment when the feature has a finite limit (PRO+ never increments).
 */
export async function enforceUsage(
  userId: string,
  feature: keyof typeof SERVER_LIMITS | string,
  corsHeaders: Record<string, string>,
): Promise<EnforceResult> {
  const row = SERVER_LIMITS[feature as string];
  if (!row) return { ok: true, plan: "basic", remaining: null };

  const plan = await getPlan(userId);
  const cfg = row[plan] ?? row.basic;
  if (cfg.limit < 0) return { ok: true, plan, remaining: null };

  const admin = _admin();
  try {
    const { data: current } = await admin.rpc("get_usage_count", {
      p_user_id: userId,
      p_feature: feature,
      p_period_type: cfg.period,
    });
    const used = Number(current ?? 0);
    if (used >= cfg.limit) {
      const upgradeTarget = plan === "basic" ? "Ultimate (₹199) or PRO+ (₹499)" : "PRO+ (₹499)";
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            error: "usage_limit_reached",
            feature,
            plan,
            period: cfg.period,
            limit: cfg.limit,
            used,
            message: `You've hit your ${cfg.period} limit of ${cfg.limit} for this feature. Upgrade to ${upgradeTarget} for more.`,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        ),
      };
    }
    await admin.rpc("increment_usage", {
      p_user_id: userId,
      p_feature: feature,
      p_period_type: cfg.period,
    });
    return { ok: true, plan, remaining: Math.max(0, cfg.limit - used - 1) };
  } catch (e) {
    console.warn(`[usage-gate] enforcement soft-failed for ${feature}:`, e instanceof Error ? e.message : e);
    return { ok: true, plan, remaining: null };
  }
}
