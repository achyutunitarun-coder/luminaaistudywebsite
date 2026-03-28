import { useState, useCallback } from 'react';
import { Loader2, Layers, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Flashcard {
  front: string;
  back: string;
}

interface Props {
  notes: string;
  onBeforeGenerate?: () => Promise<boolean>;
}

const LectureFlashcards = ({ notes, onBeforeGenerate }: Props) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [flippedIdx, setFlippedIdx] = useState<number | null>(null);

  const generate = useCallback(async () => {
    if (onBeforeGenerate) {
      const allowed = await onBeforeGenerate();
      if (!allowed) return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lecture-tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ notes, type: 'flashcards' }),
      });

      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      
      // Parse the JSON content
      let content = data.content || '';
      // Extract JSON array from possible markdown code blocks
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setCards(parsed);
        toast.success(`${parsed.length} flashcards generated!`);
      } else {
        throw new Error('Invalid format');
      }
    } catch {
      toast.error('Failed to generate flashcards');
    } finally {
      setLoading(false);
    }
  }, [notes]);

  if (!cards.length && !loading) {
    return (
      <div className="flex flex-col items-center py-16">
        <Layers className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-display font-bold text-foreground mb-2">Generate Flashcards</h3>
        <p className="text-muted-foreground text-sm mb-6">Create flashcards from your lecture notes for quick revision.</p>
        <Button onClick={generate} disabled={!notes} className="h-11 px-6 rounded-2xl">
          <Layers className="w-4 h-4 mr-2" /> Generate Flashcards
        </Button>
        {!notes && <p className="text-xs text-muted-foreground mt-2">Generate notes first</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Generating flashcards...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{cards.length} cards • Click to flip</span>
        <Button variant="ghost" size="sm" onClick={generate} className="rounded-xl">
          <RotateCcw className="w-4 h-4 mr-1.5" /> Regenerate
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            onClick={() => setFlippedIdx(flippedIdx === i ? null : i)}
            className="cursor-pointer rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-5 min-h-[120px] flex items-center justify-center text-center transition-all hover:border-primary/30"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-2">
                {flippedIdx === i ? 'Answer' : 'Question'}
              </span>
              <p className="text-sm text-foreground leading-relaxed">
                {flippedIdx === i ? card.back : card.front}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default LectureFlashcards;
