/**
 * First-run tutorial overlay.
 *
 * Mounted from App.tsx for authenticated users who have completed onboarding
 * but not yet seen the tutorial. Shows 4 best-fit features tailored to the
 * goal they selected at signup (exams / mastery / revision / practice), so
 * the website no longer feels overwhelming on day one.
 *
 * Persistence: localStorage key `lumina_tutorial_seen_v1`. We deliberately
 * avoid a database column for this — it's purely client UX.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  X,
  ArrowRight,
  Target,
  Brain,
  Zap,
  Pencil,
  Compass,
  Cpu,
  Sparkles,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

const STORAGE_KEY = "lumina_tutorial_seen_v1";

type GoalId = "exams" | "mastery" | "revision" | "practice" | "default";

interface FeatureCard {
  title: string;
  body: string;
  cta: string;
  to: string;
  icon: LucideIcon;
}

// 4 best-fit features per goal — kept simple and outcome-led so a brand-new
// user instantly knows where to start instead of facing the entire menu.
const TUTORIALS: Record<GoalId, { headline: string; sub: string; features: FeatureCard[] }> = {
  exams: {
    headline: "Your exam-prep starter kit",
    sub: "Four tools, in order. Spend 10 minutes in each — that's your first week.",
    features: [
      { title: "Weakness Radar", body: "Take one diagnostic. It shows what's leaking marks before you waste time anywhere else.", cta: "Open Weakness Radar", to: "/weakness-radar", icon: Target },
      { title: "Study Planner", body: "Generates a day-by-day plan that targets the gaps from your radar.", cta: "Build my plan", to: "/study-planner", icon: Compass },
      { title: "Smart Tests", body: "AI-built mock papers focused on the topics you actually need.", cta: "Generate a test", to: "/tests", icon: Pencil },
      { title: "Lumina Computer", body: "Ask for a custom revision sheet, formula card, or interactive simulator.", cta: "Open Computer", to: "/computer", icon: Cpu },
    ],
  },
  mastery: {
    headline: "Your concept-mastery starter kit",
    sub: "These four build deep understanding, not just answers.",
    features: [
      { title: "Guided Lesson", body: "Teach -> check -> feedback loop. The system explains a concept three ways until one clicks.", cta: "Start a lesson", to: "/guided-lesson", icon: Brain },
      { title: "Doubt Solver", body: "Step-by-step explanations with the *why*, not just the answer.", cta: "Ask a doubt", to: "/doubt-solver", icon: Sparkles },
      { title: "Notes Generator", body: "Turn any topic into clean structured notes with worked examples.", cta: "Generate notes", to: "/notes-generator", icon: BookOpen },
      { title: "Lumina Computer", body: "Ask for an interactive simulator or visualization of any concept.", cta: "Open Computer", to: "/computer", icon: Cpu },
    ],
  },
  revision: {
    headline: "Your fast-revision starter kit",
    sub: "Pick one, do it now. Build the habit.",
    features: [
      { title: "Quick Study", body: "60-second briefings on any topic — perfect right before a class or test.", cta: "Quick Study", to: "/quick-study", icon: Zap },
      { title: "Flashcards", body: "Spaced-repetition decks generated from your notes or any topic you name.", cta: "Open flashcards", to: "/flashcards", icon: BookOpen },
      { title: "Smart Notebook", body: "All your AI-generated notes in one place, organized by subject.", cta: "Open notebook", to: "/smart-notebook", icon: Pencil },
      { title: "Lecture AI", body: "Drop a recording or PDF and get structured notes, flashcards, and a quiz in one pass.", cta: "Open Lecture AI", to: "/lecture-ai", icon: Sparkles },
    ],
  },
  practice: {
    headline: "Your practice-first starter kit",
    sub: "Do the reps. The system will spot patterns in what you miss.",
    features: [
      { title: "Smart Tests", body: "AI-generated tests on any topic, any difficulty, any time.", cta: "Generate a test", to: "/tests", icon: Pencil },
      { title: "Doubt Solver", body: "Stuck on a question? Paste it in and get a step-by-step walkthrough.", cta: "Solve a doubt", to: "/doubt-solver", icon: Brain },
      { title: "Weakness Radar", body: "Every wrong answer becomes a tagged weakness you can target.", cta: "See my weaknesses", to: "/weakness-radar", icon: Target },
      { title: "Game Modes", body: "Boss battles and timed challenges that make practice feel less like work.", cta: "Open game modes", to: "/game-modes", icon: Sparkles },
    ],
  },
  default: {
    headline: "Start with these four",
    sub: "The four features most students use in their first week.",
    features: [
      { title: "Lumina Computer", body: "Ask for anything — a study sheet, a simulator, a quiz, a custom app. The flagship.", cta: "Open Computer", to: "/computer", icon: Cpu },
      { title: "Weakness Radar", body: "One diagnostic shows exactly which topics are costing you marks.", cta: "Open radar", to: "/weakness-radar", icon: Target },
      { title: "Study Planner", body: "An AI-built timetable tailored to your goal and time.", cta: "Build my plan", to: "/study-planner", icon: Compass },
      { title: "Doubt Solver", body: "Step-by-step solutions to anything you're stuck on.", cta: "Ask a doubt", to: "/doubt-solver", icon: Brain },
    ],
  },
};

function readGoalFromPrefs(extra: unknown): GoalId {
  if (typeof extra !== "string") return "default";
  try {
    const parsed = JSON.parse(extra) as { goal?: string };
    const g = parsed?.goal;
    if (g === "exams" || g === "mastery" || g === "revision" || g === "practice") return g;
    return "default";
  } catch {
    return "default";
  }
}

export const TutorialOverlay = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<GoalId>("default");

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("extra_preferences")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      // Only show after onboarding has completed (extra_preferences is set).
      if (!data?.extra_preferences) return;
      setGoal(readGoalFromPrefs(data.extra_preferences));
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    setOpen(false);
  };

  const jumpTo = (path: string) => {
    dismiss();
    navigate(path);
  };

  const tutorial = TUTORIALS[goal];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-md px-4 py-6"
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#0e0e14] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] overflow-hidden"
          >
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-full text-white/50 hover:text-white hover:bg-white/[0.06] transition"
              title="Skip tutorial"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-7 md:p-9">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/40 mb-2">
                Welcome to Lumina
              </div>
              <h2 className="text-[24px] md:text-[28px] font-semibold text-white tracking-tight">
                {tutorial.headline}
              </h2>
              <p className="text-[14px] text-white/55 mt-1.5">{tutorial.sub}</p>

              <div className="mt-7 grid sm:grid-cols-2 gap-3">
                {tutorial.features.map((f, i) => {
                  const Icon = f.icon;
                  return (
                    <motion.button
                      key={f.title}
                      onClick={() => jumpTo(f.to)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.04 }}
                      className="group text-left rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white/[0.05] grid place-items-center text-white/80 group-hover:text-white">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-medium text-white">{f.title}</div>
                          <p className="text-[12.5px] text-white/55 leading-[1.5] mt-1">{f.body}</p>
                          <div className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-white/70 group-hover:text-white">
                            {f.cta}
                            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 pt-5 border-t border-white/[0.05]">
                <p className="text-[11.5px] text-white/40">
                  You can revisit any of these from the sidebar at any time.
                </p>
                <button
                  onClick={dismiss}
                  className="px-4 h-8 rounded-full bg-white text-black text-[12px] font-medium hover:bg-white/90 transition"
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
