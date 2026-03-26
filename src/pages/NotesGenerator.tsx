import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Sparkles, Loader2, Copy, Check, FileText, PenTool, ArrowLeft, Download, GraduationCap, Brain, Lightbulb, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';

const suggestedTopics = ['Photosynthesis', 'World War II', 'Calculus Derivatives', 'DNA Replication', 'Supply & Demand', 'Electromagnetic Waves'];

const noteStyles = [
  { id: 'bullet', label: 'Bullet Points', icon: ListChecks, desc: 'Fast, scannable revision bullets' },
  { id: 'hyphen', label: 'Hyphen Outline', icon: FileText, desc: 'Hierarchical outline with hyphens' },
  { id: 'paragraph', label: 'Paragraph', icon: BookOpen, desc: 'Connected, narrative explanations' },
  { id: 'mindmap', label: 'Mind Map', icon: Brain, desc: 'Text-based branching concept map' },
  { id: 'root_cause', label: 'Deep Root Analysis', icon: Lightbulb, desc: 'Root causes + corrective study plan' },
];

const NotesGenerator = () => {
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('bullet');
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();

  const generate = async () => {
    if (!topic.trim() && !sourceText.trim()) return;
    const allowed = await checkAndIncrement('notes_generations');
    if (!allowed) return;
    setGenerating(true);
    setNotes('');

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ topic, sourceText, style: selectedStyle }),
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

  const downloadNotes = () => {
    const blob = new Blob([notes], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${topic || 'notes'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Notes downloaded!');
  };

  return (
    <>
    <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    <div className="max-w-5xl mx-auto space-y-8">
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
            className="space-y-5"
          >
            {/* Main Input Card */}
            <div className="relative rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-success/8 blur-[80px]" />
              <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/8 blur-[60px]" />

              <div className="relative z-10 p-8 space-y-6">
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

                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block">Source Material <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Textarea
                    placeholder="Paste any reference text, textbook excerpts, or lecture notes for richer, context-aware output..."
                    value={sourceText}
                    onChange={e => setSourceText(e.target.value)}
                    className="bg-muted/30 border-border/40 rounded-xl min-h-[140px] px-5 py-4 text-sm leading-relaxed resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Note Style Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {noteStyles.map((style) => {
                const Icon = style.icon;
                const active = selectedStyle === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`relative rounded-2xl border p-4 text-left transition-all duration-200 ${
                      active
                        ? 'border-success/40 bg-success/8 shadow-lg shadow-success/10'
                        : 'border-border/30 bg-card/30 hover:border-success/20 hover:bg-card/50'
                    }`}
                  >
                    {active && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-success animate-pulse" />
                    )}
                    <div className={`w-9 h-9 rounded-xl ${active ? 'bg-success/15' : 'bg-muted/20'} flex items-center justify-center mb-3`}>
                      <Icon className={`w-4.5 h-4.5 ${active ? 'text-success' : 'text-muted-foreground'}`} />
                    </div>
                    <p className={`text-sm font-semibold ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{style.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{style.desc}</p>
                  </button>
                );
              })}
            </div>

            <Button
              onClick={generate}
              disabled={generating || (!topic.trim() && !sourceText.trim())}
              className="gradient-primary text-primary-foreground h-14 px-10 text-base rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
            >
              {generating ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" /> Generate Notes</>
              )}
            </Button>
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
              <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-primary/5 blur-[60px]" />

              {/* Header Bar */}
              <div className="flex items-center justify-between p-6 pb-0 border-b border-border/10 mb-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-success/15 to-primary/10 flex items-center justify-center shadow-sm">
                    <Brain className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-bold text-foreground">{topic || 'Generated Notes'}</h2>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success" />
                      {noteStyles.find(s => s.id === selectedStyle)?.label} style • AI-generated
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={downloadNotes} className="rounded-xl hover:bg-muted/50 text-xs">
                    <Download className="w-3.5 h-3.5 mr-1" /> Export
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copyNotes} className="rounded-xl hover:bg-muted/50 text-xs">
                    {copied ? <Check className="w-3.5 h-3.5 mr-1 text-success" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 pt-6">
                <div className="prose prose-invert prose-base max-w-none prose-headings:font-display prose-headings:text-foreground prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-[1.8] prose-strong:text-foreground prose-li:text-muted-foreground prose-li:leading-[1.7] prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-blockquote:border-l-primary/40 prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-xl prose-blockquote:py-2 prose-blockquote:px-4 prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-6 prose-table:text-sm">
                  <MarkdownRenderer>{notes}</MarkdownRenderer>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => { setNotes(''); setTopic(''); setSourceText(''); }}
                variant="outline"
                className="h-12 px-8 rounded-2xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Generate New Notes
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
};

export default NotesGenerator;
