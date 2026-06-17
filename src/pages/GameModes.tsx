import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Swords, Zap, Brain, Shield, ArrowLeft, Trophy, Timer, CheckCircle2, XCircle, Lock, Flame, Star, Heart, Skull, Crown, Sparkles, RotateCcw } from 'lucide-react';
import LiveLeaderboard from '@/components/LiveLeaderboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

const ease = [0.25, 0.1, 0.25, 1] as const;

interface GameMode {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  glowColor: string;
  rules: string;
  unlockLevel: number;
  tagline: string;
}

const GAME_MODES: GameMode[] = [
  { id: 'lumina_quest', name: 'Lumina Quest', description: 'Battle epic boss enemies with your knowledge', icon: <Swords className="w-7 h-7" />, gradient: 'from-rose-600 via-red-500 to-orange-500', glowColor: 'shadow-rose-500/30', rules: 'Answer to deal damage. Wrong = lose HP. Defeat the boss to win!', unlockLevel: 1, tagline: '⚔️ Boss Battle' },
  { id: 'velocity_run', name: 'Velocity Run', description: 'Race the clock — answer as fast as you can', icon: <Zap className="w-7 h-7" />, gradient: 'from-amber-500 via-yellow-400 to-lime-400', glowColor: 'shadow-amber-500/30', rules: '60 seconds. Streak bonuses multiply your score!', unlockLevel: 3, tagline: '⚡ Speed Run' },
  { id: 'neural_heist', name: 'Neural Heist', description: 'Crack the code by unlocking a 3×3 grid', icon: <Shield className="w-7 h-7" />, gradient: 'from-violet-600 via-purple-500 to-blue-500', glowColor: 'shadow-violet-500/30', rules: 'Reveal all 9 tiles. Wrong answers lock tiles permanently!', unlockLevel: 7, tagline: '🧩 Grid Hack' },
  { id: 'concept_arena', name: 'Concept Arena', description: 'Turn-based knowledge duel against AI', icon: <Brain className="w-7 h-7" />, gradient: 'from-cyan-500 via-teal-400 to-emerald-400', glowColor: 'shadow-cyan-500/30', rules: 'Outscore the AI. Streaks give combo multipliers!', unlockLevel: 12, tagline: '🤖 AI Duel' },
  { id: 'mind_dungeon', name: 'Mind Dungeon', description: 'Descend 5 floors of increasingly hard questions', icon: <Skull className="w-7 h-7" />, gradient: 'from-emerald-600 via-teal-500 to-cyan-500', glowColor: 'shadow-emerald-500/30', rules: '5 floors. 3 wrong = game over. Final boss awaits!', unlockLevel: 18, tagline: '🏰 Dungeon Crawl' },
];

interface Question { question: string; options: string[]; answer: number; }

const GameModes = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const userLevel = profile?.level || 1;
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [gameState, setGameState] = useState<'select' | 'setup' | 'playing' | 'finished'>('select');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [loading, setLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [gridRevealed, setGridRevealed] = useState<boolean[]>(new Array(9).fill(false));
  const [floor, setFloor] = useState(1);
  const [bossHP, setBossHP] = useState(100);
  const [playerHP, setPlayerHP] = useState(100);
  const [xpEarned, setXpEarned] = useState(0);

  const mode = GAME_MODES.find(m => m.id === selectedMode);

  const generateQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const count = selectedMode === 'velocity_run' ? 20 : selectedMode === 'neural_heist' ? 9 : selectedMode === 'mind_dungeon' ? 15 : 10;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error('Please sign in to play.'); setLoading(false); return; }
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ curriculum: 'general', subject: topic || 'General Knowledge', topic: topic || 'Mixed Topics', type: 'game_questions', count }),
      });
      if (!resp.ok) throw new Error('Failed to generate');
      const data = await resp.json();
      const qs = data.content?.questions || [];
      if (!qs.length) throw new Error('No questions returned');
      setQuestions(qs);
      setGameState('playing');
      if (selectedMode === 'velocity_run') {
        setTimeLeft(60);
        const interval = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) { clearInterval(interval); endGame(); return 0; }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate questions');
    } finally {
      setLoading(false);
    }
  }, [selectedMode, topic]);

  const endGame = useCallback(async () => {
    setGameState('finished');
    const xp = Math.min(score, 100);
    setXpEarned(xp);
    try {
      await supabase.rpc('award_xp_coins', { p_user_id: user!.id, p_xp: xp, p_coins: Math.min(Math.floor(score / 10), 20) });
      await supabase.from('game_sessions').insert({ user_id: user!.id, game_mode: selectedMode!, score, xp_earned: xp, coins_earned: Math.min(Math.floor(score / 10), 20) });
      await supabase.rpc('sync_leaderboard', { p_user_id: user!.id });
    } catch {}
  }, [score, selectedMode, user]);

  const handleAnswer = useCallback((answerIdx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answerIdx);
    const correct = questions[currentQ]?.answer === answerIdx;
    setTimeout(() => {
      if (correct) {
        const dmg = 10 + streak * 5;
        setScore(s => s + dmg);
        setStreak(s => s + 1);
        if (selectedMode === 'lumina_quest') setBossHP(hp => Math.max(0, hp - dmg));
        if (selectedMode === 'neural_heist') { const g = [...gridRevealed]; g[currentQ] = true; setGridRevealed(g); }
      } else {
        setStreak(0);
        if (selectedMode === 'lumina_quest') {
          setPlayerHP(hp => { const n = Math.max(0, hp - 20); if (n <= 0) endGame(); return n; });
        }
        if (selectedMode === 'mind_dungeon') {
          setLives(l => { const n = l - 1; if (n <= 0) endGame(); return n; });
        }
      }
      const nextQ = currentQ + 1;
      if ((selectedMode === 'lumina_quest' && bossHP <= (correct ? 10 + streak * 5 : 0)) || nextQ >= questions.length) {
        endGame();
      } else {
        setCurrentQ(nextQ);
        setSelectedAnswer(null);
        if (selectedMode === 'mind_dungeon' && nextQ % 3 === 0) setFloor(f => f + 1);
      }
    }, 800);
  }, [selectedAnswer, questions, currentQ, streak, selectedMode, bossHP, playerHP, lives, gridRevealed, endGame]);

  const resetGame = () => { setGameState('select'); setSelectedMode(null); setCurrentQ(0); setScore(0); setLives(3); setStreak(0); setTimeLeft(60); setSelectedAnswer(null); setGridRevealed(new Array(9).fill(false)); setFloor(1); setQuestions([]); setTopic(''); setBossHP(100); setPlayerHP(100); };

  // ═══════════════════════════════════════════════════════════════
  // SELECT SCREEN — Game Mode Selection
  // ═══════════════════════════════════════════════════════════════
  if (gameState === 'select') {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Gamepad2 className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">5 Game Modes</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight mb-3">Lumina Arena</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">Learn through play. Battle bosses, race clocks, crack codes — and earn XP.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAME_MODES.map((gm, i) => {
            const locked = userLevel < gm.unlockLevel;
            return (
              <motion.div key={gm.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, ease }}>
                <button
                  onClick={() => { if (!locked) { setSelectedMode(gm.id); setGameState('setup'); } else toast.error(`Unlock at Level ${gm.unlockLevel}!`); }}
                  disabled={locked}
                  className={`w-full text-left rounded-2xl overflow-hidden transition-all duration-300 group relative ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] hover:shadow-2xl cursor-pointer'}`}
                  style={{ background: 'hsl(230 20% 8% / 0.6)', border: '1px solid hsl(0 0% 100% / 0.06)', backdropFilter: 'blur(20px)' }}
                >
                  {locked && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl">
                      <div className="text-center"><Lock className="w-10 h-10 text-muted-foreground mx-auto mb-2" /><p className="text-sm font-bold text-muted-foreground">Level {gm.unlockLevel}</p></div>
                    </div>
                  )}
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gm.gradient} flex items-center justify-center text-white shadow-lg ${gm.glowColor} group-hover:scale-110 transition-transform`}>
                        {gm.icon}
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{gm.tagline}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-bold text-white mb-1">{gm.name}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{gm.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                      <Flame className="w-3 h-3" /> {gm.rules}
                    </div>
                    {!locked && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:gap-all transition-all">
                        <span>Play Now</span><ArrowLeft className="w-3 h-3 rotate-180" />
                      </div>
                    )}
                  </div>
                  <div className={`h-1 bg-gradient-to-r ${gm.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </button>
              </motion.div>
            );
          })}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="rounded-2xl border border-border/10 bg-card/30 backdrop-blur-xl p-6">
          <LiveLeaderboard maxEntries={10} compact />
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SETUP SCREEN
  // ═══════════════════════════════════════════════════════════════
  if (gameState === 'setup') {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <button onClick={resetGame} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${mode?.gradient} flex items-center justify-center text-white mb-4 shadow-xl ${mode?.glowColor}`}>{mode?.icon}</div>
          <h1 className="text-3xl font-display font-bold text-white mb-1">{mode?.name}</h1>
          <p className="text-muted-foreground">{mode?.rules}</p>
        </motion.div>
        <div className="space-y-4 rounded-2xl p-6" style={{ background: 'hsl(230 20% 8% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.06)' }}>
          <Input placeholder="Enter topic (e.g., Photosynthesis, Newton's Laws)..." value={topic} onChange={e => setTopic(e.target.value)} className="h-12 rounded-xl bg-card/50 border-border/20 text-white placeholder:text-muted-foreground/40" />
          <Button onClick={generateQuestions} disabled={loading} className={`w-full h-14 rounded-xl text-base font-bold bg-gradient-to-r ${mode?.gradient} text-white shadow-lg ${mode?.glowColor}`}>
            {loading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Generating...</> : <><Sparkles className="w-5 h-5 mr-2" /> Start Battle</>}
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // FINISHED SCREEN
  // ═══════════════════════════════════════════════════════════════
  if (gameState === 'finished') {
    const won = selectedMode === 'lumina_quest' ? playerHP > 0 : selectedMode === 'mind_dungeon' ? lives > 0 : true;
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15 }} className="space-y-4">
          <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center ${won ? 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-xl shadow-amber-500/30' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>
            {won ? <Trophy className="w-12 h-12 text-white" /> : <Skull className="w-12 h-12 text-white" />}
          </div>
          <h1 className="text-4xl font-display font-bold text-white">{won ? 'Victory!' : 'Game Over'}</h1>
          <p className="text-muted-foreground">{won ? 'You crushed it! Knowledge is power.' : 'The boss won this time. Train harder!'}</p>
          <div className="flex gap-8 justify-center">
            <div><p className="text-4xl font-bold text-primary">{score}</p><p className="text-xs text-muted-foreground uppercase">Score</p></div>
            <div><p className="text-4xl font-bold text-yellow-400">+{xpEarned}</p><p className="text-xs text-muted-foreground uppercase">XP Earned</p></div>
          </div>
          <Button onClick={resetGame} className="rounded-xl h-12 px-8 gradient-primary text-primary-foreground font-bold"><RotateCcw className="w-4 h-4 mr-2" /> Play Again</Button>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PLAYING SCREEN
  // ═══════════════════════════════════════════════════════════════
  const q = questions[currentQ];
  if (!q) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* HUD */}
      <div className="flex items-center justify-between rounded-2xl p-4" style={{ background: 'hsl(230 20% 8% / 0.6)', border: '1px solid hsl(0 0% 100% / 0.06)' }}>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-lg bg-gradient-to-r ${mode?.gradient} text-white text-xs font-bold`}>{mode?.name}</div>
          {selectedMode === 'velocity_run' && (
            <div className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-sm tabular-nums ${timeLeft <= 10 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-card text-foreground'}`}>
              <Timer className="w-3.5 h-3.5" /> {timeLeft}s
            </div>
          )}
          {selectedMode === 'mind_dungeon' && <div className="px-3 py-1 rounded-lg bg-card text-xs font-bold text-foreground">Floor {floor}/5</div>}
        </div>
        <div className="flex items-center gap-4">
          {selectedMode === 'mind_dungeon' && (
            <div className="flex gap-1">{Array.from({ length: 3 }).map((_, i) => <Heart key={i} className={`w-4 h-4 ${i < lives ? 'text-red-400 fill-red-400' : 'text-muted-foreground/30'}`} />)}</div>
          )}
          <div className="text-lg font-bold text-primary tabular-nums">{score}</div>
          {streak > 1 && <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold"><Flame className="w-3 h-3" /> {streak}</div>}
        </div>
      </div>

      {/* Boss HP Bars */}
      {selectedMode === 'lumina_quest' && (
        <div className="space-y-2 rounded-2xl p-4" style={{ background: 'hsl(230 20% 8% / 0.6)', border: '1px solid hsl(0 0% 100% / 0.06)' }}>
          <div>
            <div className="flex justify-between text-xs mb-1"><span className="text-red-400 font-bold">👹 Boss</span><span className="text-muted-foreground tabular-nums">{bossHP}%</span></div>
            <div className="h-3 rounded-full bg-muted/20 overflow-hidden"><motion.div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500" animate={{ width: `${bossHP}%` }} transition={{ duration: 0.5 }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span className="text-primary font-bold">🛡️ You</span><span className="text-muted-foreground tabular-nums">{playerHP}%</span></div>
            <div className="h-3 rounded-full bg-muted/20 overflow-hidden"><motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400" animate={{ width: `${playerHP}%` }} transition={{ duration: 0.5 }} /></div>
          </div>
        </div>
      )}

      {/* Neural Heist Grid */}
      {selectedMode === 'neural_heist' && (
        <div className="grid grid-cols-3 gap-3">
          {gridRevealed.map((revealed, i) => (
            <motion.div key={i} animate={revealed ? { scale: [1, 1.2, 1] } : {}}
              className={`aspect-square rounded-2xl flex items-center justify-center text-2xl font-bold transition-all ${revealed ? 'bg-primary/20 text-primary border-2 border-primary/40 shadow-lg shadow-primary/20' : 'bg-card/50 border border-border/10 text-muted-foreground/30'} ${i === currentQ && !revealed ? 'ring-2 ring-primary animate-pulse' : ''}`}
            >{revealed ? '✓' : i + 1}</motion.div>
          ))}
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3">
        <Progress value={((currentQ + 1) / questions.length) * 100} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground tabular-nums">{currentQ + 1}/{questions.length}</span>
      </div>

      {/* Question Card */}
      <motion.div key={currentQ} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
        className="rounded-2xl p-6 space-y-5" style={{ background: 'hsl(230 20% 8% / 0.6)', border: '1px solid hsl(0 0% 100% / 0.06)' }}
      >
        <p className="text-sm text-muted-foreground">Question {currentQ + 1} of {questions.length}</p>
        <p className="text-lg font-medium text-white leading-relaxed">{q.question}</p>
        <div className="space-y-2">
          {q.options.map((opt, j) => {
            const isSelected = selectedAnswer === j;
            const isCorrect = q.answer === j;
            const showResult = selectedAnswer !== null;
            return (
              <motion.button key={j} onClick={() => handleAnswer(j)} disabled={selectedAnswer !== null}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${showResult ? (isCorrect ? 'border-green-500/50 bg-green-500/10 text-green-300' : isSelected ? 'border-red-500/50 bg-red-500/10 text-red-300' : 'border-border/10 text-muted-foreground/40') : 'border-border/20 hover:border-primary/30 text-muted-foreground hover:text-white hover:bg-primary/5'}`}
                whileHover={!showResult ? { x: 4 } : {}} whileTap={!showResult ? { scale: 0.98 } : {}}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${showResult && isCorrect ? 'bg-green-500/20 text-green-400' : showResult && isSelected ? 'bg-red-500/20 text-red-400' : 'bg-card text-muted-foreground'}`}>
                  {showResult && isCorrect ? <CheckCircle2 className="w-4 h-4" /> : showResult && isSelected ? <XCircle className="w-4 h-4" /> : String.fromCharCode(65 + j)}
                </span>
                <span className="text-sm leading-relaxed">{opt}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default GameModes;
