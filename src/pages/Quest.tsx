import { useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, Heart, Shield, Zap, Trophy, Star, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useProfile } from '@/hooks/useProfile';

type Boss = {
  name: string;
  hp: number;
  maxHp: number;
  icon: string;
  subject: string;
  questions: { q: string; options: string[]; correct: number }[];
};

const sampleBoss: Boss = {
  name: 'Algebra Demon',
  hp: 100,
  maxHp: 100,
  icon: '👹',
  subject: 'Algebra',
  questions: [
    { q: 'What is 2x + 3 = 11? Solve for x.', options: ['x = 3', 'x = 4', 'x = 5', 'x = 6'], correct: 1 },
    { q: 'Simplify: 3(x + 2) - x', options: ['2x + 6', '2x + 2', '4x + 6', '3x + 2'], correct: 0 },
    { q: 'Factor: x² - 9', options: ['(x-3)(x+3)', '(x-9)(x+1)', '(x-3)²', '(x+9)(x-1)'], correct: 0 },
    { q: 'What is √144?', options: ['11', '12', '13', '14'], correct: 1 },
    { q: 'If y = 2x + 1, what is y when x = 5?', options: ['9', '10', '11', '12'], correct: 2 },
  ],
};

const dailyQuests = [
  { icon: Target, title: 'Solve 5 questions', progress: 3, target: 5, xp: 20 },
  { icon: Star, title: 'Review 10 flashcards', progress: 7, target: 10, xp: 15 },
  { icon: Zap, title: 'Study for 10 minutes', progress: 10, target: 10, xp: 25 },
  { icon: Trophy, title: 'Complete 1 test', progress: 0, target: 1, xp: 50 },
];

const Quest = () => {
  const { profile, getLevelTitle } = useProfile();
  const [boss, setBoss] = useState<Boss>(sampleBoss);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [playerHp, setPlayerHp] = useState(100);
  const [battleActive, setBattleActive] = useState(false);
  const [battleResult, setBattleResult] = useState<'win' | 'lose' | null>(null);
  const [xpEarned, setXpEarned] = useState(0);

  const startBattle = () => {
    setBoss({ ...sampleBoss });
    setPlayerHp(100);
    setQuestionIdx(0);
    setBattleActive(true);
    setBattleResult(null);
    setXpEarned(0);
  };

  const answerQuestion = (optionIdx: number) => {
    const q = boss.questions[questionIdx];
    if (optionIdx === q.correct) {
      // Correct: boss loses HP
      const newBossHp = Math.max(0, boss.hp - 25);
      setBoss(prev => ({ ...prev, hp: newBossHp }));
      setXpEarned(prev => prev + 10);
      if (newBossHp <= 0) {
        setBattleResult('win');
        setBattleActive(false);
        return;
      }
    } else {
      // Wrong: player loses HP
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
        <p className="text-muted-foreground text-sm">Battle knowledge bosses and level up!</p>
      </motion.div>

      {/* Boss Battle */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
        <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Swords className="w-5 h-5 text-destructive" /> Boss Battle
        </h2>

        {!battleActive && !battleResult && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">{boss.icon}</div>
            <h3 className="text-xl font-display font-bold text-foreground mb-2">{boss.name}</h3>
            <p className="text-muted-foreground mb-6">Defeat this boss by answering {boss.subject} questions!</p>
            <Button onClick={startBattle} className="gradient-primary text-primary-foreground">
              <Swords className="w-4 h-4 mr-2" /> Start Battle
            </Button>
          </div>
        )}

        {battleActive && (
          <div className="space-y-6">
            {/* HP Bars */}
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

            {/* Question */}
            <div className="glass rounded-xl p-5">
              <p className="text-primary text-xs font-semibold mb-2">Question {questionIdx + 1}</p>
              <p className="text-foreground font-medium mb-4">{boss.questions[questionIdx].q}</p>
              <div className="grid grid-cols-2 gap-2">
                {boss.questions[questionIdx].options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => answerQuestion(i)}
                    className="glass rounded-lg px-4 py-3 text-sm text-left hover:border-primary/50 transition-all"
                  >
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
            <Button onClick={startBattle} variant="outline" className="mt-4">
              Try Again
            </Button>
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
