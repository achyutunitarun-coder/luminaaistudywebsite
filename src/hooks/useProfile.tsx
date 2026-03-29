import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Allow-list of safe fields — gamification stats are server-only
  const SAFE_FIELDS = new Set([
    'display_name', 'avatar_url', 'study_mode', 'difficulty',
    'learning_style', 'gamification_mode', 'theme', 'extra_preferences',
  ]);

  const updateProfile = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!user) throw new Error('Not authenticated');
      // Strip any fields not in the allow-list
      const safeUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (SAFE_FIELDS.has(key)) safeUpdates[key] = value;
      }
      if (Object.keys(safeUpdates).length === 0) throw new Error('No valid fields to update');
      const { error } = await supabase
        .from('profiles')
        .update(safeUpdates)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  const getLevelTitle = (level: number) => {
    if (level >= 50) return 'Legend';
    if (level >= 25) return 'Master';
    if (level >= 10) return 'Scholar';
    return 'Beginner';
  };

  const xpForNextLevel = (level: number) => level * 100;

  return { profile, isLoading, updateProfile, getLevelTitle, xpForNextLevel };
};
