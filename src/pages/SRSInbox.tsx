import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, RotateCcw, Check, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/hooks/useProfile';

type SRSCard = {
  id: string; front: string; back: string; subject: string; topic: string;
  ease_factor: number; interval_days: number; repetitions: number; due_date: string;
  source: string; last_reviewed: string | null;
};

function sm2(card: SRSCard, rating: 1 | 2 | 3 | 4) {
  let { ease_factor, interval_days, repetitions } = card;
  if (rating >= 3) {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval_days = 1;
  }
  ease_factor = Math.max(1.3, ease_factor + 0.1 - (4 - rating) * (0.08 + (4 - rating) * 0.02));
  const due = new Date();
  due.setDate(due.getDate() + interval_days);
  return {
    ease_factor, interval_days, repetitions,
    due_date: due.toISOString().split('T')[0],
    last_reviewed: new Date().toISOString(),
  };
}

const RATINGS = [
  { value: 1 as const, label: 'Again', color: 'bg-destructive hover:bg-destructive/80', icon: RotateCcw },
  { value: 2 as const, label: 'Hard', color: 'bg-warning hover:bg-warning/80', icon: ChevronRight },
  { value: 3 as const, label: 'Good', color: 'bg-primary hover:bg-primary/80', icon: Check },
  { value: 4 as const, label: 'Easy', color: 'bg-success hover:bg-success/80', icon: Sparkles },
];

const SRSInbox = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0 });
  const [done, setDone] = useState(false);

  const { data: cards, isLoading } = useQuery({
    queryKey: ['srs-due', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('flashcard_srs')
        .select('*')
        .eq('user_id', user!.id)
        .lte('due_date', today)
        .order('due_date', { ascending: true })
        .limit(50) as any;
      return (data || []) as SRSCard[];
    },
    enabled: !!user,
  });

  const currentCard = cards?.[currentIndex];

  const rateCard = useCallback(async (rating: 1 | 2 | 3 | 4) => {
    if (!currentCard || !user) return;
    const updated = sm2(currentCard, rating);

    await supabase.from('flashcard_srs').update(updated as any).eq('id', currentCard.id);
    await supabase.from('srs_reviews').insert({
      user_id: user.id, card_id: currentCard.id, rating,
    } as any);

    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      again: rating === 1 ? prev.again + 1 : prev.again,
    }));

    setFlipped(false);
    if (currentIndex + 1 >= (cards?.length || 0)) {
      setDone(true);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentCard, currentIndex, cards, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const dueCount = cards?.length || 0;

  if (dueCount === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Inbox className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <h1 className="text-2xl font-display font-bold text-foreground">Inbox Clear! ✨</h1>
          <p className="text-sm text-muted-foreground mt-2">No cards due right now. Take tests or use AI Chat to generate new cards.</p>
          <Button onClick={() => window.location.href = '/tests'} className="mt-6 gradient-primary text-primary-foreground rounded-xl">
            Take a Test
          </Button>
        </motion.div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-display font-bold text-foreground">Session Complete!</h1>
          <div className="flex justify-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{sessionStats.reviewed}</p>
              <p className="text-xs text-muted-foreground">Reviewed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">{sessionStats.again}</p>
              <p className="text-xs text-muted-foreground">Again</p>
            </div>
          </div>
          <Button onClick={() => { setDone(false); setCurrentIndex(0); setSessionStats({ reviewed: 0, again: 0 }); queryClient.invalidateQueries({ queryKey: ['srs-due'] }); }}
            className="mt-6 gradient-primary text-primary-foreground rounded-xl">
            New Session
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Inbox className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-display font-bold text-foreground">SRS Inbox</h1>
          </div>
          <span className="text-xs text-muted-foreground">{currentIndex + 1} / {dueCount}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted/20 mt-3 overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${((currentIndex) / dueCount) * 100}%` }} />
        </div>
      </motion.div>

      {/* Greeting */}
      <p className="text-sm text-muted-foreground">
        Hey {profile?.display_name?.split(' ')[0] || 'there'}! You have <span className="text-primary font-semibold">{dueCount}</span> cards due today.
      </p>

      {/* Card */}
      <div className="perspective-1000" style={{ perspective: '1000px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard?.id}
            initial={{ rotateY: 0, opacity: 0 }}
            animate={{ rotateY: flipped ? 180 : 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={() => !flipped && setFlipped(true)}
            className="relative w-full min-h-[280px] cursor-pointer"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Front */}
            <div className="absolute inset-0 rounded-2xl p-8 flex flex-col items-center justify-center text-center"
              style={{
                backfaceVisibility: 'hidden',
                background: 'hsl(230 20% 11% / 0.8)',
                border: '1px solid hsl(0 0% 100% / 0.08)',
              }}
            >
              {currentCard?.subject && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-primary/15 text-primary mb-4">{currentCard.subject}</span>
              )}
              <p className="text-lg text-foreground font-medium leading-relaxed">{currentCard?.front}</p>
              <p className="text-xs text-muted-foreground/40 mt-6">Tap to flip</p>
            </div>
            {/* Back */}
            <div className="absolute inset-0 rounded-2xl p-8 flex flex-col items-center justify-center text-center"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: 'linear-gradient(135deg, hsl(174 72% 56% / 0.08), hsl(264 67% 60% / 0.05))',
                border: '1px solid hsl(174 72% 56% / 0.15)',
              }}
            >
              <p className="text-lg text-foreground font-medium leading-relaxed">{currentCard?.back}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rating buttons */}
      {flipped && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-2">
          {RATINGS.map(r => (
            <Button key={r.value} onClick={() => rateCard(r.value)}
              className={`${r.color} text-primary-foreground rounded-xl h-12 flex flex-col gap-0.5`}
            >
              <r.icon className="w-4 h-4" />
              <span className="text-[10px]">{r.label}</span>
            </Button>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default SRSInbox;
