import { motion } from 'framer-motion';
import { Trophy, Flame, Target, BookOpen, Zap, Swords, TrendingUp, BarChart3, Clock, ArrowRight, CheckCircle2, Brain, Sparkles, AlertTriangle } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStudyTimer } from '@/hooks/useStudyTimer';

const ease = [0.25, 0.1, 0.25, 1] as const;

const Dashboard = () => {
  const { profile, getLevelTitle, xpForNextLevel } = useProfile();
  const { user } = useAuth();
  const { seconds: liveSeconds } = useStudyTimer();
  const navigate = useNavigate();

  const { data: todayMinutes } = useQuery({
    queryKey: ['today-study-minutes', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('study_sessions')
        .select('duration_minutes')
        .eq('user_id', user!.id)
        .gte('started_at', today);
      return data?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
    },
    enabled: !!user,
  });

  const { data: recentTests } = useQuery({
    queryKey: ['recent-tests-insight', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tests')
        .select('score, subject, created_at')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: weeklyMinutes } = useQuery({
    queryKey: ['weekly-study-minutes', user?.id],
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

  const { data: mistakeData } = useQuery({
    queryKey: ['weakness-insight', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('mistakes')
        .select('topic, subject')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  if (!profile) return null;

  const xpProgress = profile.xp % 100;
  const nextLevelXp = xpForNextLevel(profile.level);
  const liveMinutes = Math.floor(liveSeconds / 60);
  const totalToday = (todayMinutes || 0) + liveMinutes;
  const hrs = Math.floor(totalToday / 60);
  const mins = totalToday % 60;

  // AI Insight computation
  const avgScore = recentTests?.length
    ? Math.round(recentTests.reduce((s, t) => s + (t.score || 0), 0) / recentTests.length)
    : null;

  const topWeakness = (() => {
    if (!mistakeData?.length) return null;
    const counts: Record<string, number> = {};
    mistakeData.forEach(m => { counts[m.topic] = (counts[m.topic] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
  })();

  const weekTotal = weeklyMinutes?.reduce((s, w) => s + (w.duration_minutes || 0), 0) || 0;
  const daysStudied = new Set(weeklyMinutes?.map(w => new Date(w.started_at).toDateString())).size;

  const insightMessage = (() => {
    if (avgScore !== null && topWeakness) {
      return `Your average test score is ${avgScore}%. Your biggest weakness is **${topWeakness}**. Focus on 2-3 targeted practice sessions to improve.`;
    }
    if (avgScore !== null) {
      return `Your average score is ${avgScore}%. Keep pushing — consistent practice is the fastest way to improve.`;
    }
    if (totalToday > 60) {
      return `Great momentum! You've studied ${hrs}h ${mins}m today. Take a short break, then focus on your weakest topics.`;
    }
    return `Welcome back! Start a study session to build your streak and track your progress.`;
  })();

  const insightAction = topWeakness
    ? { label: `Practice ${topWeakness}`, url: '/tests' }
    : avgScore !== null
    ? { label: 'Take a Test', url: '/tests' }
    : { label: 'Start Studying', url: '/study-session' };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* AI Insight Panel — PRIMARY FOCAL POINT */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="relative rounded-[2rem] liquid-glass-elevated noise-overlay p-8 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/6 via-transparent to-secondary/4 z-[1]" />
        <div className="ambient-orb w-[400px] h-[400px] bg-primary/5 -top-20 -right-20" />
        <div className="ambient-orb w-[300px] h-[300px] bg-secondary/4 -bottom-20 -left-20" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Left: AI badge + message */}
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/15 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">AI Insight</span>
            </div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-foreground leading-snug mb-2">
              {avgScore !== null ? `You're at ${avgScore}% readiness` : `Let's build your study streak`}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              {insightMessage.replace(/\*\*(.*?)\*\*/g, '$1')}
            </p>
            <Button
              onClick={() => navigate(insightAction.url)}
              size="sm"
              className="mt-4 gradient-primary text-primary-foreground px-6 rounded-xl shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {insightAction.label} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>

          {/* Right: Readiness Ring */}
          <div className="flex-shrink-0">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted) / 0.3)" strokeWidth="6" />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="url(#readiness-grad)" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - (avgScore || 0) / 100) }}
                  transition={{ duration: 1.2, delay: 0.3, ease }}
                />
                <defs>
                  <linearGradient id="readiness-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--secondary))" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-display font-bold text-foreground tabular-nums">{avgScore ?? '—'}%</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Ready</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Level 2: Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Trophy, label: 'Level', value: profile.level, color: 'text-xp', bg: 'bg-xp/8' },
          { icon: Flame, label: 'Streak', value: `${profile.streak_days}d`, color: 'text-warning', bg: 'bg-warning/8' },
          { icon: Clock, label: 'Today', value: `${hrs}h ${mins}m`, color: 'text-primary', bg: 'bg-primary/8' },
          { icon: Target, label: 'XP', value: profile.xp, color: 'text-secondary', bg: 'bg-secondary/8' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05, ease }}
            className="rounded-2xl liquid-glass p-4 card-hover"
          >
            <div className="relative z-10 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-display font-bold text-foreground tabular-nums">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Level 2: Subject Cards with AI mini-insights */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ease }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-display font-semibold text-foreground flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> Weak Areas
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/weakness-radar')} className="text-primary text-xs rounded-xl hover:bg-primary/8">
            View All <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {mistakeData && mistakeData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(() => {
              const topicCounts: Record<string, { count: number; subject: string }> = {};
              mistakeData.forEach(m => {
                if (!topicCounts[m.topic]) topicCounts[m.topic] = { count: 0, subject: m.subject || '' };
                topicCounts[m.topic].count++;
              });
              return Object.entries(topicCounts)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 3)
                .map(([topic, { count, subject }], i) => (
                  <div key={topic} className="rounded-2xl liquid-glass p-4 border-l-2 border-destructive/40">
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                        <span className="text-xs text-destructive font-medium">{count} mistakes</span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mb-0.5">{topic}</h3>
                      <p className="text-[11px] text-muted-foreground">{subject}</p>
                    </div>
                  </div>
                ));
            })()}
          </div>
        ) : (
          <div className="rounded-2xl liquid-glass p-6 text-center">
            <div className="relative z-10">
              <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Take some tests to discover your weak areas</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, ease }}>
        <h2 className="text-[15px] font-display font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { name: 'AI Chat', desc: 'Ask anything, get explanations', icon: Zap, url: '/chat', color: 'text-primary', bg: 'bg-primary/8' },
            { name: 'Generate Test', desc: 'Adaptive tests on any topic', icon: Target, url: '/tests', color: 'text-secondary', bg: 'bg-secondary/8' },
            { name: 'Brain Hub', desc: 'Active recall, spaced repetition', icon: Brain, url: '/hub', color: 'text-xp', bg: 'bg-xp/8' },
          ].map(action => (
            <button
              key={action.name}
              onClick={() => navigate(action.url)}
              className="rounded-2xl liquid-glass p-5 text-left transition-all duration-300 group card-hover"
            >
              <div className="relative z-10">
                <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110`}>
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-0.5">{action.name}</h3>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Weekly Activity Graph */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, ease }}
        className="rounded-[1.75rem] liquid-glass p-6"
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-display font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> This Week
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">{daysStudied}/7 days active</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/pulse')} className="text-primary text-xs rounded-xl hover:bg-primary/8">
              Full Analytics <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>

          <div className="flex items-end justify-between gap-2 h-24">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
              const dayMins = weeklyMinutes?.filter(s => {
                const d = new Date(s.started_at);
                return d.getDay() === (i + 1) % 7;
              }).reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
              const maxMins = Math.max(...(weeklyMinutes?.map(s => s.duration_minutes || 0) || [1]), 1);
              const height = Math.max((dayMins / maxMins) * 100, 4);
              const today = new Date().getDay() === (i + 1) % 7;

              return (
                <div key={day} className="flex flex-col items-center gap-1.5 flex-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.6, delay: 0.1 * i, ease }}
                    className={`w-full max-w-[32px] rounded-lg ${
                      dayMins > 0 ? 'gradient-primary' : 'bg-muted/20'
                    } ${today ? 'ring-2 ring-primary/30' : ''}`}
                  />
                  <span className={`text-[9px] font-medium ${today ? 'text-primary' : 'text-muted-foreground/50'}`}>{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
