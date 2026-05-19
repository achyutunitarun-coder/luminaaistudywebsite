import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type TerminalLine = {
  type: "command" | "info" | "success" | "warning" | "error" | "progress";
  text: string;
  ts: number;
};

const COLORS: Record<TerminalLine["type"], { color: string; prefix: string }> = {
  command: { color: "#58a6ff", prefix: "❯ " },
  info: { color: "#8b949e", prefix: "  " },
  success: { color: "#3fb950", prefix: "✓ " },
  warning: { color: "#d29922", prefix: "⚠ " },
  error: { color: "#f85149", prefix: "✗ " },
  progress: { color: "#bc8cff", prefix: "◈ " },
};

interface Props {
  lines: TerminalLine[];
  done: boolean;
  error?: string;
  onRetry?: () => void;
}

export const GenerationTerminal = ({ lines, done, error, onRetry }: Props) => {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 250);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const headerBg = done ? (error ? "#2e1a1a" : "#1a2e1a") : "#161b22";
  const headerTitle = done ? (error ? "✗ Generation failed" : "✓ Generation complete") : "Lumina AI — generating...";

  return (
    <div
      className="rounded-[10px] overflow-hidden font-mono text-[12px] md:text-[13px] shadow-lg"
      style={{ background: "#0d1117", border: "1px solid #30363d" }}
    >
      {/* Header */}
      <div
        className="flex items-center px-3 py-2 gap-2"
        style={{ background: headerBg, borderBottom: "1px solid #30363d" }}
      >
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: done && !error ? "#3fb950" : "#ff5f57" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: done && !error ? "#3fb950" : "#febc2e" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
        </div>
        <span className="text-[11px]" style={{ color: "#8b949e", marginLeft: 6 }}>{headerTitle}</span>
        <span className="ml-auto text-[10px]" style={{ color: "#6e7681" }}>
          Elapsed: {mm}:{ss}
        </span>
      </div>

      {/* Body */}
      <div
        className="px-3 py-2.5 max-h-[280px] overflow-auto scrollbar-thin"
        style={{ background: "#0d1117" }}
      >
        <AnimatePresence initial={false}>
          {lines.map((line, i) => {
            const c = COLORS[line.type];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12 }}
                className="leading-[1.6] whitespace-pre-wrap break-words"
                style={{ color: c.color }}
              >
                <span>{c.prefix}</span>
                <span>{line.text}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!done && (
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ color: "#bc8cff" }}
          >
            █
          </motion.span>
        )}
        <div ref={endRef} />
      </div>

      {error && onRetry && (
        <div className="px-3 py-2 border-t" style={{ borderColor: "#30363d", background: "#161b22" }}>
          <button
            onClick={onRetry}
            className="text-[11px] px-3 py-1 rounded"
            style={{ background: "#30363d", color: "#e6edf3" }}
          >
            ↻ Try again
          </button>
        </div>
      )}
    </div>
  );
};
