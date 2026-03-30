import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown, Shield, TrendingUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

type Period = 'daily' | 'weekly' | 'all_time';

interface LeaderboardEntry {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  xp: number;
  level: number;
}

const ease = [0.25, 0.1, 0.25, 1] as const;

const rankIcons = [
  <Crown className="w-5 h-5 text-yellow-400" />,
  <Medal className="w-5 h-5 text-gray-300" />,
  <Medal className="w-5 h-5 text-amber-600" />,
];

const Leaderboard = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('all_time');

  // Sync own leaderboard entry on mount
  useEffect(() => {
    if (!user) return;
    supabase.rpc('sync_leaderboard', { p_user_id: user.id }).then();
  }, [user]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: async () => {
      const periodStart = period === 'all_time'
        ? '2024-01-01'
        : period === 'weekly'
          ? new Date(Date.now() - new Date().getDay() * 86400000).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

      const { data } = await supabase
        .from('leaderboard_entries')
        .select('*')
        .eq('period', period)
        .eq('period_start', periodStart)
        .order('xp', { ascending: false })
        .limit(50);
      return (data || []) as LeaderboardEntry[];
    },
    refetchInterval: 30000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard_entries' }, () => {
        // refetch handled by react-query refetchInterval
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const myRank = entries.findIndex(e => e.user_id === user?.id) + 1;
  const myEntry = entries.find(e => e.user_id === user?.id);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-1">
          <Trophy className="inline w-8 h-8 mr-2 text-yellow-400" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground">Compete with fellow learners</p>
      </motion.div>

      {/* My rank */}
      {myEntry && (
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              #{myRank}
            </div>
            <Avatar className="h-10 w-10">
              <AvatarImage src={myEntry.avatar_url || ''} />
              <AvatarFallback className="bg-primary/20 text-primary">{myEntry.display_name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{myEntry.display_name} <span className="text-xs text-muted-foreground">(You)</span></p>
              <p className="text-xs text-muted-foreground">Level {myEntry.level}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-primary">{myEntry.xp.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground uppercase">XP</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={period} onValueChange={v => setPeriod(v as Period)}>
        <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-muted/30 p-1">
          <TabsTrigger value="daily" className="rounded-xl text-xs">Today</TabsTrigger>
          <TabsTrigger value="weekly" className="rounded-xl text-xs">This Week</TabsTrigger>
          <TabsTrigger value="all_time" className="rounded-xl text-xs">All Time</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <Shield className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">No entries yet. Start studying to appear on the leaderboard!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, ease }}
            >
              <Card className={`transition-all ${entry.user_id === user?.id ? 'border-primary/30 bg-primary/5' : 'hover:border-border/50'}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-8 text-center">
                    {i < 3 ? rankIcons[i] : <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>}
                  </div>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={entry.avatar_url || ''} />
                    <AvatarFallback className="bg-muted text-xs">{entry.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {entry.display_name}
                      {entry.user_id === user?.id && <span className="text-xs text-primary ml-1">(You)</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Level {entry.level}</p>
                  </div>
                  <div className="text-right flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                    <span className="font-bold text-sm text-foreground">{entry.xp.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground">XP</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
