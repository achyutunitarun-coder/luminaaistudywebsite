/**
 * LUMINA DASHBOARD
 * Linear / Notion / Vercel-grade. Clean, spacious, precise.
 * Uses design system primitives — no custom CSS classes.
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
    { icon: Trophy, label: "Level", value: String(profile.level), sub: `${profile.xp % 100} / 100 XP`, color: "var(--amber)" },
    { icon: Flame, label: "Streak", value: String(streakDays), sub: streakDays === 1 ? "day" : "days", color: "var(--amber)" },
    { icon: Clock, label: "Today", value: totalToday > 0 ? (hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`) : "0m", sub: totalToday >= 60 ? "deep work" : "studying", color: "var(--teal)" },
    { icon: Target, label: "Avg Score", value: avgScore !== null ? `${avgScore}%` : "—", sub: `${recentTests?.length || 0} tests`, color: "var(--green)" },
  ];

  return (
    <>
    <div className="page-container" style={{ background: "var(--bg-base)", minHeight: "100vh" }}>

      {/* Top bar */}
      <motion.div {...fadeUp(0)} className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2 text-sm">
          <CircleDot className="w-3.5 h-3.5" style={{ color: "var(--brand-glow)" }} />
          <span style={{ color: "var(--text-muted)" }}>Workspace</span>
          <ChevronRight className="w-3 h-3 opacity-40" style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-primary)" }}>Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{today}</span>
          <button onClick={() => navigate("/chat")} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-[var(--bg-hover)]" style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            <Command className="w-3 h-3" />
            <span>Ask Lumina</span>
            <kbd className="text-[10px] px-1 py-0.5 rounded" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>⌘K</kbd>
          </button>
        </div>
      </motion.div>

      {/* Hero — Neural Insight */}
      <motion.section {...fadeUp(0.05)} className="rounded-2xl p-8 md:p-10 mb-6 border" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
          <div className="flex-1 min-w-0 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border" style={{ borderColor: "rgba(45,212,191,0.25)", background: "var(--teal-tint)" }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--teal)" }} />
              <Brain className="w-3.5 h-3.5" style={{ color: "var(--teal)" }} />
              <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--teal)" }}>Neural Insight</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
              {getGreeting()}, <em style={{ fontFamily: "var(--font-display)", fontStyle: "italic", color: "var(--brand-glow)" }}>{userName}</em>.
            </h1>

            <p className="text-sm leading-relaxed max-w-xl" style={{ color: "var(--text-secondary)" }}>
              {avgScore !== null && recentTests?.length
                ? <>You're averaging <b style={{ color: "var(--text-primary)" }}>{avgScore}%</b> across <b style={{ color: "var(--text-primary)" }}>{recentTests.length}</b> recent tests. {weakSubjects[0] ? <>The gap sits in <b style={{ color: "var(--text-primary)" }}>{weakSubjects[0].subject}</b> — let's close it.</> : "Momentum is yours."}</>
                : totalToday > 0
                  ? <>You've put in <b style={{ color: "var(--text-primary)" }}>{hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}</b> today. Quiet, consistent work compounds.</>
                  : <>A fresh canvas. The smallest first move beats the perfect one tomorrow.</>}
            </p>

            <div className="flex items-center gap-3">
              <Button onClick={() => navigate(weakSubjects.length ? "/tests" : "/study-session")} className="btn-primary px-6">
                {weakSubjects.length ? `Practice ${weakSubjects[0].subject}` : "Start a session"}
                <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </Button>
              <Button onClick={() => navigate("/chat")} variant="ghost" className="btn-ghost">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New thread
              </Button>
            </div>
          </div>

          {/* Readiness gauge */}
          <div className="flex-shrink-0 flex flex-col items-center gap-3">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="url(#readiness-grad)" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - readiness / 100) }}
                  transition={{ duration: prefersReduced ? 0 : 1.6, delay: 0.3, ease: EASE }}
                />
                <defs>
                  <linearGradient id="readiness-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--brand)" />
                    <stop offset="50%" stopColor="var(--teal)" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{avgScore ?? "—"}</span>
                <span className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "var(--text-muted)" }}>Readiness</span>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* KPI strip */}
      <motion.section {...fadeUp(0.1)} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 + i * 0.04, ease: EASE }}
            className="rounded-2xl p-5 border hover:border-[var(--border-default)] transition-all"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                <p className="text-xl font-bold tabular-nums leading-tight" style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{s.value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{s.sub}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.section>

      {/* Two-column: Mastery + Plan */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 mb-6">
        <motion.section {...fadeUp(0.15)} className="rounded-2xl p-6 border" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <header className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Mastery</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Across your tracked subjects</p>
            </div>
            <button onClick={() => navigate("/weakness-radar")} className="flex items-center gap-1 text-xs transition-colors hover:opacity-80" style={{ color: "var(--brand-glow)" }}>
              Radar <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </header>
          {Object.keys(subjectScores).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(subjectScores).map(([sub, score], i) => (
                <motion.button
                  key={sub}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.4, ease: EASE }}
                  onClick={() => navigate("/weakness-radar")}
                  className="w-full flex items-center gap-3 group"
                >
                  <span className="text-sm w-24 truncate text-left" style={{ color: "var(--text-secondary)" }}>{sub}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-faint)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 1, delay: 0.3 + i * 0.06, ease: EASE }}
                      className="h-full rounded-full"
                      style={{ background: score >= 75 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)" }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums w-10 text-right" style={{ color: score >= 75 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)" }}>{score}%</span>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No tests yet. Generate one to see your mastery surface here.</p>
              <Button variant="ghost" size="sm" onClick={() => navigate("/tests")} className="mt-2 btn-ghost">
                Take a test <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
        </motion.section>

        <motion.section {...fadeUp(0.18)} className="rounded-2xl p-6 border" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <header className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Today's plan</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Quiet wins, in order</p>
            </div>
            <span className="badge badge-violet"><Sparkles className="w-3 h-3" /> auto</span>
          </header>
          <ul className="space-y-1">
            {[
              { l: weakSubjects[0] ? `Practice ${weakSubjects[0].subject}` : "Warm-up: 5 flashcards", t: "20m", u: "/tests" },
              { l: "Review yesterday's mistakes", t: "10m", u: "/weakness-radar" },
              { l: "One focused study session", t: "25m", u: "/study-session" },
            ].map((x, i) => (
              <li key={i}>
                <button onClick={() => navigate(x.u)} className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg group hover:bg-[var(--bg-hover)] transition-colors text-left">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--brand)" }} />
                  <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{x.l}</span>
                  <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{x.t}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-30 group-hover:opacity-80 transition-opacity" style={{ color: "var(--text-muted)" }} />
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      </div>

      {/* Activity chart */}
      <motion.section {...fadeUp(0.22)} className="rounded-2xl p-6 border mb-6" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
        <header className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>This week</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{daysStudied} of 7 days · {consistency}% consistency</p>
          </div>
          <button onClick={() => navigate("/performance")} className="flex items-center gap-1 text-xs transition-colors hover:opacity-80" style={{ color: "var(--brand-glow)" }}>
            Performance <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </button>
        </header>
        <div className="flex items-end justify-between gap-2 h-28">
          {weeklyData.map((d, i) => {
            const pct = (d.minutes / maxMin) * 100;
            const isToday = i === ((new Date().getDay() + 6) % 7);
            return (
              <div key={d.label + i} className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full h-24 flex items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct, d.minutes > 0 ? 4 : 0)}%` }}
                    transition={{ duration: 0.8, delay: 0.25 + i * 0.05, ease: EASE }}
                    className="w-full max-w-[36px] rounded-lg mx-auto"
                    style={{
                      background: d.minutes > 0
                        ? "linear-gradient(to top, var(--brand), var(--teal))"
                        : "rgba(255,255,255,0.04)",
                      boxShadow: isToday ? "0 0 0 2px rgba(45,212,191,0.25)" : "none",
                    }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${isToday ? "font-semibold" : ""}`} style={{ color: isToday ? "var(--teal)" : "var(--text-muted)" }}>{d.label}</span>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Upgrade banner */}
      {!isProPlus && (
        <motion.section {...fadeUp(0.26)} className="rounded-2xl p-6 border mb-6 flex items-center justify-between" style={{ background: "var(--brand-tint)", borderColor: "var(--border-brand)" }}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--brand)", color: "white" }}>
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Lumina Hub</h4>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Unlock 10 neurocognitive engines · ₹499/mo</p>
            </div>
          </div>
          <Button onClick={openPricing} className="btn-primary">
            Upgrade <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </motion.section>
      )}

      {/* Weakness cards */}
      <motion.section {...fadeUp(0.3)}>
        <header className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Where to focus</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Top patterns from your recent work</p>
          </div>
          <button onClick={() => navigate("/weakness-radar")} className="flex items-center gap-1 text-xs transition-colors hover:opacity-80" style={{ color: "var(--brand-glow)" }}>
            Full analysis <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </button>
        </header>
        {weakSubjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {weakSubjects.map((w, i) => {
              const colors = [
                { color: "var(--red)", bg: "var(--red-tint)", border: "rgba(248,113,113,0.25)" },
                { color: "var(--amber)", bg: "var(--amber-tint)", border: "rgba(245,158,11,0.25)" },
                { color: "var(--amber)", bg: "var(--amber-tint)", border: "rgba(251,146,60,0.25)" },
              ];
              const c = colors[i] || colors[2];
              return (
                <motion.button
                  key={w.subject}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.06, duration: 0.5, ease: EASE }}
                  onClick={() => navigate("/tests")}
                  className="rounded-2xl p-5 text-left border hover:border-[var(--border-default)] transition-all"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)", borderLeft: `3px solid ${c.color}` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="badge" style={{ background: c.bg, color: c.color, borderColor: c.border }}>
                      <Activity className="w-3 h-3" />
                      {w.count >= 10 ? "Critical" : w.count >= 5 ? "Needs work" : "Watch"}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-40" style={{ color: "var(--text-muted)" }} />
                  </div>
                  <h4 className="text-sm font-semibold mb-1 capitalize" style={{ color: "var(--text-primary)" }}>{w.subject}</h4>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{w.count} mistakes · mostly {w.topMistakeType}</p>
                  <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: "var(--border-faint)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(w.count * 5, 100)}%` }}
                      transition={{ duration: 1, delay: 0.45 + i * 0.08, ease: EASE }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${c.color}, ${c.color}33)` }}
                    />
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl p-8 text-center border" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <TrendingUp className="w-5 h-5 mb-2 mx-auto" style={{ color: "var(--green)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>All clear, for now.</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Take a test to surface what to sharpen next.</p>
          </div>
        )}
      </motion.section>

      {/* Quick actions */}
      <motion.section {...fadeUp(0.36)}>
        <header className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Quick actions</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Jump into your tools</p>
          </div>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { n: "AI Chat", d: "Ask anything", i: MessageSquare, u: "/chat", color: "var(--teal)" },
            { n: "Generate Test", d: userSubjects[0] ? `Try ${userSubjects[0]}` : "Any topic", i: Target, u: "/tests", color: "var(--brand)" },
            { n: "Brain Hub", d: "10 engines", i: Brain, u: "/hub", color: "var(--amber)" },
            { n: "All Tools", d: "9 AI tools", i: Sparkles, u: "/ai-tools", color: "var(--green)" },
          ].map((a, i) => (
            <motion.button
              key={a.n}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.04, duration: 0.4, ease: EASE }}
              onClick={() => navigate(a.u)}
              className="rounded-2xl p-5 text-left border hover:border-[var(--border-default)] transition-all group"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110" style={{ background: `${a.color}12`, border: `1px solid ${a.color}25` }}>
                <a.i className="w-5 h-5" style={{ color: a.color }} />
              </div>
              <span className="text-sm font-semibold block mb-0.5" style={{ color: "var(--text-primary)" }}>{a.n}</span>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{a.d}</span>
              <ArrowUpRight className="w-3.5 h-3.5 mt-2 opacity-30 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
            </motion.button>
          ))}
        </div>
      </motion.section>

      {/* Marketing sections */}
      <div className="mt-8">
        <CTASection />
        <Testimonials />
        <FAQ />
      </div>
    </div>

    {showOnboarding && <OnboardingTutorial onComplete={() => setShowOnboarding(false)} />}
    </>
  );
}
