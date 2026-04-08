import { useState, useCallback } from 'react';
import { Loader2, Copy, Check, BookOpen, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { createBufferedTextAccumulator, streamSSE } from '@/lib/aiStream';
import { motion } from 'framer-motion';

interface Props {
  transcript: string;
  notes: string;
  setNotes: (n: string) => void;
  notesGenerated: boolean;
  setNotesGenerated: (v: boolean) => void;
  onBeforeGenerate?: () => Promise<boolean>;
}

const STYLE_PRESETS = [
  { label: 'Detailed & Structured', value: 'detailed', description: 'Comprehensive notes with deep explanations', emoji: '📚' },
  { label: 'Exam-Ready', value: 'exam', description: 'Key facts, formulas & potential questions', emoji: '🎯' },
  { label: 'Simple & Clear', value: 'simple', description: 'Easy language with examples & analogies', emoji: '💡' },
  { label: 'Cornell Method', value: 'cornell', description: 'Cues, notes & summary in Cornell format', emoji: '📝' },
];

const LectureNotes = ({ transcript, notes, setNotes, notesGenerated, setNotesGenerated, onBeforeGenerate }: Props) => {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('detailed');
  const [customInstruction, setCustomInstruction] = useState('');
  const [followUpInput, setFollowUpInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const generateNotes = useCallback(async (additionalInstruction?: string) => {
    const isRefine = !!additionalInstruction && notesGenerated;
    if (!isRefine && onBeforeGenerate) {
      const allowed = await onBeforeGenerate();
      if (!allowed) return;
    }
    if (isRefine) { setIsRefining(true); } else { setLoading(true); setNotes(''); }

    try {
      const stylePreset = STYLE_PRESETS.find((s) => s.value === selectedStyle);
      const styleLabel = stylePreset?.label || 'Detailed & Structured';
      let userPrompt = `Create comprehensive study notes from this lecture content. Style: ${styleLabel}.`;
      if (customInstruction.trim()) userPrompt += `\n\nUser preferences: ${customInstruction.trim()}`;
      if (additionalInstruction) {
        userPrompt += `\n\nAdditional request: ${additionalInstruction}`;
        userPrompt += `\n\nHere are the current notes to refine:\n${notes}`;
      }
      userPrompt += `\n\nLecture content:\n${transcript}`;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ topic: 'Lecture Analysis', sourceText: userPrompt, style: selectedStyle, isRefinement: isRefine }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error('Rate limit exceeded. Please wait a moment.');
        if (resp.status === 402) throw new Error('AI credits exhausted.');
        throw new Error('Failed');
      }

      const streamBuffer = createBufferedTextAccumulator(setNotes);
      await streamSSE(resp, { onDelta: (chunk) => streamBuffer.push(chunk) });
      streamBuffer.flushNow();
      if (!streamBuffer.getText().trim()) throw new Error('Empty response');
      setNotesGenerated(true);
      toast.success(isRefine ? 'Notes updated!' : 'Notes generated!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate notes');
    } finally {
      setLoading(false);
      setIsRefining(false);
    }
  }, [transcript, setNotes, setNotesGenerated, selectedStyle, customInstruction, notes, notesGenerated]);

  const handleFollowUp = () => {
    if (!followUpInput.trim()) return;
    const instruction = followUpInput.trim();
    setFollowUpInput('');
    generateNotes(instruction);
  };

  const copyNotes = () => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied!');
  };

  if (!notesGenerated && !loading && !notes) {
    return (
      <div className="flex flex-col items-center py-10">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary)/0.15)] to-[hsl(var(--secondary)/0.1)] flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary/60" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-primary animate-pulse" />
        </div>
        <h3 className="text-xl font-display font-bold text-foreground mb-1.5">Generate Study Notes</h3>
        <p className="text-muted-foreground text-sm mb-8 text-center max-w-md leading-relaxed">
          Transform your lecture into organized, in-depth study notes. Choose a style below.
        </p>

        {/* Style presets */}
        <div className="grid grid-cols-2 gap-2.5 mb-5 w-full max-w-lg">
          {STYLE_PRESETS.map((style) => (
            <motion.button
              key={style.value}
              onClick={() => setSelectedStyle(style.value)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
                selectedStyle === style.value
                  ? 'border-primary/40 bg-primary/10 shadow-md shadow-primary/10'
                  : 'border-border/20 bg-card/30 hover:border-border/40 hover:bg-card/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{style.emoji}</span>
                <span className="text-sm font-semibold text-foreground">{style.label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{style.description}</p>
            </motion.button>
          ))}
        </div>

        {/* Custom instruction */}
        <div className="w-full max-w-lg mb-5">
          <Textarea
            placeholder="Any specific preferences? e.g., 'Focus on formulas', 'Make it beginner-friendly'..."
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            className="rounded-2xl bg-card/40 border-border/20 text-sm min-h-[56px] resize-none backdrop-blur-xl focus:border-primary/30"
          />
        </div>

        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button
            onClick={() => generateNotes()}
            className="h-12 px-8 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] shadow-lg shadow-primary/20"
          >
            <BookOpen className="w-4 h-4 mr-2" /> Generate Notes
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading && !notes && (
        <div className="flex flex-col items-center py-12 gap-3">
          <div className="relative">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Generating detailed notes...</p>
        </div>
      )}
      {notes && (
        <>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={copyNotes} className="rounded-xl h-9">
              {copied ? <Check className="w-4 h-4 mr-1.5 text-green-500" /> : <Copy className="w-4 h-4 mr-1.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="text-sm max-w-none text-muted-foreground max-h-[500px] overflow-y-auto pr-2 scroll-smooth">
            <MarkdownRenderer streaming={loading || isRefining}>{notes}</MarkdownRenderer>
          </div>
          {(loading || isRefining) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> {isRefining ? 'Refining notes...' : 'Still generating...'}
            </div>
          )}

          {/* Follow-up refinement */}
          {notesGenerated && !loading && !isRefining && (
            <div className="flex gap-2 items-end mt-4">
              <Textarea
                placeholder="Want changes? e.g., 'Add more examples', 'Simplify section X'..."
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                className="rounded-2xl bg-card/40 border-border/20 text-sm min-h-[44px] max-h-[100px] resize-none flex-1 backdrop-blur-xl focus:border-primary/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFollowUp(); }
                }}
              />
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={handleFollowUp}
                  disabled={!followUpInput.trim()}
                  size="sm"
                  className="rounded-2xl h-11 px-4 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)]"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </motion.div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LectureNotes;
