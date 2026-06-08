import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface Props {
  stage: string;
  active: boolean;
}

interface Substage {
  key: string;
  until: number; // seconds
  label: string;
  explain: string;
}

const SUBSTAGES: Substage[] = [
  {
    key: "queue",
    until: 5,
    label: "Queueing background job…",
    explain:
      "The request is being routed to an available free model. This usually takes a couple of seconds; longer means the gateway is busy.",
  },
  {
    key: "route",
    until: 18,
    label: "Starting model route…",
    explain:
      "Lumina is picking the best free model for this task (long context, vision, or quality-tier) and warming up the stream.",
  },
  {
    key: "write",
    until: 45,
    label: "Writing content…",
    explain:
      "The model is generating the body of the artifact: text, calculations, structure, and any embedded HTML or code.",
  },
  {
    key: "style",
    until: 90,
    label: "Adding styles and interactions…",
    explain:
      "Adding CSS, layout polish, and any working JavaScript (sliders, MCQs, math). Heavy artifacts spend most of their time here.",
  },
  {
    key: "finalise",
    until: 180,
    label: "Finalising in background…",
    explain:
      "Large outputs are completed by a background job. You can close this tab — when it's done you'll find it under your saved items.",
  },
  {
    key: "keepalive",
    until: Infinity,
    label: "Still working — keeping the job alive…",
    explain:
      "Very large artifacts can take a few minutes. Credits only charge after a successful result, so it's safe to wait.",
  },
];

/**
 * Smooth, monotonically-increasing fake progress that reaches ~94% over a few minutes.
 * Real progress comes when the artifact actually arrives — we then jump to 100.
 */
export const LoadingStages = ({ stage, active }: Props) => {
  const [pct, setPct] = useState(0);
  const [sub, setSub] = useState<Substage>(SUBSTAGES[0]);

  useEffect(() => {
    if (!active) {
      setPct(0);
      return;
    }
    setPct(2);
    const start = Date.now();
    const id = setInterval(() => {
      const t = (Date.now() - start) / 1000;
      const target = Math.min(94, 94 * (1 - Math.exp(-t / 70)));
      setPct((prev) => Math.max(prev, +target.toFixed(1)));
      const next = SUBSTAGES.find((s) => t < s.until) ?? SUBSTAGES[SUBSTAGES.length - 1];
      setSub(next);
    }, 350);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="px-4 py-3 rounded-xl bg-card/40 border border-border">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 gap-2">
        <span className="flex items-center gap-2 min-w-0 truncate">
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate cursor-help inline-flex items-center gap-1">
                {stage || sub.label}
                <Info className="w-3 h-3 opacity-50" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-[11.5px] leading-snug">
              {sub.explain}
            </TooltipContent>
          </Tooltip>
        </span>
        <span className="tabular-nums opacity-70 shrink-0">{Math.round(pct)}%</span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-border/40 overflow-hidden">
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-primary to-primary/60"
        />
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground/70">
        {sub.label} · artifact jobs can take a few minutes — credits only charge
        on success
      </div>
    </div>
  );
};
