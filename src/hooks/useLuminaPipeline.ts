import { useState, useCallback } from "react";

export type StageStatus = "idle" | "working" | "done" | "error";

export type PipelineStage =
  | "planner"
  | "router"
  | "research"
  | "architect"
  | "builder"
  | "validator"
  | "debugger"
  | "runner"
  | "assembler";

export const idleFactoryStates: Record<PipelineStage, StageStatus> = {
  planner: "idle",
  router: "idle",
  research: "idle",
  architect: "idle",
  builder: "idle",
  validator: "idle",
  debugger: "idle",
  runner: "idle",
  assembler: "idle",
};

export function useLuminaPipeline() {
  const [stages, setStages] = useState<Record<PipelineStage, StageStatus>>(idleFactoryStates);

  const setStage = useCallback((stage: PipelineStage, status: StageStatus) => {
    setStages((prev) => ({ ...prev, [stage]: status }));
  }, []);

  const reset = useCallback(() => {
    setStages(idleFactoryStates);
  }, []);

  const isWorking = Object.values(stages).some((s) => s === "working");
  const hasError = Object.values(stages).some((s) => s === "error");
  const isComplete = Object.values(stages).every((s) => s === "done");

  return { stages, setStage, reset, isWorking, hasError, isComplete };
}
