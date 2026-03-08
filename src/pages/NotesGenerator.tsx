import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Sparkles, Loader2, Copy, Check, FileText, PenTool, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

const suggestedTopics = ['Photosynthesis', 'World War II', 'Calculus Derivatives', 'DNA Replication', 'Supply & Demand', 'Electromagnetic Waves'];

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
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center shadow-lg shadow-success/10">
          <BookOpen className="w-7 h-7 text-success" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Notes Generator</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-0.5">
            <PenTool className="w-3.5 h-3.5" /> AI-powered smart notes like NotebookLM
          </p>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!notes ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="relative rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-success/8 blur-[80px]" />
              <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/8 blur-[60px]" />

              <div className="relative z-10 p-8 space-y-6">
                {/* Topic */}
                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> Topic
                  </label>
                  <Input
                    placeholder="e.g., Photosynthesis, French Revolution, Linear Algebra..."
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    className="bg-muted/30 border-border/40 rounded-xl h-14 px-5 text-base"
                  />
                </div>

                {/* Quick Picks */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2.5">Quick picks</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTopics.map(t => (
                      <button
                        key={t}
                        onClick={() => setTopic(t)}
                        className={`text-xs px-3.5 py-2 rounded-xl border transition-all ${
                          topic === t
                            ? 'border-success/40 bg-success/10 text-success'
                            : 'border-border/40 bg-muted/20 text-muted-foreground hover:border-success/30 hover:text-foreground'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Source Material */}
                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block">Source Material <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Textarea
                    placeholder="Paste any reference text, textbook excerpts, or lecture notes for richer, context-aware output..."
                    value={sourceText}
                    onChange={e => setSourceText(e.target.value)}
                    className="bg-muted/30 border-border/40 rounded-xl min-h-[140px] px-5 py-4 text-sm leading-relaxed resize-none"
                  />
                </div>

                <Button
                  onClick={generate}
                  disabled={generating || (!topic.trim() && !sourceText.trim())}
                  className="gradient-primary text-primary-foreground h-13 px-8 text-base rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
                >
                  {generating ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" /> Generate Notes</>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="notes"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Notes Output Card */}
            <div className="relative rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-success/5 blur-[80px]" />

              {/* Header Bar */}
              <div className="flex items-center justify-between p-6 pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-bold text-foreground">{topic || 'Generated Notes'}</h2>
                    <p className="text-xs text-muted-foreground">AI-generated study notes</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={copyNotes} className="rounded-xl hover:bg-muted/50">
                  {copied ? <Check className="w-4 h-4 mr-1.5 text-success" /> : <Copy className="w-4 h-4 mr-1.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              {/* Content */}
              <div className="p-6 pt-4">
                <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-li:text-muted-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs">
                  <ReactMarkdown>{notes}</ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Back Button */}
            <Button
              onClick={() => { setNotes(''); setTopic(''); setSourceText(''); }}
              variant="outline"
              className="h-12 px-8 rounded-2xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Generate New Notes
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotesGenerator;
