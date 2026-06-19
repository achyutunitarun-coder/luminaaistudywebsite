import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

type Period = 'daily' | 'weekly' | 'monthly';
type TierLimit = { limit: number; period: Period };
type FeatureLimits = { basic: TierLimit; ultimate: TierLimit; pro_plus: TierLimit };

// -1 = unlimited. Single source of truth for every plan tier.
// Numbers come from the production pricing page (Basic / Ultimate ₹199 / PRO+ ₹499).
const LIMITS: Record<string, FeatureLimits> = {
  // ── Core chat & doubts ──
  chat_messages:      { basic: { limit: 60,  period: 'daily' }, ultimate: { limit: 200, period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  doubt_messages:     { basic: { limit: 60,  period: 'daily' }, ultimate: { limit: 200, period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },

  // ── Generators ──
  notes_generations:  { basic: { limit: 3,   period: 'daily' }, ultimate: { limit: 30,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  test_generations:   { basic: { limit: 3,   period: 'daily' }, ultimate: { limit: 30,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  flashcard_sets:     { basic: { limit: 3,   period: 'daily' }, ultimate: { limit: 30,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  quick_study:        { basic: { limit: 3,   period: 'daily' }, ultimate: { limit: 30,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  summaries:          { basic: { limit: 5,   period: 'daily' }, ultimate: { limit: 50,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  note_to_quiz:       { basic: { limit: 10,  period: 'daily' }, ultimate: { limit: 50,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  study_planners:     { basic: { limit: 15,  period: 'daily' }, ultimate: { limit: 60,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },

  // ── Sessions / games ──
  study_sessions:     { basic: { limit: 3,   period: 'daily' }, ultimate: { limit: 20,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  quest_games:        { basic: { limit: 10,  period: 'daily' }, ultimate: { limit: 50,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },

  // ── Smart Notebook / Resources ──
  smart_notebook:     { basic: { limit: 5,   period: 'daily' }, ultimate: { limit: 30,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },

  // ── Audio / Lecture pipeline ──
  audio_analysis:     { basic: { limit: 5,   period: 'daily' }, ultimate: { limit: 30,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  lecture_notes:      { basic: { limit: 6,   period: 'daily' }, ultimate: { limit: 40,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  lecture_flashcards: { basic: { limit: 6,   period: 'daily' }, ultimate: { limit: 40,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  lecture_quiz:       { basic: { limit: 6,   period: 'daily' }, ultimate: { limit: 40,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  podcast_generation: { basic: { limit: 1,   period: 'weekly' }, ultimate: { limit: 5,  period: 'weekly' }, pro_plus: { limit: -1, period: 'weekly' } },

  // ── Insights ──
  weakness_radar:     { basic: { limit: 1,   period: 'weekly' }, ultimate: { limit: 5,  period: 'weekly' }, pro_plus: { limit: -1, period: 'weekly' } },

  // ── Lumina Hub modules ──
  recall_mode:        { basic: { limit: 20,  period: 'daily' }, ultimate: { limit: 100, period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  spaced_scheduler:   { basic: { limit: 5,   period: 'daily' }, ultimate: { limit: 30,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  smart_shuffle:      { basic: { limit: 2,   period: 'daily' }, ultimate: { limit: 15,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  explain_mode:       { basic: { limit: 2,   period: 'daily' }, ultimate: { limit: 15,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  why_engine:         { basic: { limit: 3,   period: 'daily' }, ultimate: { limit: 20,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  visualize_mode:     { basic: { limit: 1,   period: 'daily' }, ultimate: { limit: 10,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  cognitive_dashboard:{ basic: { limit: 3,   period: 'daily' }, ultimate: { limit: 20,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  pomodoro_timer:     { basic: { limit: 5,   period: 'daily' }, ultimate: { limit: 30,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  mind_mapping:       { basic: { limit: 3,   period: 'daily' }, ultimate: { limit: 20,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  sq3r_method:        { basic: { limit: 2,   period: 'daily' }, ultimate: { limit: 15,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
  guided_lesson:      { basic: { limit: 5,   period: 'daily' }, ultimate: { limit: 30,  period: 'daily' }, pro_plus: { limit: -1, period: 'daily' } },
};

// Features whose limits are enforced authoritatively in the corresponding
// edge function via _shared/usage-gate.ts. For these we still PRE-CHECK on
// the client (to show the upgrade modal early) but we never increment —
// the server owns the counter so we don't double-count.
const SERVER_ENFORCED = new Set<string>([
  "chat_messages",
  "doubt_messages",
  "notes_generations",
  "test_generations",
  "flashcard_sets",
  "quick_study",
  "study_planners",
  "smart_notebook",
  "lecture_notes",
  "lecture_flashcards",
  "lecture_quiz",
  "podcast_generation",
  "guided_lesson",
  "lumina_computer",
  "artifact_generation",
]);

export const useUsageLimits = () => {
  const { user } = useAuth();
  const { plan, isProPlus } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const limitFor = useCallback((feature: string): TierLimit | null => {
    const row = LIMITS[feature];
    if (!row) return null;
    return row[plan] ?? row.basic;
  }, [plan]);

  const checkAndIncrement = useCallback(async (feature: string): Promise<boolean> => {
    // PRO+ users bypass everything.
    if (isProPlus) return true;
    if (feature === 'resource_generation' || feature === 'resources') return true;
    if (!user) {
      toast.error('Please sign in to use this feature.');
      return false;
    }

    const config = limitFor(feature);
    if (!config) return true;
    if (config.limit < 0) return true; // unlimited

    try {
      const { data: currentCount } = await supabase.rpc('get_usage_count', {
        p_user_id: user.id,
        p_feature: feature,
        p_period_type: config.period,
      });

      if ((currentCount ?? 0) >= config.limit) {
        const periodLabel = config.period === 'weekly' ? 'weekly' : 'daily';
        const upgradeTarget = plan === 'basic' ? 'Ultimate (₹199) or PRO+ (₹499)' : 'PRO+ (₹499)';
        toast.error(`You've hit your ${periodLabel} limit of ${config.limit} for this tool. Upgrade to ${upgradeTarget} for more.`);
        setShowUpgrade(true);
        return false;
      }

      // Skip client increment when the server-side gate owns the counter,
      // otherwise the user would be double-charged per request.
      if (!SERVER_ENFORCED.has(feature)) {
        await supabase.rpc('increment_usage', {
          p_user_id: user.id,
          p_feature: feature,
          p_period_type: config.period,
        });
      }

      const newCount = (currentCount ?? 0) + 1;
      if (newCount >= Math.floor(config.limit * 0.8) && newCount < config.limit) {
        const remaining = config.limit - newCount;
        toast.warning(`Heads up — ${remaining} use${remaining === 1 ? '' : 's'} left ${config.period === 'weekly' ? 'this week' : 'today'}.`);
      }

      return true;
    } catch (err) {
      console.error('Usage check failed:', err);
      return true;
    }
  }, [user, isProPlus, plan, limitFor]);


  const getUsage = useCallback(async (feature: string): Promise<{ used: number; limit: number } | null> => {
    if (!user || isProPlus) return null;
    const config = limitFor(feature);
    if (!config) return null;

    const { data } = await supabase.rpc('get_usage_count', {
      p_user_id: user.id,
      p_feature: feature,
      p_period_type: config.period,
    });

    return { used: data ?? 0, limit: config.limit };
  }, [user, isProPlus, limitFor]);

  return { checkAndIncrement, getUsage, showUpgrade, setShowUpgrade, LIMITS };
};
