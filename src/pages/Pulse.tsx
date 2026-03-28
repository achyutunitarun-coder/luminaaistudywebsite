import { motion } from 'framer-motion';
import { Activity, Clock, Zap, Target, BookOpen, MessageSquare, FileText, Layers, TrendingUp, BarChart3 } from 'lucide-react';
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

const MAX_DAILY_MINUTES = 1440;

const Pulse = () => {
  const { seconds, isRunning } = useStudyTimer();
  const { profile } = useProfile();
  const { user } = useAuth();

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  // Last 30 days of study data for the performance graph
  const { data: monthlyData } = useQuery({
    queryKey: ['pulse-monthly', user?.id],
    queryFn: async () => {
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase
        .from('study_sessions')
        .select('duration_minutes, started_at')
        .eq('user_id', user!.id)
        .gte('started_at', monthAgo)
        .order('started_at');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: testData } = useQuery({
    queryKey: ['pulse-tests', user?.id],
    queryFn: async () => {
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase
        .from('tests')
        .select('score, created_at, subject')
        .eq('user_id', user!.id)
        .gte('created_at', monthAgo)
        .not('score', 'is', null)
        .order('created_at');
      return data || [];
    },
    enabled: !!user,
  });

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
    }).reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, MAX_DAILY_MINUTES), 0) || 0;
    return Math.min(dayMins, MAX_DAILY_MINUTES);
  });
  const maxDay = Math.max(...weeklyMinsByDay, 1);
  const totalWeekMins = weeklyMinsByDay.reduce((a, b) => a + b, 0);
  const totalHrs = Math.floor((totalStudied || 0) / 60);
  const totalMins = (totalStudied || 0) % 60;

  // Build 30-day study minutes chart data
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date;
  });
  const dailyStudyMins = last30Days.map(date => {
    const dateStr = date.toISOString().split('T')[0];
    const dayMins = monthlyData?.filter(s => s.started_at.startsWith(dateStr))
      .reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, MAX_DAILY_MINUTES), 0) || 0;
    return { date, mins: Math.min(dayMins, MAX_DAILY_MINUTES), label: date.getDate().toString() };
  });
  const maxDailyMins = Math.max(...dailyStudyMins.map(d => d.mins), 1);

  // Build test score trend data
  const testScores = (testData || []).map(t => ({
    score: Number(t.score) || 0,
    date: new Date(t.created_at),
    subject: t.subject || 'General',
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Activity className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Performance & Pulse</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Your study heartbeat & performance analytics</p>
          </div>
        </div>
      </motion.div>

      {/* Live Timer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-[2rem] liquid-glass-intense overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06),transparent_60%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/3 blur-[100px]" />
        <div className="relative z-10 py-14 px-8 text-center">
          {isRunning && seconds > 0 ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] font-bold text-success uppercase tracking-[0.2em]">Live Session</span>
              </div>
              <div className="flex items-baseline justify-center gap-1 tabular-nums">
                <span className="text-7xl md:text-8xl font-display font-bold text-foreground">{String(hrs).padStart(2, '0')}</span>
                <span className="text-2xl text-muted-foreground/50 font-light mx-1">:</span>
                <span className="text-7xl md:text-8xl font-display font-bold text-foreground">{String(mins).padStart(2, '0')}</span>
                <span className="text-2xl text-muted-foreground/50 font-light mx-1">:</span>
                <span className="text-5xl md:text-6xl font-display font-semibold text-muted-foreground">{String(secs).padStart(2, '0')}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-4">studying right now</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">No Active Session</span>
              </div>
              <p className="text-lg text-muted-foreground">Start a study session to see your live timer</p>
            </>
          )}
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: profile?.xp || 0, label: 'Total XP', icon: Zap, color: 'text-xp' },
          { value: profile?.level || 1, label: 'Level', icon: TrendingUp, color: 'text-primary' },
          { value: totalHrs > 0 ? `${totalHrs}h ${totalMins}m` : `${totalStudied || 0}m`, label: 'Total Studied', icon: Clock, color: 'text-secondary' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            className="rounded-2xl liquid-glass p-5 text-center"
          >
            <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-2`} />
            <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* 30-Day Study Activity Graph */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl liquid-glass p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="text-base font-display font-semibold text-foreground">30-Day Study Activity</h2>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {dailyStudyMins.reduce((a, b) => a + b.mins, 0)}m total
          </span>
        </div>
        <div className="flex items-end gap-[3px] h-32">
          {dailyStudyMins.map((day, i) => {
            const pct = (day.mins / maxDailyMins) * 100;
            const isToday = i === 29;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="w-full relative" style={{ height: '100px' }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct, 3)}%` }}
                    transition={{ delay: 0.3 + i * 0.02, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className={`absolute bottom-0 w-full rounded-sm ${
                      isToday ? 'gradient-primary shadow-sm shadow-primary/20' : day.mins > 0 ? 'bg-primary/40' : 'bg-muted/15'
                    }`}
                  />
                </div>
                {(i === 0 || i === 14 || i === 29) && (
                  <span className={`text-[8px] font-medium ${isToday ? 'text-primary' : 'text-muted-foreground/50'}`}>
                    {day.date.getMonth() + 1}/{day.label}
                  </span>
                )}
                {/* Tooltip on hover */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border/30 rounded-lg px-2 py-1 text-[9px] text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                  {day.mins}m • {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Test Score Trend */}
      {testScores.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl liquid-glass p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" />
              <h2 className="text-base font-display font-semibold text-foreground">Test Score Trend</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Avg: {Math.round(testScores.reduce((a, b) => a + b.score, 0) / testScores.length)}%
            </span>
          </div>
          <div className="relative h-40">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[9px] text-muted-foreground/60 pr-2">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            {/* Grid lines */}
            <div className="absolute left-8 right-0 top-0 bottom-0">
              {[0, 25, 50, 75, 100].map(v => (
                <div key={v} className="absolute w-full border-t border-border/10" style={{ bottom: `${v}%` }} />
              ))}
              {/* Line chart */}
              <svg className="w-full h-full" viewBox={`0 0 ${testScores.length * 60} 160`} preserveAspectRatio="none">
                {/* Area fill */}
                <path
                  d={`M ${testScores.map((t, i) => `${i * 60 + 30},${160 - (t.score / 100) * 160}`).join(' L ')} L ${(testScores.length - 1) * 60 + 30},160 L 30,160 Z`}
                  fill="url(#scoreGradient)"
                  opacity="0.15"
                />
                {/* Line */}
                <path
                  d={`M ${testScores.map((t, i) => `${i * 60 + 30},${160 - (t.score / 100) * 160}`).join(' L ')}`}
                  fill="none"
                  stroke="hsl(var(--success))"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots */}
                {testScores.map((t, i) => (
                  <circle
                    key={i}
                    cx={i * 60 + 30}
                    cy={160 - (t.score / 100) * 160}
                    r="4"
                    fill="hsl(var(--success))"
                    stroke="hsl(var(--card))"
                    strokeWidth="2"
                  />
                ))}
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
              {/* X-axis labels */}
              <div className="flex justify-between mt-1">
                {testScores.map((t, i) => (
                  <span key={i} className="text-[8px] text-muted-foreground/50 truncate max-w-[50px]" title={t.subject}>
                    {t.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Weekly Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-2xl liquid-glass p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-display font-semibold text-foreground">This Week</h2>
          <span className="text-xs text-muted-foreground font-medium">{totalWeekMins}m total</span>
        </div>
        <div className="flex items-end justify-between gap-3 h-36">
          {weekDays.map((day, i) => {
            const pct = (weeklyMinsByDay[i] / maxDay) * 100;
            const today = new Date().getDay() === (i + 1) % 7;
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] text-muted-foreground tabular-nums">{weeklyMinsByDay[i]}m</span>
                <div className="w-full relative" style={{ height: '100px' }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct, 6)}%` }}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className={`absolute bottom-0 w-full rounded-lg ${today ? 'gradient-primary shadow-sm shadow-primary/20' : 'bg-primary/25'}`}
                  />
                </div>
                <span className={`text-[11px] font-medium ${today ? 'text-primary' : 'text-muted-foreground'}`}>{day}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* XP Rewards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-xl p-6"
      >
        <h2 className="text-base font-display font-semibold text-foreground mb-5">XP Rewards</h2>
        <div className="space-y-1">
          {xpRules.map((rule, i) => (
            <div key={i} className="flex items-center gap-4 py-2.5 px-3 rounded-xl hover:bg-muted/10 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-muted/30 flex items-center justify-center">
                <rule.icon className={`w-4 h-4 ${rule.color}`} />
              </div>
              <span className="flex-1 text-sm text-foreground font-medium">{rule.label}</span>
              <span className="text-sm font-bold text-xp bg-xp/10 px-3 py-1 rounded-lg">+{rule.xp}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Pulse;
