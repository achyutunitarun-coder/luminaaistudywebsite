import { useState, useCallback } from 'react';
import { Loader2, Copy, Check, BookOpen, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { createBufferedTextAccumulator, streamSSE } from '@/lib/aiStream';

interface Props {
  transcript: string;
  notes: string;
  setNotes: (n: string) => void;
  notesGenerated: boolean;
  setNotesGenerated: (v: boolean) => void;
  onBeforeGenerate?: () => Promise<boolean>;
}

const STYLE_PRESETS = [
  { label: 'Detailed & Structured', value: 'detailed', description: 'Comprehensive notes with headings, subheadings, and deep explanations' },
  { label: 'Exam-Ready', value: 'exam', description: 'Focus on key facts, definitions, formulas, and potential exam questions' },
  { label: 'Simple & Clear', value: 'simple', description: 'Easy-to-understand language with examples and analogies' },
  { label: 'Cornell Method', value: 'cornell', description: 'Cues, notes, and summary sections in Cornell note-taking format' },
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
    if (isRefine) {
      setIsRefining(true);
    } else {
      setLoading(true);
      setNotes('');
    }

    try {
      const stylePreset = STYLE_PRESETS.find((s) => s.value === selectedStyle);
      const styleLabel = stylePreset?.label || 'Detailed & Structured';

      let userPrompt = `Create comprehensive study notes from this lecture content. Style: ${styleLabel}.`;
      if (customInstruction.trim()) {
        userPrompt += `\n\nUser preferences: ${customInstruction.trim()}`;
      }
      if (additionalInstruction) {
        userPrompt += `\n\nAdditional request: ${additionalInstruction}`;
        userPrompt += `\n\nHere are the current notes to refine:\n${notes}`;
      }
      userPrompt += `\n\nLecture content:\n${transcript}`;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          topic: 'Lecture Analysis',
          sourceText: userPrompt,
          style: selectedStyle,
          isRefinement: isRefine,
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        if (resp.status === 402) throw new Error('AI credits are exhausted right now. Please add credits.');
        throw new Error('Failed');
      }

      const streamBuffer = createBufferedTextAccumulator(setNotes);
      await streamSSE(resp, {
        onDelta: (chunk) => streamBuffer.push(chunk),
      });
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
        <BookOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-display font-bold text-foreground mb-2">Generate Study Notes</h3>
        <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
          Transform your lecture into organized, in-depth study notes. Choose a style and add any preferences below.
        </p>

        {/* Style presets */}
        <div className="grid grid-cols-2 gap-2 mb-4 w-full max-w-lg">
          {STYLE_PRESETS.map((style) => (
            <button
              key={style.value}
              onClick={() => setSelectedStyle(style.value)}
              className={`text-left p-3 rounded-xl border transition-all ${
                selectedStyle === style.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border/30 bg-card/30 text-muted-foreground hover:border-border/60'
              }`}
            >
              <div className="text-sm font-semibold">{style.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{style.description}</div>
            </button>
          ))}
        </div>

        {/* Custom instruction */}
        <div className="w-full max-w-lg mb-4">
          <Textarea
            placeholder="Any specific preferences? e.g., 'Focus on formulas', 'Include diagrams descriptions', 'Make it beginner-friendly'..."
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            className="rounded-xl bg-card/40 border-border/30 text-sm min-h-[60px] resize-none"
          />
        </div>

        <Button onClick={() => generateNotes()} className="h-11 px-6 rounded-2xl">
          <BookOpen className="w-4 h-4 mr-2" /> Generate Notes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading && !notes && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Generating detailed notes...
        </div>
      )}
      {notes && (
        <>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={copyNotes} className="rounded-xl">
              {copied ? <Check className="w-4 h-4 mr-1.5 text-success" /> : <Copy className="w-4 h-4 mr-1.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-foreground prose-headings:tracking-tight prose-headings:border-b prose-headings:border-border/20 prose-headings:pb-2 prose-p:text-muted-foreground prose-p:leading-[1.85] prose-strong:text-foreground prose-strong:font-semibold prose-li:text-muted-foreground prose-li:leading-[1.75] prose-blockquote:border-l-success/50 prose-blockquote:bg-success/5 prose-blockquote:rounded-r-xl prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:text-foreground/80 prose-blockquote:not-italic prose-h2:mt-8 prose-h2:mb-4 prose-h3:mt-6 prose-h3:mb-2 prose-h3:border-none prose-hr:border-border/20 prose-hr:my-6 prose-table:text-sm prose-th:text-foreground prose-th:font-semibold prose-th:bg-muted/20 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-1.5 prose-td:border-border/20 [&_table]:rounded-xl [&_table]:overflow-hidden [&_table]:border [&_table]:border-border/20 [&_ul]:space-y-1 [&_input[type=checkbox]]:mr-2 [&_input[type=checkbox]]:accent-success max-h-[500px] overflow-y-auto pr-2">
            <MarkdownRenderer>{notes}</MarkdownRenderer>
          </div>
          {(loading || isRefining) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> {isRefining ? 'Refining notes...' : 'Still generating...'}
            </div>
          )}

          {/* Conversational follow-up */}
          {notesGenerated && !loading && !isRefining && (
            <div className="flex gap-2 items-end mt-4">
              <Textarea
                placeholder="Want changes? e.g., 'Make the formulas section longer', 'Add more examples', 'Simplify the explanation of X'..."
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                className="rounded-xl bg-card/40 border-border/30 text-sm min-h-[44px] max-h-[100px] resize-none flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleFollowUp();
                  }
                }}
              />
              <Button
                onClick={handleFollowUp}
                disabled={!followUpInput.trim()}
                size="sm"
                className="rounded-xl h-11 px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LectureNotes;
