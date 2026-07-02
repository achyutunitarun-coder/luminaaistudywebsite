import { motion, AnimatePresence } from "framer-motion";
import {
  Search, FileText, Table, Presentation, Globe, Sparkles, ArrowRight, X, Check,
} from "lucide-react";
import { useState } from "react";

export type LuminaMode = "research" | "doc" | "sheet" | "slide" | "website";

interface Props {
  selected: LuminaMode | null;
  onSelect: (mode: LuminaMode | null) => void;
  onSend: (mode: LuminaMode, prompt: string) => void;
  active: boolean;
}

const MODES: {
  key: LuminaMode;
  label: string;
  icon: typeof Search;
  desc: string;
  detail: string;
  gradient: string;
  gradientHover: string;
  accent: string;
  glow: string;
}[] = [
  {
    key: "research",
    label: "Deep Research",
    icon: Search,
    desc: "Multi-source investigation",
    detail: "Async deep-dive with planning, multi-source collection, citation synthesis, and follow-up Q&A. Outputs comprehensive reports with verification. Best for complex topics requiring thorough analysis.",
    gradient: "from-violet-600/40 via-purple-600/20 to-transparent",
    gradientHover: "from-violet-500/50 via-purple-500/30 to-transparent",
    accent: "#8B5CF6",
    glow: "rgba(139,92,246,0.3)",
  },
  {
    key: "doc",
    label: "Documents",
    icon: FileText,
    desc: "Polished writing & reports",
    detail: "Outline-first document generation with self-verification. Supports LaTeX, inline review, bulk templated generation. Produces DOCX and PDF output. Ideal for research papers, reports, and formal writing.",
    gradient: "from-blue-600/40 via-sky-600/20 to-transparent",
    gradientHover: "from-blue-500/50 via-sky-500/30 to-transparent",
    accent: "#3B82F6",
    glow: "rgba(59,130,246,0.3)",
  },
  {
    key: "sheet",
    label: "Sheets",
    icon: Table,
    desc: "Smart spreadsheets",
    detail: "Schema-first spreadsheet design with correct formulas tied to actual column ranges. Auto-builds summary layers (grouped/aggregated) and chart-ready data. Includes visible assumptions section and formula verification.",
    gradient: "from-emerald-600/40 via-green-600/20 to-transparent",
    gradientHover: "from-emerald-500/50 via-green-500/30 to-transparent",
    accent: "#10B981",
    glow: "rgba(16,185,129,0.3)",
  },
  {
    key: "slide",
    label: "Slides",
    icon: Presentation,
    desc: "Presentation decks",
    detail: "Two-stage pipeline: narrative outline → per-slide content generation with editable outline checkpoint. Speaker notes, visual annotations, optional live data integration. Outputs structured slide content ready for PPTX.",
    gradient: "from-pink-600/40 via-rose-600/20 to-transparent",
    gradientHover: "from-pink-500/50 via-rose-500/30 to-transparent",
    accent: "#EC4899",
    glow: "rgba(236,72,153,0.3)",
  },
  {
    key: "website",
    label: "Websites",
    icon: Globe,
    desc: "Complete frontend code",
    detail: "Site-map-first generation producing multi-page HTML with embedded CSS/JS. Conversational region-editing via addressable sections. Uses visual reference context. Self-checks output and can deploy to preview URLs.",
    gradient: "from-cyan-600/40 via-teal-600/20 to-transparent",
    gradientHover: "from-cyan-500/50 via-teal-500/30 to-transparent",
    accent: "#06B6D4",
    glow: "rgba(6,182,212,0.3)",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 180, damping: 18 },
  },
};

export const LuminaModePicker = ({ selected, onSelect, onSend, active }: Props) => {
  const [expanded, setExpanded] = useState<LuminaMode | null>(null);

  const handleToggle = (mode: LuminaMode) => {
    if (selected === mode) {
      onSelect(null);
      setExpanded(null);
    } else {
      onSelect(mode);
      setExpanded(mode);
    }
  };

  return (
    <div className="w-full max-w-[720px] mx-auto mt-6 mb-2">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-1"
      >
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[var(--brand)] to-[var(--teal)] flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Lumina Modes — Specialized Output
          </span>
          {selected && (
            <button
              type="button"
              onClick={() => { onSelect(null); setExpanded(null); }}
              className="ml-auto text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-5 gap-2.5">
          {MODES.map((mode) => {
            const isSelected = selected === mode.key;
            const isExpanded = expanded === mode.key;
            const Icon = mode.icon;

            return (
              <motion.button
                key={mode.key}
                variants={cardVariants}
                type="button"
                onClick={() => handleToggle(mode.key)}
                className={`relative group flex flex-col items-center text-center p-3 rounded-xl border transition-all duration-300 ${
                  isSelected
                    ? "border-transparent shadow-lg shadow-[var(--color-glow)]"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                }`}
                style={{
                  background: isSelected
                    ? `linear-gradient(135deg, ${mode.accent}22, ${mode.accent}08)`
                    : "var(--bg-surface)",
                  "--color-glow": mode.glow,
                  boxShadow: isSelected ? `0 0 24px ${mode.glow}, inset 0 1px 0 ${mode.accent}44` : undefined,
                } as React.CSSProperties}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: mode.accent }}
                  >
                    <Check className="w-3 h-3 text-white" />
                  </motion.div>
                )}

                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-all duration-300 group-hover:scale-110"
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${mode.accent}33, ${mode.accent}11)`
                      : "var(--bg-elevated)",
                    border: isSelected ? `1px solid ${mode.accent}44` : "1px solid var(--border-faint)",
                    boxShadow: isSelected ? `0 0 16px ${mode.glow}` : undefined,
                  }}
                >
                  <Icon
                    className="w-5 h-5 transition-all duration-300"
                    style={{
                      color: isSelected ? mode.accent : "var(--text-secondary)",
                      filter: isSelected ? `drop-shadow(0 0 4px ${mode.glow})` : undefined,
                    }}
                  />
                </div>

                <span
                  className="text-[11px] font-semibold leading-tight transition-colors duration-300"
                  style={{
                    color: isSelected ? mode.accent : "var(--text-primary)",
                  }}
                >
                  {mode.label}
                </span>
                <span className="text-[9.5px] text-[var(--text-muted)] leading-tight mt-0.5 line-clamp-1">
                  {mode.desc}
                </span>

                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mt-2 w-full"
                  >
                    <div
                      className="w-full h-[2px] rounded-full opacity-40"
                      style={{ background: `linear-gradient(90deg, transparent, ${mode.accent}, transparent)` }}
                    />
                  </motion.div>
                )}

                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${mode.accent}11, transparent 60%)`,
                  }}
                />
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence>
          {selected && (() => {
            const mode = MODES.find(m => m.key === selected)!;
            return (
              <motion.div
                key="detail"
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div
                  className="mt-2.5 p-3.5 rounded-xl border"
                  style={{
                    background: `linear-gradient(135deg, ${mode.accent}0a, transparent)`,
                    borderColor: `${mode.accent}22`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: `${mode.accent}18`,
                        border: `1px solid ${mode.accent}33`,
                      }}
                    >
                      <mode.icon className="w-4 h-4" style={{ color: mode.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                        {mode.detail}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium cursor-pointer hover:brightness-110 transition-all"
                          style={{
                            background: mode.accent,
                            color: "#fff",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSend(selected, "");
                          }}
                        >
                          <ArrowRight className="w-3 h-3" />
                          Start in {mode.label} Mode
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(null);
                          }}
                          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
