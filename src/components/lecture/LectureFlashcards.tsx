import { useState, useCallback } from 'react';
import { Loader2, Layers, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface Flashcard { front: string; back: string; }

interface Props {
  notes: string;
  onBeforeGenerate?: () => Promise<boolean>;
}

const LectureFlashcards = ({ notes, onBeforeGenerate }: Props) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [flippedIdx, setFlippedIdx] = useState<number | null>(null);

  const generate = useCallback(async () => {
    if (onBeforeGenerate) { const allowed = await onBeforeGenerate(); if (!allowed) return; }
    setLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lecture-tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ notes, type: 'flashcards' }),
      });
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      const match = (data.content || '').match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setCards(parsed);
        toast.success(`${parsed.length} flashcards generated!`);
      } else throw new Error('Invalid format');
    } catch { toast.error('Failed to generate flashcards'); }
    finally { setLoading(false); }
  }, [notes]);

  if (!cards.length && !loading) {
    return (
      <div className="flex flex-col items-center py-14">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary)/0.15)] to-[hsl(var(--secondary)/0.1)] flex items-center justify-center">
            <Layers className="w-8 h-8 text-primary/60" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-primary animate-pulse" />
        </div>
        <h3 className="text-xl font-display font-bold text-foreground mb-1.5">Generate Flashcards</h3>
        <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">Create flashcards from your lecture notes for quick revision.</p>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button onClick={generate} disabled={!notes} className="h-12 px-8 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] shadow-lg shadow-primary/20">
            <Layers className="w-4 h-4 mr-2" /> Generate Flashcards
          </Button>
        </motion.div>
        {!notes && <p className="text-xs text-muted-foreground mt-3">Generate notes first</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Generating flashcards...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{cards.length} cards • Click to flip</span>
        <Button variant="ghost" size="sm" onClick={generate} className="rounded-xl h-9">
          <RotateCcw className="w-4 h-4 mr-1.5" /> Regenerate
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            onClick={() => setFlippedIdx(flippedIdx === i ? null : i)}
            className={`cursor-pointer rounded-2xl border p-5 min-h-[130px] flex items-center justify-center text-center transition-all duration-300 backdrop-blur-xl ${
              flippedIdx === i
                ? 'border-primary/30 bg-primary/5 shadow-md shadow-primary/10'
                : 'border-border/20 bg-card/30 hover:border-border/40 hover:bg-card/50'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            layout
          >
            <div>
              <span className={`text-[10px] uppercase tracking-[0.15em] font-semibold block mb-2.5 ${
                flippedIdx === i ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {flippedIdx === i ? '✓ Answer' : 'Question'}
              </span>
              <div className="text-sm text-foreground leading-relaxed">
                <MarkdownRenderer>{flippedIdx === i ? card.back : card.front}</MarkdownRenderer>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default LectureFlashcards;
