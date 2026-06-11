// Lumina v2 — Client hook to drive the 6-agent Computer Mode pipeline.
//
// Streams stage events from the `lumina-pipeline` edge function and exposes:
//   - states: per-stage status (idle | working | done | error)
//   - finalOutput: the optimizer's final artifact text
//   - run(request): kicks off a pipeline run
//   - reset()

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PipelineStage =
  | "orchestrate" | "plan" | "research" | "build" | "debug" | "optimize";
export type StageStatus = "idle" | "working" | "done" | "error";

const STAGE_LABELS: Record<PipelineStage, string> = {
  orchestrate: "Orchestrator",
  plan: "Planner",
  research: "Research",
  build: "Builder",
  debug: "Debug",
  optimize: "Optimizer",
};

const STAGES: PipelineStage[] = ["orchestrate", "plan", "research", "build", "debug", "optimize"];

export interface ActiveSkill { id: string; label: string; icon: string; }

const PIPELINE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lumina-pipeline`;

export function useLuminaPipeline() {
  const [states, setStates] = useState<Record<PipelineStage, StageStatus>>(
    () => Object.fromEntries(STAGES.map((s) => [s, "idle"])) as Record<PipelineStage, StageStatus>,
  );
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [finalOutput, setFinalOutput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [intercepted, setIntercepted] = useState(false);
  const [skills, setSkills] = useState<ActiveSkill[]>([]);
  const [tier, setTier] = useState<"TIER_3" | "TIER_2" | "TIER_1" | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStates(Object.fromEntries(STAGES.map((s) => [s, "idle"])) as Record<PipelineStage, StageStatus>);
    setActiveLabel(null);
    setFinalOutput("");
    setRunning(false);
    setIntercepted(false);
    setSkills([]);
    setTier(null);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  const run = useCallback(async (request: string) => {
    reset();
    setRunning(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setRunning(false); throw new Error("Not signed in"); }

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const resp = await fetch(PIPELINE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ request }),
      signal: ctrl.signal,
    });

    if (!resp.ok || !resp.body) {
      setRunning(false);
      throw new Error(`Pipeline failed: ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "";

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!chunk.startsWith("data:")) continue;
          const payload = chunk.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload) as {
              stage: PipelineStage | "final" | "meta";
              status: StageStatus;
              label?: string;
              output?: string;
              intercepted?: boolean;
              error?: string;
              skills?: ActiveSkill[];
              tier_target?: string;
              tier_achieved?: string;
            };
            if (evt.stage === "meta") {
              if (evt.skills) setSkills(evt.skills);
              if (evt.tier_target === "TIER_1") setTier("TIER_2");
              if (evt.tier_achieved === "TIER_1") setTier("TIER_1");
            } else if (evt.stage === "final") {
              if (evt.intercepted) setIntercepted(true);
              if (evt.output) setFinalOutput(evt.output);
            } else {
              setStates((s) => ({ ...s, [evt.stage as PipelineStage]: evt.status }));
              if (evt.status === "working") setActiveLabel(evt.label ?? STAGE_LABELS[evt.stage as PipelineStage]);
            }
          } catch { /* ignore malformed line */ }
        }
      }
    } finally {
      setRunning(false);
      setActiveLabel(null);
    }
  }, [reset]);

  return { states, activeLabel, finalOutput, running, intercepted, skills, tier, run, cancel, reset, STAGE_LABELS };
}
