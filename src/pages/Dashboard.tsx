/**
 * LUMINA DASHBOARD — v4
 * Linear / Notion / Vercel-grade. Cinematic, restrained, precise.
 */
import { motion, useReducedMotion } from "framer-motion";
import {
  Trophy, Flame, Target, Clock, ArrowRight, ArrowUpRight, Brain,
  Sparkles, MessageSquare, Activity, Crown, Command, Plus,
  CircleDot, TrendingUp, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useStudyTimer } from "@/hooks/useStudyTimer";
import { useSubscription } from "@/hooks/useSubscription";
import { useMemo, useState, useEffect } from "react";
import { openPricing } from "@/lib/pricing";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";

const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE },
});

export default function Dashboard() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { seconds: liveSeconds } = useStudyTimer();
  const { isProPlus } = useSubscription();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (profile && !profile.extra_preferences) setShowOnboarding(true);
  }, [profile]);

  const userPrefs = useMemo(() => {
    if (!profile?.extra_preferences) return null;
    try { return JSON.parse(profile.extra_preferences as string); } catch { return null; }
  }, [profile?.extra_preferences]);

  const rawName = (profile?.display_name?.split(" ")[0]?.trim() || user?.email?.split("@")[0]?.trim() || "").trim();
  const userName = !rawName || /^(lumina|user|student|guest|test|admin|scholar)$/i.test(rawName) ? "Scholar" : rawName;
  const userSubjects = userPrefs?.subjects || [];

  const { data: todayMinutes } = useQuery({
    queryKey: ["today-study-minutes", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase.from("study_sessions").select("duration_minutes").eq("user_id", user!.id).gte("started_at", today);
      return data?.reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0;
    },
    enabled: !!user,
  });

  const { data: recentTests } = useQuery({
    queryKey: ["recent-tests", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("tests").select("score, subject, created_at").eq("user_id", user!.id).eq("status", "completed").order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: weeklyMinutes } = useQuery({
    queryKey: ["weekly-study-minutes", user?.id],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase.from("study_sessions").select("duration_minutes, started_at").eq("user_id", user!.id).gte("started_at", weekAgo);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: mistakeData } = useQuery({
    queryKey: ["mistakes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("mistakes").select("topic, subject, mistake_type").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  const streakDays = profile?.streak_days || 0;

  const subjectScores = useMemo(() => {
    if (!recentTests?.length) return {};
    const map: Record<string, { total: number; count: number }> = {};
    recentTests.forEach(t => {
      const sub = t.subject || "General";
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
      const sub = m.subject || "General";
      if (!counts[sub]) counts[sub] = { count: 0, types: {} };
      counts[sub].count++;
      counts[sub].types[m.mistake_type || "conceptual"] = (counts[sub].types[m.mistake_type || "conceptual"] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 3)
      .map(([subject, data]) => ({ subject, count: data.count, topMistakeType: Object.entries(data.types).sort((a, b) => b[1] - a[1])[0]?.[0] || "conceptual" }));
  }, [mistakeData]);

  if (!profile) return null;

  const liveMin = Math.floor(liveSeconds / 60);
  const totalToday = (todayMinutes || 0) + liveMin;
  const hrs = Math.floor(totalToday / 60);
  const mins = totalToday % 60;
  const avgScore = recentTests?.length ? Math.round(recentTests.reduce((s, t) => s + (t.score || 0), 0) / recentTests.length) : null;
  const readiness = avgScore ?? 0;

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Welcome back";
  };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Weekly chart data
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
    { icon: Trophy, label: "Level", value: String(profile.level), sub: `${profile.xp % 100} / 100 XP`, accent: "text-[var(--brand-glow)]" },
    { icon: Flame, label: "Streak", value: String(streakDays), sub: streakDays === 1 ? "day" : "days", accent: "text-[var(--amber)]" },
    { icon: Clock, label: "Today", value: totalToday > 0 ? (hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`) : "0m", sub: totalToday >= 60 ? "deep work" : "studying", accent: "text-[var(--teal)]" },
    { icon: Target, label: "Avg Score", value: avgScore !== null ? `${avgScore}%` : "—", sub: `${recentTests?.length || 0} tests`, accent: "text-[var(--green)]" },
  ];

  return (
    <>
      <div className="dash-v4">
        {/* Cinematic ambient glow */}
        <div className="dash-glow" aria-hidden />

        {/* Top bar */}
        <motion.div {...fadeUp(0)} className="dash-topbar">
          <div className="dash-crumbs">
            <CircleDot className="w-3 h-3 text-[var(--brand-glow)]" />
            <span>Workspace</span>
            <ChevronRight className="w-3 h-3 opacity-40" />
            <span className="text-[var(--text-primary)]">Dashboard</span>
          </div>
          <div className="dash-topbar-right">
            <span className="dash-date">{today}</span>
            <button className="dash-cmd" onClick={() => navigate("/chat")}>
              <Command className="w-3 h-3" />
              <span>Ask Lumina</span>
              <kbd>⌘K</kbd>
            </button>
          </div>
        </motion.div>

        {/* Hero */}
        <motion.section {...fadeUp(0.05)} className="dash-hero">
          <div className="dash-hero-left">
            <span className="dash-eyebrow">
              <span className="dash-pulse-dot" />
              Neural insight · live
            </span>
            <h1 className="dash-headline">
              {getGreeting()}, <em>{userName}</em>.
            </h1>
            <p className="dash-sub">
              {avgScore !== null && recentTests?.length
                ? <>You're averaging <b className="text-[var(--text-primary)]">{avgScore}%</b> across <b className="text-[var(--text-primary)]">{recentTests.length}</b> recent tests. {weakSubjects[0] ? <>The gap sits in <b className="text-[var(--text-primary)]">{weakSubjects[0].subject}</b> — let's close it.</> : "Momentum is yours."}</>
                : totalToday > 0
                  ? <>You've put in <b className="text-[var(--text-primary)]">{hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}</b> today. Quiet, consistent work compounds.</>
                  : <>A fresh canvas. The smallest first move beats the perfect one tomorrow.</>}
            </p>
            <div className="dash-hero-actions">
              <Button onClick={() => navigate(weakSubjects.length ? "/tests" : "/study-session")} className="dash-btn-primary">
                {weakSubjects.length ? `Practice ${weakSubjects[0].subject}` : "Start a session"}
                <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </Button>
              <Button onClick={() => navigate("/chat")} variant="ghost" className="dash-btn-ghost">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New thread
              </Button>
            </div>
          </div>

          {/* Readiness gauge */}
          <div className="dash-gauge">
            <svg viewBox="0 0 120 120" className="dash-gauge-svg">
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#2DD4BF" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="50" className="dash-gauge-track" />
              <motion.circle
                cx="60" cy="60" r="50"
                className="dash-gauge-fill"
                strokeDasharray={`${2 * Math.PI * 50}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - readiness / 100) }}
                transition={{ duration: prefersReduced ? 0 : 1.6, delay: 0.3, ease: EASE }}
              />
            </svg>
            <div className="dash-gauge-center">
              <span className="dash-gauge-num">{avgScore ?? "—"}</span>
              <span className="dash-gauge-lbl">Readiness</span>
            </div>
          </div>
        </motion.section>

        {/* KPI strip */}
        <motion.section {...fadeUp(0.1)} className="dash-kpis">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 + i * 0.04, ease: EASE }}
              className="dash-kpi"
            >
              <div className="dash-kpi-head">
                <s.icon className={`w-3.5 h-3.5 ${s.accent}`} />
                <span>{s.label}</span>
              </div>
              <div className="dash-kpi-val">{s.value}</div>
              <div className="dash-kpi-sub">{s.sub}</div>
            </motion.div>
          ))}
        </motion.section>

        {/* Two-column: Mastery + Plan */}
        <div className="dash-grid-2">
          <motion.section {...fadeUp(0.15)} className="dash-panel">
            <header className="dash-panel-head">
              <div>
                <h3>Mastery</h3>
                <p>Across your tracked subjects</p>
              </div>
              <button onClick={() => navigate("/weakness-radar")} className="dash-link">
                Radar <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </button>
            </header>
            {Object.keys(subjectScores).length > 0 ? (
              <div className="dash-mastery">
                {Object.entries(subjectScores).map(([sub, score], i) => (
                  <motion.button
                    key={sub}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 0.4, ease: EASE }}
                    onClick={() => navigate("/weakness-radar")}
                    className="dash-mastery-row"
                  >
                    <span className="dash-mastery-name">{sub}</span>
                    <div className="dash-mastery-bar">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.06, ease: EASE }}
                        className={`dash-mastery-fill ${score >= 75 ? "is-good" : score >= 50 ? "is-mid" : "is-low"}`}
                      />
                    </div>
                    <span className="dash-mastery-pct">{score}%</span>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="dash-empty">
                <p>No tests yet. Generate one to see your mastery surface here.</p>
                <Button variant="ghost" size="sm" onClick={() => navigate("/tests")} className="dash-link mt-2">
                  Take a test <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            )}
          </motion.section>

          <motion.section {...fadeUp(0.18)} className="dash-panel">
            <header className="dash-panel-head">
              <div>
                <h3>Today's plan</h3>
                <p>Quiet wins, in order</p>
              </div>
              <span className="dash-badge"><Sparkles className="w-3 h-3" /> auto</span>
            </header>
            <ul className="dash-plan">
              {[
                { l: weakSubjects[0] ? `Practice ${weakSubjects[0].subject}` : "Warm-up: 5 flashcards", t: "20m", u: "/tests" },
                { l: "Review yesterday's mistakes", t: "10m", u: "/weakness-radar" },
                { l: "One focused study session", t: "25m", u: "/study-session" },
              ].map((x, i) => (
                <li key={i}>
                  <button onClick={() => navigate(x.u)} className="dash-plan-row">
                    <span className="dash-plan-dot" />
                    <span className="dash-plan-l">{x.l}</span>
                    <span className="dash-plan-t">{x.t}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-30 group-hover:opacity-80 transition" />
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        </div>

        {/* Activity chart */}
        <motion.section {...fadeUp(0.22)} className="dash-panel">
          <header className="dash-panel-head">
            <div>
              <h3>This week</h3>
              <p>{daysStudied} of 7 days · {consistency}% consistency</p>
            </div>
            <button onClick={() => navigate("/performance")} className="dash-link">
              Performance <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </header>
          <div className="dash-chart">
            {weeklyData.map((d, i) => {
              const pct = (d.minutes / maxMin) * 100;
              const isToday = i === ((new Date().getDay() + 6) % 7);
              return (
                <div key={d.label + i} className="dash-chart-col">
                  <div className="dash-chart-track">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(pct, d.minutes > 0 ? 4 : 0)}%` }}
                      transition={{ duration: 0.8, delay: 0.25 + i * 0.05, ease: EASE }}
                      className={`dash-chart-bar ${isToday ? "is-today" : ""}`}
                    />
                  </div>
                  <span className={`dash-chart-lbl ${isToday ? "is-today" : ""}`}>{d.label}</span>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Upgrade banner (subtle, Vercel-style) */}
        {!isProPlus && (
          <motion.section {...fadeUp(0.26)} className="dash-upgrade">
            <div className="dash-upgrade-l">
              <div className="dash-upgrade-icon"><Crown className="w-4 h-4" /></div>
              <div>
                <h4>Lumina Hub</h4>
                <p>Unlock 10 neurocognitive engines · ₹499/mo</p>
              </div>
            </div>
            <Button onClick={openPricing} className="dash-btn-primary">
              Upgrade <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </motion.section>
        )}

        {/* Weakness cards */}
        <motion.section {...fadeUp(0.3)}>
          <header className="dash-panel-head dash-section-head">
            <div>
              <h3>Where to focus</h3>
              <p>Top patterns from your recent work</p>
            </div>
            <button onClick={() => navigate("/weakness-radar")} className="dash-link">
              Full analysis <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </header>
          {weakSubjects.length > 0 ? (
            <div className="dash-weak-grid">
              {weakSubjects.map((w, i) => (
                <motion.button
                  key={w.subject}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.06, duration: 0.5, ease: EASE }}
                  onClick={() => navigate("/tests")}
                  className="dash-weak"
                >
                  <div className="dash-weak-head">
                    <span className={`dash-weak-tag ${w.count >= 10 ? "is-c" : w.count >= 5 ? "is-w" : "is-n"}`}>
                      <Activity className="w-3 h-3" />
                      {w.count >= 10 ? "Critical" : w.count >= 5 ? "Needs work" : "Watch"}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-40" />
                  </div>
                  <h4>{w.subject}</h4>
                  <p>{w.count} mistakes · mostly {w.topMistakeType}</p>
                  <div className="dash-weak-track">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(w.count * 5, 100)}%` }}
                      transition={{ duration: 1, delay: 0.45 + i * 0.08, ease: EASE }}
                      className="dash-weak-fill"
                    />
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="dash-panel dash-empty">
              <TrendingUp className="w-5 h-5 mb-2 text-[var(--green)]" />
              <p className="text-[var(--text-primary)] font-medium">All clear, for now.</p>
              <p>Take a test to surface what to sharpen next.</p>
            </div>
          )}
        </motion.section>

        {/* Actions */}
        <motion.section {...fadeUp(0.36)}>
          <header className="dash-panel-head dash-section-head">
            <div>
              <h3>Quick actions</h3>
              <p>Jump into your tools</p>
            </div>
          </header>
          <div className="dash-actions">
            {[
              { n: "AI Chat", d: "Ask anything", i: MessageSquare, u: "/chat" },
              { n: "Generate Test", d: userSubjects[0] ? `Try ${userSubjects[0]}` : "Any topic", i: Target, u: "/tests" },
              { n: "Brain Hub", d: "10 engines", i: Brain, u: "/hub" },
              { n: "All Tools", d: "9 AI tools", i: Sparkles, u: "/ai-tools" },
            ].map((a, i) => (
              <motion.button
                key={a.n}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.04, duration: 0.4, ease: EASE }}
                onClick={() => navigate(a.u)}
                className="dash-action"
              >
                <div className="dash-action-icon"><a.i className="w-4 h-4" /></div>
                <div className="dash-action-text">
                  <span className="dash-action-name">{a.n}</span>
                  <span className="dash-action-desc">{a.d}</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-30 group-hover:opacity-100 transition" />
              </motion.button>
            ))}
          </div>
        </motion.section>
      </div>

      {showOnboarding && <OnboardingTutorial onComplete={() => setShowOnboarding(false)} />}
    </>
  );
}
