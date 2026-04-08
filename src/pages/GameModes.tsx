import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Swords, Zap, Brain, Shield, ArrowLeft, Trophy, Timer, CheckCircle2, XCircle, Lock } from 'lucide-react';
import LiveLeaderboard from '@/components/LiveLeaderboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
  color: string;
  rules: string;
  unlockLevel: number;
}

const GAME_MODES: GameMode[] = [
  {
    id: 'lumina_quest',
    name: 'Lumina Quest',
    description: 'Battle boss enemies with your knowledge. Defeat them to earn epic rewards!',
    icon: <Swords className="w-6 h-6" />,
    color: 'from-red-500/20 to-orange-500/20',
    rules: 'Answer questions to deal damage. Wrong answers hurt you. Defeat the boss to win!',
    unlockLevel: 1,
  },
  {
    id: 'velocity_run',
    name: 'Velocity Run',
    description: 'Race against the clock! Answer as many questions as possible in 60 seconds.',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-yellow-500/20 to-green-500/20',
    rules: '60 seconds. Streak bonuses for consecutive correct answers. Speed is everything!',
    unlockLevel: 3,
  },
  {
    id: 'neural_heist',
    name: 'Neural Heist',
    description: 'Crack the code by answering questions on a grid. Unlock all nodes to win.',
    icon: <Shield className="w-6 h-6" />,
    color: 'from-purple-500/20 to-blue-500/20',
    rules: 'Answer 9 questions to reveal the hidden pattern. Wrong answers lock tiles.',
    unlockLevel: 7,
  },
  {
    id: 'concept_arena',
    name: 'Concept Arena',
    description: 'Battle against AI in a turn-based knowledge duel. Outscore the bot!',
    icon: <Swords className="w-6 h-6" />,
    color: 'from-cyan-500/20 to-teal-500/20',
    rules: 'Take turns. Score more than the AI to win. Streaks give combo multipliers!',
    unlockLevel: 12,
  },
  {
    id: 'mind_dungeon',
    name: 'Mind Dungeon',
    description: 'Descend through dungeon floors by mastering increasingly difficult questions.',
    icon: <Brain className="w-6 h-6" />,
    color: 'from-teal-500/20 to-cyan-500/20',
    rules: '5 floors. Each floor is harder. 3 wrong answers = game over. Final boss awaits!',
    unlockLevel: 18,
  },
];

interface Question {
  question: string;
  options: string[];
  answer: number;
}

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
  // Boss fight state
  const [bossHP, setBossHP] = useState(100);
  const [playerHP, setPlayerHP] = useState(100);

  const mode = GAME_MODES.find(m => m.id === selectedMode);

  const generateQuestions = async () => {
    setLoading(true);
    try {
      const count = selectedMode === 'velocity_run' ? 20 : selectedMode === 'neural_heist' ? 9 : selectedMode === 'mind_dungeon' ? 15 : 10;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          curriculum: 'general',
          subject: topic || 'General Knowledge',
          topic: topic || 'Mixed Topics',
          type: 'game_questions',
          userId: user!.id,
          count,
        }),
      });
      if (!resp.ok) throw new Error('Failed to generate');
      const data = await resp.json();
      setQuestions(data.content?.questions || []);
      setGameState('playing');
      if (selectedMode === 'velocity_run') startTimer();
    } catch {
      toast.error('Failed to generate questions');
    } finally {
      setLoading(false);
    }
  };

  const startTimer = () => {
    setTimeLeft(60);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAnswer = (answerIdx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answerIdx);
    const correct = questions[currentQ]?.answer === answerIdx;

    setTimeout(() => {
      if (correct) {
        const dmg = 10 + streak * 5;
        setScore(s => s + dmg);
        setStreak(s => s + 1);
        if (selectedMode === 'lumina_quest') {
          setBossHP(hp => Math.max(0, hp - dmg));
        }
        if (selectedMode === 'neural_heist') {
          const newGrid = [...gridRevealed];
          newGrid[currentQ] = true;
          setGridRevealed(newGrid);
        }
      } else {
        setStreak(0);
        if (selectedMode === 'lumina_quest') {
          setPlayerHP(hp => Math.max(0, hp - 20));
          if (playerHP <= 20) { endGame(); return; }
        }
        if (selectedMode === 'mind_dungeon') {
          setLives(l => l - 1);
          if (lives <= 1) { endGame(); return; }
        }
      }

      if (selectedMode === 'lumina_quest' && bossHP <= 10 && correct) {
        endGame();
        return;
      }

      if (currentQ + 1 >= questions.length) {
        endGame();
      } else {
        setCurrentQ(q => q + 1);
        setSelectedAnswer(null);
        if (selectedMode === 'mind_dungeon' && (currentQ + 1) % 3 === 0) {
          setFloor(f => f + 1);
        }
      }
    }, 800);
  };

  const endGame = async () => {
    setGameState('finished');
    const xpEarned = Math.min(score, 100);
    const coinsEarned = Math.min(Math.floor(score / 10), 20);

    try {
      await supabase.rpc('award_xp_coins', { p_user_id: user!.id, p_xp: xpEarned, p_coins: coinsEarned });
      await supabase.from('game_sessions').insert({
        user_id: user!.id,
        game_mode: selectedMode!,
        score,
        xp_earned: xpEarned,
        coins_earned: coinsEarned,
      });
      await supabase.rpc('sync_leaderboard', { p_user_id: user!.id });
      toast.success(`+${xpEarned} XP, +${coinsEarned} coins!`);
    } catch {}
  };

  const resetGame = () => {
    setGameState('select');
    setSelectedMode(null);
    setCurrentQ(0);
    setScore(0);
    setLives(3);
    setStreak(0);
    setTimeLeft(60);
    setSelectedAnswer(null);
    setGridRevealed(new Array(9).fill(false));
    setFloor(1);
    setQuestions([]);
    setTopic('');
    setBossHP(100);
    setPlayerHP(100);
  };

  // ─── MODE SELECT ───
  if (gameState === 'select') {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-1">
            <Gamepad2 className="inline w-8 h-8 mr-2 text-primary" />
            Lumina Quest
          </h1>
          <p className="text-muted-foreground">Learn through play — unlock modes as you level up</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {GAME_MODES.map((gm, i) => {
            const isLocked = userLevel < gm.unlockLevel;
            return (
              <motion.div
                key={gm.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, ease }}
              >
                <Card
                  className={`transition-all group overflow-hidden relative ${
                    isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-primary/30'
                  }`}
                  onClick={() => {
                    if (!isLocked) {
                      setSelectedMode(gm.id);
                      setGameState('setup');
                    } else {
                      toast.error(`Unlock at Level ${gm.unlockLevel}! You're Level ${userLevel}.`);
                    }
                  }}
                >
                  {isLocked && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-2xl">
                      <div className="text-center">
                        <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm font-semibold text-muted-foreground">Level {gm.unlockLevel}</p>
                      </div>
                    </div>
                  )}
                  <CardContent className="p-5 space-y-3">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gm.color} flex items-center justify-center text-foreground`}>
                      {gm.icon}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-foreground group-hover:text-primary transition-colors">{gm.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{gm.description}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground/70 italic">{gm.rules}</p>
                      {!isLocked && <Badge variant="outline" className="text-[10px]">Unlocked</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── SETUP ───
  if (gameState === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={resetGame} className="rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${mode?.color} flex items-center justify-center text-foreground mb-4`}>
            {mode?.icon}
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">{mode?.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{mode?.rules}</p>
        </motion.div>

        <div className="space-y-4">
          <Input
            placeholder="Enter topic (e.g., Photosynthesis, Quadratic Equations)..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="h-12 rounded-2xl bg-card/40 border-border/30"
          />
          <Button
            onClick={generateQuestions}
            disabled={loading}
            className="w-full h-12 rounded-2xl text-base gradient-primary text-primary-foreground"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Generating Questions...
              </div>
            ) : 'Start Game'}
          </Button>
        </div>
      </div>
    );
  }

  // ─── FINISHED ───
  if (gameState === 'finished') {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center space-y-4">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto" />
          <h1 className="text-3xl font-display font-bold text-foreground">
            {selectedMode === 'lumina_quest' && playerHP > 0 ? '🎉 Boss Defeated!' : 'Game Over!'}
          </h1>
          <div className="flex gap-6 justify-center">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{score}</p>
              <p className="text-xs text-muted-foreground uppercase">Score</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-400">{Math.min(score, 100)}</p>
              <p className="text-xs text-muted-foreground uppercase">XP Earned</p>
            </div>
          </div>
          <Button onClick={resetGame} className="rounded-2xl h-11 px-8">Play Again</Button>
        </motion.div>
      </div>
    );
  }

  // ─── PLAYING ───
  const q = questions[currentQ];
  if (!q) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* HUD */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="rounded-xl">{mode?.name}</Badge>
          {selectedMode === 'velocity_run' && (
            <Badge className="bg-destructive/20 text-destructive rounded-xl">
              <Timer className="w-3 h-3 mr-1" /> {timeLeft}s
            </Badge>
          )}
          {selectedMode === 'mind_dungeon' && (
            <Badge variant="outline" className="rounded-xl">Floor {floor}/5</Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedMode === 'mind_dungeon' && (
            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${i < lives ? 'bg-red-400' : 'bg-muted'}`} />
              ))}
            </div>
          )}
          <span className="text-sm font-bold text-primary">{score} pts</span>
          {streak > 1 && <Badge className="bg-yellow-500/20 text-yellow-400 rounded-xl">🔥 {streak}</Badge>}
        </div>
      </div>

      {/* Boss fight health bars */}
      {selectedMode === 'lumina_quest' && (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-destructive font-semibold">👹 Boss</span>
              <span className="text-muted-foreground">{bossHP}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-destructive"
                animate={{ width: `${bossHP}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-primary font-semibold">🛡️ You</span>
              <span className="text-muted-foreground">{playerHP}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${playerHP}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      )}

      <Progress value={((currentQ + 1) / questions.length) * 100} className="h-2 rounded-full" />

      {/* Neural Heist Grid */}
      {selectedMode === 'neural_heist' && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {gridRevealed.map((revealed, i) => (
            <motion.div
              key={i}
              animate={revealed ? { scale: [1, 1.1, 1], backgroundColor: 'hsl(var(--primary) / 0.2)' } : {}}
              className={`aspect-square rounded-xl flex items-center justify-center text-xl font-bold transition-all ${
                revealed ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-muted/30 border border-border/20 text-muted-foreground/30'
              } ${i === currentQ ? 'ring-2 ring-primary' : ''}`}
            >
              {revealed ? '✓' : i + 1}
            </motion.div>
          ))}
        </div>
      )}

      {/* Question */}
      <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">Question {currentQ + 1}/{questions.length}</p>
            <p className="text-base font-medium text-foreground leading-relaxed">{q.question}</p>
            <div className="grid grid-cols-1 gap-2">
              {q.options.map((opt, j) => {
                const isSelected = selectedAnswer === j;
                const isCorrect = q.answer === j;
                const showResult = selectedAnswer !== null;

                return (
                  <motion.button
                    key={j}
                    onClick={() => handleAnswer(j)}
                    disabled={selectedAnswer !== null}
                    className={`text-left text-sm p-3.5 rounded-xl border transition-all flex items-center gap-2 ${
                      showResult
                        ? isCorrect ? 'border-green-500/50 bg-green-500/10 text-green-300'
                          : isSelected ? 'border-red-500/50 bg-red-500/10 text-red-300'
                            : 'border-border/20 text-muted-foreground/50'
                        : 'border-border/30 hover:border-primary/30 text-muted-foreground hover:text-foreground'
                    }`}
                    whileHover={!showResult ? { scale: 1.01, x: 4 } : {}}
                    whileTap={!showResult ? { scale: 0.99 } : {}}
                  >
                    {showResult && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                    {opt}
                  </motion.button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default GameModes;
