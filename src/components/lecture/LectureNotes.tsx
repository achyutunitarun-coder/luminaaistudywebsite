import { useState, useCallback } from 'react';
import { Loader2, Copy, Check, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface Props {
  transcript: string;
  notes: string;
  setNotes: (n: string) => void;
  notesGenerated: boolean;
  setNotesGenerated: (v: boolean) => void;
}

const LectureNotes = ({ transcript, notes, setNotes, notesGenerated, setNotesGenerated }: Props) => {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateNotes = useCallback(async () => {
    setLoading(true);
    setNotes('');
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          topic: 'Lecture Analysis',
          sourceText: `Transcribed lecture content:\n\n${transcript}`,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error('Failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '' || !line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) setNotes(content);
          } catch {}
        }
      }

      setNotesGenerated(true);
      toast.success('Notes generated!');
    } catch {
      toast.error('Failed to generate notes');
    } finally {
      setLoading(false);
    }
  }, [transcript, setNotes, setNotesGenerated]);

  const copyNotes = () => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied!');
  };

  if (!notesGenerated && !loading && !notes) {
    return (
      <div className="flex flex-col items-center py-16">
        <BookOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-display font-bold text-foreground mb-2">Generate Study Notes</h3>
        <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
          Transform your lecture transcript into organized, structured study notes with key concepts highlighted.
        </p>
        <Button onClick={generateNotes} className="h-11 px-6 rounded-2xl">
          <BookOpen className="w-4 h-4 mr-2" /> Generate Notes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading && !notes && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Generating notes...
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
          <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground max-h-[500px] overflow-y-auto pr-2">
            <MarkdownRenderer>{notes}</MarkdownRenderer>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Still generating...
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LectureNotes;
