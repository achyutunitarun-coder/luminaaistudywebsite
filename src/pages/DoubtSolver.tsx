import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, HelpCircle, Loader2, Sparkles, User, MessageSquare } from 'lucide-react';
import { SavedItemsPanel } from '@/components/SavedItemsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { FileUploadButton, buildFileContext, type UploadedFile } from '@/components/FileUploadButton';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Msg = { role: 'user' | 'assistant'; content: string };

const modes = [
  { value: 'simple', label: '🟢 Simple', desc: 'Beginner-friendly explanations' },
  { value: 'exam', label: '📝 Exam Focused', desc: 'Exam-ready structured answers' },
  { value: 'deep', label: '🧠 Deep Concept', desc: 'In-depth conceptual breakdown' },
];

async function readStream(resp: Response, onChunk: (text: string) => void): Promise<string> {
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
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
      if (json === '[DONE]') break;
      try {
        const c = JSON.parse(json).choices?.[0]?.delta?.content;
        if (c) { full += c; onChunk(full); }
      } catch {}
    }
  }
  return full;
}

const DoubtSolver = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('simple');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessage = useCallback(async (role: string, content: string, existingChatId: string | null) => {
    if (!user || !content) return existingChatId;
    try {
      let cId = existingChatId;
      if (!cId) {
        const title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
        const { data } = await supabase.from('chats').insert({
          user_id: user.id, title, chat_type: 'doubt_solver',
        }).select('id').single();
        cId = data?.id || null;
        if (cId) setChatId(cId);
      }
      if (cId) {
        await supabase.from('chat_messages').insert({ chat_id: cId, role, content });
      }
      return cId;
    } catch (e) {
      console.error('Failed to save message:', e);
      return existingChatId;
    }
  }, [user]);

  const ask = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;
    const allowed = await checkAndIncrement('doubt_messages');
    if (!allowed) return;
    const fileContext = buildFileContext(uploadedFiles);
    const question = input.trim() + fileContext;
    const displayContent = input.trim() || `[Uploaded ${uploadedFiles.length} file(s)]`;
    setInput('');
    setUploadedFiles([]);
    const userMsg: Msg = { role: 'user', content: `[${mode.toUpperCase()} MODE] ${question}` };
    const updatedMessages = [...messages, userMsg];
    setMessages(prev => [...prev, { role: 'user', content: displayContent }]);
    setIsLoading(true);

    const currentChatId = await saveMessage('user', displayContent, chatId);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doubt-solver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!resp.ok) throw new Error('Failed');

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const fullContent = await readStream(resp, (text) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: text };
          return updated;
        });
      });

      if (fullContent) {
        await saveMessage('assistant', fullContent, currentChatId);
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' };
          return updated;
        });
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-5rem)] -m-6 p-6">
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--primary))] flex items-center justify-center shadow-xl shadow-secondary/20">
              <HelpCircle className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">AI Doubt Solver</h1>
              <p className="text-muted-foreground text-xs">Step-by-step explanations • Auto-saves conversations</p>
            </div>
          </div>
          <SavedItemsPanel
            label="Past Doubts"
            table="chats"
            filters={{ chat_type: 'doubt_solver' }}
            select="id, title, created_at"
            onLoad={(item) => {
              toast.info(`Loaded: ${item.title}`);
            }}
          />
        </div>

        <div className="flex gap-2">
          {modes.map(m => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                mode === m.value
                  ? 'liquid-glass-intense border-primary/30 text-primary shadow-sm shadow-primary/10'
                  : 'liquid-glass-subtle border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-auto space-y-4 mb-4 scrollbar-thin scrollbar-thumb-border/20 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-3xl liquid-glass flex items-center justify-center mb-5">
              <MessageSquare className="w-9 h-9 text-muted-foreground/20" />
            </div>
            <p className="text-foreground font-display font-semibold text-lg mb-1">Ask any question</p>
            <p className="text-xs text-muted-foreground/60 max-w-sm">
              Get detailed, step-by-step explanations in {modes.find(m => m.value === mode)?.desc?.toLowerCase()} mode
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                  className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 shadow-sm ${
                    isUser
                      ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
                      : 'liquid-glass-subtle text-secondary'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                </motion.div>

                <div className={`max-w-[85%] min-w-0`}>
                  <span className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 block ${
                    isUser ? 'text-right text-primary/50' : 'text-left text-secondary/50'
                  }`}>
                    {isUser ? 'You' : 'Lumina'}
                  </span>
                  <div className={`rounded-2xl px-4 py-3 transition-all ${
                    isUser
                      ? 'gradient-primary text-primary-foreground rounded-tr-md shadow-lg shadow-primary/10'
                      : 'liquid-glass rounded-tl-md'
                  }`}>
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-headings:text-foreground prose-strong:text-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-primary/30 prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1">
                      <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing Indicator */}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <div className="w-7 h-7 rounded-xl liquid-glass-subtle text-secondary flex items-center justify-center flex-shrink-0 mt-1">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-secondary/50 mb-1.5 block">Lumina</span>
              <div className="rounded-2xl rounded-tl-md liquid-glass px-5 py-3.5">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.span key={i} className="w-2 h-2 rounded-full bg-secondary/50"
                      animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                    />
                  ))}
                  <span className="text-[11px] text-muted-foreground/40 ml-2 italic">thinking...</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="space-y-2">
        <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} />
        <div className="flex items-center gap-2 liquid-glass rounded-2xl px-3 py-1.5 focus-within:border-primary/30 transition-all duration-200 focus-within:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.15)]">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask your doubt..."
            className="border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-sm placeholder:text-muted-foreground/35 px-0"
            onKeyDown={e => e.key === 'Enter' && ask()}
          />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button onClick={ask} disabled={isLoading} size="icon" className="h-8 w-8 rounded-xl gradient-primary text-primary-foreground shrink-0 disabled:opacity-20 shadow-sm">
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default DoubtSolver;
