/**
 * LUMINA DASHBOARD v3 — Complete Rewrite
 * Fresh start. New class names. New everything.
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

const ease = [0.25, 0.1, 0.25, 1] as const;

export default function Dashboard() {
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

  const rawName = (profile?.display_name?.split(" ")[0]?.trim() || user?.email?.split("@")[0]?.trim() || "").trim();
  const userName = !rawName || /^(lumina|user|student|guest|test|admin|scholar)$/i.test(rawName) ? "back" : rawName;
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
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  };

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
    <div className="v3-dash">

      {/* HEADER */}
      <header className="v3-header">
        <h1 className="v3-title">{getGreeting()}, {userName}.</h1>
        <p className="v3-sub">Here's where you stand.</p>
      </header>

      {/* HERO */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }} className="v3-hero">
        <div className="v3-hero-left">
          <div className="v3-badge"><Brain className="w-3.5 h-3.5" /><span>Neural Insight</span></div>
          <h2 className="v3-headline">
            {avgScore !== null ? <>{avgScore >= 70 ? "Strong progress" : "Building momentum"}, {userName}</> : <>Welcome back, {userName}</>}
          </h2>
          <div className="v3-insights">
            <p><span className="v3-ilabel">Observation</span> — {avgScore !== null && recentTests?.length ? `Your average score is ${avgScore}% across ${recentTests.length} tests.` : `You've studied ${totalToday > 0 ? `${hrs}h ${mins}m today` : "haven't started today yet"}.`}</p>
            <p><span className="v3-ilabel">Interpretation</span> — {weakSubjects.length ? `${weakSubjects[0].subject} is your weakest area — ${weakSubjects[0].count} mistakes.` : avgScore !== null && avgScore < 70 ? "Your scores suggest conceptual gaps." : streakDays >= 3 ? `Your ${streakDays}-day streak shows consistency.` : "Building a habit is the first step."}</p>
          </div>
          {Object.keys(subjectScores).length > 0 && (
            <div className="v3-pills">
              {Object.entries(subjectScores).map(([sub, score]) => (
                <span key={sub} className={`v3-pill ${score >= 70 ? "v3-pill-g" : score >= 50 ? "v3-pill-a" : "v3-pill-r"}`}>{sub} <b>{score}%</b></span>
              ))}
            </div>
          )}
          <Button onClick={() => navigate(weakSubjects.length ? "/tests" : "/study-session")} size="sm" className="v3-cta">
            {weakSubjects.length ? `Practice ${weakSubjects[0].subject}` : "Start Session"} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
        <div className="v3-ring">
          <svg className="v3-ring-svg" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="v3-ring-bg" />
            <motion.circle cx="50" cy="50" r="42" className="v3-ring-fill" strokeDasharray={`${2 * Math.PI * 42}`} initial={{ strokeDashoffset: 2 * Math.PI * 42 }} animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - readiness / 100) }} transition={{ duration: 1.2, delay: 0.3, ease }} />
          </svg>
          <div className="v3-ring-center"><span className="v3-ring-val">{avgScore ?? "—"}</span><span className="v3-ring-lbl">Readiness</span></div>
        </div>
      </motion.section>

      {/* STATS */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4, ease }} className="v3-stats">
        {stats.map(s => (
          <div key={s.label} className="v3-stat">
            <div className="v3-stat-ico"><s.icon className="w-4 h-4" /></div>
            <div><span className="v3-stat-val">{s.value}</span><span className="v3-stat-lbl">{s.label}</span><span className="v3-stat-sub">{s.sub}</span></div>
          </div>
        ))}
      </motion.section>

      {/* TWO COL */}
      <div className="v3-two">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4, ease }} className="v3-card">
          <h3 className="v3-ch"><Layers className="w-4 h-4" />Mastery Map</h3>
          {Object.keys(subjectScores).length > 0 ? (
            <div className="v3-pills">
              {Object.entries(subjectScores).map(([sub, score]) => (
                <button key={sub} onClick={() => navigate("/weakness-radar")} className={`v3-pill ${score >= 70 ? "v3-pill-g" : score >= 50 ? "v3-pill-a" : "v3-pill-r"}`}>{sub} <b>{score}%</b></button>
              ))}
            </div>
          ) : (
            <div className="v3-empty"><p>Take tests to see your mastery map</p><Button variant="ghost" size="sm" onClick={() => navigate("/tests")} className="mt-2 text-xs">Take a Test <ArrowRight className="w-3 h-3 ml-1" /></Button></div>
          )}
        </motion.section>
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4, ease }} className="v3-card">
          <h3 className="v3-ch"><Zap className="w-4 h-4" />Today's Plan</h3>
          <div className="v3-plan">
            {[{ l: "Practice weak areas", t: "20 min" }, { l: "Review flashcards", t: "10 min" }, { l: "Take a quiz", t: "15 min" }].map((x, i) => (
              <div key={i} className="v3-prow"><span>{x.l}</span><span className="v3-ptime">{x.t}</span></div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* UPGRADE */}
      {!isProPlus && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4, ease }} className="v3-upgrade">
          <div className="v3-upg-text"><Crown className="w-4 h-4" /><span>Unlock Lumina Hub — 10 brain engines for ₹499/mo</span></div>
          <Button onClick={openPricing} size="sm" className="v3-upg-btn"><Rocket className="w-3.5 h-3.5 mr-1.5" />Upgrade</Button>
        </motion.section>
      )}

      {/* WEAKNESS */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4, ease }}>
        <div className="v3-sh"><h3 className="v3-ch"><Activity className="w-4 h-4" />Weakness Radar</h3><Button variant="ghost" size="sm" onClick={() => navigate("/weakness-radar")} className="v3-slink">Full Analysis <ArrowRight className="w-3 h-3 ml-1" /></Button></div>
        {weakSubjects.length > 0 ? (
          <div className="v3-weak-grid">
            {weakSubjects.map((w, i) => (
              <motion.button key={w.subject} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08, duration: 0.35, ease }} onClick={() => navigate("/tests")} className="v3-weak-card">
                <div className="v3-weak-hdr"><span className={`v3-sev ${w.count >= 10 ? "v3-sev-c" : w.count >= 5 ? "v3-sev-w" : "v3-sev-n"}`}><AlertTriangle className="w-3 h-3" />{w.count >= 10 ? "Critical" : w.count >= 5 ? "Needs Work" : "Watch"}</span></div>
                <h4 className="v3-weak-title">{w.subject}</h4>
                <p className="v3-weak-desc">{w.count} mistakes · {w.topMistakeType}</p>
                <div className="v3-weak-track"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(w.count * 5, 100)}%` }} transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease }} className="v3-weak-fill" /></div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="v3-empty-card"><CheckCircle2 className="w-6 h-6 mb-2" /><p className="v3-empty-title">Looking good!</p><p className="v3-empty-desc">Take tests to discover areas for improvement</p><Button variant="outline" size="sm" onClick={() => navigate("/tests")} className="mt-4 rounded-xl text-xs">Take a Test <ArrowRight className="w-3 h-3 ml-1" /></Button></div>
        )}
      </motion.section>

      {/* ACTIONS */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4, ease }}>
        <h3 className="v3-ch mb-4"><Sparkles className="w-4 h-4" />Intelligence Hub</h3>
        <div className="v3-actions">
          {[{ n: "AI Chat", d: "Ask anything", i: MessageSquare, u: "/chat" }, { n: "Generate Test", d: userSubjects[0] ? `Try ${userSubjects[0]}` : "Any topic", i: Target, u: "/tests" }, { n: "Brain Hub", d: "10 brain engines", i: Brain, u: "/hub" }, { n: "All Tools", d: "9 AI tools", i: Sparkles, u: "/ai-tools" }].map(a => (
            <button key={a.n} onClick={() => navigate(a.u)} className="v3-action"><div className="v3-action-ico"><a.i className="w-5 h-5" /></div><span className="v3-action-name">{a.n}</span><span className="v3-action-desc">{a.d}</span></button>
          ))}
        </div>
      </motion.section>

      {/* CHART */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4, ease }} className="v3-card">
        <div className="v3-sh"><h3 className="v3-ch"><BarChart3 className="w-4 h-4" />Weekly Evolution</h3><span className="v3-consistency">{daysStudied}/7 days · {consistency}% consistency</span></div>
        <div className="v3-chart">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
            const dm = weeklyMinutes?.filter(s => new Date(s.started_at).getDay() === (i + 1) % 7).reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0;
            const mx = Math.max(...[0,1,2,3,4,5,6].map(j => weeklyMinutes?.filter(s => new Date(s.started_at).getDay() === (j + 1) % 7).reduce((sum, s) => sum + Math.min(s.duration_minutes || 0, 1440), 0) || 0), 1);
            return <div key={day} className="v3-chart-col"><motion.div initial={{ height: 0 }} animate={{ height: `${Math.max((dm / mx) * 100, 6)}%` }} transition={{ duration: 0.6, delay: 0.1 * i, ease }} className="v3-chart-bar" /><span className="v3-chart-lbl">{day}</span></div>;
          })}
        </div>
      </motion.section>

    </div>
    {showOnboarding && <OnboardingTutorial onComplete={() => setShowOnboarding(false)} />}
    </>
  );
}
