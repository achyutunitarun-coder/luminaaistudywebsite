import { motion } from 'framer-motion';
import { Activity, Clock, Zap, Target, BookOpen, MessageSquare, FileText, Layers } from 'lucide-react';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const xpRules = [
  { icon: MessageSquare, label: 'Doubt Solved', xp: 10, color: 'text-primary' },
  { icon: FileText, label: 'Test Completed', xp: 50, color: 'text-secondary' },
  { icon: Layers, label: 'Flashcard Deck Reviewed', xp: 15, color: 'text-xp' },
  { icon: BookOpen, label: 'Note Quiz Generated', xp: 20, color: 'text-success' },
  { icon: Target, label: 'Study Session (per 10 min)', xp: 5, color: 'text-warning' },
];

const Pulse = () => {
  const { seconds } = useStudyTimer();
  const { profile } = useProfile();
  const { user } = useAuth();

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const { data: weeklyData } = useQuery({
    queryKey: ['pulse-weekly', user?.id],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from('study_sessions')
        .select('duration_minutes, started_at')
        .eq('user_id', user!.id)
        .gte('started_at', weekAgo);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: totalStudied } = useQuery({
    queryKey: ['total-studied', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('study_sessions')
        .select('duration_minutes')
        .eq('user_id', user!.id);
      return data?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
    },
    enabled: !!user,
  });

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyMinsByDay = weekDays.map((_, i) => {
    const dayMins = weeklyData?.filter(s => {
      const d = new Date(s.started_at);
      return d.getDay() === (i + 1) % 7;
    }).reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
    return dayMins;
  });
  const maxDay = Math.max(...weeklyMinsByDay, 1);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Activity className="w-7 h-7 text-primary" /> The Pulse
        </h1>
        <p className="text-muted-foreground mt-1">Your real-time study heartbeat</p>
      </motion.div>

      {/* Live Timer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-10 text-center relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="relative z-10">
          <p className="text-xs font-medium text-primary uppercase tracking-[0.2em] mb-4">Live Session</p>
          <div className="flex items-baseline justify-center gap-1 tabular-nums">
            <span className="text-7xl md:text-8xl font-display font-bold text-foreground">{String(hrs).padStart(2, '0')}</span>
            <span className="text-2xl text-muted-foreground font-light mx-1">:</span>
            <span className="text-7xl md:text-8xl font-display font-bold text-foreground">{String(mins).padStart(2, '0')}</span>
            <span className="text-2xl text-muted-foreground font-light mx-1">:</span>
            <span className="text-5xl md:text-6xl font-display font-semibold text-muted-foreground">{String(secs).padStart(2, '0')}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-4">studying right now</p>
          <div className="w-2 h-2 rounded-full bg-success mx-auto mt-3 animate-pulse" />
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 text-center">
          <p className="text-3xl font-display font-bold text-foreground">{profile?.xp || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Total XP</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-6 text-center">
          <p className="text-3xl font-display font-bold text-foreground">{profile?.level || 1}</p>
          <p className="text-xs text-muted-foreground mt-1">Level</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-2xl p-6 text-center">
          <p className="text-3xl font-display font-bold text-foreground">{totalStudied || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Minutes</p>
        </motion.div>
      </div>

      {/* Weekly Activity */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-2xl p-6">
        <h2 className="text-lg font-display font-semibold text-foreground mb-6">This Week</h2>
        <div className="flex items-end justify-between gap-2 h-40">
          {weekDays.map((day, i) => {
            const pct = (weeklyMinsByDay[i] / maxDay) * 100;
            const today = new Date().getDay() === (i + 1) % 7;
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">{weeklyMinsByDay[i]}m</span>
                <div className="w-full relative" style={{ height: '120px' }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct, 4)}%` }}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.6 }}
                    className={`absolute bottom-0 w-full rounded-lg ${today ? 'gradient-primary' : 'bg-primary/30'}`}
                  />
                </div>
                <span className={`text-xs ${today ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{day}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* XP Breakdown */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass rounded-2xl p-6">
        <h2 className="text-lg font-display font-semibold text-foreground mb-4">XP Rewards</h2>
        <div className="space-y-3">
          {xpRules.map((rule, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
                <rule.icon className={`w-4 h-4 ${rule.color}`} />
              </div>
              <span className="flex-1 text-sm text-foreground">{rule.label}</span>
              <span className="text-sm font-semibold text-xp">+{rule.xp} XP</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Pulse;
