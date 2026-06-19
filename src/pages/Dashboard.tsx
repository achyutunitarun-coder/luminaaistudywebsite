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
import { useMemo, useState, useEffect } from 'react';
import { openPricing } from '@/lib/pricing';
import { OnboardingTutorial } from '@/components/OnboardingTutorial';

const ease = [0.25, 0.1, 0.25, 1] as const;

const Dashboard = () => {
  const { profile, xpForNextLevel } = useProfile();
  const { user } = useAuth();
  const { seconds: liveSeconds } = useStudyTimer();
  const { isPro, isProPlus } = useSubscription();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (profile && !profile.extra_preferences) {
      setShowOnboarding(true);
    }
  }, [profile]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const userPrefs = useMemo(() => {
    if (!profile?.extra_preferences) return null;
    try { return JSON.parse(profile.extra_preferences as string); } catch { return null; }
  }, [profile?.extra_preferences]);

  const emailName = user?.email?.split('@')[0]?.trim() || '';
  const rawName = (profile?.display_name?.split(' ')[0]?.trim() || emailName).trim();
  const isGenericName = !rawName || /^(lumina|user|student|guest|test|admin|scholar)$/i.test(rawName);
  const userName = isGenericName ? 'back' : rawName;
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

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <>
    <div className="page-container space-y-8">

      {/* ─── HEADER ─── */}
      <div>
        <p className="text-sm text-[var(--text-secondary)]">{getGreeting()}, {userName}.</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Here's where you stand.</p>
      </div>

      {/* ─── NEURAL INSIGHT CARD ─── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="rounded-[var(--r-xl)] overflow-hidden border border-[var(--border-subtle)]"
        style={{ background: 'var(--bg-surface)' }}
      >
        <div className="p-8 md:p-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
            <div className="flex-1 min-w-0 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-subtle)]" style={{ background: 'var(--bg-elevated)' }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--teal)' }} />
                <Brain className="w-3.5 h-3.5" style={{ color: 'var(--teal)' }} />
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--teal)' }}>Neural Insight</span>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                {avgScore !== null ? (
                  <span className="flex items-center gap-3 flex-wrap">
                    {avgScore >= 70 ? `Strong progress, ${userName}` : `Building momentum, ${userName}`}
                    {scoreTrend !== null && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${scoreTrend >= 0 ? 'badge-green' : 'badge-red'}`}>
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
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-muted)' }} className="font-medium">Observation: </span>
                  {insightObservation}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-muted)' }} className="font-medium">Interpretation: </span>
                  {insightInterpretation}
                </p>
                <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--teal)' }}>
                  <span style={{ color: 'var(--text-muted)' }} className="font-medium">Action: </span>
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
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                        score >= 70 ? 'badge-green' : score >= 50 ? 'badge-amber' : 'badge-red'
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
                className="btn-primary px-6"
              >
                {insightAction.label} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>

            {/* Readiness Ring */}
            <div className="flex-shrink-0 flex flex-col items-center gap-3">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-faint)" strokeWidth="5" />
                  <motion.circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="url(#readiness-grad)" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - readinessScore / 100) }}
                    transition={{ duration: 1.2, delay: 0.3, ease }}
                  />
                  <defs>
                    <linearGradient id="readiness-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--teal)" />
                      <stop offset="50%" stopColor="var(--brand)" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{avgScore ?? '—'}</span>
                  <span className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>Readiness</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── STATS ROW ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Trophy, label: 'Level', value: profile.level, sub: `${profile.xp % 100}/100 XP`, color: 'var(--amber)', bg: 'var(--amber-tint)' },
          { icon: Flame, label: 'Streak', value: `${streakDays}d`, sub: streakDays >= 7 ? '🔥 Unstoppable' : streakDays >= 3 ? '🔥 On fire' : 'Build it up', color: '#fb923c', bg: 'rgba(251,146,60,0.08)' },
          { icon: Clock, label: 'Today', value: `${hrs}h ${mins}m`, sub: totalToday >= 60 ? 'Deep work' : totalToday > 0 ? 'Getting started' : 'Not yet', color: 'var(--teal)', bg: 'var(--teal-tint)' },
          { icon: Target, label: 'Avg Score', value: avgScore !== null ? `${avgScore}%` : '—', sub: `${recentTests?.length || 0} tests`, color: 'var(--brand)', bg: 'var(--brand-tint)' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.06, ease }}
            className="stat-card"
          >
            <div className="flex items-center gap-3">
              <div className="stat-card-icon" style={{ background: stat.bg }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="stat-card-label">{stat.label}</p>
                <p className="stat-card-value">{stat.value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.sub}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── 2/3 + 1/3 ROW ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Mastery Map */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, ease }}
          className="rounded-[var(--r-lg)] p-6 border border-[var(--border-subtle)]"
          style={{ background: 'var(--bg-surface)' }}
        >
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Layers className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            Mastery Map
          </h2>
          {Object.keys(subjectScores).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(subjectScores).map(([sub, score]) => (
                <button
                  key={sub}
                  onClick={() => navigate('/weakness-radar')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:scale-[1.02]"
                  style={{
                    background: score >= 70 ? 'var(--green-tint)' : score >= 50 ? 'var(--amber-tint)' : 'var(--red-tint)',
                    color: score >= 70 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)',
                    borderColor: score >= 70 ? 'rgba(52,211,153,0.2)' : score >= 50 ? 'rgba(245,158,11,0.2)' : 'rgba(248,113,113,0.2)',
                  }}
                >
                  <span className="capitalize">{sub}</span>
                  <span className="font-bold tabular-nums">{score}%</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Take tests to see your mastery map</p>
              <Button variant="ghost" size="sm" onClick={() => navigate('/tests')} className="mt-2 text-xs">
                Take a Test <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
        </motion.div>

        {/* Today's Plan */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, ease }}
          className="rounded-[var(--r-lg)] p-6 border border-[var(--border-subtle)]"
          style={{ background: 'var(--bg-surface)' }}
        >
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Zap className="w-4 h-4" style={{ color: 'var(--amber)' }} />
            Today's Plan
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Practice weak areas', time: '20 min', color: 'var(--red)' },
              { label: 'Review flashcards', time: '10 min', color: 'var(--teal)' },
              { label: 'Take a quiz', time: '15 min', color: 'var(--brand)' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-faint)]" style={{ background: 'var(--bg-elevated)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                </div>
                <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{item.time}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─── LUMINA HUB SHOWCASE (for free users) ─── */}
      {!isProPlus && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, ease }}
          className="rounded-[var(--r-xl)] p-6 border"
          style={{ background: 'var(--brand-tint)', borderColor: 'var(--border-brand)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5" style={{ color: 'var(--brand-glow)' }} />
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Lumina Hub — PRO+</h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>10 science-backed brain engines for ₹499/mo</p>
            </div>
            <Button
              onClick={openPricing}
              size="sm"
              className="shrink-0 rounded-xl text-xs font-semibold hover:opacity-90 px-5"
              style={{ background: 'var(--brand)', color: '#fff' }}
            >
              <Rocket className="w-3.5 h-3.5 mr-1.5" /> Upgrade
            </Button>
          </div>
        </motion.div>
      )}

      {/* ─── WEAKNESS RADAR ─── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--red-tint)' }}>
              <Activity className="w-4 h-4" style={{ color: 'var(--red)' }} />
            </div>
            Weakness Radar
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/weakness-radar')} className="text-xs rounded-xl" style={{ color: 'var(--teal)' }}>
            Full Analysis <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {weakSubjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {weakSubjects.map((w, i) => {
              const severity = w.count >= 10 ? 'Critical' : w.count >= 5 ? 'Needs Work' : 'Watch';
              const colors = [
                { border: 'rgba(248,113,113,0.4)', icon: 'var(--red)', badge: 'var(--red-tint)' },
                { border: 'rgba(251,191,36,0.4)', icon: 'var(--amber)', badge: 'var(--amber-tint)' },
                { border: 'rgba(251,146,60,0.4)', icon: '#fb923c', badge: 'rgba(251,146,60,0.12)' },
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
                  className="rounded-[var(--r-lg)] p-5 text-left border-l-[3px] relative overflow-hidden group cursor-pointer border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-all"
                  style={{ background: 'var(--bg-surface)', borderLeftColor: c.border }}
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: c.badge, color: c.icon }}>
                        <AlertTriangle className="w-3 h-3" />
                        {severity}
                      </div>
                      {subjectScore !== undefined && (
                        <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{subjectScore}%</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold mb-1 group-hover:text-[var(--teal)] transition-colors capitalize" style={{ color: 'var(--text-primary)' }}>{w.subject}</h3>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{w.count} mistakes · {w.topMistakeType}</p>
                    <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-faint)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(w.count * 5, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease }}
                        className="h-full rounded-full"
                        style={{ background: c.icon }}
                      />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[var(--r-lg)] p-8 text-center border border-[var(--border-subtle)]" style={{ background: 'var(--bg-surface)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--green-tint)' }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--green)' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Looking good!</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Take tests to discover areas for improvement</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/tests')} className="mt-4 rounded-xl text-xs" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
              Take a Test <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* ─── INTELLIGENCE GRID ─── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ease }}>
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-tint)' }}>
            <Zap className="w-4 h-4" style={{ color: 'var(--brand)' }} />
          </div>
          Intelligence Hub
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'AI Chat', desc: 'Ask anything', icon: MessageSquare, url: '/chat', color: 'var(--teal)' },
            { name: 'Generate Test', desc: userSubjects[0] ? `Try ${userSubjects[0]}` : 'Any topic', icon: Target, url: '/tests', color: 'var(--brand)' },
            { name: 'Brain Hub', desc: '10 brain engines', icon: Brain, url: '/hub', color: 'var(--amber)' },
            { name: 'All Tools', desc: '9 AI tools', icon: Sparkles, url: '/ai-tools', color: '#38bdf8' },
          ].map((action, i) => (
            <motion.button
              key={action.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.06, ease }}
              whileHover={{ y: -3, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(action.url)}
              className="rounded-[var(--r-lg)] p-5 text-left transition-all duration-300 group overflow-hidden relative border border-[var(--border-subtle)] hover:border-[var(--border-default)]"
              style={{ background: 'var(--bg-surface)' }}
            >
              <div className="relative z-10">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110" style={{ background: `${action.color}15`, border: `1px solid ${action.color}25` }}>
                  <action.icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <h3 className="font-semibold text-sm mb-0.5 group-hover:text-[var(--teal)] transition-colors" style={{ color: 'var(--text-primary)' }}>{action.name}</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{action.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ─── WEEKLY EVOLUTION ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, ease }}
        className="rounded-[var(--r-lg)] p-6 border border-[var(--border-subtle)]"
        style={{ background: 'var(--bg-surface)' }}
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--teal-tint)' }}>
                  <BarChart3 className="w-4 h-4" style={{ color: 'var(--teal)' }} />
                </div>
                Weekly Evolution
              </h2>
              <p className="text-xs mt-1 ml-10" style={{ color: 'var(--text-muted)' }}>{daysStudied}/7 days · {consistency}% consistency</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/pulse')} className="text-xs rounded-xl" style={{ color: 'var(--teal)' }}>
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
                    className={`w-full max-w-[36px] rounded-lg ${today ? 'ring-2 ring-offset-2' : ''}`}
                    style={{
                      background: dayMins > 0 ? 'linear-gradient(to top, var(--teal), var(--brand))' : 'var(--border-faint)',
                      ['--tw-ring-color' as any]: 'rgba(45,212,191,0.25)',
                      ['--tw-ring-offset-color' as any]: 'var(--bg-surface)',
                    }}
                  />
                  <span className={`text-[10px] font-medium ${today ? 'font-semibold' : ''}`} style={{ color: today ? 'var(--teal)' : 'var(--text-muted)' }}>{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ─── MARKETING SECTIONS ─── */}
      <CTASection />
      <Testimonials />
      <FAQ />
    </div>

    {/* Onboarding Tutorial */}
    {showOnboarding && <OnboardingTutorial onComplete={handleOnboardingComplete} />}
    </>
  );
};

export default Dashboard;
