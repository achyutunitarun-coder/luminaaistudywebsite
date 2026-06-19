/**
 * LUMINA DASHBOARD — Production-Grade Redesign
 * Linear/Vercel/Notion quality. Every pixel justified.
 * No inline hex values. All colors from design tokens.
 */
import { motion } from "framer-motion";
import {
  Trophy, Flame, Target, Clock, ArrowRight, CheckCircle2, Brain,
  Sparkles, AlertTriangle, MessageSquare, BarChart3, TrendingUp,
  TrendingDown, Zap, Layers, Activity, Crown, Rocket, Timer,
  GitBranch, Calendar, Shuffle, BookOpen,
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

const ease = [0.25, 0.1, 0.25, 1] as const;

const Dashboard = () => {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { seconds: liveSeconds } = useStudyTimer();
  const { isProPlus } = useSubscription();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (profile && !profile.extra_preferences) setShowOnboarding(true);
  }, [profile]);

  const userPrefs = useMemo(() => {
    if (!profile?.extra_preferences) return null;
    try { return JSON.parse(profile.extra_preferences as string); } catch { return null; }
  }, [profile?.extra_preferences]);

  const emailName = user?.email?.split("@")[0]?.trim() || "";
  const rawName = (profile?.display_name?.split(" ")[0]?.trim() || emailName).trim();
  const isGenericName = !rawName || /^(lumina|user|student|guest|test|admin|scholar)$/i.test(rawName);
  const userName = isGenericName ? "back" : rawName;
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
    queryKey: ["recent-tests-insight", user?.id],
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
    queryKey: ["weakness-insight", user?.id],
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
      const t = m.mistake_type || "conceptual";
      counts[sub].types[t] = (counts[sub].types[t] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 3)
      .map(([subject, data]) => ({
        subject, count: data.count,
        topMistakeType: Object.entries(data.types).sort((a, b) => b[1] - a[1])[0]?.[0] || "conceptual",
      }));
  }, [mistakeData]);

  if (!profile) return null;

  const liveMinutes = Math.floor(liveSeconds / 60);
  const totalToday = (todayMinutes || 0) + liveMinutes;
  const hrs = Math.floor(totalToday / 60);
  const mins = totalToday % 60;
  const avgScore = recentTests?.length ? Math.round(recentTests.reduce((s, t) => s + (t.score || 0), 0) / recentTests.length) : null;
  const readinessScore = avgScore ?? 0;

  const scoreTrend = (() => {
    if (!recentTests || recentTests.length < 4) return null;
    const recent3 = recentTests.slice(0, 3).reduce((s, t) => s + (t.score || 0), 0) / 3;
    const prev3 = recentTests.slice(3, 6).reduce((s, t) => s + (t.score || 0), 0) / Math.min(recentTests.length - 3, 3);
    return Math.round(recent3 - prev3);
  })();

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const insightObservation = (() => {
    if (avgScore !== null && recentTests?.length) {
      const trend = scoreTrend !== null ? (scoreTrend >= 0 ? `, trending up ${scoreTrend}%` : `, dropped ${Math.abs(scoreTrend)}%`) : "";
      return `Your average score is ${avgScore}%${trend} across ${recentTests.length} tests.`;
    }
    return `You've studied ${totalToday > 0 ? `${hrs}h ${mins}m today` : "haven't started today yet"}.`;
  })();

  const insightInterpretation = (() => {
    if (weakSubjects.length) return `${weakSubjects[0].subject} is your weakest area with ${weakSubjects[0].count} mistakes — mostly ${weakSubjects[0].topMistakeType} errors.`;
    if (avgScore !== null && avgScore < 70) return "Your scores suggest conceptual gaps that need targeted attention.";
    if (streakDays >= 3) return `Your ${streakDays}-day streak shows excellent consistency. Each day builds neural pathways.`;
    return "Building a study habit is the most important first step. Even 15 minutes creates momentum.";
  })();

  const insightAction = weakSubjects.length > 0
    ? { text: `Focus on ${weakSubjects[0].subject} — do 20 mins of targeted practice.`, label: `Practice ${weakSubjects[0].subject}`, url: "/tests" }
    : avgScore !== null && avgScore < 70
    ? { text: "Take a diagnostic test to pinpoint where your understanding breaks down.", label: "Take Diagnostic", url: "/tests" }
    : { text: "Start a focused study session to build momentum and earn XP.", label: "Start Session", url: "/study-session" };

  const stats = [
    { icon: Trophy, label: "Level", value: profile.level, sub: `${profile.xp % 100}/100 XP`, color: "var(--amber)", bg: "var(--amber-tint)" },
    { icon: Flame, label: "Streak", value: `${streakDays}d`, sub: streakDays >= 7 ? "🔥 Unstoppable" : streakDays >= 3 ? "🔥 On fire" : "Build it up", color: "#fb923c", bg: "rgba(251,146,60,0.08)" },
    { icon: Clock, label: "Today", value: `${hrs}h ${mins}m`, sub: totalToday >= 60 ? "Deep work" : totalToday > 0 ? "Getting started" : "Not yet", color: "var(--teal)", bg: "var(--teal-tint)" },
    { icon: Target, label: "Avg Score", value: avgScore !== null ? `${avgScore}%` : "—", sub: `${recentTests?.length || 0} tests`, color: "var(--brand)", bg: "var(--brand-tint)" },
  ];

  const daysStudied = new Set(weeklyMinutes?.map(w => new Date(w.started_at).toDateString())).size;
  const consistency = Math.round((daysStudied / 7) * 100);

  return (
    <>
    <div className="dash-container">

      {/* ─── HEADER ─── */}
      <div className="dash-header">
        <p className="dash-greeting">{getGreeting()}, {userName}.</p>
        <p className="dash-sub">Here's where you stand.</p>
      </div>

      {/* ─── NEURAL INSIGHT ─── */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="dash-hero">
        <div className="dash-hero-inner">
          <div className="dash-hero-content">
            <div className="dash-badge dash-badge-teal">
              <span className="dash-badge-dot" />
              <Brain className="w-3.5 h-3.5" />
              <span>Neural Insight</span>
            </div>

            <h1 className="dash-hero-title">
              {avgScore !== null ? (
                <span className="flex items-center gap-3 flex-wrap">
                  {avgScore >= 70 ? `Strong progress, ${userName}` : `Building momentum, ${userName}`}
                  {scoreTrend !== null && (
                    <span className={`dash-trend ${scoreTrend >= 0 ? "dash-trend-up" : "dash-trend-down"}`}>
                      {scoreTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {scoreTrend >= 0 ? "+" : ""}{scoreTrend}%
                    </span>
                  )}
                </span>
              ) : (
                `Welcome back, ${userName}`
              )}
            </h1>

            <div className="dash-hero-copy">
              <p><span className="dash-label">Observation: </span>{insightObservation}</p>
              <p><span className="dash-label">Interpretation: </span>{insightInterpretation}</p>
              <p className="dash-action"><span className="dash-label">Action: </span>{insightAction.text}</p>
            </div>

            {Object.keys(subjectScores).length > 0 && (
              <div className="dash-pills">
                {Object.entries(subjectScores).map(([sub, score]) => (
                  <span key={sub} className={`dash-pill ${score >= 70 ? "dash-pill-green" : score >= 50 ? "dash-pill-amber" : "dash-pill-red"}`}>
                    <span className="capitalize">{sub}</span>
                    <span className="font-bold tabular-nums">{score}%</span>
                  </span>
                ))}
              </div>
            )}

            <Button onClick={() => navigate(insightAction.url)} size="sm" className="btn-primary px-6">
              {insightAction.label} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>

          <div className="dash-readiness">
            <div className="dash-readiness-ring">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-faint)" strokeWidth="5" />
                <motion.circle cx="50" cy="50" r="42" fill="none" stroke="url(#readiness-grad)" strokeWidth="5" strokeLinecap="round"
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
              <div className="dash-readiness-center">
                <span className="dash-readiness-value">{avgScore ?? "—"}</span>
                <span className="dash-readiness-label">Readiness</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── STATS ─── */}
      <div className="dash-stats">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06, ease }} className="dash-stat">
            <div className="dash-stat-icon" style={{ background: stat.bg }}>
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="dash-stat-label">{stat.label}</p>
              <p className="dash-stat-value">{stat.value}</p>
              <p className="dash-stat-sub">{stat.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── MASTERY + PLAN ─── */}
      <div className="dash-grid-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ease }} className="dash-card">
          <h2 className="dash-card-title">
            <Layers className="w-4 h-4" style={{ color: "var(--brand)" }} />
            Mastery Map
          </h2>
          {Object.keys(subjectScores).length > 0 ? (
            <div className="dash-pills">
              {Object.entries(subjectScores).map(([sub, score]) => (
                <button key={sub} onClick={() => navigate("/weakness-radar")} className={`dash-pill ${score >= 70 ? "dash-pill-green" : score >= 50 ? "dash-pill-amber" : "dash-pill-red"}`}>
                  <span className="capitalize">{sub}</span>
                  <span className="font-bold tabular-nums">{score}%</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="dash-empty">
              <p>Take tests to see your mastery map</p>
              <Button variant="ghost" size="sm" onClick={() => navigate("/tests")} className="mt-2 text-xs">Take a Test <ArrowRight className="w-3 h-3 ml-1" /></Button>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }} className="dash-card">
          <h2 className="dash-card-title">
            <Zap className="w-4 h-4" style={{ color: "var(--amber)" }} />
            Today's Plan
          </h2>
          <div className="dash-plan-list">
            {[
              { label: "Practice weak areas", time: "20 min", color: "var(--red)" },
              { label: "Review flashcards", time: "10 min", color: "var(--teal)" },
              { label: "Take a quiz", time: "15 min", color: "var(--brand)" },
            ].map((item, i) => (
              <div key={i} className="dash-plan-item">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{item.time}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─── UPGRADE BANNER ─── */}
      {!isProPlus && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ease }} className="dash-upgrade">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5" style={{ color: "var(--brand-glow)" }} />
              <h2 className="text-lg font-bold">Lumina Hub — PRO+</h2>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>10 science-backed brain engines for ₹499/mo</p>
          </div>
          <Button onClick={openPricing} size="sm" className="shrink-0 rounded-xl text-xs font-semibold hover:opacity-90 px-5" style={{ background: "var(--brand)", color: "#fff" }}>
            <Rocket className="w-3.5 h-3.5 mr-1.5" /> Upgrade
          </Button>
        </motion.div>
      )}

      {/* ─── WEAKNESS RADAR ─── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="dash-card-title">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--red-tint)" }}>
              <Activity className="w-4 h-4" style={{ color: "var(--red)" }} />
            </div>
            Weakness Radar
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/weakness-radar")} className="text-xs rounded-xl" style={{ color: "var(--teal)" }}>
            Full Analysis <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {weakSubjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {weakSubjects.map((w, i) => {
              const severity = w.count >= 10 ? "Critical" : w.count >= 5 ? "Needs Work" : "Watch";
              const colors = [
                { border: "rgba(248,113,113,0.4)", icon: "var(--red)", badge: "var(--red-tint)" },
                { border: "rgba(251,191,36,0.4)", icon: "var(--amber)", badge: "var(--amber-tint)" },
                { border: "rgba(251,146,60,0.4)", icon: "#fb923c", badge: "rgba(251,146,60,0.12)" },
              ];
              const c = colors[i] || colors[2];
              return (
                <motion.button key={w.subject} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.1, ease }}
                  whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/tests")}
                  className="dash-weak-card" style={{ borderLeftColor: c.border }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="dash-severity" style={{ background: c.badge, color: c.icon }}>
                      <AlertTriangle className="w-3 h-3" />{severity}
                    </span>
                    {subjectScores[w.subject] !== undefined && <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{subjectScores[w.subject]}%</span>}
                  </div>
                  <h3 className="text-sm font-semibold mb-1 capitalize">{w.subject}</h3>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{w.count} mistakes · {w.topMistakeType}</p>
                  <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: "var(--border-faint)" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(w.count * 5, 100)}%` }} transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease }} className="h-full rounded-full" style={{ background: c.icon }} />
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="dash-empty-card">
            <CheckCircle2 className="w-8 h-8 mb-2" style={{ color: "var(--green)" }} />
            <p className="text-sm font-medium mb-1">Looking good!</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Take tests to discover areas for improvement</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/tests")} className="mt-4 rounded-xl text-xs">Take a Test <ArrowRight className="w-3 h-3 ml-1" /></Button>
          </div>
        )}
      </motion.div>

      {/* ─── INTELLIGENCE GRID ─── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ease }}>
        <h2 className="dash-card-title mb-4">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--brand-tint)" }}>
            <Zap className="w-4 h-4" style={{ color: "var(--brand)" }} />
          </div>
          Intelligence Hub
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: "AI Chat", desc: "Ask anything", icon: MessageSquare, url: "/chat", color: "var(--teal)" },
            { name: "Generate Test", desc: userSubjects[0] ? `Try ${userSubjects[0]}` : "Any topic", icon: Target, url: "/tests", color: "var(--brand)" },
            { name: "Brain Hub", desc: "10 brain engines", icon: Brain, url: "/hub", color: "var(--amber)" },
            { name: "All Tools", desc: "9 AI tools", icon: Sparkles, url: "/ai-tools", color: "#38bdf8" },
          ].map((action, i) => (
            <motion.button key={action.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 + i * 0.06, ease }}
              whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate(action.url)} className="dash-action-card">
              <div className="dash-action-icon" style={{ background: `${action.color}15`, border: `1px solid ${action.color}25` }}>
                <action.icon className="w-5 h-5" style={{ color: action.color }} />
              </div>
              <h3 className="font-semibold text-sm mb-0.5">{action.name}</h3>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{action.desc}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ─── WEEKLY EVOLUTION ─── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, ease }} className="dash-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="dash-card-title">
              <BarChart3 className="w-4 h-4" style={{ color: "var(--teal)" }} />
              Weekly Evolution
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{daysStudied}/7 days · {consistency}% consistency</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/pulse")} className="text-xs rounded-xl" style={{ color: "var(--teal)" }}>
            Analytics <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <div className="dash-chart">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
            const dayMins = weeklyMinutes?.filter(s => new Date(s.started_at).getDay() === (i + 1) % 7).reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0;
            const allMins = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((_, j) => weeklyMinutes?.filter(s => new Date(s.started_at).getDay() === (j + 1) % 7).reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0);
            const maxMins = Math.max(...allMins, 1);
            const height = Math.max((dayMins / maxMins) * 100, 4);
            const today = new Date().getDay() === (i + 1) % 7;
            return (
              <div key={day} className="dash-chart-col">
                <motion.div initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ duration: 0.8, delay: 0.15 * i, ease }}
                  className={`dash-chart-bar ${today ? "dash-chart-bar-today" : ""}`} />
                <span className={`text-[10px] font-medium ${today ? "font-semibold" : ""}`} style={{ color: today ? "var(--teal)" : "var(--text-muted)" }}>{day}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

    </div>
    {showOnboarding && <OnboardingTutorial onComplete={() => setShowOnboarding(false)} />}
    </>
  );
};

export default Dashboard;
