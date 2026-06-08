import { useState } from "react";
import { Gamepad2, Layers, BarChart3, Calculator, Sparkles, BookOpen, Trophy, Brain, Loader2, RefreshCcw, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { attemptGeneration } from "@/features/chat/utils/generationWrapper";

type ArtifactKind = "notes" | "exam" | "slides" | "code";

interface Preset {
  id: string;
  label: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  type: ArtifactKind;
  prompt: string;
  topic: string;
  accent: string;
}

const PRESETS: Preset[] = [
  {
    id: "game-quiz",
    label: "Quiz Arcade Game",
    blurb: "Timed, score-tracking quiz with sound and particle feedback",
    icon: Gamepad2,
    type: "code",
    topic: "Quiz Arcade Game",
    prompt:
      "Build an interactive arcade-style quiz game. 10 multiple-choice questions about general knowledge. Timer per question, animated score counter, sound feedback on right/wrong, confetti on completion, leaderboard saved in localStorage. 60fps animations.",
    accent: "from-fuchsia-500/30 to-purple-600/20",
  },
  {
    id: "flashcards",
    label: "Flashcard Deck",
    blurb: "20 study cards with 3D flip animation and shuffle",
    icon: Layers,
    type: "code",
    topic: "Flashcard Deck",
    prompt:
      "Create an elegant flashcard study deck of 20 cards on a topic of your choice. 3D flip on click, shuffle, mark-known, progress bar, keyboard arrow navigation, and a 'Studied X of 20' counter.",
    accent: "from-teal-400/30 to-cyan-500/20",
  },
  {
    id: "dashboard",
    label: "Data Dashboard",
    blurb: "Multi-panel analytics with Chart.js, KPIs, filters",
    icon: BarChart3,
    type: "code",
    topic: "Analytics Dashboard",
    prompt:
      "Generate a beautiful analytics dashboard: 4 KPI tiles, a line chart, bar chart, pie chart (Chart.js CDN), a sortable table, and a date-range filter that updates all charts. Use realistic mock data.",
    accent: "from-blue-500/30 to-indigo-600/20",
  },
  {
    id: "calculator",
    label: "Scientific Calculator",
    blurb: "Full sci-cal with history, themes, keyboard support",
    icon: Calculator,
    type: "code",
    topic: "Scientific Calculator",
    prompt:
      "Build a polished scientific calculator: trig, log, exp, parentheses, memory, history panel, keyboard input, theme toggle (light/dark), and elegant button press animations.",
    accent: "from-emerald-400/30 to-teal-600/20",
  },
  {
    id: "memory-game",
    label: "Memory Match Game",
    blurb: "Card-matching with timer, moves counter and high score",
    icon: Brain,
    type: "code",
    topic: "Memory Match Game",
    prompt:
      "Create a memory card-matching game. 16 cards (8 pairs), flip animations, moves counter, timer, win celebration with confetti, high-score persisted to localStorage. Mobile friendly.",
    accent: "from-orange-400/30 to-rose-500/20",
  },
  {
    id: "study-notes",
    label: "Visual Study Notes",
    blurb: "Beautiful one-page summary with diagrams and callouts",
    icon: BookOpen,
    type: "notes",
    topic: "Photosynthesis",
    prompt:
      "Generate richly designed visual study notes on Photosynthesis: hero section, labelled SVG diagram, step-by-step process, equations, key-term glossary, mnemonics, and a 5-question self-check.",
    accent: "from-lime-400/30 to-emerald-500/20",
  },
  {
    id: "mock-exam",
    label: "Mock Exam Paper",
    blurb: "Timed exam-style paper with mark scheme",
    icon: Trophy,
    type: "exam",
    topic: "Mock Exam",
    prompt:
      "Create a complete mock exam paper (15 questions: MCQ, short answer, long answer) with an instructions header, timer, and a collapsible mark scheme at the bottom.",
    accent: "from-amber-400/30 to-orange-600/20",
  },
  {
    id: "pitch-deck",
    label: "Pitch Deck",
    blurb: "8-slide deck with keyboard navigation",
    icon: Sparkles,
    type: "slides",
    topic: "Startup Pitch",
    prompt:
      "Generate an 8-slide pitch deck (title, problem, solution, market, product, traction, team, ask). Full-screen sections, keyboard arrow navigation, slide counter, smooth transitions.",
    accent: "from-violet-400/30 to-fuchsia-600/20",
  },
];

export default function ArtifactGallery() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<{ html: string; preset: Preset } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const run = async (preset: Preset) => {
    setGenerating(preset.id);
    setStage("Queueing…");
    setResult(null);
    try {
      const out = await attemptGeneration({
        prompt: preset.prompt,
        type: preset.type,
        topic: preset.topic,
        onStage: setStage,
        timeoutMs: 480_000,
      });
      if (out.success) {
        setResult({ html: out.content, preset });
        toast.success(`${preset.label} ready`);
      } else {
        toast.error(out.error || "Generation failed");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(null);
      setStage("");
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/5 px-3 py-1 text-xs text-teal-300 mb-4">
          <Sparkles className="w-3.5 h-3.5" /> Artifact Gallery
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-2">One-click artifacts</h1>
        <p className="text-muted-foreground max-w-2xl">
          Hand-tuned prompts that generate complete, interactive HTML artifacts in seconds. Click any tile to build it.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {PRESETS.map((p) => {
          const Icon = p.icon;
          const isLoading = generating === p.id;
          return (
            <button
              key={p.id}
              onClick={() => run(p)}
              disabled={!!generating}
              className="group relative text-left rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur p-5 transition hover:border-teal-400/40 hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${p.accent} opacity-40 group-hover:opacity-70 transition-opacity pointer-events-none`} />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center mb-4 border border-white/10">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                </div>
                <h3 className="font-semibold text-base mb-1">{p.label}</h3>
                <p className="text-xs text-white/60 leading-relaxed">{p.blurb}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-teal-300/80">
                  {p.type} · click to build
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {generating && (
        <div className="mt-8 rounded-2xl border border-teal-500/20 bg-teal-500/5 p-5 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-teal-300" />
          <div>
            <div className="font-medium">Building your artifact</div>
            <div className="text-sm text-white/60">{stage}</div>
          </div>
        </div>
      )}

      {result && (
        <div className={`mt-10 rounded-2xl border border-white/10 overflow-hidden bg-black ${fullscreen ? "fixed inset-0 z-50 m-0 rounded-none" : ""}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-2 text-sm">
              <result.preset.icon className="w-4 h-4 text-teal-300" />
              <span className="font-medium">{result.preset.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => run(result.preset)}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 flex items-center gap-1.5"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Regenerate
              </button>
              <button
                onClick={() => setFullscreen((v) => !v)}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 flex items-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5" /> {fullscreen ? "Exit" : "Fullscreen"}
              </button>
            </div>
          </div>
          <iframe
            title={result.preset.label}
            srcDoc={result.html}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className={`w-full ${fullscreen ? "h-[calc(100vh-49px)]" : "h-[720px]"} bg-white`}
          />
        </div>
      )}
    </div>
  );
}
