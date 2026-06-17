import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, HelpCircle, Loader2, Sparkles, User, MessageSquare, Lightbulb, BookOpen, Target, ChevronRight, RotateCcw, Copy, Check, FileText, Image as ImageIcon } from 'lucide-react';
import { SavedItemsPanel } from '@/components/SavedItemsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { FileUploadButton, buildFileContext, type UploadedFile } from '@/components/FileUploadButton';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { createBufferedTextAccumulator, streamSSE } from '@/lib/aiStream';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string; id: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const modes = [
  { value: 'simple', label: '🟢 Simple', desc: 'Beginner-friendly explanations', icon: Lightbulb },
  { value: 'exam', label: '📝 Exam Focused', desc: 'Exam-ready structured answers', icon: Target },
  { value: 'deep', label: '🧠 Deep Concept', desc: 'In-depth conceptual breakdown', icon: BookOpen },
];

const DoubtSolver = () => {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('simple');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' });
  }, [messages, isLoading]);

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
    } catch { return existingChatId; }
  }, [user]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    const allowed = await checkAndIncrement('doubt_solver');
    if (!allowed) return;

    const userMsg: Msg = { role: 'user', content: text, id: crypto.randomUUID() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s?.access_token) { toast.error('Please sign in.'); setIsLoading(false); return; }

      const modePrompt = modes.find(m => m.value === mode);
      const systemMode = mode === 'simple' ? 'Explain like I\'m a beginner. Use simple language, analogies, and step-by-step reasoning.' :
        mode === 'exam' ? 'Give me an exam-ready answer. Be precise, structured, and include key points examiners look for.' :
        'Give me a deep conceptual understanding. Explain the WHY behind everything, connect to first principles.';

      const fileContext = buildFileContext(uploadedFiles);
      const fullMessage = `${text}${fileContext ? `\n\n--- ATTACHED FILES ---\n${fileContext}` : ''}`;

      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemMode },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          mode: 'conversational',
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error('No response');

      const assistantId = crypto.randomUUID();
      const streamBuffer = createBufferedTextAccumulator((chunk) => {
        setMessages(prev => {
          const existing = prev.find(m => m.id === assistantId);
          if (existing) return prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m);
          return [...prev, { role: 'assistant' as const, content: chunk, id: assistantId }];
        });
      });

      await streamSSE(res, { onDelta: (chunk) => streamBuffer.push(chunk) });
      streamBuffer.flushNow();

      const finalContent = streamBuffer.getText();
      if (finalContent) await saveMessage('assistant', finalContent, chatId);
      await saveMessage('user', text, chatId);
    } catch (e: any) {
      toast.error(e.message || 'Failed to get response');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, mode, chatId, uploadedFiles, checkAndIncrement, saveMessage]);

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/20">
              <HelpCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Doubt Solver</h1>
              <p className="text-sm text-muted-foreground">Ask anything. Get instant, clear explanations.</p>
            </div>
          </div>
        </motion.div>

        {/* Mode Selector */}
        <div className="flex gap-2 mb-4">
          {modes.map(m => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                mode === m.value
                  ? 'bg-primary/15 text-primary border border-primary/25 shadow-lg shadow-primary/10'
                  : 'bg-card/50 text-muted-foreground border border-border/10 hover:border-primary/20 hover:text-foreground'
              }`}
            >
              <m.icon className="w-4 h-4" />
              {m.label}
            </button>
          ))}
        </div>

        {/* Chat Area */}
        <div className="rounded-2xl border border-border/10 bg-card/30 backdrop-blur-sm overflow-hidden">
          <div className="h-[500px] overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4 border border-primary/10">
                  <Sparkles className="w-8 h-8 text-primary/60" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">What's your doubt?</h3>
                <p className="text-sm text-muted-foreground max-w-sm">Ask any question — from basic concepts to advanced problems. I'll explain it clearly.</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {['Explain photosynthesis', 'What is Newton\'s 3rd law?', 'Help with quadratic equations'].map(q => (
                    <button key={q} onClick={() => setInput(q)} className="px-3 py-1.5 rounded-lg bg-primary/8 text-primary text-xs font-medium hover:bg-primary/15 transition-colors border border-primary/10">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0 border border-primary/10">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary/15 text-foreground border border-primary/20'
                    : 'bg-card/60 text-foreground border border-border/10'
                }`}>
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                  ) : (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  )}
                  {msg.role === 'assistant' && msg.content && (
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/10">
                      <button onClick={() => copyMessage(msg.id, msg.content)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                        {copiedId === msg.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
              </motion.div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0 border border-primary/10">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-card/60 rounded-2xl px-4 py-3 border border-border/10">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border/10 p-4 bg-card/20">
            <div className="flex gap-2">
              <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} />
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask your doubt... (Enter to send, Shift+Enter for new line)"
                className="flex-1 bg-card/50 border-border/20 rounded-xl text-sm placeholder:text-muted-foreground/50 focus:border-primary/30"
              />
              <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="gradient-primary text-primary-foreground rounded-xl px-4">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DoubtSolver;
