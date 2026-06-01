import { create } from "zustand";

export type PipelineNodeName = "Planner" | "Router" | "Executor" | "Debug" | "Verify" | "Polish";
export type NodeStatus = "pending" | "active" | "done" | "error";

interface PipelineState {
  states: Record<PipelineNodeName, { status: NodeStatus; log?: string }>;
  set: (n: PipelineNodeName, s: NodeStatus, log?: string) => void;
  reset: () => void;
}

const initial: Record<PipelineNodeName, { status: NodeStatus; log?: string }> = {
  Planner: { status: "pending" },
  Router: { status: "pending" },
  Executor: { status: "pending" },
  Debug: { status: "pending" },
  Verify: { status: "pending" },
  Polish: { status: "pending" },
};

export const usePipeline = create<PipelineState>((set) => ({
  states: initial,
  set: (n, s, log) =>
    set((st) => ({ states: { ...st.states, [n]: { status: s, log } } })),
  reset: () => set({ states: initial }),
}));

const NODES: PipelineNodeName[] = ["Planner", "Router", "Executor", "Debug", "Verify", "Polish"];

export function PipelineStrip() {
  const { states } = usePipeline();
  return (
    <div
      className="flex flex-row gap-2 overflow-x-auto py-2 px-4"
      style={{
        background: "rgba(20,184,166,0.04)",
        borderTop: "1px solid rgba(20,184,166,0.10)",
      }}
    >
      {NODES.map((n, i) => {
        const st = states[n];
        const isActive = st.status === "active";
        const isDone = st.status === "done";
        const isErr = st.status === "error";
        const fill = isActive
          ? "#14b8a6"
          : isDone
            ? "#7c3aed"
            : isErr
              ? "#dc2626"
              : "rgba(255,255,255,0.08)";
        const fg = isActive || isDone || isErr ? "#fff" : "rgba(255,255,255,0.4)";
        return (
          <div key={n} className="flex flex-col items-center flex-shrink-0 min-w-[90px]">
            <div className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all duration-300"
                style={{
                  background: fill,
                  color: fg,
                  boxShadow: isActive ? "0 0 14px rgba(20,184,166,0.5)" : "none",
                  animation: isActive ? "lumina-node-pulse 900ms ease-in-out infinite" : "none",
                }}
              >
                {isDone ? "✓" : isErr ? "✗" : i + 1}
              </div>
              <span className="text-[10px] font-medium" style={{ color: fg }}>{n}</span>
            </div>
            {st.log && (isActive || isDone) && (
              <div className="text-[10px] italic text-white/35 mt-0.5 max-w-[110px] truncate">{st.log}</div>
            )}
          </div>
        );
      })}
      <style>{`@keyframes lumina-node-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }`}</style>
    </div>
  );
}
