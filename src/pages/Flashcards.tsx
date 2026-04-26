import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, RotateCcw, ChevronLeft, ChevronRight, Loader2, ArrowLeft, Layers, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';
import { FileUploadButton, buildFileContext, type UploadedFile } from '@/components/FileUploadButton';

const Flashcards = () => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [cardCount, setCardCount] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [activeDeck, setActiveDeck] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

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
    if (!title.trim() || !user) return;
    const allowed = await checkAndIncrement('flashcard_sets');
    if (!allowed) return;
    setGenerating(true);
    try {
      const fileContext = buildFileContext(uploadedFiles);
      // Topic-only generation: if no notes pasted, use the title/topic as the basis.
      const baseContent = content.trim()
        ? content
        : `Generate comprehensive, exam-quality flashcards about the topic: "${title.trim()}". Cover key definitions, core concepts, common formulas/facts, important examples, and the kinds of questions a student is most likely to be asked. Vary card difficulty (easy → hard).`;
      const fullContent = baseContent + fileContext;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-flashcards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ content: fullContent, title, cardCount }),
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
        setCardCount(20);
        toast.success(`Flashcard deck created with ${data.cards.length} cards!`);
      }
    } catch {
      toast.error('Failed to generate flashcards');
    }
    setGenerating(false);
  };

  // ── Active Deck / Card Review ──
  if (activeDeck && cards) {
    const card = cards[cardIndex];
    const progress = cards.length > 0 ? ((cardIndex + 1) / cards.length) * 100 : 0;
    const deckTitle = decks?.find(d => d.id === activeDeck)?.title;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => { setActiveDeck(null); setCardIndex(0); setFlipped(false); }} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <span className="text-sm font-medium text-muted-foreground">{deckTitle}</span>
          <span className="text-sm font-bold text-primary">{cardIndex + 1}/{cards.length}</span>
        </div>

        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 100 }}
          />
        </div>

        {card && (
          <div className="flex flex-col items-center pt-4">
            <div className="w-full perspective-[1200px]">
              <motion.div
                className="relative w-full aspect-[4/3] cursor-pointer"
                onClick={() => setFlipped(!flipped)}
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.5, type: 'spring', stiffness: 80 }}
              >
                <div
                  className="absolute inset-0 rounded-[2rem] liquid-glass-intense flex flex-col items-center justify-center p-10"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-6 bg-primary/10 px-3 py-1 rounded-full">Question</span>
                  <p className="text-xl md:text-2xl text-foreground font-display font-semibold text-center leading-relaxed">{card.front}</p>
                  <p className="text-xs text-muted-foreground mt-8">Tap to reveal answer</p>
                </div>
                <div
                  className="absolute inset-0 rounded-[2rem] liquid-glass-intense border-success/20 flex flex-col items-center justify-center p-10"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <span className="text-[10px] font-bold text-success uppercase tracking-[0.2em] mb-6 bg-success/10 px-3 py-1 rounded-full">Answer</span>
                  <p className="text-xl md:text-2xl text-foreground font-display font-semibold text-center leading-relaxed">{card.back}</p>
                </div>
              </motion.div>
            </div>

            <div className="flex items-center gap-3 mt-8">
              <Button variant="outline" size="lg" onClick={() => { setCardIndex(Math.max(0, cardIndex - 1)); setFlipped(false); }} disabled={cardIndex === 0} className="rounded-2xl h-12 w-12">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => setFlipped(false)} className="rounded-2xl h-12 w-12">
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => { setCardIndex(Math.min(cards.length - 1, cardIndex + 1)); setFlipped(false); }} disabled={cardIndex === cards.length - 1} className="rounded-2xl h-12 w-12">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex gap-1.5 mt-6 flex-wrap justify-center max-w-md">
              {cards.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCardIndex(i); setFlipped(false); }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === cardIndex ? 'bg-primary w-6' : i < cardIndex ? 'bg-primary/40' : 'bg-muted/50'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    <div className="max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center shadow-xl shadow-primary/20">
              <Layers className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Flashcards</h1>
              <p className="text-muted-foreground text-sm mt-0.5">AI-generated decks for active recall</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="gradient-primary text-primary-foreground rounded-2xl h-12 px-6 shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" /> New Deck
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-[2rem] liquid-glass-intense p-8 space-y-5">
              <Input
                placeholder="Deck title — e.g., Biology Chapter 5"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-muted/20 border-border/30 rounded-xl h-13 px-5 text-base"
              />
              <Textarea
                placeholder="Paste your notes, textbook content, or syllabus here..."
                value={content}
                onChange={e => setContent(e.target.value)}
                className="bg-muted/20 border-border/30 rounded-xl min-h-[140px] px-5 py-4 text-sm resize-none"
              />
              <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} maxFiles={5} />
              
              {/* Card count selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">Number of flashcards</label>
                  <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{cardCount} cards</span>
                </div>
                <Slider
                  value={[cardCount]}
                  onValueChange={(v) => setCardCount(v[0])}
                  min={5}
                  max={80}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>5</span>
                  <span>20</span>
                  <span>40</span>
                  <span>60</span>
                  <span>80</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={generateDeck}
                  disabled={generating || !title.trim()}
                  className="gradient-primary text-primary-foreground h-12 px-8 rounded-2xl shadow-lg shadow-primary/20"
                >
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Generate {cardCount} Cards
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-2xl h-12">Cancel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks?.map((deck, i) => (
          <motion.button
            key={deck.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => { setActiveDeck(deck.id); setCardIndex(0); setFlipped(false); }}
            className="group relative rounded-2xl liquid-glass hover:border-primary/30 p-6 text-left transition-all hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-primary/5 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-bold text-foreground mb-1 text-lg">{deck.title}</h3>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Layers className="w-3 h-3" /> {deck.card_count} cards
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(deck.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {(!decks || decks.length === 0) && !showCreate && (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-3xl liquid-glass flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">No flashcard decks yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first deck to start studying</p>
        </div>
      )}
    </div>
    </>
  );
};

export default Flashcards;
