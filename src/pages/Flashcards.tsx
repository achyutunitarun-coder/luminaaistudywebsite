import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, RotateCcw, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const Flashcards = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [activeDeck, setActiveDeck] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const { data: decks } = useQuery({
    queryKey: ['flashcard_decks', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('flashcard_decks').select('*').order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: cards } = useQuery({
    queryKey: ['flashcards', activeDeck],
    queryFn: async () => {
      if (!activeDeck) return [];
      const { data } = await supabase.from('flashcards').select('*').eq('deck_id', activeDeck).order('created_at');
      return data || [];
    },
    enabled: !!activeDeck,
  });

  const generateDeck = async () => {
    if (!content.trim() || !title.trim() || !user) return;
    setGenerating(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-flashcards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ content, title }),
      });
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();

      const { data: deck } = await supabase.from('flashcard_decks').insert({
        user_id: user.id, title, card_count: data.cards.length,
      }).select().single();

      if (deck && data.cards) {
        await supabase.from('flashcards').insert(
          data.cards.map((c: { front: string; back: string }) => ({ deck_id: deck.id, front: c.front, back: c.back }))
        );
        queryClient.invalidateQueries({ queryKey: ['flashcard_decks'] });
        setShowCreate(false);
        setTitle('');
        setContent('');
        toast.success('Flashcard deck created!');
      }
    } catch {
      toast.error('Failed to generate flashcards');
    }
    setGenerating(false);
  };

  if (activeDeck && cards) {
    const card = cards[cardIndex];
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => { setActiveDeck(null); setCardIndex(0); setFlipped(false); }}>
          ← Back to Decks
        </Button>
        {card && (
          <div className="flex flex-col items-center">
            <p className="text-sm text-muted-foreground mb-4">{cardIndex + 1} / {cards.length}</p>
            <motion.div
              className="w-full aspect-[3/2] glass rounded-2xl flex items-center justify-center p-8 cursor-pointer"
              onClick={() => setFlipped(!flipped)}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={flipped ? 'back' : 'front'}
                  initial={{ opacity: 0, rotateY: 90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  exit={{ opacity: 0, rotateY: -90 }}
                  transition={{ duration: 0.3 }}
                  className="text-center"
                >
                  <p className="text-xs text-primary font-semibold mb-2">{flipped ? 'ANSWER' : 'QUESTION'}</p>
                  <p className="text-xl text-foreground font-medium">{flipped ? card.back : card.front}</p>
                </motion.div>
              </AnimatePresence>
            </motion.div>
            <div className="flex items-center gap-4 mt-6">
              <Button variant="outline" size="icon" onClick={() => { setCardIndex(Math.max(0, cardIndex - 1)); setFlipped(false); }} disabled={cardIndex === 0}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setFlipped(false)}>
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => { setCardIndex(Math.min(cards.length - 1, cardIndex + 1)); setFlipped(false); }} disabled={cardIndex === cards.length - 1}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">AI Flashcards</h1>
          <p className="text-muted-foreground text-sm">Generate flashcards from any content</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gradient-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" /> Create Deck
        </Button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6 space-y-4">
          <Input placeholder="Deck title" value={title} onChange={e => setTitle(e.target.value)} className="bg-muted/50" />
          <Textarea placeholder="Paste your notes, syllabus, or any content here..." value={content} onChange={e => setContent(e.target.value)} className="bg-muted/50 min-h-[120px]" />
          <div className="flex gap-2">
            <Button onClick={generateDeck} disabled={generating || !title.trim() || !content.trim()} className="gradient-primary text-primary-foreground">
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generate Cards
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks?.map((deck, i) => (
          <motion.button
            key={deck.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => { setActiveDeck(deck.id); setCardIndex(0); setFlipped(false); }}
            className="glass rounded-xl p-5 text-left hover:border-primary/50 transition-all"
          >
            <h3 className="font-semibold text-foreground mb-1">{deck.title}</h3>
            <p className="text-sm text-muted-foreground">{deck.card_count} cards</p>
          </motion.button>
        ))}
      </div>

      {(!decks || decks.length === 0) && !showCreate && (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No flashcard decks yet. Create your first one!</p>
        </div>
      )}
    </div>
  );
};

export default Flashcards;
