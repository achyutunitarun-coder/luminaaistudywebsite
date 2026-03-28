import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Square, MessageSquare, FileText, Layers, Target, Clock, Loader2, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { FileUploadButton, buildFileContext, type UploadedFile } from '@/components/FileUploadButton';
import { useQueryClient } from '@tanstack/react-query';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';

type Strength = { topic: string; subject: string; detail: string; confidence_level: string; maintenance_tip?: string };
type Weakness = { topic: string; subject: string; root_cause: string; severity: string; fix_suggestion: string; prerequisite_gaps?: string };
type Recommendation = { action: string; priority: string; estimated_time: string; subjects_to_cover?: string; study_method?: string };

type SessionAnalysis = {
  summary: string;
  strengths: Strength[];
  weaknesses: Weakness[];
  recommendations: Recommendation[];
  score_breakdown: { area: string; score: number; comment: string }[];
};

const severityColors: Record<string, string> = {
  critical: 'border-destructive/40 bg-destructive/5',
  moderate: 'border-warning/40 bg-warning/5',
  minor: 'border-muted-foreground/20 bg-muted/30',
};

const StudySession = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [active, setActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [ending, setEnding] = useState(false);
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (active && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        setSeconds(elapsed);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return { h: h.toString().padStart(2, '0'), m: m.toString().padStart(2, '0'), s: sec.toString().padStart(2, '0') };
  };

  const startSession = async () => {
    if (!user) return;
    const allowed = await checkAndIncrement('study_sessions');
    if (!allowed) return;
    const { data } = await supabase.from('study_sessions').insert({
      user_id: user.id,
      status: 'active',
    }).select().single();
    if (data) {
      setSessionId(data.id);
      startTimeRef.current = Date.now();
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
    const routes: Record<string, string> = {
      'Doubt Solver': '/doubt-solver',
      'Tests': '/tests',
      'Flashcards': '/flashcards',
      'AI Chat': '/chat',
      'Notes Generator': '/notes-generator',
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

    await supabase.rpc('increment_study_minutes', {
      p_user_id: user.id,
      p_minutes: duration,
    });

    // Award XP and coins for study session
    const xpEarned = Math.max(5, Math.floor(duration / 10) * 5); // 5 XP per 10 min
    const coinsEarned = Math.max(2, Math.floor(duration / 15) * 3); // 3 coins per 15 min
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp, coins, level, streak_days, last_study_date')
        .eq('user_id', user.id)
        .single();
      
      if (profile) {
        const newXp = (profile.xp || 0) + xpEarned;
        const newCoins = (profile.coins || 0) + coinsEarned;
        const newLevel = Math.floor(newXp / 100) + 1;
        
        // Streak logic
        const today = new Date().toISOString().split('T')[0];
        const lastDate = profile.last_study_date;
        let newStreak = profile.streak_days || 0;
        
        if (lastDate !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          if (lastDate === yesterday) {
            newStreak += 1; // Consecutive day
          } else if (!lastDate) {
            newStreak = 1; // First study day
          } else {
            newStreak = 1; // Streak broken, restart
          }
        }
        
        await supabase
          .from('profiles')
          .update({ 
            xp: newXp, 
            coins: newCoins, 
            level: newLevel,
            streak_days: newStreak,
            last_study_date: today,
          })
          .eq('user_id', user.id);
        
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        
        if (newLevel > (profile.level || 1)) {
          toast.success(`🎉 Level Up! You're now Level ${newLevel}!`);
        }
      }
    } catch (err) {
      console.error('Failed to award XP/coins:', err);
    }

    try {
      const { data, error } = await supabase.functions.invoke('session-analysis', {
        body: {
          sessionData: { duration_minutes: duration, tools_used: toolsUsed, uploaded_materials: buildFileContext(uploadedFiles) },
          userId: user.id,
        },
      });

      if (error) {
        console.error('Failed to get analysis:', error.message);
      } else if (data) {
        setAnalysis(data as SessionAnalysis);
        await supabase.from('study_sessions').update({ analysis: data }).eq('id', sessionId);
      }
    } catch {
      console.error('Failed to get analysis');
    }

    setActive(false);
    setEnding(false);
    toast.success(`Session completed! ${duration} minutes logged. +${xpEarned} XP, +${coinsEarned} coins`);
  };

  const time = formatTime(seconds);

  // Session Summary View
  if (analysis) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-3xl font-display font-bold text-foreground">Session Complete!</h1>
          <p className="text-muted-foreground mt-1">{Math.floor(seconds / 60)} minutes of focused study</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
          <h2 className="font-display font-semibold text-lg text-foreground mb-3">AI Deep Analysis</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
        </motion.div>

        {analysis.score_breakdown?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6">
            <h2 className="font-display font-semibold text-foreground mb-4">Performance Breakdown</h2>
            <div className="space-y-4">
              {analysis.score_breakdown.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-foreground font-medium">{s.area}</span>
                    <span className={`font-semibold ${s.score >= 70 ? 'text-success' : s.score >= 50 ? 'text-warning' : 'text-destructive'}`}>{s.score}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${s.score}%` }} transition={{ delay: 0.2 + i * 0.1, duration: 0.8 }} className={`h-full rounded-full ${s.score >= 70 ? 'bg-success' : s.score >= 50 ? 'bg-warning' : 'bg-destructive'}`} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.comment}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {analysis.strengths?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-6">
            <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" /> Strengths
            </h2>
            <div className="space-y-3">
              {analysis.strengths.map((s, i) => (
                <div key={i} className="border border-success/20 bg-success/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{s.topic}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success">{s.subject}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                  {s.maintenance_tip && (
                    <p className="text-xs text-success/80 mt-1.5"><strong className="text-success">💡 Keep it up:</strong> {s.maintenance_tip}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {analysis.weaknesses?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-2xl p-6">
            <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" /> Weaknesses — Root Cause Analysis
            </h2>
            <div className="space-y-3">
              {analysis.weaknesses.map((w, i) => (
                <div key={i} className={`border rounded-xl p-4 ${severityColors[w.severity] || 'bg-muted/30'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-foreground">{w.topic}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{w.subject}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${w.severity === 'critical' ? 'bg-destructive/20 text-destructive' : w.severity === 'moderate' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'}`}>{w.severity}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2"><strong className="text-foreground">Root cause:</strong> {w.root_cause}</p>
                  {w.prerequisite_gaps && (
                    <p className="text-xs text-warning/80 mb-2"><strong className="text-warning">⚠️ Prerequisites to revisit:</strong> {w.prerequisite_gaps}</p>
                  )}
                  <p className="text-xs text-primary"><strong>🔧 Fix plan:</strong> {w.fix_suggestion}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {analysis.recommendations?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass rounded-2xl p-6">
            <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-xp" /> Action Plan
            </h2>
            <div className="space-y-4">
              {analysis.recommendations.map((r, i) => (
                <div key={i} className="border border-border/30 rounded-xl p-4 bg-muted/10">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${r.priority === 'high' ? 'bg-destructive/20 text-destructive' : r.priority === 'medium' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'}`}>{r.priority}</span>
                    <span className="text-xs text-muted-foreground">⏱ {r.estimated_time}</span>
                    {r.study_method && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">📚 {r.study_method}</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{r.action}</p>
                  {r.subjects_to_cover && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.subjects_to_cover.split(',').map((s, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground/70 font-medium">{s.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <Button onClick={() => { setAnalysis(null); setSessionId(null); }} variant="outline" className="w-full">
          Start New Session
        </Button>
      </div>
    );
  }

  return (
    <>
    <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-xl shadow-primary/20">
            <Target className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Study Session</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Comprehensive workspace with deep AI analysis</p>
          </div>
        </div>
      </motion.div>

      {!active ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6 glow-primary">
            <Play className="w-10 h-10 text-primary-foreground ml-1" />
          </div>
          <h2 className="text-2xl font-display font-semibold text-foreground mb-2">Ready to Study?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">Start a session to use tools and get a deep AI analysis of your strengths and weaknesses.</p>
          <Button onClick={startSession} size="lg" className="gradient-primary text-primary-foreground px-10 h-12 text-base">
            <Play className="w-5 h-5 mr-2" /> Start Study Session
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
            <div className="relative z-10">
              <div className="flex items-baseline justify-center gap-1 tabular-nums">
                <span className="text-6xl font-display font-bold text-foreground">{time.h}</span>
                <span className="text-2xl text-muted-foreground mx-1">:</span>
                <span className="text-6xl font-display font-bold text-foreground">{time.m}</span>
                <span className="text-2xl text-muted-foreground mx-1">:</span>
                <span className="text-4xl font-display font-semibold text-muted-foreground">{time.s}</span>
              </div>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-3">
                <Clock className="w-3 h-3" /> Session in progress
                <span className="w-2 h-2 rounded-full bg-success animate-pulse ml-1" />
              </p>
            </div>
          </motion.div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Study Tools</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { name: 'Doubt Solver', icon: MessageSquare, desc: 'Ask questions', color: 'text-primary', bg: 'bg-primary/10' },
                { name: 'Tests', icon: Target, desc: 'Take a test', color: 'text-secondary', bg: 'bg-secondary/10' },
                { name: 'Flashcards', icon: Layers, desc: 'Review cards', color: 'text-xp', bg: 'bg-xp/10' },
                { name: 'AI Chat', icon: MessageSquare, desc: 'Study chat', color: 'text-success', bg: 'bg-success/10' },
                { name: 'Notes Generator', icon: FileText, desc: 'Generate notes', color: 'text-warning', bg: 'bg-warning/10' },
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

          {/* Upload study materials */}
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Study Materials
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Upload notes or resources for AI to analyze in your session report</p>
            <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} maxFiles={5} />
          </div>

          <Button onClick={endSession} disabled={ending} variant="destructive" className="w-full h-12 text-base" size="lg">
            {ending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Square className="w-5 h-5 mr-2" />}
            End Session & Get Deep Analysis
          </Button>
        </div>
      )}
    </div>
    </>
  );
};

export default StudySession;
