import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, HelpCircle, Loader2, Sparkles, User, Lightbulb, BookOpen, Target, Copy, Check, FileText, ChevronRight } from 'lucide-react';
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

type Msg = { role: 'user' | 'assistant'; content: string; id: string; };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const modes = [
  { value: 'simple', label: 'Simple', desc: 'Beginner-friendly', icon: Lightbulb, color: 'violet' },
  { value: 'exam', label: 'Exam', desc: 'Exam-ready answers', icon: Target, color: 'amber' },
  { value: 'deep', label: 'Deep', desc: 'Conceptual depth', icon: BookOpen, color: 'sky' },
];

const suggestions = [
  'Explain photosynthesis',
  "What is Newton's 3rd law?",
  'Help with quadratic equations',
  'Explain quantum entanglement',
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

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' }); }, [messages, isLoading]);

  const saveMessage = useCallback(async (role: string, content: string, existingChatId: string | null) => {
    if (!user || !content) return existingChatId;
    try {
      let cId = existingChatId;
      if (!cId) {
        const title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
        const { data } = await supabase.from('chats').insert({ user_id: user.id, title, chat_type: 'doubt_solver' }).select('id').single();
        cId = data?.id || null;
        if (cId) setChatId(cId);
      }
      if (cId) await supabase.from('chat_messages').insert({ chat_id: cId, role, content });
      return cId;
    } catch { return existingChatId; }
  }, [user]);

  const handleSend = useCallback(async () => {
    const text = input.trim(); if (!text || isLoading) return;
    const allowed = await checkAndIncrement('doubt_solver'); if (!allowed) return;
    const userMsg: Msg = { role: 'user', content: text, id: crypto.randomUUID() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages); setInput(''); setIsLoading(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s?.access_token) { toast.error('Please sign in.'); setIsLoading(false); return; }
      const systemMode = mode === 'simple' ? "Explain like I'm a beginner. Use simple language, analogies, and step-by-step reasoning." :
        mode === 'exam' ? 'Give me an exam-ready answer. Be precise, structured, and include key points examiners look for.' :
        'Give me a deep conceptual understanding. Explain the WHY behind everything, connect to first principles.';
      const fileContext = buildFileContext(uploadedFiles);
      const res = await fetch(CHAT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ messages: [{ role: 'system', content: systemMode }, ...newMessages.map(m => ({ role: m.role, content: m.content }))], mode: 'conversational' }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const assistantId = crypto.randomUUID();
      const streamBuffer = createBufferedTextAccumulator((chunk) => {
        setMessages(prev => { const existing = prev.find(m => m.id === assistantId); if (existing) return prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m); return [...prev, { role: 'assistant' as const, content: chunk, id: assistantId }]; });
      });
      await streamSSE(res, { onDelta: (chunk) => streamBuffer.push(chunk) });
      streamBuffer.flushNow();
      const finalContent = streamBuffer.getText();
      if (finalContent) await saveMessage('assistant', finalContent, chatId);
      await saveMessage('user', text, chatId);
    } catch (e: any) { toast.error(e.message || 'Failed to get response'); }
    finally { setIsLoading(false); }
  }, [input, isLoading, messages, mode, chatId, uploadedFiles, checkAndIncrement, saveMessage]);

  const copyMessage = (id: string, content: string) => { navigator.clipboard.writeText(content); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
  const empty = messages.length === 0 && !isLoading;

  return (
    <>
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(167,139,250,0.15))', border: '1px solid rgba(124,58,237,0.2)' }}>
              <HelpCircle className="w-6 h-6" style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#f0f0f5] tracking-tight">Doubt Solver</h1>
              <p className="text-sm text-[#8a8aa3] mt-0.5">Ask anything. Get instant, clear explanations.</p>
            </div>
          </div>
        </motion.div>

        {/* Mode Selector */}
        <div className="flex gap-2 mb-6">
          {modes.map(m => {
            const active = mode === m.value;
            return (
              <button key={m.value} onClick={() => setMode(m.value)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={active ? { background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.25)', boxShadow: '0 4px 12px rgba(124,58,237,0.1)' } : { background: 'rgba(255,255,255,0.03)', color: '#8a8aa3', border: '1px solid rgba(255,255,255,0.06)' }}>
                <m.icon className="w-4 h-4" />
                <span>{m.label}</span>
                <span className="text-[10px] opacity-60 hidden sm:inline">{m.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Chat Area */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="h-[520px] overflow-y-auto p-5 space-y-5">
            {empty && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(167,139,250,0.08))', border: '1px solid rgba(124,58,237,0.1)' }}>
                  <Sparkles className="w-8 h-8" style={{ color: '#a78bfa' }} />
                </div>
                <h3 className="text-lg font-semibold text-[#f0f0f5] mb-1.5">What's your doubt?</h3>
                <p className="text-sm text-[#8a8aa3] max-w-sm mb-6">Ask any question — from basic concepts to advanced problems. I'll explain it clearly.</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestions.map(q => (
                    <button key={q} onClick={() => setInput(q)} className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'rgba(124,58,237,0.08)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.12)' }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(167,139,250,0.1))', border: '1px solid rgba(124,58,237,0.15)' }}>
                    <Sparkles className="w-4 h-4" style={{ color: '#a78bfa' }} />
                  </div>
                )}
                <div className="max-w-[75%] rounded-2xl px-4 py-3" style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', borderRadius: '16px 16px 4px 16px' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px 16px 16px 4px' }}>
                  {msg.role === 'assistant' ? <MarkdownRenderer>{msg.content}</MarkdownRenderer> : <p className="text-sm leading-relaxed">{msg.content}</p>}
                  {msg.role === 'assistant' && msg.content && (
                    <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button onClick={() => copyMessage(msg.id, msg.content)} className="flex items-center gap-1.5 text-xs text-[#5a5a73] hover:text-[#8a8aa3] transition-colors">
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-[#10b981]" /> : <Copy className="w-3 h-3" />}
                        {copiedId === msg.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(124,58,237,0.15))', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <User className="w-4 h-4" style={{ color: '#a78bfa' }} />
                  </div>
                )}
              </motion.div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(167,139,250,0.1))', border: '1px solid rgba(124,58,237,0.15)' }}>
                  <Sparkles className="w-4 h-4" style={{ color: '#a78bfa' }} />
                </div>
                <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#a78bfa', animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#a78bfa', animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#a78bfa', animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-[#5a5a73]">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)' }}>
            <div className="flex gap-2">
              <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} />
              <Input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask your doubt..."
                className="flex-1 rounded-xl text-sm h-11" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f5' }}
              />
              <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="rounded-xl px-4 h-11" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', boxShadow: '0 2px 8px rgba(124,58,237,0.2)' }}>
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
