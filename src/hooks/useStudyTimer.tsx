import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

type StudyTimerCtx = {
  seconds: number;
  isRunning: boolean;
  sessionId: string | null;
};

const StudyTimerContext = createContext<StudyTimerCtx>({ seconds: 0, isRunning: false, sessionId: null });

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

  // Start timer when user logs in
  useEffect(() => {
    if (!user) {
      setIsRunning(false);
      setSeconds(0);
      secondsRef.current = 0;
      setSessionId(null);
      return;
    }

    const startTimer = async () => {
      // Always create a fresh session for this page load
      // First complete any lingering active sessions
      await supabase
        .from('study_sessions')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('status', 'active');

      // Create new session
      const { data } = await supabase
        .from('study_sessions')
        .insert({ user_id: user.id, status: 'active' })
        .select()
        .single();
      
      if (data) {
        setSessionId(data.id);
        startTimeRef.current = Date.now();
        setSeconds(0);
        secondsRef.current = 0;
        setIsRunning(true);
      }
    };

    startTimer();
  }, [user]);

  // Tick - use elapsed time from startTimeRef for accuracy
  useEffect(() => {
    if (isRunning && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        secondsRef.current = elapsed;
        setSeconds(elapsed);
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  // Save duration every 60 seconds
  useEffect(() => {
    if (isRunning && sessionId) {
      saveRef.current = setInterval(async () => {
        const mins = Math.floor(secondsRef.current / 60);
        await supabase.from('study_sessions').update({
          duration_minutes: mins,
        }).eq('id', sessionId);
      }, 60000);
    }
    return () => { if (saveRef.current) clearInterval(saveRef.current); };
  }, [isRunning, sessionId]);

  return (
    <StudyTimerContext.Provider value={{ seconds, isRunning, sessionId }}>
      {children}
    </StudyTimerContext.Provider>
  );
};
