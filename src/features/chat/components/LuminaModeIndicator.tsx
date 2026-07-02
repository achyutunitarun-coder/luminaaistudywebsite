import { motion } from "framer-motion";
import { Search, FileText, Table, Presentation, Globe, X, Loader2 } from "lucide-react";
import type { LuminaMode } from "./LuminaModePicker";

interface Props {
  mode: LuminaMode;
  onClear: () => void;
  isRunning?: boolean;
  statusMessage?: string;
}

const MODE_META: Record<LuminaMode, {
  label: string; icon: typeof Search; color: string;
  stages: string[];
}> = {
  research: {
    label: "Deep Research",
    icon: Search,
    color: "#8B5CF6",
    stages: ["Planning", "Searching", "Collecting", "Synthesizing", "Verifying"],
  },
  doc: {
    label: "Documents",
    icon: FileText,
    color: "#3B82F6",
    stages: ["Outlining", "Writing", "Verifying"],
  },
  sheet: {
    label: "Sheets",
    icon: Table,
    color: "#10B981",
    stages: ["Designing schema", "Building tables", "Computing formulas", "Verifying"],
  },
  slide: {
    label: "Slides",
    icon: Presentation,
    color: "#EC4899",
    stages: ["Outlining narrative", "Writing slides", "Verifying"],
  },
  website: {
    label: "Websites",
    icon: Globe,
    color: "#06B6D4",
    stages: ["Mapping site structure", "Generating pages", "Verifying"],
  },
};

export const LuminaModeIndicator = ({ mode, onClear, isRunning, statusMessage }: Props) => {
  const meta = MODE_META[mode];
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, x: -8 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        className="flex items-center gap-2 px-2.5 py-1 rounded-full"
        style={{
          background: `${meta.color}14`,
          border: `1px solid ${meta.color}33`,
        }}
      >
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{
            background: `${meta.color}22`,
          }}
        >
          <Icon className="w-3 h-3" style={{ color: meta.color }} />
        </div>
        <span className="text-[11px] font-semibold" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </motion.div>

      {isRunning && (
        <div className="flex items-center gap-1.5">
          {meta.stages.map((stage, i) => (
            <div
              key={stage}
              className="flex items-center gap-1"
            >
              <div
                className="w-1.5 h-1.5 rounded-full transition-all duration-500"
                style={{
                  background: i === 0 ? meta.color : "var(--border-default)",
                  boxShadow: i === 0 ? `0 0 6px ${meta.color}` : undefined,
                  animation: i === 0 ? "pulse 1.4s ease-in-out infinite" : undefined,
                }}
              />
            </div>
          ))}
          {statusMessage && (
            <span className="text-[10px] text-[var(--text-muted)] ml-1 truncate max-w-[160px]">
              {statusMessage}
            </span>
          )}
        </div>
      )}

      {!isRunning && (
        <button
          type="button"
          onClick={onClear}
          className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
          style={{ color: "var(--text-muted)" }}
          title="Exit Lumina mode"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
