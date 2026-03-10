import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { FileUploadButton, buildFileContext, type UploadedFile } from '@/components/FileUploadButton';

type Msg = { role: 'user' | 'assistant'; content: string };

const modes = [
  { value: 'simple', label: '🟢 Simple', desc: 'Beginner-friendly' },
  { value: 'exam', label: '📝 Exam Focused', desc: 'Exam-ready answers' },
  { value: 'deep', label: '🧠 Deep Concept', desc: 'In-depth explanation' },
];

const DoubtSolver = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('simple');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const ask = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;
    const fileContext = buildFileContext(uploadedFiles);
    const question = input.trim() + fileContext;
    setInput('');
    setUploadedFiles([]);
    const userMsg: Msg = { role: 'user', content: `[${mode.toUpperCase()} MODE] ${question}` };
    const updatedMessages = [...messages, userMsg];
    setMessages(prev => [...prev, { role: 'user', content: input.trim() || `[Uploaded ${uploadedFiles.length} file(s)]` }]);
    setIsLoading(true);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doubt-solver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!resp.ok || !resp.body) throw new Error('Failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { streamDone = true; break; }
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content;
            if (c) {
              assistantContent += c;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantContent };
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-5rem)] -m-6 p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">AI Doubt Solver</h1>
        <p className="text-muted-foreground text-sm">Get step-by-step explanations for any topic</p>

        <div className="flex gap-2 mt-3">
          {modes.map(m => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                mode === m.value
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'border-border/20 bg-muted/10 text-muted-foreground hover:text-foreground hover:border-border/40'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <HelpCircle className="w-14 h-14 text-muted-foreground/15 mb-4" />
            <p className="text-muted-foreground text-sm">Ask any question and get detailed explanations</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Mode: {modes.find(m => m.value === mode)?.desc}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user' ? 'gradient-primary text-primary-foreground' : 'border border-border/20 bg-card/60 backdrop-blur-xl'
            }`}>
              <div className="prose prose-sm prose-invert max-w-none">
                <MarkdownRenderer>{msg.content}</MarkdownRenderer>
              </div>
            </div>
          </motion.div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="space-y-2">
        <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} />
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask your doubt..."
            className="bg-muted/20 border-border/30 rounded-xl"
            onKeyDown={e => e.key === 'Enter' && ask()}
          />
          <Button onClick={ask} disabled={isLoading} className="gradient-primary text-primary-foreground rounded-xl">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DoubtSolver;
