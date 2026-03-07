import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Square, MessageSquare, FileText, Layers, Target, Clock, TrendingUp, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type SessionAnalysis = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  score_breakdown: { area: string; score: number; comment: string }[];
};

const StudySession = () => {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [ending, setEnding] = useState(false);
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const startSession = async () => {
    if (!user) return;
    const { data } = await supabase.from('study_sessions').insert({
      user_id: user.id,
      status: 'active',
    }).select().single();
    if (data) {
      setSessionId(data.id);
      setActive(true);
      setSeconds(0);
      setToolsUsed([]);
      setAnalysis(null);
    }
  };

  const useTool = (tool: string) => {
    if (!toolsUsed.includes(tool)) {
      setToolsUsed(prev => [...prev, tool]);
    }
    // Open tool in new context - for now, navigate via window
    const routes: Record<string, string> = {
      'Doubt Solver': '/doubt-solver',
      'Tests': '/tests',
      'Flashcards': '/flashcards',
      'AI Chat': '/chat',
    };
    window.open(routes[tool] || '/', '_blank');
  };

  const endSession = async () => {
    if (!sessionId || !user) return;
    setEnding(true);
    const duration = Math.floor(seconds / 60);

    await supabase.from('study_sessions').update({
      ended_at: new Date().toISOString(),
      duration_minutes: duration,
      tools_used: toolsUsed,
      status: 'completed',
    }).eq('id', sessionId);

    // Update total study minutes on profile
    await supabase.from('profiles').update({
      total_study_minutes: (duration),
    }).eq('user_id', user.id);

    // Get AI analysis
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/session-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          sessionData: {
            duration_minutes: duration,
            tools_used: toolsUsed,
          },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setAnalysis(data);
        await supabase.from('study_sessions').update({ analysis: data }).eq('id', sessionId);
      }
    } catch {
      console.error('Failed to get analysis');
    }

    setActive(false);
    setEnding(false);
    toast.success(`Session completed! ${duration} minutes logged.`);
  };

  // Session Summary View
  if (analysis) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-display font-bold text-foreground">Session Complete!</h1>
          <p className="text-muted-foreground">{Math.floor(seconds / 60)} minutes of focused study</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
          <h2 className="font-display font-semibold text-foreground mb-3">AI Analysis</h2>
          <p className="text-sm text-muted-foreground mb-4">{analysis.summary}</p>

          {analysis.score_breakdown?.length > 0 && (
            <div className="space-y-3 mb-6">
              {analysis.score_breakdown.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{s.area}</span>
                    <span className="text-primary font-semibold">{s.score}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${s.score}%` }} transition={{ delay: i * 0.1 }} className={`h-full rounded-full ${s.score >= 70 ? 'bg-success' : s.score >= 50 ? 'bg-warning' : 'bg-destructive'}`} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.comment}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-success mb-2">💪 Strengths</h3>
              {analysis.strengths?.map((s, i) => (
                <p key={i} className="text-xs text-muted-foreground mb-1">• {s}</p>
              ))}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-warning mb-2">📋 Areas to Improve</h3>
              {analysis.weaknesses?.map((w, i) => (
                <p key={i} className="text-xs text-muted-foreground mb-1">• {w}</p>
              ))}
            </div>
          </div>

          {analysis.recommendations?.length > 0 && (
            <div className="mt-4 border-t border-border/50 pt-4">
              <h3 className="text-xs font-semibold text-primary mb-2">🎯 Recommendations</h3>
              {analysis.recommendations.map((r, i) => (
                <p key={i} className="text-xs text-muted-foreground mb-1">• {r}</p>
              ))}
            </div>
          )}
        </motion.div>

        <Button onClick={() => { setAnalysis(null); setSessionId(null); }} variant="outline" className="w-full">
          Start New Session
        </Button>
      </div>
    );
  }

  // Pre-session or active session
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" /> Study Session
        </h1>
        <p className="text-muted-foreground text-sm">Comprehensive study workspace with AI analysis</p>
      </motion.div>

      {!active ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6 glow-primary">
            <Play className="w-10 h-10 text-primary-foreground ml-1" />
          </div>
          <h2 className="text-xl font-display font-semibold text-foreground mb-2">Ready to Study?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">Start a session to use Doubt Solver, Notes, Flashcards, and Tests. Get an AI analysis at the end.</p>
          <Button onClick={startSession} size="lg" className="gradient-primary text-primary-foreground px-10">
            <Play className="w-5 h-5 mr-2" /> Start Study Session
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Timer */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 text-center">
            <div className="text-6xl font-display font-bold text-foreground tabular-nums mb-2">
              {formatTime(seconds)}
            </div>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Session in progress
            </p>
          </motion.div>

          {/* Study Tools */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Study Tools</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Doubt Solver', icon: MessageSquare, desc: 'Ask questions', color: 'text-primary', bg: 'bg-primary/10' },
                { name: 'Tests', icon: Target, desc: 'Take a test', color: 'text-secondary', bg: 'bg-secondary/10' },
                { name: 'Flashcards', icon: Layers, desc: 'Review cards', color: 'text-xp', bg: 'bg-xp/10' },
                { name: 'AI Chat', icon: MessageSquare, desc: 'Study chat', color: 'text-success', bg: 'bg-success/10' },
              ].map(tool => (
                <button
                  key={tool.name}
                  onClick={() => useTool(tool.name)}
                  className={`glass rounded-xl p-4 text-left hover:border-primary/30 transition-all ${toolsUsed.includes(tool.name) ? 'border-primary/30' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-lg ${tool.bg} flex items-center justify-center mb-2`}>
                    <tool.icon className={`w-4 h-4 ${tool.color}`} />
                  </div>
                  <p className="text-sm font-medium text-foreground">{tool.name}</p>
                  <p className="text-xs text-muted-foreground">{tool.desc}</p>
                  {toolsUsed.includes(tool.name) && <span className="text-[10px] text-primary">✓ Used</span>}
                </button>
              ))}
            </div>
          </div>

          {/* End Session */}
          <Button onClick={endSession} disabled={ending} variant="destructive" className="w-full" size="lg">
            {ending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
            End Session & Get Analysis
          </Button>
        </div>
      )}
    </div>
  );
};

export default StudySession;
