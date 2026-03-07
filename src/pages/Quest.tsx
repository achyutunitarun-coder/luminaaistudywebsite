import { useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, Heart, Shield, Zap, Trophy, Star, Target, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

type Boss = {
  name: string;
  hp: number;
  maxHp: number;
  icon: string;
  questions: { q: string; options: string[]; correct: number }[];
};

const dailyQuests = [
  { icon: Target, title: 'Solve 5 questions', progress: 3, target: 5, xp: 20 },
  { icon: Star, title: 'Review 10 flashcards', progress: 7, target: 10, xp: 15 },
  { icon: Zap, title: 'Study for 10 minutes', progress: 10, target: 10, xp: 25 },
  { icon: Trophy, title: 'Complete 1 test', progress: 0, target: 1, xp: 50 },
];

const Quest = () => {
  const { profile } = useProfile();
  const [boss, setBoss] = useState<Boss | null>(null);
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [playerHp, setPlayerHp] = useState(100);
  const [battleActive, setBattleActive] = useState(false);
  const [battleResult, setBattleResult] = useState<'win' | 'lose' | null>(null);
  const [xpEarned, setXpEarned] = useState(0);

  const generateBoss = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-boss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ topic }),
      });
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      setBoss({
        name: data.name,
        hp: 100,
        maxHp: 100,
        icon: data.icon || '👹',
        questions: data.questions,
      });
    } catch {
      toast.error('Failed to generate boss');
    }
    setGenerating(false);
  };

  const startBattle = () => {
    if (!boss) return;
    setBoss(prev => prev ? { ...prev, hp: prev.maxHp } : null);
    setPlayerHp(100);
    setQuestionIdx(0);
    setBattleActive(true);
    setBattleResult(null);
    setXpEarned(0);
  };

  const answerQuestion = (optionIdx: number) => {
    if (!boss) return;
    const q = boss.questions[questionIdx];
    if (optionIdx === q.correct) {
      const newBossHp = Math.max(0, boss.hp - 25);
      setBoss(prev => prev ? { ...prev, hp: newBossHp } : null);
      setXpEarned(prev => prev + 10);
      if (newBossHp <= 0) {
        setBattleResult('win');
        setBattleActive(false);
        return;
      }
    } else {
      const newPlayerHp = Math.max(0, playerHp - 20);
      setPlayerHp(newPlayerHp);
      if (newPlayerHp <= 0) {
        setBattleResult('lose');
        setBattleActive(false);
        return;
      }
    }
    setQuestionIdx(prev => Math.min(prev + 1, boss.questions.length - 1));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-display font-bold text-foreground">Lumina Quest</h1>
        <p className="text-muted-foreground text-sm">Choose your topic and battle AI-generated knowledge bosses!</p>
      </motion.div>

      {/* Boss Battle */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
        <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Swords className="w-5 h-5 text-destructive" /> Boss Battle
        </h2>

        {!boss && !battleActive && (
          <div className="text-center py-8 space-y-4">
            <div className="text-6xl mb-2">⚔️</div>
            <h3 className="text-xl font-display font-bold text-foreground">Choose Your Battle Topic</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">Enter any topic and the AI will generate a boss with questions for you to defeat!</p>
            <div className="max-w-md mx-auto flex gap-2">
              <Input
                placeholder="e.g., Algebra, Photosynthesis, World War II"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="bg-muted/50"
                onKeyDown={e => e.key === 'Enter' && generateBoss()}
              />
              <Button onClick={generateBoss} disabled={generating || !topic.trim()} className="gradient-primary text-primary-foreground">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {boss && !battleActive && !battleResult && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">{boss.icon}</div>
            <h3 className="text-xl font-display font-bold text-foreground mb-2">{boss.name}</h3>
            <p className="text-muted-foreground mb-6">Defeat this boss by answering questions on {topic}!</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={startBattle} className="gradient-primary text-primary-foreground">
                <Swords className="w-4 h-4 mr-2" /> Start Battle
              </Button>
              <Button onClick={() => { setBoss(null); setTopic(''); }} variant="ghost">
                Change Topic
              </Button>
            </div>
          </div>
        )}

        {battleActive && boss && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{boss.icon}</span>
                  <span className="text-sm font-semibold text-foreground">{boss.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-destructive" />
                  <Progress value={(boss.hp / boss.maxHp) * 100} className="h-3 flex-1" />
                  <span className="text-xs text-muted-foreground">{boss.hp}/{boss.maxHp}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold text-foreground">You</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-success" />
                  <Progress value={playerHp} className="h-3 flex-1" />
                  <span className="text-xs text-muted-foreground">{playerHp}/100</span>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-5">
              <p className="text-primary text-xs font-semibold mb-2">Question {questionIdx + 1}</p>
              <p className="text-foreground font-medium mb-4">{boss.questions[questionIdx].q}</p>
              <div className="grid grid-cols-2 gap-2">
                {boss.questions[questionIdx].options.map((opt, i) => (
                  <button key={i} onClick={() => answerQuestion(i)} className="glass rounded-lg px-4 py-3 text-sm text-left hover:border-primary/50 transition-all">
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {battleResult && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
            <div className="text-6xl mb-4">{battleResult === 'win' ? '🏆' : '💀'}</div>
            <h3 className="text-2xl font-display font-bold text-foreground mb-2">
              {battleResult === 'win' ? 'Victory!' : 'Defeated!'}
            </h3>
            <p className="text-muted-foreground mb-2">
              {battleResult === 'win' ? `You earned ${xpEarned} XP!` : 'Study more and try again!'}
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <Button onClick={startBattle} variant="outline">Try Again</Button>
              <Button onClick={() => { setBoss(null); setTopic(''); setBattleResult(null); }} variant="ghost">New Topic</Button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Daily Quests */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-lg font-display font-semibold text-foreground mb-4">Daily Quests</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dailyQuests.map((quest, i) => (
            <div key={i} className="glass rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <quest.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{quest.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={(quest.progress / quest.target) * 100} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground">{quest.progress}/{quest.target}</span>
                </div>
              </div>
              <span className="text-xs text-xp font-semibold">+{quest.xp} XP</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Leaderboard */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-lg font-display font-semibold text-foreground mb-4">Leaderboard</h2>
        <div className="glass rounded-xl p-4">
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-2 text-xp/30" />
            <p>Leaderboard updates weekly. Keep studying to climb the ranks!</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Quest;
