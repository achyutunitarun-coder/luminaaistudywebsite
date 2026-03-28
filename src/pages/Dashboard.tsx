import { motion } from 'framer-motion';
import { Trophy, Flame, Target, BookOpen, Zap, Swords, Search, TrendingUp, BarChart3, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStudyTimer } from '@/hooks/useStudyTimer';

const ease = [0.25, 0.1, 0.25, 1] as const;

const Dashboard = () => {
  const { profile, getLevelTitle, xpForNextLevel } = useProfile();
  const { user } = useAuth();
  const { seconds: liveSeconds } = useStudyTimer();
  const navigate = useNavigate();

  const { data: todayMinutes } = useQuery({
    queryKey: ['today-study-minutes', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('study_sessions')
        .select('duration_minutes')
        .eq('user_id', user!.id)
        .gte('started_at', today);
      return data?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
    },
    enabled: !!user,
  });

  const { data: weeklyMinutes } = useQuery({
    queryKey: ['weekly-study-minutes', user?.id],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from('study_sessions')
        .select('duration_minutes, started_at')
        .eq('user_id', user!.id)
        .gte('started_at', weekAgo);
      return data || [];
    },
    enabled: !!user,
  });

  if (!profile) return null;

  const xpProgress = (profile.xp % 100);
  const nextLevelXp = xpForNextLevel(profile.level);
  const liveMinutes = Math.floor(liveSeconds / 60);
  const totalToday = (todayMinutes || 0) + liveMinutes;
  const hrs = Math.floor(totalToday / 60);
  const mins = totalToday % 60;

  const featureCards = [
    { icon: Search, title: 'Weakness Detection', desc: 'Automatically identify weak subjects from tests.', color: 'text-destructive', bg: 'bg-destructive/8' },
    { icon: TrendingUp, title: 'Smart Suggestions', desc: 'AI recommends exactly what to study next.', color: 'text-primary', bg: 'bg-primary/8' },
    { icon: BarChart3, title: 'Progress Tracking', desc: 'See your strengths improve over time.', color: 'text-success', bg: 'bg-success/8' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
        className="relative text-center py-16 px-8 rounded-[2.5rem] overflow-hidden liquid-glass-elevated noise-overlay"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/4 via-transparent to-secondary/4 z-[2]" />
        <div className="ambient-orb w-[600px] h-[600px] bg-primary/3 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, ease }}
            className="text-4xl md:text-5xl lg:text-[3.5rem] font-display font-bold text-foreground leading-[1.08] max-w-3xl mx-auto"
          >
            An AI that finds your weak subjects and <span className="text-gradient-animated">helps you fix them.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ease }}
            className="text-lg text-muted-foreground max-w-xl mx-auto mt-5 leading-relaxed"
          >
            Lumina analyzes your tests, notes, and doubts to show exactly what you need to study next.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, ease }}
            className="mt-8 flex items-center justify-center gap-3"
          >
            <Button
              onClick={() => navigate('/study-session')}
              size="lg"
              className="gradient-primary text-primary-foreground px-8 h-[52px] text-sm font-semibold rounded-2xl shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Studying <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={() => navigate('/quick-study')}
              variant="outline"
              size="lg"
              className="h-[52px] px-8 text-sm rounded-2xl border-border/20 hover:bg-muted/20 transition-all duration-300"
            >
              Quick 10-Min Lesson
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {featureCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.08, ease }}
            className="rounded-2xl liquid-glass p-6 text-center card-hover"
          >
            <div className="relative z-10">
              <div className={`w-12 h-12 rounded-2xl ${card.bg} flex items-center justify-center mx-auto mb-4`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-1.5">{card.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Welcome & XP */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, ease }}
        className="rounded-[1.75rem] liquid-glass-intense p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-primary/4 blur-[60px]" />
        <div className="relative z-10">
          <p className="text-muted-foreground text-[13px] mb-1 font-medium">Welcome back,</p>
          <h2 className="text-3xl font-display font-bold text-foreground mb-1.5">
            {profile.display_name || 'Student'}
          </h2>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xp font-display text-[13px] font-semibold">{getLevelTitle(profile.level)}</span>
            <span className="text-muted-foreground/30">•</span>
            <span className="text-muted-foreground text-[13px]">Level {profile.level}</span>
          </div>
          <div className="max-w-md">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-xp font-semibold tabular-nums">{profile.xp} XP</span>
              <span className="text-muted-foreground">{nextLevelXp} XP to Level {profile.level + 1}</span>
            </div>
            <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 1.2, delay: 0.3, ease }}
                className="h-full rounded-full gradient-xp"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Trophy} label="Level" value={profile.level} color="xp" delay={0.1} />
        <StatCard icon={Flame} label="Day Streak" value={profile.streak_days} color="warning" delay={0.15} />
        <StatCard icon={Target} label="XP Earned" value={profile.xp} color="primary" delay={0.2} />
        <StatCard icon={BookOpen} label="Coins" value={profile.coins} color="secondary" delay={0.25} />
      </div>

      {/* Learning Progress */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, ease }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-display font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" /> Learning Progress
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Start Learning', desc: 'Begin your study journey', done: true, color: 'text-success' },
            { label: 'Take Tests', desc: 'Test your knowledge with AI', done: profile.xp > 50, color: 'text-primary' },
            { label: 'Master Topics', desc: 'Fix weaknesses and level up', done: profile.xp > 200, color: 'text-xp' },
          ].map((step, i) => (
            <div key={i} className={`rounded-2xl liquid-glass p-5 ${step.done ? 'border-success/20' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className={`w-5 h-5 ${step.done ? 'text-success' : 'text-muted-foreground/30'}`} />
                <span className={`text-sm font-semibold ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, ease }}>
        <h2 className="text-[15px] font-display font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { name: 'AI Chat', desc: 'Ask questions, get explanations', icon: Zap, url: '/chat', color: 'text-primary', bg: 'bg-primary/8' },
            { name: 'Generate Test', desc: 'AI-powered adaptive tests', icon: Target, url: '/tests', color: 'text-secondary', bg: 'bg-secondary/8' },
            { name: 'Lumina Quest', desc: 'Battle bosses, earn rewards', icon: Swords, url: '/quest', color: 'text-xp', bg: 'bg-xp/8' },
          ].map(action => (
            <button
              key={action.name}
              onClick={() => navigate(action.url)}
              className="rounded-2xl liquid-glass p-5 text-left transition-all duration-300 group card-hover"
            >
              <div className="relative z-10">
                <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110`}>
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-0.5">{action.name}</h3>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Pulse Widget */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, ease }}
        className="rounded-[1.75rem] liquid-glass p-8"
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[15px] font-display font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Pulse
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your study activity today</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/pulse')} className="text-primary text-xs rounded-xl hover:bg-primary/8">
              View Details <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>

          <div className="text-center">
            <div className="flex items-baseline justify-center gap-1 tabular-nums">
              <span className="text-[56px] font-display font-bold text-foreground leading-none">{hrs}</span>
              <span className="text-lg text-muted-foreground/40 font-light">hr</span>
              <span className="text-[56px] font-display font-bold text-foreground ml-2 leading-none">{mins}</span>
              <span className="text-lg text-muted-foreground/40 font-light">min</span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">studied today</p>
          </div>

          <div className="flex items-center justify-center gap-2.5 mt-8">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
              const dayData = weeklyMinutes?.find(s => {
                const d = new Date(s.started_at);
                return d.getDay() === (i + 1) % 7;
              });
              const active = dayData && dayData.duration_minutes > 0;
              const today = new Date().getDay() === (i + 1) % 7;
              return (
                <div key={day} className="flex flex-col items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                    active ? 'border-primary bg-primary/12 text-primary' : today ? 'border-primary/30 text-muted-foreground' : 'border-border/20 text-muted-foreground/30'
                  }`}>
                    {active ? '✓' : ''}
                  </div>
                  <span className={`text-[9px] font-medium ${today ? 'text-primary' : 'text-muted-foreground/40'}`}>{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
