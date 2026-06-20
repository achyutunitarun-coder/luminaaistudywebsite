/**
 * LUMINA DASHBOARD — v5
 * Even, balanced, minimalist. No giant blocks. Linear/Notion/Vercel grade.
 */
import { motion, useReducedMotion } from "framer-motion";
import {
  Trophy, Flame, Target, Clock, ArrowRight, ArrowUpRight, Brain,
  Sparkles, MessageSquare, Activity, Crown, Command, Plus, ChevronRight,
  TrendingUp,
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
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: EASE },
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

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Welcome back";
  })();

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
    { icon: Trophy, label: "Level", value: String(profile.level), sub: `${profile.xp % 100} / 100 XP` },
    { icon: Flame, label: "Streak", value: String(streakDays), sub: streakDays === 1 ? "day" : "days" },
    { icon: Clock, label: "Today", value: totalToday > 0 ? (hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`) : "0m", sub: totalToday >= 60 ? "deep work" : "studying" },
    { icon: Target, label: "Readiness", value: avgScore !== null ? `${avgScore}%` : "—", sub: `${recentTests?.length || 0} tests` },
  ];

  const C = 2 * Math.PI * 42;

  return (
    <>
      <div className="dash5">
        <div className="dash5-aurora" aria-hidden />

        {/* Top bar */}
        <motion.div {...fadeUp(0)} className="dash5-top">
          <div className="dash5-crumb">
            <span className="dash5-crumb-dot" />
            <span>Workspace</span>
            <ChevronRight className="w-3 h-3 opacity-40" />
            <span className="dash5-crumb-active">Dashboard</span>
          </div>
          <div className="dash5-top-right">
            <span className="dash5-date">{today}</span>
            <button className="dash5-cmd" onClick={() => navigate("/chat")}>
              <Command className="w-3 h-3" />
              <span>Ask Lumina</span>
              <kbd>⌘K</kbd>
            </button>
          </div>
        </motion.div>

        {/* Hero — balanced row: greeting+CTA  |  compact readiness gauge */}
        <motion.section {...fadeUp(0.04)} className="dash5-hero">
          <div className="dash5-hero-l">
            <span className="dash5-eyebrow">
              <span className="dash5-pulse" /> Neural insight · live
            </span>
            <h1 className="dash5-h1">
              {greeting}, <em>{userName}</em>.
            </h1>
            <p className="dash5-sub">
              {avgScore !== null && recentTests?.length
                ? <>You're averaging <b>{avgScore}%</b> across <b>{recentTests.length}</b> recent tests.{weakSubjects[0] ? <> The gap sits in <b>{weakSubjects[0].subject}</b> — let's close it.</> : " Momentum is yours."}</>
                : totalToday > 0
                  ? <>You've put in <b>{hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}</b> today. Quiet, consistent work compounds.</>
                  : <>A fresh canvas. The smallest first move beats the perfect one tomorrow.</>}
            </p>
            <div className="dash5-hero-cta">
              <Button onClick={() => navigate(weakSubjects.length ? "/tests" : "/study-session")} className="dash5-btn">
                {weakSubjects.length ? `Practice ${weakSubjects[0].subject}` : "Start a session"}
                <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </Button>
              <Button onClick={() => navigate("/chat")} variant="ghost" className="dash5-btn-ghost">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New thread
              </Button>
            </div>
          </div>

          <div className="dash5-gauge">
            <svg viewBox="0 0 100 100" className="dash5-gauge-svg">
              <defs>
                <linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#2DD4BF" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="42" className="dash5-gauge-track" />
              <motion.circle
                cx="50" cy="50" r="42"
                className="dash5-gauge-fill"
                strokeDasharray={`${C}`}
                initial={{ strokeDashoffset: C }}
                animate={{ strokeDashoffset: C * (1 - readiness / 100) }}
                transition={{ duration: prefersReduced ? 0 : 1.4, delay: 0.2, ease: EASE }}
              />
            </svg>
            <div className="dash5-gauge-c">
              <span className="dash5-gauge-n">{avgScore ?? "—"}</span>
              <span className="dash5-gauge-l">Readiness</span>
            </div>
          </div>
        </motion.section>

        {/* KPI row — perfectly even 4-up */}
        <motion.section {...fadeUp(0.08)} className="dash5-kpis">
          {stats.map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.04, ease: EASE }}
              className="dash5-kpi"
            >
              <div className="dash5-kpi-h">
                <s.icon className="w-3.5 h-3.5" />
                <span>{s.label}</span>
              </div>
              <div className="dash5-kpi-v">{s.value}</div>
              <div className="dash5-kpi-s">{s.sub}</div>
            </motion.div>
          ))}
        </motion.section>

        {/* Two-col: Mastery + Plan — equal heights */}
        <div className="dash5-cols-2">
          <motion.section {...fadeUp(0.12)} className="dash5-card">
            <header className="dash5-head">
              <div>
                <h3>Mastery</h3>
                <p>Across your tracked subjects</p>
              </div>
              <button onClick={() => navigate("/weakness-radar")} className="dash5-link">
                Radar <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </button>
            </header>
            {Object.keys(subjectScores).length > 0 ? (
              <div className="dash5-mastery">
                {Object.entries(subjectScores).slice(0, 5).map(([sub, score], i) => (
                  <motion.button
                    key={sub}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 0.4 }}
                    onClick={() => navigate("/weakness-radar")}
                    className="dash5-m-row"
                  >
                    <span className="dash5-m-name">{sub}</span>
                    <div className="dash5-m-bar">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${score}%` }}
                        transition={{ duration: 0.9, delay: 0.3 + i * 0.05, ease: EASE }}
                        className={`dash5-m-fill ${score >= 75 ? "good" : score >= 50 ? "mid" : "low"}`}
                      />
                    </div>
                    <span className="dash5-m-pct">{score}%</span>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="dash5-empty">
                <p>No tests yet. Generate one to see your mastery surface here.</p>
                <button onClick={() => navigate("/tests")} className="dash5-link mt-3">
                  Take a test <ArrowRight className="w-3 h-3 ml-1" />
                </button>
              </div>
            )}
          </motion.section>

          <motion.section {...fadeUp(0.14)} className="dash5-card">
            <header className="dash5-head">
              <div>
                <h3>Today's plan</h3>
                <p>Quiet wins, in order</p>
              </div>
              <span className="dash5-pill"><Sparkles className="w-3 h-3" /> auto</span>
            </header>
            <ul className="dash5-plan">
              {[
                { l: weakSubjects[0] ? `Practice ${weakSubjects[0].subject}` : "Warm-up: 5 flashcards", t: "20m", u: "/tests" },
                { l: "Review yesterday's mistakes", t: "10m", u: "/weakness-radar" },
                { l: "One focused study session", t: "25m", u: "/study-session" },
              ].map((x, i) => (
                <li key={i}>
                  <button onClick={() => navigate(x.u)} className="dash5-plan-row">
                    <span className="dash5-plan-dot" />
                    <span className="dash5-plan-l">{x.l}</span>
                    <span className="dash5-plan-t">{x.t}</span>
                    <ChevronRight className="w-3.5 h-3.5 dash5-plan-ch" />
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        </div>

        {/* Activity chart */}
        <motion.section {...fadeUp(0.18)} className="dash5-card">
          <header className="dash5-head">
            <div>
              <h3>This week</h3>
              <p>{daysStudied} of 7 days · {consistency}% consistency</p>
            </div>
            <button onClick={() => navigate("/performance")} className="dash5-link">
              Performance <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </header>
          <div className="dash5-chart">
            {weeklyData.map((d, i) => {
              const pct = (d.minutes / maxMin) * 100;
              const isToday = i === ((new Date().getDay() + 6) % 7);
              return (
                <div key={d.label + i} className="dash5-chart-col">
                  <div className="dash5-chart-track">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(pct, d.minutes > 0 ? 4 : 0)}%` }}
                      transition={{ duration: 0.7, delay: 0.2 + i * 0.04, ease: EASE }}
                      className={`dash5-chart-bar ${isToday ? "today" : ""}`}
                    />
                  </div>
                  <span className={`dash5-chart-lbl ${isToday ? "today" : ""}`}>{d.label}</span>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Upgrade banner */}
        {!isProPlus && (
          <motion.section {...fadeUp(0.22)} className="dash5-upgrade">
            <div className="dash5-upgrade-l">
              <div className="dash5-upgrade-i"><Crown className="w-4 h-4" /></div>
              <div>
                <h4>Lumina PRO+</h4>
                <p>Unlock 10 neurocognitive engines · ₹499/mo</p>
              </div>
            </div>
            <Button onClick={openPricing} className="dash5-btn">
              Upgrade <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </motion.section>
        )}

        {/* Weakness focus */}
        <motion.section {...fadeUp(0.26)}>
          <header className="dash5-head dash5-section-head">
            <div>
              <h3>Where to focus</h3>
              <p>Top patterns from your recent work</p>
            </div>
            <button onClick={() => navigate("/weakness-radar")} className="dash5-link">
              Full analysis <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </header>
          {weakSubjects.length > 0 ? (
            <div className="dash5-weak-grid">
              {weakSubjects.map((w, i) => (
                <motion.button
                  key={w.subject}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05, duration: 0.45 }}
                  onClick={() => navigate("/tests")}
                  className="dash5-weak"
                >
                  <div className="dash5-weak-h">
                    <span className={`dash5-weak-tag ${w.count >= 10 ? "c" : w.count >= 5 ? "w" : "n"}`}>
                      <Activity className="w-3 h-3" />
                      {w.count >= 10 ? "Critical" : w.count >= 5 ? "Needs work" : "Watch"}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-40" />
                  </div>
                  <h4>{w.subject}</h4>
                  <p>{w.count} mistakes · mostly {w.topMistakeType}</p>
                  <div className="dash5-weak-track">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${Math.min(w.count * 5, 100)}%` }}
                      transition={{ duration: 0.9, delay: 0.4 + i * 0.05, ease: EASE }}
                      className="dash5-weak-fill"
                    />
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="dash5-card dash5-empty-card">
              <TrendingUp className="w-5 h-5 mb-2 dash5-empty-i" />
              <p className="dash5-empty-t">All clear, for now.</p>
              <p className="dash5-empty-s">Take a test to surface what to sharpen next.</p>
            </div>
          )}
        </motion.section>

        {/* Quick actions */}
        <motion.section {...fadeUp(0.3)}>
          <header className="dash5-head dash5-section-head">
            <div>
              <h3>Quick actions</h3>
              <p>Jump into your tools</p>
            </div>
          </header>
          <div className="dash5-actions">
            {[
              { n: "AI Chat", d: "Ask anything", i: MessageSquare, u: "/chat" },
              { n: "Generate Test", d: userSubjects[0] ? `Try ${userSubjects[0]}` : "Any topic", i: Target, u: "/tests" },
              { n: "Brain Hub", d: "10 engines", i: Brain, u: "/hub" },
              { n: "All Tools", d: "9 AI tools", i: Sparkles, u: "/ai-tools" },
            ].map((a, i) => (
              <motion.button
                key={a.n}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.04, duration: 0.4 }}
                onClick={() => navigate(a.u)}
                className="dash5-action"
              >
                <div className="dash5-action-i"><a.i className="w-4 h-4" /></div>
                <div className="dash5-action-t">
                  <span className="dash5-action-n">{a.n}</span>
                  <span className="dash5-action-d">{a.d}</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 dash5-action-ch" />
              </motion.button>
            ))}
          </div>
        </motion.section>
      </div>

      {showOnboarding && <OnboardingTutorial onComplete={() => setShowOnboarding(false)} />}
    </>
  );
}
