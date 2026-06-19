/**
 * LUMINA DASHBOARD — World-Class Redesign
 * 
 * Design principles:
 * - Negative space is the primary design element
 * - One focal point per section
 * - Typography hierarchy over color
 * - Subtle motion, never decorative
 * - Content-first, chrome-second
 * 
 * Reference: Linear (spacing), Notion (hierarchy), Vercel (dark theme)
 */
import { motion } from "framer-motion";
import {
  Trophy, Flame, Target, Clock, ArrowRight, CheckCircle2, Brain,
  Sparkles, AlertTriangle, MessageSquare, BarChart3, TrendingUp,
  TrendingDown, Zap, Layers, Activity, Crown, Rocket,
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
    if (weakSubjects.length) return `${weakSubjects[0].subject} is your weakest area — ${weakSubjects[0].count} mistakes, mostly ${weakSubjects[0].topMistakeType}.`;
    if (avgScore !== null && avgScore < 70) return "Your scores suggest conceptual gaps that need targeted attention.";
    if (streakDays >= 3) return `Your ${streakDays}-day streak shows excellent consistency.`;
    return "Building a study habit is the most important first step. Even 15 minutes creates momentum.";
  })();

  const insightAction = weakSubjects.length > 0
    ? { text: `Focus on ${weakSubjects[0].subject}`, label: `Practice ${weakSubjects[0].subject}`, url: "/tests" }
    : avgScore !== null && avgScore < 70
    ? { text: "Take a diagnostic test", label: "Take Diagnostic", url: "/tests" }
    : { text: "Start a focused session", label: "Start Session", url: "/study-session" };

  const stats = [
    { icon: Trophy, label: "Level", value: String(profile.level), sub: `${profile.xp % 100}/100 XP` },
    { icon: Flame, label: "Streak", value: `${streakDays}d`, sub: streakDays >= 7 ? "Unstoppable" : streakDays >= 3 ? "On fire" : "Build it up" },
    { icon: Clock, label: "Today", value: totalToday > 0 ? `${hrs}h ${mins}m` : "—", sub: totalToday >= 60 ? "Deep work" : totalToday > 0 ? "Getting started" : "Not yet" },
    { icon: Target, label: "Avg Score", value: avgScore !== null ? `${avgScore}%` : "—", sub: `${recentTests?.length || 0} tests` },
  ];

  const daysStudied = new Set(weeklyMinutes?.map(w => new Date(w.started_at).toDateString())).size;
  const consistency = Math.round((daysStudied / 7) * 100);

  return (
    <>
    <div className="d">

      {/* ═══ HEADER ═══ */}
      <header className="d-header">
        <h1 className="d-title">{getGreeting()}, {userName}.</h1>
        <p className="d-subtitle">Here's where you stand.</p>
      </header>

      {/* ═══ NEURAL INSIGHT — The hero. One focal point. ═══ */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }} className="d-hero">
        <div className="d-hero-main">
          <div className="d-hero-badge">
            <Brain className="w-3.5 h-3.5" />
            <span>Neural Insight</span>
          </div>

          <h2 className="d-hero-headline">
            {avgScore !== null ? (
              <>
                {avgScore >= 70 ? "Strong progress" : "Building momentum"}{userName ? `, ${userName}` : ""}
                {scoreTrend !== null && (
                  <span className={`d-trend ${scoreTrend >= 0 ? "d-trend-up" : "d-trend-down"}`}>
                    {scoreTrend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {scoreTrend >= 0 ? "+" : ""}{scoreTrend}%
                  </span>
                )}
              </>
            ) : (
              <>Welcome back{userName ? `, ${userName}` : ""}</>
            )}
          </h2>

          <div className="d-hero-insights">
            <p><span className="d-insight-label">Observation</span> — {insightObservation}</p>
            <p><span className="d-insight-label">Interpretation</span> — {insightInterpretation}</p>
          </div>

          {Object.keys(subjectScores).length > 0 && (
            <div className="d-subjects">
              {Object.entries(subjectScores).map(([sub, score]) => (
                <span key={sub} className={`d-subject-pill ${score >= 70 ? "d-pill-green" : score >= 50 ? "d-pill-amber" : "d-pill-red"}`}>
                  {sub} <strong>{score}%</strong>
                </span>
              ))}
            </div>
          )}

          <Button onClick={() => navigate(insightAction.url)} size="sm" className="d-cta">
            {insightAction.label} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>

        <div className="d-hero-ring">
          <svg className="d-ring-svg" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="d-ring-bg" />
            <motion.circle cx="50" cy="50" r="42" className="d-ring-fill"
              strokeDasharray={`${2 * Math.PI * 42}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - readinessScore / 100) }}
              transition={{ duration: 1.2, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </svg>
          <div className="d-ring-center">
            <span className="d-ring-value">{avgScore ?? "—"}</span>
            <span className="d-ring-label">Readiness</span>
          </div>
        </div>
      </motion.section>

      {/* ═══ STATS — Minimal, typography-first ═══ */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }} className="d-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="d-stat">
            <div className="d-stat-icon"><stat.icon className="w-4 h-4" /></div>
            <div className="d-stat-info">
              <span className="d-stat-value">{stat.value}</span>
              <span className="d-stat-label">{stat.label}</span>
              <span className="d-stat-sub">{stat.sub}</span>
            </div>
          </div>
        ))}
      </motion.section>

      {/* ═══ TWO COLUMN — Mastery + Plan ═══ */}
      <div className="d-two-col">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }} className="d-card">
          <h3 className="d-card-heading">
            <Layers className="w-4 h-4" />
            Mastery Map
          </h3>
          {Object.keys(subjectScores).length > 0 ? (
            <div className="d-subjects">
              {Object.entries(subjectScores).map(([sub, score]) => (
                <button key={sub} onClick={() => navigate("/weakness-radar")} className={`d-subject-pill ${score >= 70 ? "d-pill-green" : score >= 50 ? "d-pill-amber" : "d-pill-red"}`}>
                  {sub} <strong>{score}%</strong>
                </button>
              ))}
            </div>
          ) : (
            <div className="d-empty">
              <p>Take tests to see your mastery map</p>
              <Button variant="ghost" size="sm" onClick={() => navigate("/tests")} className="d-empty-cta">Take a Test <ArrowRight className="w-3 h-3 ml-1" /></Button>
            </div>
          )}
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }} className="d-card">
          <h3 className="d-card-heading">
            <Zap className="w-4 h-4" />
            Today's Plan
          </h3>
          <div className="d-plan">
            {[
              { label: "Practice weak areas", time: "20 min" },
              { label: "Review flashcards", time: "10 min" },
              { label: "Take a quiz", time: "15 min" },
            ].map((item, i) => (
              <div key={i} className="d-plan-row">
                <span className="d-plan-label">{item.label}</span>
                <span className="d-plan-time">{item.time}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* ═══ UPGRADE — Subtle, not loud ═══ */}
      {!isProPlus && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }} className="d-upgrade">
          <div className="d-upgrade-text">
            <Crown className="w-4 h-4" />
            <span>Unlock Lumina Hub — 10 science-backed brain engines for ₹499/mo</span>
          </div>
          <Button onClick={openPricing} size="sm" className="d-upgrade-btn">
            <Rocket className="w-3.5 h-3.5 mr-1.5" /> Upgrade
          </Button>
        </motion.section>
      )}

      {/* ═══ WEAKNESS RADAR ═══ */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}>
        <div className="d-section-header">
          <h3 className="d-card-heading">
            <Activity className="w-4 h-4" />
            Weakness Radar
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigate("/weakness-radar")} className="d-section-link">
            Full Analysis <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {weakSubjects.length > 0 ? (
          <div className="d-weakness-grid">
            {weakSubjects.map((w, i) => {
              const severity = w.count >= 10 ? "Critical" : w.count >= 5 ? "Needs Work" : "Watch";
              return (
                <motion.button key={w.subject} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                  onClick={() => navigate("/tests")} className="d-weak-card">
                  <div className="d-weak-header">
                    <span className={`d-severity ${w.count >= 10 ? "d-sev-critical" : w.count >= 5 ? "d-sev-warn" : "d-sev-watch"}`}>
                      <AlertTriangle className="w-3 h-3" />{severity}
                    </span>
                    {subjectScores[w.subject] !== undefined && <span className="d-weak-score">{subjectScores[w.subject]}%</span>}
                  </div>
                  <h4 className="d-weak-title">{w.subject}</h4>
                  <p className="d-weak-desc">{w.count} mistakes · {w.topMistakeType}</p>
                  <div className="d-weak-bar-track">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(w.count * 5, 100)}%` }} transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: [0.25, 0.1, 0.25, 1] }} className="d-weak-bar-fill" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="d-empty-card">
            <CheckCircle2 className="w-6 h-6 mb-2" />
            <p className="d-empty-title">Looking good!</p>
            <p className="d-empty-desc">Take tests to discover areas for improvement</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/tests")} className="d-empty-cta">Take a Test <ArrowRight className="w-3 h-3 ml-1" /></Button>
          </div>
        )}
      </motion.section>

      {/* ═══ INTELLIGENCE GRID ═══ */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}>
        <h3 className="d-card-heading mb-4">
          <Sparkles className="w-4 h-4" />
          Intelligence Hub
        </h3>
        <div className="d-actions">
          {[
            { name: "AI Chat", desc: "Ask anything", icon: MessageSquare, url: "/chat" },
            { name: "Generate Test", desc: userSubjects[0] ? `Try ${userSubjects[0]}` : "Any topic", icon: Target, url: "/tests" },
            { name: "Brain Hub", desc: "10 brain engines", icon: Brain, url: "/hub" },
            { name: "All Tools", desc: "9 AI tools", icon: Sparkles, url: "/ai-tools" },
          ].map((action) => (
            <button key={action.name} onClick={() => navigate(action.url)} className="d-action">
              <div className="d-action-icon"><action.icon className="w-5 h-5" /></div>
              <div>
                <span className="d-action-name">{action.name}</span>
                <span className="d-action-desc">{action.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* ═══ WEEKLY CHART ═══ */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }} className="d-card">
        <div className="d-section-header">
          <h3 className="d-card-heading">
            <BarChart3 className="w-4 h-4" />
            Weekly Evolution
          </h3>
          <span className="d-consistency">{daysStudied}/7 days · {consistency}% consistency</span>
        </div>
        <div className="d-chart">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
            const dayMins = weeklyMinutes?.filter(s => new Date(s.started_at).getDay() === (i + 1) % 7).reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0;
            const allMins = [0,1,2,3,4,5,6].map(j => weeklyMinutes?.filter(s => new Date(s.started_at).getDay() === (j + 1) % 7).reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0);
            const maxMins = Math.max(...allMins, 1);
            const height = Math.max((dayMins / maxMins) * 100, 6);
            return (
              <div key={day} className="d-chart-col">
                <motion.div initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ duration: 0.6, delay: 0.1 * i, ease: [0.25, 0.1, 0.25, 1] }} className="d-chart-bar" />
                <span className="d-chart-label">{day}{i === 1 ? day : ""}</span>
              </div>
            );
          })}
        </div>
      </motion.section>

    </div>
    {showOnboarding && <OnboardingTutorial onComplete={() => setShowOnboarding(false)} />}
    </>
  );
};

export default Dashboard;
