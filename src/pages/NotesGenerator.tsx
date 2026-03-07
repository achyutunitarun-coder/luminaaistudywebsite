import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

const NotesGenerator = () => {
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!topic.trim() && !sourceText.trim()) return;
    setGenerating(true);
    setNotes('');

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ topic, sourceText }),
      });

      if (!resp.ok || !resp.body) throw new Error('Failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) setNotes(prev => prev + content);
          } catch {}
        }
      }

      toast.success('Notes generated!');
    } catch {
      toast.error('Failed to generate notes');
    }
    setGenerating(false);
  };

  const copyNotes = () => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-primary" /> Notes Generator
        </h1>
        <p className="text-muted-foreground mt-1">AI-powered smart notes — like NotebookLM for your studies</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-sm font-semibold text-foreground mb-2 block">Topic</label>
          <Input
            placeholder="e.g., Photosynthesis, French Revolution, Linear Algebra..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="bg-muted/50"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-foreground mb-2 block">Source Material (optional)</label>
          <Textarea
            placeholder="Paste any reference text, textbook excerpts, or lecture notes..."
            value={sourceText}
            onChange={e => setSourceText(e.target.value)}
            className="bg-muted/50 min-h-[120px]"
          />
        </div>
        <Button onClick={generate} disabled={generating || (!topic.trim() && !sourceText.trim())} className="gradient-primary text-primary-foreground">
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Generate Notes
        </Button>
      </motion.div>

      {notes && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-foreground">Generated Notes</h2>
            <Button variant="ghost" size="sm" onClick={copyNotes}>
              {copied ? <Check className="w-4 h-4 mr-1 text-success" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{notes}</ReactMarkdown>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default NotesGenerator;
