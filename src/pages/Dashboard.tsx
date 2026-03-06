import { motion } from 'framer-motion';
import { Trophy, Flame, Target, BookOpen, Zap, Swords } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { profile, getLevelTitle, xpForNextLevel } = useProfile();
  const navigate = useNavigate();

  if (!profile) return null;

  const xpProgress = (profile.xp % 100);
  const nextLevelXp = xpForNextLevel(profile.level);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-secondary/5 blur-3xl" />
        
        <div className="relative z-10">
          <p className="text-muted-foreground text-sm mb-1">Welcome back,</p>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            {profile.display_name || 'Student'}
          </h1>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xp font-display text-sm font-semibold">
              {getLevelTitle(profile.level)}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground text-sm">Level {profile.level}</span>
          </div>

          {/* XP Progress */}
          <div className="max-w-md">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-xp font-semibold">{profile.xp} XP</span>
              <span className="text-muted-foreground">{nextLevelXp} XP to Level {profile.level + 1}</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full rounded-full gradient-xp"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Trophy} label="Level" value={profile.level} color="xp" delay={0.1} />
        <StatCard icon={Flame} label="Day Streak" value={profile.streak_days} color="warning" delay={0.2} />
        <StatCard icon={Target} label="XP Earned" value={profile.xp} color="primary" delay={0.3} />
        <StatCard icon={BookOpen} label="Coins" value={profile.coins} color="secondary" delay={0.4} />
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-lg font-display font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/chat')}
            className="glass rounded-xl p-5 text-left hover:border-primary/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:glow-primary transition-shadow">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">AI Chat</h3>
            <p className="text-sm text-muted-foreground">Ask questions, get explanations</p>
          </button>

          <button
            onClick={() => navigate('/tests')}
            className="glass rounded-xl p-5 text-left hover:border-secondary/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center mb-3 group-hover:glow-secondary transition-shadow">
              <Target className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Generate Test</h3>
            <p className="text-sm text-muted-foreground">AI-powered adaptive tests</p>
          </button>

          <button
            onClick={() => navigate('/quest')}
            className="glass rounded-xl p-5 text-left hover:border-xp/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-xp/10 flex items-center justify-center mb-3 group-hover:glow-xp transition-shadow">
              <Swords className="w-5 h-5 text-xp" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Lumina Quest</h3>
            <p className="text-sm text-muted-foreground">Battle bosses, earn rewards</p>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
