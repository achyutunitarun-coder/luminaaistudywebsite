import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

type StudyTimerCtx = {
  seconds: number;
  isRunning: boolean;
  sessionId: string | null;
};

const StudyTimerContext = createContext<StudyTimerCtx>({ seconds: 0, isRunning: false, sessionId: null });

const SESSION_ID_KEY = 'lumina_active_study_session_id';
const SESSION_START_KEY = 'lumina_active_study_start_ms';

const clearStoredSession = () => {
  sessionStorage.removeItem(SESSION_ID_KEY);
  sessionStorage.removeItem(SESSION_START_KEY);
};

const storeSession = (sessionId: string, startMs: number) => {
  sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  sessionStorage.setItem(SESSION_START_KEY, String(startMs));
};

export const useStudyTimer = () => useContext(StudyTimerContext);

export const StudyTimerProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const pausedSecondsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const startFreshSession = async (userId: string) => {
      await supabase
        .from('study_sessions')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('status', 'active');

      const { data } = await supabase
        .from('study_sessions')
        .insert({ user_id: userId, status: 'active' })
        .select('id')
        .single();

      if (!data || cancelled) return;

      const now = Date.now();
      storeSession(data.id, now);
      setSessionId(data.id);
      startTimeRef.current = now;
      secondsRef.current = 0;
      pausedSecondsRef.current = 0;
      setSeconds(0);
      setIsRunning(true);
    };

    const initializeTimer = async () => {
      if (!user) {
        setIsRunning(false);
        setSeconds(0);
        secondsRef.current = 0;
        pausedSecondsRef.current = 0;
        startTimeRef.current = null;
        setSessionId(null);
        clearStoredSession();
        return;
      }

      const storedSessionId = sessionStorage.getItem(SESSION_ID_KEY);
      const storedStartMs = Number(sessionStorage.getItem(SESSION_START_KEY));

      if (storedSessionId && Number.isFinite(storedStartMs) && storedStartMs > 0) {
        const { data: existingSession } = await supabase
          .from('study_sessions')
          .select('id, status')
          .eq('id', storedSessionId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingSession?.status === 'active' && !cancelled) {
          const elapsed = Math.max(0, Math.floor((Date.now() - storedStartMs) / 1000));
          setSessionId(storedSessionId);
          startTimeRef.current = storedStartMs;
          secondsRef.current = elapsed;
          pausedSecondsRef.current = elapsed;
          setSeconds(elapsed);
          setIsRunning(true);
          return;
        }
      }

      clearStoredSession();
      await startFreshSession(user.id);
    };

    initializeTimer();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!isRunning || !startTimeRef.current) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
      secondsRef.current = elapsed;
      setSeconds(elapsed);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || !sessionId || !user) {
      if (saveRef.current) clearInterval(saveRef.current);
      return;
    }

    saveRef.current = setInterval(async () => {
      const mins = Math.floor(secondsRef.current / 60);
      await supabase
        .from('study_sessions')
        .update({ duration_minutes: mins })
        .eq('id', sessionId)
        .eq('user_id', user.id);
    }, 60000);

    return () => {
      if (saveRef.current) clearInterval(saveRef.current);
    };
  }, [isRunning, sessionId, user]);

  useEffect(() => {
    if (!user || !sessionId) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        pausedSecondsRef.current = secondsRef.current;
        setIsRunning(false);

        const mins = Math.floor(secondsRef.current / 60);
        await supabase
          .from('study_sessions')
          .update({ duration_minutes: mins })
          .eq('id', sessionId)
          .eq('user_id', user.id);
        return;
      }

      startTimeRef.current = Date.now() - pausedSecondsRef.current * 1000;
      secondsRef.current = pausedSecondsRef.current;
      setSeconds(pausedSecondsRef.current);
      setIsRunning(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, user]);

  return (
    <StudyTimerContext.Provider value={{ seconds, isRunning, sessionId }}>
      {children}
    </StudyTimerContext.Provider>
  );
};
