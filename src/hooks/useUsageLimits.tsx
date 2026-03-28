import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

const LIMITS: Record<string, { limit: number; period: 'daily' | 'weekly' }> = {
  chat_messages:      { limit: 50,  period: 'daily' },
  study_sessions:     { limit: 3,   period: 'daily' },
  test_generations:   { limit: 10,  period: 'daily' },
  flashcard_sets:     { limit: 10,  period: 'daily' },
  notes_generations:  { limit: 6,   period: 'daily' },
  quest_games:        { limit: 25,  period: 'daily' },
  doubt_messages:     { limit: 50,  period: 'daily' },
  summaries:          { limit: 5,   period: 'daily' },
  note_to_quiz:       { limit: 10,  period: 'daily' },
  quick_study:        { limit: 10,  period: 'daily' },
  study_planners:     { limit: 15,  period: 'daily' },
  smart_notebook:     { limit: 5,   period: 'daily' },
  audio_analysis:     { limit: 5,   period: 'daily' },
  podcast_generation: { limit: 1,   period: 'weekly' },
  weakness_radar:     { limit: 1,   period: 'weekly' },
};

export const useUsageLimits = () => {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const checkAndIncrement = useCallback(async (feature: string): Promise<boolean> => {
    if (isPro) return true;
    if (!user) {
      toast.error('Please sign in to use this feature.');
      return false;
    }

    const config = LIMITS[feature];
    if (!config) return true;

    try {
      const { data: currentCount } = await supabase.rpc('get_usage_count', {
        p_user_id: user.id,
        p_feature: feature,
        p_period_type: config.period,
      });

      if ((currentCount ?? 0) >= config.limit) {
        const periodLabel = config.period === 'weekly' ? 'weekly' : 'daily';
        toast.error(`You've reached your ${periodLabel} limit of ${config.limit} for this feature. Upgrade to Pro for unlimited access!`);
        setShowUpgrade(true);
        return false;
      }

      await supabase.rpc('increment_usage', {
        p_user_id: user.id,
        p_feature: feature,
        p_period_type: config.period,
      });

      const newCount = (currentCount ?? 0) + 1;
      if (newCount >= Math.floor(config.limit * 0.8) && newCount < config.limit) {
        const remaining = config.limit - newCount;
        toast.warning(`You have ${remaining} use${remaining === 1 ? '' : 's'} left for this feature today.`);
      }

      return true;
    } catch (err) {
      console.error('Usage check failed:', err);
      return true;
    }
  }, [user, isPro]);

  const getUsage = useCallback(async (feature: string): Promise<{ used: number; limit: number } | null> => {
    if (!user || isPro) return null;
    const config = LIMITS[feature];
    if (!config) return null;

    const { data } = await supabase.rpc('get_usage_count', {
      p_user_id: user.id,
      p_feature: feature,
      p_period_type: config.period,
    });

    return { used: data ?? 0, limit: config.limit };
  }, [user, isPro]);

  return { checkAndIncrement, getUsage, showUpgrade, setShowUpgrade, LIMITS };
};
