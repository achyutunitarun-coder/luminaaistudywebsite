// Visual cards for the 6-agent Lumina pipeline.
// Backed by useLuminaPipeline. Drop in anywhere — it shows per-stage
// status (idle / working / done / error) with Apple-clean styling.

import { CheckCircle2, Loader2, AlertCircle, Circle } from "lucide-react";
import type { PipelineStage, StageStatus } from "@/hooks/useLuminaPipeline";

const ORDER: PipelineStage[] = [
  "orchestrate",
  "plan",
  "research",
  "build",
  "debug",
  "optimize",
];

const LABEL: Record<PipelineStage, string> = {
  orchestrate: "Orchestrator",
  plan: "Planner",
  research: "Research",
  build: "Builder",
  debug: "Debug",
  optimize: "Optimizer",
};

const SUBTITLE: Record<PipelineStage, string> = {
  orchestrate: "Breaking your request into subtasks.",
  plan: "Sequencing the execution steps.",
  research: "Gathering facts, formulas, examples.",
  build: "Producing the artifact.",
  debug: "Reviewing for correctness.",
  optimize: "Polishing the final output.",
};

function StatusIcon({ status }: { status: StageStatus }) {
  if (status === "working") return <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />;
  if (status === "done") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === "error") return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
  return <Circle className="w-3.5 h-3.5 text-white/25" />;
}

interface Props {
  states: Record<PipelineStage, StageStatus>;
  activeLabel?: string | null;
  running?: boolean;
  compact?: boolean;
  skills?: Array<{ id: string; label: string; icon: string }>;
  tier?: "TIER_3" | "TIER_2" | "TIER_1" | null;
}

export function AgentPipelinePanel({ states, activeLabel, running, compact, skills, tier }: Props) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-white/[0.05]">
        <span className="text-[11px] font-medium text-white/55 tracking-wide uppercase">
          Agent Pipeline
        </span>
        {running && activeLabel && (
          <span className="ml-auto text-[11px] text-emerald-400/80 truncate">
            {activeLabel}…
          </span>
        )}
      </div>

      {(skills && skills.length > 0) || tier ? (
        <div className="px-3.5 py-2 flex flex-wrap items-center gap-1.5 border-b border-white/[0.04] bg-white/[0.015]">
          {skills?.map((s) => (
            <span
              key={s.id}
              title={s.label}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium text-emerald-300/90 bg-emerald-400/[0.08] border border-emerald-400/20"
            >
              <span>{s.icon}</span>
              <span className="truncate max-w-[110px]">{s.label}</span>
            </span>
          ))}
          {tier && (
            <span
              className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                tier === "TIER_1"
                  ? "text-amber-300 bg-amber-400/[0.10] border border-amber-400/30"
                  : "text-white/60 bg-white/[0.04] border border-white/10"
              }`}
              title={tier === "TIER_1" ? "Stunning — TIER 1 achieved" : "Pushing output to TIER 1"}
            >
              {tier === "TIER_1" ? "✨ TIER 1" : "→ TIER 1"}
            </span>
          )}
        </div>
      ) : null}

      <ol className="p-2 space-y-1">
        {ORDER.map((stage, i) => {
          const st = states[stage] ?? "idle";
          const active = st === "working";
          return (
            <li
              key={stage}
              className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition ${
                active
                  ? "bg-emerald-400/[0.06] border border-emerald-400/20"
                  : "border border-transparent hover:bg-white/[0.03]"
              }`}
            >
              <div className="mt-0.5 w-5 h-5 grid place-items-center rounded-md bg-white/[0.05] text-[10px] font-semibold text-white/55">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[12.5px] font-medium ${
                      st === "done"
                        ? "text-white/80"
                        : active
                          ? "text-white"
                          : st === "error"
                            ? "text-rose-300"
                            : "text-white/55"
                    }`}
                  >
                    {LABEL[stage]}
                  </span>
                  <StatusIcon status={st} />
                </div>
                {!compact && (
                  <div className="text-[11px] text-white/35 leading-snug mt-0.5">
                    {SUBTITLE[stage]}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
