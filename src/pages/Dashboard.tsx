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

  return (
    <>
    <div className="max-w-6xl mx-auto space-y-6 p-6">

      {/* ═══ HERO ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06]"
        style={{ background: '#0a0a10' }}
      >
        <div className="p-8 md:p-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
            <div className="flex-1 min-w-0 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-400/15 bg-teal-400/[0.08]">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <Brain className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-widest">Neural Insight</span>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                {avgScore !== null ? (
                  <span className="flex items-center gap-3 flex-wrap">
                    {avgScore >= 70 ? `Strong progress, ${userName}` : `Building momentum, ${userName}`}
                    {scoreTrend !== null && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${
                        scoreTrend >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
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
                <p className="text-sm text-gray-400 leading-relaxed">
                  <span className="text-gray-500 font-medium">Observation: </span>
                  {insightObservation}
                </p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  <span className="text-gray-500 font-medium">Interpretation: </span>
                  {insightInterpretation}
                </p>
                <p className="text-sm text-teal-400/90 leading-relaxed font-medium">
                  <span className="text-gray-500 font-medium">Action: </span>
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
                        score >= 70 ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15' :
                        score >= 50 ? 'bg-amber-500/8 text-amber-400 border-amber-500/15' :
                        'bg-red-500/8 text-red-400 border-red-500/15'
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
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
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
                      <stop offset="0%" stopColor="#2dd4bf" />
                      <stop offset="50%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <span className="text-3xl font-bold text-white tabular-nums">{avgScore ?? '—'}</span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Readiness</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ STATS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Trophy, label: 'Level', value: profile.level, sub: `${profile.xp % 100}/100 XP`, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
          { icon: Flame, label: 'Streak', value: `${streakDays}d`, sub: streakDays >= 7 ? '🔥 Unstoppable' : streakDays >= 3 ? '🔥 On fire' : 'Build it up', color: '#fb923c', bg: 'rgba(251,146,60,0.08)' },
          { icon: Clock, label: 'Today', value: `${hrs}h ${mins}m`, sub: totalToday >= 60 ? 'Deep work' : totalToday > 0 ? 'Getting started' : 'Not yet', color: '#2dd4bf', bg: 'rgba(45,212,191,0.08)' },
          { icon: Target, label: 'Avg Score', value: avgScore !== null ? `${avgScore}%` : '—', sub: `${recentTests?.length || 0} tests`, color: '#a855f7', bg: 'rgba(168,85,247,0.08)' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.06, ease }}
            className="rounded-2xl p-5 border border-white/[0.04] cursor-default overflow-hidden group hover:border-white/[0.08] transition-all"
            style={{ background: '#0a0a10' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: stat.bg, border: `1px solid ${stat.color}20` }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-bold text-white tabular-nums leading-tight">{stat.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{stat.sub}</p>
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
          className="rounded-2xl relative overflow-hidden border border-white/[0.04]"
          style={{ background: '#0a0a10' }}
        >
          <div className="p-6 md:p-8 relative z-10">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-violet-400" />
                  <h2 className="text-lg font-bold text-white">Lumina Hub — PRO+</h2>
                </div>
                <p className="text-sm text-gray-400">10 science-backed brain engines for ₹499/mo</p>
              </div>
              <Button
                onClick={openPricing}
                size="sm"
                className="shrink-0 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-semibold hover:opacity-90 px-5"
              >
                <Rocket className="w-3.5 h-3.5 mr-1.5" /> Upgrade
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { icon: Brain, label: 'Active Recall', color: '#a855f7' },
                { icon: Calendar, label: 'Spaced Rep', color: '#38bdf8' },
                { icon: Shuffle, label: 'Interleaving', color: '#34d399' },
                { icon: Timer, label: 'Pomodoro', color: '#f87171' },
                { icon: GitBranch, label: 'Mind Maps', color: '#2dd4bf' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.06, ease }}
                  onClick={() => navigate('/hub')}
                  className="rounded-xl p-3 text-center cursor-pointer hover:bg-white/[0.03] transition-colors border border-white/[0.04]"
                >
                  <item.icon className="w-5 h-5 mx-auto mb-1.5" style={{ color: item.color }} />
                  <p className="text-[10px] text-gray-400 font-medium">{item.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══ WEAKNESS RADAR ═══ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-red-400" />
            </div>
            Weakness Radar
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/weakness-radar')} className="text-teal-400 text-xs rounded-xl hover:bg-teal-400/8">
            Full Analysis <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {weakSubjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {weakSubjects.map((w, i) => {
              const severity = w.count >= 10 ? 'Critical' : w.count >= 5 ? 'Needs Work' : 'Watch';
              const colors = [
                { border: 'rgba(248,113,113,0.3)', icon: '#f87171', badge: 'rgba(248,113,113,0.12)', glow: 'rgba(248,113,113,0.04)' },
                { border: 'rgba(251,191,36,0.3)', icon: '#fbbf24', badge: 'rgba(251,191,36,0.12)', glow: 'rgba(251,191,36,0.04)' },
                { border: 'rgba(251,146,60,0.3)', icon: '#fb923c', badge: 'rgba(251,146,60,0.12)', glow: 'rgba(251,146,60,0.04)' },
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
                  className="rounded-2xl p-5 text-left border-l-[3px] relative overflow-hidden group cursor-pointer border border-white/[0.04] hover:border-white/[0.08] transition-all"
                  style={{ background: '#0a0a10', borderLeftColor: c.border }}
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold`} style={{ background: c.badge, color: c.icon }}>
                        <AlertTriangle className="w-3 h-3" />
                        {severity}
                      </div>
                      {subjectScore !== undefined && (
                        <span className="text-xs text-gray-500 tabular-nums">{subjectScore}%</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-teal-400 transition-colors capitalize">{w.subject}</h3>
                    <p className="text-[11px] text-gray-500">{w.count} mistakes · {w.topMistakeType}</p>
                    <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(w.count * 5, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${c.icon}99, ${c.icon}33)` }}
                      />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl p-8 text-center border border-white/[0.04]" style={{ background: '#0a0a10' }}>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-white mb-1">Looking good!</p>
            <p className="text-xs text-gray-500">Take tests to discover areas for improvement</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/tests')} className="mt-4 rounded-xl text-xs border-white/[0.08] text-gray-400 hover:text-white">
              Take a Test <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* ═══ INTELLIGENCE GRID ═══ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ease }}>
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-400/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-teal-400" />
          </div>
          Intelligence Hub
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'AI Chat', desc: 'Ask anything', icon: MessageSquare, url: '/chat', color: '#2dd4bf' },
            { name: 'Generate Test', desc: userSubjects[0] ? `Try ${userSubjects[0]}` : 'Any topic', icon: Target, url: '/tests', color: '#a855f7' },
            { name: 'Brain Hub', desc: '10 brain engines', icon: Brain, url: '/hub', color: '#fbbf24' },
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
              className="rounded-2xl p-5 text-left transition-all duration-300 group overflow-hidden relative border border-white/[0.04] hover:border-white/[0.08]"
              style={{ background: '#0a0a10' }}
            >
              <div className="relative z-10">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110" style={{ background: `${action.color}12`, border: `1px solid ${action.color}25` }}>
                  <action.icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <h3 className="font-semibold text-white text-sm mb-0.5 group-hover:text-teal-400 transition-colors">{action.name}</h3>
                <p className="text-[11px] text-gray-500">{action.desc}</p>
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
        className="rounded-2xl p-6 relative overflow-hidden border border-white/[0.04]"
        style={{ background: '#0a0a10' }}
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-400/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-teal-400" />
                </div>
                Weekly Evolution
              </h2>
              <p className="text-xs text-gray-500 mt-1 ml-10">{daysStudied}/7 days · {consistency}% consistency</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/pulse')} className="text-teal-400 text-xs rounded-xl hover:bg-teal-400/8">
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
                      dayMins > 0 ? '' : ''
                    } ${today ? 'ring-2 ring-teal-400/25 ring-offset-2' : ''}`}
                    style={{
                      background: dayMins > 0
                        ? 'linear-gradient(to top, #2dd4bf, #a855f7)'
                        : 'rgba(255,255,255,0.04)',
                      ringOffsetColor: '#0a0a10',
                    }}
                  />
                  <span className={`text-[10px] font-medium ${today ? 'text-teal-400 font-semibold' : 'text-gray-600'}`}>{day}</span>
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

    {/* Onboarding Tutorial */}
    {showOnboarding && <OnboardingTutorial onComplete={handleOnboardingComplete} />}
    </>
  );
};

export default Dashboard;
