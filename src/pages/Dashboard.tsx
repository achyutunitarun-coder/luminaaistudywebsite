import { motion } from 'framer-motion';
import { Trophy, Flame, Target, Clock, ArrowRight, CheckCircle2, Brain, Sparkles, AlertTriangle, MessageSquare, BarChart3, TrendingUp, TrendingDown, Zap, BookOpen, Layers, Activity, Crown, Rocket, Timer, GitBranch, Calendar, Shuffle } from 'lucide-react';
import { CTASection } from '@/components/marketing/CTASection';
import { Testimonials } from '@/components/marketing/Testimonials';
import { FAQ } from '@/components/marketing/FAQ';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useSubscription } from '@/hooks/useSubscription';
import { useMemo } from 'react';

const ease = [0.25, 0.1, 0.25, 1] as const;

const Dashboard = () => {
  const { profile, xpForNextLevel } = useProfile();
  const { user } = useAuth();
  const { seconds: liveSeconds } = useStudyTimer();
  const { isPro, isProPlus } = useSubscription();
  const navigate = useNavigate();

  const userPrefs = useMemo(() => {
    if (!profile?.extra_preferences) return null;
    try { return JSON.parse(profile.extra_preferences as string); } catch { return null; }
  }, [profile?.extra_preferences]);

  const rawName = profile?.display_name?.split(' ')[0]?.trim() || '';
  // Sanitize: avoid greeting users with the app's own name or generic placeholders
  const isGenericName = !rawName || /^(lumina|user|student|guest|test|admin|scholar)$/i.test(rawName);
  const userName = isGenericName ? 'scholar' : rawName;
  const userSubjects = userPrefs?.subjects || [];

  const { data: todayMinutes } = useQuery({
    queryKey: ['today-study-minutes', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('study_sessions').select('duration_minutes').eq('user_id', user!.id).gte('started_at', today);
      return data?.reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0;
    },
    enabled: !!user,
  });

  const { data: recentTests } = useQuery({
    queryKey: ['recent-tests-insight', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('tests').select('score, subject, created_at, correct_answers, total_questions').eq('user_id', user!.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: weeklyMinutes } = useQuery({
    queryKey: ['weekly-study-minutes', user?.id],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase.from('study_sessions').select('duration_minutes, started_at').eq('user_id', user!.id).gte('started_at', weekAgo);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: mistakeData } = useQuery({
    queryKey: ['weakness-insight', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('mistakes').select('topic, subject, mistake_type').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  const streakDays = profile?.streak_days || 0;

  const subjectScoresData = useMemo(() => {
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

  const weakSubjectsData = useMemo(() => {
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

  if (!profile) return null;

  const liveMinutes = Math.floor(liveSeconds / 60);
  const totalToday = (todayMinutes || 0) + liveMinutes;
  const hrs = Math.floor(totalToday / 60);
  const mins = totalToday % 60;

  const avgScore = recentTests?.length
    ? Math.round(recentTests.reduce((s, t) => s + (t.score || 0), 0) / recentTests.length)
    : null;

  const scoreTrend = (() => {
    if (!recentTests || recentTests.length < 4) return null;
    const recent3 = recentTests.slice(0, 3).reduce((s, t) => s + (t.score || 0), 0) / 3;
    const prev3 = recentTests.slice(3, 6).reduce((s, t) => s + (t.score || 0), 0) / Math.min(recentTests.length - 3, 3);
    return Math.round(recent3 - prev3);
  })();

  const subjectScores = subjectScoresData;
  const weakSubjects = weakSubjectsData;
  const daysStudied = new Set(weeklyMinutes?.map(w => new Date(w.started_at).toDateString())).size;
  const consistency = Math.round((daysStudied / 7) * 100);
  const readinessScore = avgScore ?? 0;

  const insightObservation = (() => {
    if (avgScore !== null && recentTests && recentTests.length > 0) {
      const trendText = scoreTrend !== null ? (scoreTrend >= 0 ? `, trending up ${scoreTrend}%` : `, dropped ${Math.abs(scoreTrend)}%`) : '';
      return `Your average score is ${avgScore}%${trendText} across ${recentTests.length} tests.`;
    }
    return `You've studied ${totalToday > 0 ? `${hrs}h ${mins}m today` : 'haven\'t started today yet'}.`;
  })();

  const insightInterpretation = (() => {
    if (weakSubjects.length > 0) {
      return `${weakSubjects[0].subject} is your weakest area with ${weakSubjects[0].count} mistakes — mostly ${weakSubjects[0].topMistakeType} errors.`;
    }
    if (avgScore !== null && avgScore < 70) return 'Your scores suggest conceptual gaps that need targeted attention.';
    if (streakDays >= 3) return `Your ${streakDays}-day streak shows excellent consistency. Each day builds neural pathways.`;
    return 'Building a study habit is the most important first step. Even 15 minutes creates momentum.';
  })();

  const insightAction = weakSubjects.length > 0
    ? { text: `Focus on ${weakSubjects[0].subject} — do 20 mins of targeted practice.`, label: `Practice ${weakSubjects[0].subject}`, url: '/tests' }
    : avgScore !== null && avgScore < 70
    ? { text: 'Take a diagnostic test to pinpoint where your understanding breaks down.', label: 'Take Diagnostic', url: '/tests' }
    : { text: 'Start a focused study session to build momentum and earn XP.', label: 'Start Session', url: '/study-session' };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ═══ HERO: AI Neural Insight Panel ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
        className="relative rounded-[2rem] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsl(230 20% 10% / 0.6) 0%, hsl(230 20% 12% / 0.5) 100%)',
          backdropFilter: 'blur(60px) saturate(2)',
          border: '1px solid hsl(0 0% 100% / 0.06)',
          boxShadow: '0 24px 80px -12px hsl(0 0% 0% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.08)',
        }}
      >
        <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/[0.06] blur-[100px] -top-32 -right-32" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-secondary/[0.04] blur-[80px] -bottom-24 -left-24" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-secondary/[0.02]" />

        <div className="relative z-10 p-8 md:p-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
            <div className="flex-1 min-w-0 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/15"
                style={{ background: 'hsl(174 72% 56% / 0.08)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <Brain className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-primary uppercase tracking-widest">Neural Insight</span>
              </div>

              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground leading-tight">
                {avgScore !== null ? (
                  <span className="flex items-center gap-3">
                    {avgScore >= 70 ? `Strong progress, ${userName}` : `Building momentum, ${userName}`}
                    {scoreTrend !== null && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${
                        scoreTrend >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                      }`}>
                        {scoreTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {scoreTrend >= 0 ? '+' : ''}{scoreTrend}%
                      </span>
                    )}
                  </span>
                ) : (
                  `Welcome back, ${userName}`
                )}
              </h1>

              <div className="space-y-3 max-w-xl">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  <span className="text-muted-foreground font-medium">Observation: </span>
                  {insightObservation}
                </p>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  <span className="text-muted-foreground font-medium">Interpretation: </span>
                  {insightInterpretation}
                </p>
                <p className="text-sm text-primary/90 leading-relaxed font-medium">
                  <span className="text-muted-foreground font-medium">Action: </span>
                  {insightAction.text}
                </p>
              </div>

              {Object.keys(subjectScores).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(subjectScores).map(([sub, score]) => (
                    <motion.div
                      key={sub}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border backdrop-blur-sm ${
                        score >= 70 ? 'bg-success/8 text-success border-success/15' :
                        score >= 50 ? 'bg-warning/8 text-warning border-warning/15' :
                        'bg-destructive/8 text-destructive border-destructive/15'
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
                className="gradient-primary text-primary-foreground px-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {insightAction.label} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>

            {/* Readiness Ring */}
            <div className="flex-shrink-0 flex flex-col items-center gap-3">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-full opacity-20 blur-xl gradient-primary" />
                <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(230 15% 16% / 0.5)" strokeWidth="5" />
                  <motion.circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="url(#readiness-grad)" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - readinessScore / 100) }}
                    transition={{ duration: 1.5, delay: 0.3, ease }}
                  />
                  <defs>
                    <linearGradient id="readiness-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="hsl(174 72% 56%)" />
                      <stop offset="50%" stopColor="hsl(200 80% 50%)" />
                      <stop offset="100%" stopColor="hsl(264 67% 60%)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <span className="text-3xl font-display font-bold text-foreground tabular-nums">{avgScore ?? '—'}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Readiness</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ STATS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Trophy, label: 'Level', value: profile.level, sub: `${profile.xp % 100}/100 XP`, color: 'text-xp', bg: 'from-xp/10 to-xp/5', glow: 'shadow-xp/10' },
          { icon: Flame, label: 'Streak', value: `${streakDays}d`, sub: streakDays >= 7 ? '🔥 Unstoppable' : streakDays >= 3 ? '🔥 On fire' : 'Build it up', color: 'text-warning', bg: 'from-warning/10 to-warning/5', glow: 'shadow-warning/10' },
          { icon: Clock, label: 'Today', value: `${hrs}h ${mins}m`, sub: totalToday >= 60 ? 'Deep work' : totalToday > 0 ? 'Getting started' : 'Not yet', color: 'text-primary', bg: 'from-primary/10 to-primary/5', glow: 'shadow-primary/10' },
          { icon: Target, label: 'Avg Score', value: avgScore !== null ? `${avgScore}%` : '—', sub: `${recentTests?.length || 0} tests`, color: 'text-secondary', bg: 'from-secondary/10 to-secondary/5', glow: 'shadow-secondary/10' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.06, ease }}
            className="relative rounded-2xl p-4 card-hover cursor-default overflow-hidden group"
            style={{
              background: 'hsl(230 20% 11% / 0.5)',
              backdropFilter: 'blur(24px)',
              border: '1px solid hsl(0 0% 100% / 0.05)',
              boxShadow: '0 4px 16px hsl(0 0% 0% / 0.2)',
            }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="relative z-10 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.bg} flex items-center justify-center shadow-lg ${stat.glow}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-display font-bold text-foreground tabular-nums leading-tight">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{stat.sub}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══ LUMINA HUB SHOWCASE (for free users) ═══ */}
      {!isProPlus && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, ease }}
          className="rounded-[2rem] relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, hsl(264 30% 12% / 0.6) 0%, hsl(264 20% 10% / 0.5) 100%)',
            border: '1px solid hsl(264 67% 60% / 0.15)',
            boxShadow: '0 12px 40px -8px hsl(264 67% 60% / 0.1)',
          }}
        >
          <div className="absolute w-[400px] h-[400px] rounded-full bg-violet-500/[0.06] blur-[80px] -top-20 -right-20" />
          <div className="p-6 md:p-8 relative z-10">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-violet-400" />
                  <h2 className="text-lg font-display font-bold text-foreground">Lumina Hub — PRO+</h2>
                </div>
                <p className="text-sm text-muted-foreground">10 science-backed brain engines for ₹499/mo</p>
              </div>
              <Button
                onClick={() => window.open('https://monumental-custard-d06d45.netlify.app/#pricing', '_blank', 'noopener')}
                size="sm"
                className="shrink-0 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-primary-foreground text-xs font-semibold hover:opacity-90 px-5"
              >
                <Rocket className="w-3.5 h-3.5 mr-1.5" /> Upgrade
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { icon: Brain, label: 'Active Recall', color: 'text-violet-400' },
                { icon: Calendar, label: 'Spaced Rep', color: 'text-blue-400' },
                { icon: Shuffle, label: 'Interleaving', color: 'text-emerald-400' },
                { icon: Timer, label: 'Pomodoro', color: 'text-red-400' },
                { icon: GitBranch, label: 'Mind Maps', color: 'text-teal-400' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.06, ease }}
                  onClick={() => navigate('/hub')}
                  className="rounded-xl p-3 text-center cursor-pointer hover:bg-white/[0.03] transition-colors"
                  style={{ border: '1px solid hsl(0 0% 100% / 0.05)' }}
                >
                  <item.icon className={`w-5 h-5 ${item.color} mx-auto mb-1.5`} />
                  <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══ WEAKNESS RADAR ═══ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-display font-semibold text-foreground flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-destructive" />
            </div>
            Weakness Radar
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/weakness-radar')} className="text-primary text-xs rounded-xl hover:bg-primary/8">
            Full Analysis <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {weakSubjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {weakSubjects.map((w, i) => {
              const severity = w.count >= 10 ? 'Critical' : w.count >= 5 ? 'Needs Work' : 'Watch';
              const colors = [
                { border: 'border-l-rose-500/50', icon: 'text-rose-400', badge: 'bg-rose-500/15 text-rose-400', glow: 'from-rose-500/5' },
                { border: 'border-l-amber-500/50', icon: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-400', glow: 'from-amber-500/5' },
                { border: 'border-l-orange-500/50', icon: 'text-orange-400', badge: 'bg-orange-500/15 text-orange-400', glow: 'from-orange-500/5' },
              ];
              const c = colors[i] || colors[2];
              const subjectScore = subjectScores[w.subject];

              return (
                <motion.button
                  key={w.subject}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.1, ease }}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/tests')}
                  className={`rounded-2xl p-5 text-left border-l-[3px] ${c.border} relative overflow-hidden group cursor-pointer`}
                  style={{
                    background: 'hsl(230 20% 11% / 0.45)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid hsl(0 0% 100% / 0.05)',
                  }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${c.glow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.badge}`}>
                        <AlertTriangle className="w-3 h-3" />
                        {severity}
                      </div>
                      {subjectScore !== undefined && (
                        <span className="text-xs text-muted-foreground tabular-nums">{subjectScore}%</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors capitalize">{w.subject}</h3>
                    <p className="text-[11px] text-muted-foreground">{w.count} mistakes · {w.topMistakeType}</p>
                    <div className="mt-3 h-1 rounded-full bg-muted/15 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(w.count * 5, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease }}
                        className="h-full rounded-full bg-gradient-to-r from-destructive/60 to-destructive/30"
                      />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'hsl(230 20% 11% / 0.4)', border: '1px solid hsl(0 0% 100% / 0.05)' }}>
            <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-success" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Looking good!</p>
            <p className="text-xs text-muted-foreground">Take tests to discover areas for improvement</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/tests')} className="mt-4 rounded-xl text-xs border-border/20">
              Take a Test <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* ═══ INTELLIGENCE GRID ═══ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ease }}>
        <h2 className="text-base font-display font-semibold text-foreground mb-4 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          Intelligence Hub
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'AI Chat', desc: 'Ask anything', icon: MessageSquare, url: '/chat', gradient: 'from-primary/12 to-primary/4', iconColor: 'text-primary' },
            { name: 'Generate Test', desc: userSubjects[0] ? `Try ${userSubjects[0]}` : 'Any topic', icon: Target, url: '/tests', gradient: 'from-secondary/12 to-secondary/4', iconColor: 'text-secondary' },
            { name: 'Brain Hub', desc: '10 brain engines', icon: Brain, url: '/hub', gradient: 'from-xp/12 to-xp/4', iconColor: 'text-xp' },
            { name: 'All Tools', desc: '9 AI tools', icon: Sparkles, url: '/ai-tools', gradient: 'from-primary/8 to-secondary/8', iconColor: 'text-primary' },
          ].map((action, i) => (
            <motion.button
              key={action.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.06, ease }}
              whileHover={{ y: -3, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(action.url)}
              className="rounded-2xl p-5 text-left transition-all duration-300 group overflow-hidden relative"
              style={{
                background: 'hsl(230 20% 11% / 0.45)',
                backdropFilter: 'blur(24px)',
                border: '1px solid hsl(0 0% 100% / 0.05)',
              }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative z-10">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110`}>
                  <action.icon className={`w-5 h-5 ${action.iconColor}`} />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-0.5 group-hover:text-primary transition-colors">{action.name}</h3>
                <p className="text-[11px] text-muted-foreground/70">{action.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ═══ WEEKLY EVOLUTION ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, ease }}
        className="rounded-[1.75rem] p-6 relative overflow-hidden"
        style={{
          background: 'hsl(230 20% 11% / 0.45)',
          backdropFilter: 'blur(24px)',
          border: '1px solid hsl(0 0% 100% / 0.05)',
        }}
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-display font-semibold text-foreground flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                Weekly Evolution
              </h2>
              <p className="text-xs text-muted-foreground mt-1 ml-10">{daysStudied}/7 days · {consistency}% consistency</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/pulse')} className="text-primary text-xs rounded-xl hover:bg-primary/8">
              Analytics <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>

          <div className="flex items-end justify-between gap-2 h-28">
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
                <div key={day} className="flex flex-col items-center gap-2 flex-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.8, delay: 0.15 * i, ease }}
                    className={`w-full max-w-[36px] rounded-lg ${
                      dayMins > 0 ? 'gradient-primary shadow-lg shadow-primary/10' : 'bg-muted/15'
                    } ${today ? 'ring-2 ring-primary/25 ring-offset-2 ring-offset-background' : ''}`}
                  />
                  <span className={`text-[10px] font-medium ${today ? 'text-primary font-semibold' : 'text-muted-foreground/50'}`}>{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ═══ MARKETING SECTIONS ═══ */}
      <CTASection />
      <Testimonials />
      <FAQ />
    </div>
  );
};

export default Dashboard;
