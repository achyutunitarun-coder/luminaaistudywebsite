import { motion } from 'framer-motion';
import { Trophy, Flame, Target, Clock, ArrowRight, CheckCircle2, Brain, Sparkles, AlertTriangle, MessageSquare, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useMemo } from 'react';

const ease = [0.25, 0.1, 0.25, 1] as const;

const Dashboard = () => {
  const { profile, xpForNextLevel } = useProfile();
  const { user } = useAuth();
  const { seconds: liveSeconds } = useStudyTimer();
  const navigate = useNavigate();

  // Parse user preferences for personalization
  const userPrefs = useMemo(() => {
    if (!profile?.extra_preferences) return null;
    try {
      return JSON.parse(profile.extra_preferences as string);
    } catch { return null; }
  }, [profile?.extra_preferences]);

  const userName = profile?.display_name?.split(' ')[0] || 'there';
  const userSubjects = userPrefs?.subjects || [];
  const userGoal = userPrefs?.goal || 'learning';

  const { data: todayMinutes } = useQuery({
    queryKey: ['today-study-minutes', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('study_sessions')
        .select('duration_minutes')
        .eq('user_id', user!.id)
        .gte('started_at', today);
      return data?.reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0;
    },
    enabled: !!user,
  });

  const { data: recentTests } = useQuery({
    queryKey: ['recent-tests-insight', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tests')
        .select('score, subject, created_at, correct_answers, total_questions')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);
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
        .select('topic, subject, mistake_type')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  // Streak calculation from profile
  const streakDays = profile?.streak_days || 0;

  if (!profile) return null;

  const liveMinutes = Math.floor(liveSeconds / 60);
  const totalToday = (todayMinutes || 0) + liveMinutes;
  const hrs = Math.floor(totalToday / 60);
  const mins = totalToday % 60;

  const avgScore = recentTests?.length
    ? Math.round(recentTests.reduce((s, t) => s + (t.score || 0), 0) / recentTests.length)
    : null;

  // Score trend
  const scoreTrend = (() => {
    if (!recentTests || recentTests.length < 4) return null;
    const recent3 = recentTests.slice(0, 3).reduce((s, t) => s + (t.score || 0), 0) / 3;
    const prev3 = recentTests.slice(3, 6).reduce((s, t) => s + (t.score || 0), 0) / Math.min(recentTests.length - 3, 3);
    return Math.round(recent3 - prev3);
  })();

  // Group by SUBJECT not individual question text
  const subjectScores = useMemo(() => {
    if (!recentTests?.length) return {};
    const map: Record<string, { total: number; count: number }> = {};
    recentTests.forEach(t => {
      const sub = t.subject || 'General';
      if (!map[sub]) map[sub] = { total: 0, count: 0 };
      map[sub].total += t.score || 0;
      map[sub].count++;
    });
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Math.round(v.total / v.count)]));
  }, [recentTests]);

  // Weak areas grouped by SUBJECT (not raw question text)
  const weakSubjects = useMemo(() => {
    if (!mistakeData?.length) return [];
    const subjectCounts: Record<string, { count: number; types: Record<string, number> }> = {};
    mistakeData.forEach(m => {
      const sub = m.subject || 'General';
      if (!subjectCounts[sub]) subjectCounts[sub] = { count: 0, types: {} };
      subjectCounts[sub].count++;
      const t = m.mistake_type || 'conceptual';
      subjectCounts[sub].types[t] = (subjectCounts[sub].types[t] || 0) + 1;
    });
    return Object.entries(subjectCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([subject, data]) => {
        const topType = Object.entries(data.types).sort((a, b) => b[1] - a[1])[0]?.[0] || 'conceptual';
        return { subject, count: data.count, topMistakeType: topType };
      });
  }, [mistakeData]);

  const daysStudied = new Set(weeklyMinutes?.map(w => new Date(w.started_at).toDateString())).size;
  const consistency = Math.round((daysStudied / 7) * 100);

  // Personalized insight message
  const insightMessage = (() => {
    const parts: string[] = [];

    if (avgScore !== null && recentTests && recentTests.length > 0) {
      const lastTest = recentTests[0];
      const trendText = scoreTrend !== null
        ? (scoreTrend >= 0 ? ` — trending up ${scoreTrend}%` : ` — dropped ${Math.abs(scoreTrend)}%`)
        : '';
      parts.push(`Average score: ${avgScore}%${trendText}. Last test: ${lastTest.subject || 'General'} (${lastTest.score}%).`);
    }

    if (weakSubjects.length > 0) {
      const weakest = weakSubjects[0];
      parts.push(`${weakest.subject} needs attention — ${weakest.count} mistakes, mostly ${weakest.topMistakeType}.`);
    }

    if (streakDays >= 3) {
      parts.push(`${streakDays}-day streak! Keep the momentum going.`);
    } else if (streakDays === 0 && totalToday === 0) {
      parts.push(`Start studying today to build your streak.`);
    }

    if (consistency > 0 && consistency < 100) {
      parts.push(`${consistency}% consistency this week (${daysStudied}/7 days).`);
    }

    if (parts.length === 0) {
      return `Hey ${userName}! ${userGoal === 'exams' ? 'Ready to prep for exams?' : 'Ready to learn something new?'} Start a study session or take a test to get personalized insights.`;
    }

    return parts.join(' ');
  })();

  const insightAction = weakSubjects.length > 0
    ? { label: `Practice ${weakSubjects[0].subject}`, url: '/tests' }
    : avgScore !== null && avgScore < 70
    ? { label: 'Improve Your Score', url: '/tests' }
    : { label: 'Start Studying', url: '/study-session' };

  const readinessScore = avgScore ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* AI Insight Panel */}
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
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/15 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">AI Insight</span>
            </div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-foreground leading-snug mb-2">
              {avgScore !== null
                ? (
                  <span className="flex items-center gap-2">
                    {avgScore >= 70 ? `Strong performance, ${userName}` : `Room to grow, ${userName}`}
                    {scoreTrend !== null && (
                      scoreTrend >= 0
                        ? <TrendingUp className="w-5 h-5 text-success inline" />
                        : <TrendingDown className="w-5 h-5 text-destructive inline" />
                    )}
                  </span>
                )
                : `Welcome back, ${userName}!`}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              {insightMessage}
            </p>

            {/* Subject performance chips */}
            {Object.keys(subjectScores).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(subjectScores).map(([sub, score]) => (
                  <motion.div
                    key={sub}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                      score >= 70
                        ? 'bg-success/10 text-success border-success/20'
                        : score >= 50
                        ? 'bg-warning/10 text-warning border-warning/20'
                        : 'bg-destructive/10 text-destructive border-destructive/20'
                    }`}
                  >
                    <span className="capitalize">{sub}</span>
                    <span className="font-bold tabular-nums">{score}%</span>
                  </motion.div>
                ))}
              </div>
            )}

            <Button
              onClick={() => navigate(insightAction.url)}
              size="sm"
              className="mt-4 gradient-primary text-primary-foreground px-6 rounded-xl shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {insightAction.label} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>

          <div className="flex-shrink-0">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted) / 0.3)" strokeWidth="6" />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="url(#readiness-grad)" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - readinessScore / 100) }}
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Trophy, label: 'Level', value: profile.level, sub: `${profile.xp % 100}/${100} XP`, color: 'text-xp', bg: 'bg-xp/8' },
          { icon: Flame, label: 'Streak', value: `${streakDays}d`, sub: streakDays >= 3 ? '🔥 On fire!' : 'Keep going', color: 'text-warning', bg: 'bg-warning/8' },
          { icon: Clock, label: 'Today', value: `${hrs}h ${mins}m`, sub: totalToday > 30 ? 'Great progress' : 'Just started', color: 'text-primary', bg: 'bg-primary/8' },
          { icon: Target, label: 'Avg Score', value: avgScore !== null ? `${avgScore}%` : '—', sub: `${recentTests?.length || 0} tests taken`, color: 'text-secondary', bg: 'bg-secondary/8' },
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
                <p className="text-[10px] text-muted-foreground/70">{stat.sub}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Weak Areas — By SUBJECT */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ease }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-display font-semibold text-foreground flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> Areas to Improve
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/weakness-radar')} className="text-primary text-xs rounded-xl hover:bg-primary/8">
            Details <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {weakSubjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(() => {
              const colors = [
                { border: 'border-l-rose-500/40', bg: 'from-rose-500/8 to-transparent', badge: 'bg-rose-500/15 text-rose-400' },
                { border: 'border-l-amber-500/40', bg: 'from-amber-500/8 to-transparent', badge: 'bg-amber-500/15 text-amber-400' },
                { border: 'border-l-orange-500/40', bg: 'from-orange-500/8 to-transparent', badge: 'bg-orange-500/15 text-orange-400' },
              ];
              return weakSubjects.map((w, i) => {
                const c = colors[i] || colors[2];
                const severity = w.count >= 10 ? 'Critical' : w.count >= 5 ? 'Needs Work' : 'Watch';
                const subjectScore = subjectScores[w.subject];
                return (
                  <motion.button
                    key={w.subject}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1, ease }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/tests')}
                    className={`rounded-2xl liquid-glass p-5 text-left border-l-[3px] ${c.border} relative overflow-hidden group cursor-pointer`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${c.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.badge}`}>
                          <AlertTriangle className="w-3 h-3" />
                          {severity}
                        </div>
                        {subjectScore !== undefined && (
                          <span className="text-xs text-muted-foreground tabular-nums">{subjectScore}% avg</span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors capitalize">{w.subject}</h3>
                      <p className="text-[11px] text-muted-foreground">{w.count} mistakes · mostly {w.topMistakeType}</p>
                      <div className="mt-3 h-1 rounded-full bg-muted/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-destructive/40 transition-[width] duration-700 ease-out"
                          style={{ width: `${Math.min(w.count * 5, 100)}%` }}
                        />
                      </div>
                    </div>
                  </motion.button>
                );
              });
            })()}
          </div>
        ) : (
          <div className="rounded-2xl liquid-glass p-8 text-center">
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-success" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Looking good!</p>
              <p className="text-xs text-muted-foreground">Take some tests to discover areas for improvement</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/tests')} className="mt-4 rounded-xl text-xs">
                Take a Test <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, ease }}>
        <h2 className="text-[15px] font-display font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'AI Chat', desc: 'Ask anything', icon: MessageSquare, url: '/chat', color: 'text-primary', bg: 'bg-primary/8' },
            { name: 'Generate Test', desc: userSubjects[0] ? `Try ${userSubjects[0]}` : 'Any topic', icon: Target, url: '/tests', color: 'text-secondary', bg: 'bg-secondary/8' },
            { name: 'Brain Hub', desc: 'Active recall', icon: Brain, url: '/hub', color: 'text-xp', bg: 'bg-xp/8' },
            { name: 'AI Tools', desc: 'All tools', icon: Sparkles, url: '/ai-tools', color: 'text-primary', bg: 'bg-primary/8' },
          ].map((action, i) => (
            <motion.button
              key={action.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.05, ease }}
              onClick={() => navigate(action.url)}
              className="rounded-2xl liquid-glass p-4 text-left transition-all duration-300 group card-hover"
            >
              <div className="relative z-10">
                <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110`}>
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-0.5">{action.name}</h3>
                <p className="text-[11px] text-muted-foreground">{action.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Weekly Activity */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, ease }}
        className="rounded-[1.75rem] liquid-glass p-6"
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-display font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> This Week
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">{daysStudied}/7 days · {consistency}% consistency</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/pulse')} className="text-primary text-xs rounded-xl hover:bg-primary/8">
              Analytics <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>

          <div className="flex items-end justify-between gap-2 h-24">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
              const dayMins = weeklyMinutes?.filter(s => {
                const d = new Date(s.started_at);
                return d.getDay() === (i + 1) % 7;
              }).reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0;
              const allDayMins = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((_, j) =>
                weeklyMinutes?.filter(s => new Date(s.started_at).getDay() === (j + 1) % 7)
                  .reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0
              );
              const maxMins = Math.max(...allDayMins, 1);
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