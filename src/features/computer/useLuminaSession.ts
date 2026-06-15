// Lumina Computer — persistent session memory.
//
// Loads a session by id (or creates lazily on first run), holds the
// in-memory project file tree + conversation history, and persists
// updates with debounce. Server-side `lumina-pipeline` also persists
// after each run; this hook keeps the client view fresh.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SessionFile = { content: string; lang: string };
export type SessionFiles = Record<string, SessionFile>;
export interface ConversationTurn { role: "user" | "assistant"; content: string; ts: number }

export interface LuminaSession {
  id: string;
  title: string;
  conversation_history: ConversationTurn[];
  project_files: SessionFiles;
  agent_logs: any[];
  architecture_decisions: string[];
  task_history: string[];
}

export function useLuminaSession(initialId?: string | null) {
  const [session, setSession] = useState<LuminaSession | null>(null);
  const [loading, setLoading] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lumina_sessions" as any)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setLoading(false);
    if (error || !data) return null;
    const s: LuminaSession = {
      id: (data as any).id,
      title: (data as any).title ?? "Untitled",
      conversation_history: (data as any).conversation_history ?? [],
      project_files: (data as any).project_files ?? {},
      agent_logs: (data as any).agent_logs ?? [],
      architecture_decisions: (data as any).architecture_decisions ?? [],
      task_history: (data as any).task_history ?? [],
    };
    setSession(s);
    return s;
  }, []);

  useEffect(() => {
    if (initialId) load(initialId);
  }, [initialId, load]);

  const mergeFiles = useCallback((patch: SessionFiles) => {
    setSession((prev) => prev ? { ...prev, project_files: { ...prev.project_files, ...patch } } : prev);
  }, []);

  const setSessionId = useCallback((id: string) => {
    load(id);
  }, [load]);

  const persist = useCallback(() => {
    if (!session) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await supabase
        .from("lumina_sessions" as any)
        .update({
          project_files: session.project_files,
          conversation_history: session.conversation_history,
        })
        .eq("id", session.id);
    }, 1500);
  }, [session]);

  useEffect(() => { persist(); }, [persist]);

  return { session, loading, load, mergeFiles, setSessionId, setSession };
}
