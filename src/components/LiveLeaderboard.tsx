import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, Medal, TrendingUp, Globe, Wifi } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type Period = 'daily' | 'weekly' | 'all_time';

interface LeaderboardEntry {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  xp: number;
  level: number;
}

const rankIcons = [
  <Crown key="1" className="w-5 h-5 text-yellow-400" />,
  <Medal key="2" className="w-5 h-5 text-gray-300" />,
  <Medal key="3" className="w-5 h-5 text-amber-600" />,
];

interface LiveLeaderboardProps {
  maxEntries?: number;
  compact?: boolean;
}

const LiveLeaderboard = ({ maxEntries = 20, compact = false }: LiveLeaderboardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('all_time');
  const [isLive, setIsLive] = useState(false);

  // Sync own entry on mount
  useEffect(() => {
    if (!user) return;
    supabase.rpc('sync_leaderboard', { p_user_id: user.id }).then();
  }, [user]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['live-leaderboard', period],
    queryFn: async () => {
      const periodStart = period === 'all_time'
        ? '2024-01-01'
        : period === 'weekly'
          ? new Date(Date.now() - new Date().getDay() * 86400000).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

      const { data } = await supabase
        .from('leaderboard_entries')
        .select('id, user_id, display_name, avatar_url, xp, level')
        .eq('period', period)
        .eq('period_start', periodStart)
        .order('xp', { ascending: false })
        .limit(maxEntries);
      return (data || []) as LeaderboardEntry[];
    },
    refetchInterval: 30000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('live-leaderboard-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leaderboard_entries',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-leaderboard', period] });
      })
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [period, queryClient]);

  const myRank = entries.findIndex(e => e.user_id === user?.id) + 1;
  const myEntry = entries.find(e => e.user_id === user?.id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-foreground text-base">Global Leaderboard</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ opacity: isLive ? [0.5, 1, 0.5] : 0.3 }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-muted-foreground'}`}
          />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {isLive ? 'Live' : 'Connecting'}
          </span>
        </div>
      </div>

      {/* Period tabs */}
      <Tabs value={period} onValueChange={v => setPeriod(v as Period)}>
        <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-muted/15 p-1 h-10">
          <TabsTrigger value="daily" className="rounded-xl text-xs">Today</TabsTrigger>
          <TabsTrigger value="weekly" className="rounded-xl text-xs">This Week</TabsTrigger>
          <TabsTrigger value="all_time" className="rounded-xl text-xs">All Time</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* My rank card */}
      {myEntry && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
            #{myRank}
          </div>
          <Avatar className="h-8 w-8">
            <AvatarImage src={myEntry.avatar_url || ''} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs">{myEntry.display_name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">
              {myEntry.display_name} <span className="text-xs text-primary">(You)</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Level {myEntry.level}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-primary">{myEntry.xp.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground uppercase">XP</p>
          </div>
        </div>
      )}

      {/* Entries list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8">
          <Trophy className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No entries yet. Start playing to appear!</p>
        </div>
      ) : (
        <div className={`space-y-1.5 ${compact ? 'max-h-[300px]' : 'max-h-[400px]'} overflow-y-auto pr-1`}>
          <AnimatePresence mode="popLayout">
            {entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className={`flex items-center gap-3 rounded-xl p-2.5 transition-colors ${
                  entry.user_id === user?.id
                    ? 'bg-primary/8 border border-primary/15'
                    : 'hover:bg-card/40'
                }`}
              >
                <div className="w-7 text-center flex-shrink-0">
                  {i < 3 ? rankIcons[i] : (
                    <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                  )}
                </div>
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={entry.avatar_url || ''} />
                  <AvatarFallback className="bg-muted/30 text-xs">{entry.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {entry.display_name}
                    {entry.user_id === user?.id && <span className="text-xs text-primary ml-1">(You)</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Lvl {entry.level}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  <span className="font-bold text-xs text-foreground">{entry.xp.toLocaleString()}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default LiveLeaderboard;
