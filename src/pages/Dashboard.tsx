/**
 * LUMINA DASHBOARD v6
 */
import { motion, useReducedMotion } from 'framer-motion';
import {
  Trophy, Flame, Target, Clock, ArrowRight, ArrowUpRight, Brain,
  Sparkles, MessageSquare, Activity, Crown, Command, Plus, ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useSubscription } from '@/hooks/useSubscription';
import { useMemo } from 'react';
import { openPricing } from '@/lib/pricing';

const EASE = [0.16, 1, 0.3, 1] as const;
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE },
});

export default function Dashboard() {
  const { profile, isLoading: profileLoading } = useProfile();
  const { user } = useAuth();
  const { seconds: liveSeconds } = useStudyTimer();
  const { isProPlus } = useSubscription();
  const navigate = useNavigate();
  const prefersReduced = useReducedMotion();
  const go = navigate;

  const safeProfile = profile ?? {
    display_name: null,
    extra_preferences: null,
    xp: 0,
    level: 1,
    streak_days: 0,
  };

  const userPrefs = useMemo(() => {
    if (!profile?.extra_preferences) return null;
    try { return JSON.parse(profile.extra_preferences as string); } catch { return null; }
  }, [profile?.extra_preferences]);

  const rawName = (safeProfile.display_name?.split(' ')[0]?.trim() || user?.email?.split('@')[0]?.trim() || '').trim();
  const userName = !rawName || /^(lumina|user|student|guest|test|admin|scholar)$/i.test(rawName) ? 'Scholar' : rawName;
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
    queryKey: ['recent-tests', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('tests').select('score, subject, created_at').eq('user_id', user!.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(10);
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
    queryKey: ['mistakes', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('mistakes').select('topic, subject, mistake_type').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  const streakDays = safeProfile.streak_days || 0;

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

  const weakSubjects = useMemo(() => {
    if (!mistakeData?.length) return [];
    const counts: Record<string, { count: number; types: Record<string, number> }> = {};
    mistakeData.forEach(m => {
      const sub = m.subject || 'General';
      if (!counts[sub]) counts[sub] = { count: 0, types: {} };
      counts[sub].count++;
      counts[sub].types[m.mistake_type || 'conceptual'] = (counts[sub].types[m.mistake_type || 'conceptual'] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 3)
      .map(([subject, data]) => ({ subject, count: data.count, topMistakeType: Object.entries(data.types).sort((a, b) => b[1] - a[1])[0]?.[0] || 'conceptual' }));
  }, [mistakeData]);

  const liveMin = Math.floor(liveSeconds / 60);
  const totalToday = (todayMinutes || 0) + liveMin;
  const hrs = Math.floor(totalToday / 60);
  const mins = totalToday % 60;
  const avgScore = recentTests?.length ? Math.round(recentTests.reduce((s, t) => s + (t.score || 0), 0) / recentTests.length) : null;
  const readiness = avgScore ?? 0;

  const h = new Date().getHours();
  const greeting = h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Welcome back';

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyData = dayLabels.map((label, i) => {
    const targetDay = (i + 1) % 7;
    const dm = weeklyMinutes?.filter(s => new Date(s.started_at).getDay() === targetDay)
      .reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0;
    return { label, minutes: dm };
  });
  const maxMin = Math.max(...weeklyData.map(d => d.minutes), 60);
  const daysStudied = weeklyData.filter(d => d.minutes > 0).length;
  const consistency = Math.round((daysStudied / 7) * 100);

  const stats = [
    { icon: Trophy, label: 'Level', value: String(safeProfile.level), sub: profileLoading && !profile ? 'syncing XP' : `${safeProfile.xp % 100} / 100 XP`, accent: 'var(--amber)' },
    { icon: Flame, label: 'Streak', value: String(streakDays), sub: streakDays === 1 ? 'day' : 'days', accent: '#f97316' },
    { icon: Clock, label: 'Today', value: totalToday > 0 ? (hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`) : '0m', sub: totalToday >= 60 ? 'deep work' : 'studying', accent: 'var(--teal)' },
    { icon: Target, label: 'Readiness', value: avgScore !== null ? `${avgScore}%` : '\u2014', sub: `${recentTests?.length || 0} tests`, accent: 'var(--brand-glow)' },
  ];

  const C = 2 * Math.PI * 42;

  return (
    <div className="dash6">
      <div className="dash6-aurora" aria-hidden />

      <motion.header {...fadeUp(0)} className="dash6-top">
        <div className="dash6-breadcrumb">
          <span className="dash6-breadcrumb-dot" />
          <span className="dash6-breadcrumb-text">Workspace</span>
          <ChevronRight className="w-3 h-3 dash6-breadcrumb-sep" />
          <span className="dash6-breadcrumb-current">Dashboard</span>
        </div>
        <div className="dash6-top-actions">
          <span className="dash6-date">{todayStr}</span>
          <button className="dash6-cmd-btn" onClick={() => go('/chat')}>
            <Command className="w-3.5 h-3.5" />
            <span className="dash6-cmd-label">Ask Lumina</span>
            <kbd className="dash6-cmd-kbd">{'\u2318'}K</kbd>
          </button>
        </div>
      </motion.header>

      <motion.section {...fadeUp(0.05)} className="dash6-hero">
        <div className="dash6-hero-content">
          <span className="dash6-eyebrow">
            <span className="dash6-pulse-dot" />
            Neural insight {'\u00b7'} live
          </span>
          <h1 className="dash6-title">
            {greeting}, <em className="dash6-title-em">{userName}</em>.
          </h1>
          <p className="dash6-subtitle">
            {avgScore !== null && recentTests?.length
              ? <>You{'\u2019'}re averaging <strong>{avgScore}%</strong> across <strong>{recentTests.length}</strong> recent tests.{weakSubjects[0] ? <> The gap sits in <strong>{weakSubjects[0].subject}</strong> {'\u2014'} let{'\u2019'}s close it.</> : ' Momentum is yours.'}</>
              : totalToday > 0
                ? <>You{'\u2019'}ve put in <strong>{hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}</strong> today. Quiet, consistent work compounds.</>
                : <>A fresh canvas. The smallest first move beats the perfect one tomorrow.</>}
          </p>
          <div className="dash6-cta-row">
            <Button onClick={() => go(weakSubjects.length ? '/tests' : '/study-session')} className="dash6-btn-primary">
              {weakSubjects.length ? `Practice ${weakSubjects[0].subject}` : 'Start a session'}
              <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Button>
            <Button onClick={() => go('/chat')} variant="ghost" className="dash6-btn-ghost">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New thread
            </Button>
          </div>
        </div>
        <div className="dash6-gauge">
          <svg viewBox="0 0 100 100" className="dash6-gauge-svg">
            <defs>
              <linearGradient id="dash6-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#A78BFA" />
                <stop offset="100%" stopColor="#2DD4BF" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="42" className="dash6-gauge-track" />
            <motion.circle
              cx="50" cy="50" r="42"
              className="dash6-gauge-fill"
              strokeDasharray={`${C}`}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: C * (1 - readiness / 100) }}
              transition={{ duration: prefersReduced ? 0 : 1.4, delay: 0.3, ease: EASE }}
            />
          </svg>
          <div className="dash6-gauge-center">
            <span className="dash6-gauge-value">{avgScore !== null ? avgScore : '\u2014'}</span>
            <span className="dash6-gauge-label">Readiness</span>
          </div>
        </div>
      </motion.section>

      <motion.section {...fadeUp(0.1)} className="dash6-kpis">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 + i * 0.05, ease: EASE }} className="dash6-kpi">
            <div className="dash6-kpi-icon" style={{ background: `${s.accent}15`, color: s.accent }}>
              <s.icon className="w-4 h-4" />
            </div>
            <span className="dash6-kpi-label">{s.label}</span>
            <span className="dash6-kpi-value">{s.value}</span>
            <span className="dash6-kpi-sub">{s.sub}</span>
          </motion.div>
        ))}
      </motion.section>

      <div className="dash6-cols">
        <motion.section {...fadeUp(0.15)} className="dash6-card">
          <header className="dash6-card-header">
            <div>
              <h3 className="dash6-card-title">Mastery</h3>
              <p className="dash6-card-desc">Across your tracked subjects</p>
            </div>
            <button onClick={() => go('/weakness-radar')} className="dash6-link">
              Radar <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </header>
          {Object.keys(subjectScores).length > 0 ? (
            <div className="dash6-mastery">
              {Object.entries(subjectScores).slice(0, 5).map(([sub, score], i) => (
                <motion.button key={sub} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.5 }}
                  onClick={() => go('/weakness-radar')} className="dash6-mastery-row">
                  <span className="dash6-mastery-name">{sub}</span>
                  <div className="dash6-mastery-track">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }}
                      transition={{ duration: 1, delay: 0.3 + i * 0.06, ease: EASE }}
                      className={`dash6-mastery-fill ${score >= 75 ? 'is-high' : score >= 50 ? 'is-mid' : 'is-low'}`} />
                  </div>
                  <span className="dash6-mastery-pct">{score}%</span>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="dash6-empty">
              <p>No tests yet. Generate one to see your mastery surface here.</p>
              <button onClick={() => go('/tests')} className="dash6-link mt-3">
                Take a test <ArrowRight className="w-3 h-3 ml-1" />
              </button>
            </div>
          )}
        </motion.section>

        <motion.section {...fadeUp(0.18)} className="dash6-card">
          <header className="dash6-card-header">
            <div>
              <h3 className="dash6-card-title">Today{'\u2019'}s plan</h3>
              <p className="dash6-card-desc">Quiet wins, in order</p>
            </div>
            <span className="dash6-badge"><Sparkles className="w-3 h-3" /> auto</span>
          </header>
          <ul className="dash6-plan">
            {[
              { l: weakSubjects[0] ? `Practice ${weakSubjects[0].subject}` : 'Warm-up: 5 flashcards', t: '20m', u: '/tests' },
              { l: 'Review yesterday\u2019s mistakes', t: '10m', u: '/weakness-radar' },
              { l: 'One focused study session', t: '25m', u: '/study-session' },
            ].map((x, i) => (
              <li key={i}>
                <button onClick={() => go(x.u)} className="dash6-plan-row">
                  <span className="dash6-plan-dot" />
                  <span className="dash6-plan-label">{x.l}</span>
                  <span className="dash6-plan-time">{x.t}</span>
                  <ChevronRight className="w-3.5 h-3.5 dash6-plan-arrow" />
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      </div>

      <motion.section {...fadeUp(0.22)} className="dash6-card">
        <header className="dash6-card-header">
          <div>
            <h3 className="dash6-card-title">This week</h3>
            <p className="dash6-card-desc">{daysStudied} of 7 days {'\u00b7'} {consistency}% consistency</p>
          </div>
          <button onClick={() => go('/performance')} className="dash6-link">
            Performance <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </button>
        </header>
        <div className="dash6-chart">
          {weeklyData.map((d, i) => {
            const pct = (d.minutes / maxMin) * 100;
            const isToday = i === ((new Date().getDay() + 6) % 7);
            return (
              <div key={d.label + i} className="dash6-chart-col">
                <div className="dash6-chart-track">
                  <motion.div initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct, d.minutes > 0 ? 6 : 0)}%` }}
                    transition={{ duration: 0.8, delay: 0.25 + i * 0.05, ease: EASE }}
                    className={`dash6-chart-bar ${isToday ? 'is-today' : ''}`} />
                </div>
                <span className={`dash6-chart-label ${isToday ? 'is-today' : ''}`}>{d.label}</span>
              </div>
            );
          })}
        </div>
      </motion.section>

      {!isProPlus && (
        <motion.section {...fadeUp(0.26)} className="dash6-upgrade">
          <div className="dash6-upgrade-left">
            <div className="dash6-upgrade-icon"><Crown className="w-4 h-4" /></div>
            <div>
              <h4 className="dash6-upgrade-title">Lumina PRO+</h4>
              <p className="dash6-upgrade-desc">Unlock 10 neurocognitive engines {'\u00b7'} {'\u20b9'}499/mo</p>
            </div>
          </div>
          <Button onClick={openPricing} className="dash6-btn-primary">
            Upgrade <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </motion.section>
      )}

      <motion.section {...fadeUp(0.3)}>
        <header className="dash6-section-header">
          <div>
            <h3 className="dash6-section-title">Where to focus</h3>
            <p className="dash6-section-desc">Top patterns from your recent work</p>
          </div>
          <button onClick={() => go('/weakness-radar')} className="dash6-link">
            Full analysis <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </button>
        </header>
        {weakSubjects.length > 0 ? (
          <div className="dash6-weak-grid">
            {weakSubjects.map((w, i) => (
              <motion.button key={w.subject} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.06, duration: 0.5 }}
                onClick={() => go('/tests')} className="dash6-weak-card">
                <div className="dash6-weak-header">
                  <span className={`dash6-weak-tag ${w.count >= 10 ? 'is-critical' : w.count >= 5 ? 'is-warning' : 'is-watch'}`}>
                    <Activity className="w-3 h-3" />
                    {w.count >= 10 ? 'Critical' : w.count >= 5 ? 'Needs work' : 'Watch'}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 dash6-weak-arrow" />
                </div>
                <h4 className="dash6-weak-title">{w.subject}</h4>
                <p className="dash6-weak-desc">{w.count} mistakes {'\u00b7'} mostly {w.topMistakeType}</p>
                <div className="dash6-weak-track">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(w.count * 5, 100)}%` }}
                    transition={{ duration: 1, delay: 0.45 + i * 0.06, ease: EASE }}
                    className="dash6-weak-fill" />
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="dash6-card dash6-empty-card">
            <TrendingUp className="w-5 h-5 mb-2 dash6-empty-icon" />
            <p className="dash6-empty-title">All clear, for now.</p>
            <p className="dash6-empty-desc">Take a test to surface what to sharpen next.</p>
          </div>
        )}
      </motion.section>

      <motion.section {...fadeUp(0.34)}>
        <header className="dash6-section-header">
          <div>
            <h3 className="dash6-section-title">Quick actions</h3>
            <p className="dash6-section-desc">Jump into your tools</p>
          </div>
        </header>
        <div className="dash6-actions">
          {[
            { n: 'AI Chat', d: 'Ask anything', i: MessageSquare, u: '/chat' },
            { n: 'Generate Test', d: userSubjects[0] ? `Try ${userSubjects[0]}` : 'Any topic', i: Target, u: '/tests' },
            { n: 'Brain Hub', d: '10 engines', i: Brain, u: '/hub' },
            { n: 'All Tools', d: '9 AI tools', i: Sparkles, u: '/ai-tools' },
          ].map((a, i) => (
            <motion.button key={a.n} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.05, duration: 0.45 }}
              onClick={() => go(a.u)} className="dash6-action">
              <div className="dash6-action-icon"><a.i className="w-4 h-4" /></div>
              <div className="dash6-action-text">
                <span className="dash6-action-name">{a.n}</span>
                <span className="dash6-action-desc">{a.d}</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 dash6-action-arrow" />
            </motion.button>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
