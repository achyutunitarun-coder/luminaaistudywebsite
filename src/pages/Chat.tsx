import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Send, Trash2, Edit3, Check, X, MessageSquare, Sparkles, User, Menu, ArrowLeft, Download, Brain, Code2, Zap, BookOpen, FileText, Palette, MessagesSquare, ChevronDown, Bot, Wand2, Search, GraduationCap, ThumbsUp, ThumbsDown } from 'lucide-react';
import { FileUploadButton, buildFileContext, type UploadedFile } from '@/components/FileUploadButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { createBufferedTextAccumulator, streamSSE } from '@/lib/aiStream';
import { toast } from 'sonner';
import { GenerationTerminal, type TerminalLine } from '@/components/chat/GenerationTerminal';
import { ArtifactCard, type ArtifactPayload } from '@/components/chat/ArtifactCard';
import { GenerateSetupCard, type GenerateConfig } from '@/components/chat/GenerateSetupCard';
import { SlideArtifactCard, type SlideArtifactPayload } from '@/components/chat/SlideArtifactCard';
import { detectGenerateIntent, detectSlideIntent, extractSlideTopic } from '@/lib/artifactThemes';

type Chat = { id: string; title: string; created_at: string };
type Message = { id: string; role: string; content: string; created_at: string };
type GenJob = {
  id: string;
  stage: 'setup' | 'running' | 'done' | 'error';
  initialTopic: string;
  lines: TerminalLine[];
  artifacts: ArtifactPayload[];
  error?: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const MAX_CONTEXT_MESSAGES = 20;
const MAX_MESSAGES_PER_CONVERSATION = 60;

const MODE_OPTIONS = [
  { value: 'auto', label: 'Auto', icon: Zap, desc: 'AI picks best mode', color: 'from-violet-500 to-fuchsia-500' },
  { value: 'reasoning', label: 'Reasoning', icon: Brain, desc: 'Math & logic', color: 'from-blue-500 to-cyan-500' },
  { value: 'coding', label: 'Coding', icon: Code2, desc: 'Programming', color: 'from-green-500 to-emerald-500' },
  { value: 'general', label: 'General', icon: MessagesSquare, desc: 'Chat & explain', color: 'from-orange-500 to-amber-500' },
  { value: 'fast', label: 'Fast', icon: Zap, desc: 'Quick answers', color: 'from-yellow-500 to-orange-500' },
  { value: 'study', label: 'Study', icon: BookOpen, desc: 'Structured learning', color: 'from-purple-500 to-pink-500' },
  { value: 'long_context', label: 'Deep Dive', icon: FileText, desc: 'Long docs & summaries', color: 'from-teal-500 to-cyan-500' },
  { value: 'creative', label: 'Creative', icon: Palette, desc: 'Writing & stories', color: 'from-pink-500 to-rose-500' },
];

const SUGGESTIONS = [
  { text: 'Explain quantum entanglement', icon: '🔬' },
  { text: 'Help me with calculus derivatives', icon: '📐' },
  { text: 'Summarize World War II causes', icon: '📚' },
  { text: 'Write a Python sorting algorithm', icon: '💻' },
  { text: 'Quiz me on cell biology', icon: '🧬' },
  { text: 'Explain supply & demand', icon: '📊' },
];

/* ─── Chat History Sidebar ─── */
const ChatSidebar = ({
  chats, activeChat, editingChat, editTitle, setEditTitle, setEditingChat,
  setActiveChat, createChat, deleteChat, renameChat, onSelect,
}: {
  chats: Chat[]; activeChat: string | null; editingChat: string | null;
  editTitle: string; setEditTitle: (v: string) => void; setEditingChat: (v: string | null) => void;
  setActiveChat: (v: string | null) => void; createChat: () => void;
  deleteChat: (id: string) => void; renameChat: (id: string) => void;
  onSelect?: () => void;
}) => (
  <div className="flex flex-col h-full bg-background/50">
    <div className="p-3 pb-2">
      <Button
        onClick={() => { createChat(); onSelect?.(); }}
        className="w-full h-10 rounded-xl bg-gradient-to-r from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 text-primary border border-primary/20 hover:border-primary/30 transition-all duration-300 font-medium text-sm gap-2"
        variant="ghost"
      >
        <Plus className="w-4 h-4" /> New Chat
      </Button>
    </div>

    <div className="px-4 py-1.5 flex items-center justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/40">History</span>
      {chats.length > 0 && (
        <span className="text-[9px] text-muted-foreground/40">{chats.length}</span>
      )}
    </div>

    <div className="flex-1 overflow-auto px-2 space-y-0.5 scrollbar-thin scrollbar-thumb-border/10">
      {chats.map(chat => (
        <div
          key={chat.id}
          className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-all duration-200 ${
            activeChat === chat.id
              ? 'bg-primary/10 text-foreground border-l-2 border-primary'
              : 'hover:bg-muted/15 text-muted-foreground hover:text-foreground border-l-2 border-transparent'
          }`}
          onClick={() => { setActiveChat(chat.id); onSelect?.(); }}
        >
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-40" />
          {editingChat === chat.id ? (
            <div className="flex-1 flex items-center gap-1">
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="h-6 text-xs bg-background/80 rounded border-border/30"
                onKeyDown={e => e.key === 'Enter' && renameChat(chat.id)}
                autoFocus
              />
              <button onClick={() => renameChat(chat.id)} className="p-0.5 hover:text-primary"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditingChat(null)} className="p-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <>
              <span className="flex-1 text-[12px] truncate">{chat.title}</span>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button className="p-0.5 rounded hover:bg-muted/30" onClick={e => { e.stopPropagation(); setEditingChat(chat.id); setEditTitle(chat.title); }}>
                  <Edit3 className="w-2.5 h-2.5" />
                </button>
                <button className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive" onClick={e => { e.stopPropagation(); deleteChat(chat.id); }}>
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
      {chats.length === 0 && (
        <div className="px-3 py-10 text-center">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
          <p className="text-[11px] text-muted-foreground/30">No conversations yet</p>
        </div>
      )}
    </div>
  </div>
);

/* ─── Main Chat Component ─── */
const ChatPage = () => {
  const { user, session } = useAuth();
  const isMobile = useIsMobile();
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingChat, setEditingChat] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedMode, setSelectedMode] = useState<string>('auto');
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'up'|'down'>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const interactionMapRef = useRef<Record<string, string>>({}); // messageId -> interactionId
  const isSendingRef = useRef(false);
  const [genJobs, setGenJobs] = useState<Record<string, GenJob>>({});

  const startGeneration = useCallback(async (jobId: string, cfg: GenerateConfig) => {
    if (!activeChat || !session) return;
    setGenJobs(prev => ({ ...prev, [jobId]: { ...prev[jobId], stage: 'running', lines: [{ type: 'command', text: `lumina generate --types=${cfg.types.join(',')}`, ts: Date.now() }], artifacts: [], error: undefined } }));
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-html-artifact`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...cfg, chatId: activeChat }),
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop() || '';
        for (const ev of events) {
          const lines = ev.split('\n');
          const eName = lines.find(l => l.startsWith('event:'))?.slice(6).trim();
          const dRaw = lines.find(l => l.startsWith('data:'))?.slice(5).trim();
          if (!dRaw) continue;
          try {
            const payload = JSON.parse(dRaw);
            if (eName === 'log') {
              setGenJobs(prev => ({ ...prev, [jobId]: { ...prev[jobId], lines: [...prev[jobId].lines, { ...payload, ts: Date.now() }] } }));
            } else if (eName === 'done') {
              setGenJobs(prev => ({ ...prev, [jobId]: { ...prev[jobId], stage: payload.error ? 'error' : 'done', artifacts: payload.artifacts || [], error: payload.error } }));
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setGenJobs(prev => ({ ...prev, [jobId]: { ...prev[jobId], stage: 'error', error: e?.message || 'Failed' } }));
    }
  }, [activeChat, session]);

  useEffect(() => { if (user) loadChats(); }, [user]);
  useEffect(() => { if (activeChat) loadMessages(activeChat); }, [activeChat]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' }); }, [messages, isLoading]);

  const loadChats = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('chats')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) { console.error('loadChats:', error); toast.error('Could not load conversations'); return; }
    if (data) setChats(data as Chat[]);
  };

  const loadMessages = async (chatId: string) => {
    const { data } = await supabase.from('chat_messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const createChat = async () => {
    if (!user) return;
    const { data } = await supabase.from('chats').insert({ user_id: user.id, title: 'New Chat' }).select().single();
    if (data) {
      setChats(prev => [data, ...prev]);
      setActiveChat(data.id);
      setMessages([]);
      sessionIdRef.current = crypto.randomUUID(); // new analytics session per chat
      interactionMapRef.current = {};
      setFeedbackMap({});
    }
  };

  const handleFeedback = useCallback(async (messageId: string, kind: 'up' | 'down') => {
    const interactionId = interactionMapRef.current[messageId];
    if (!interactionId) { toast.error('Feedback not available yet'); return; }
    setFeedbackMap(prev => ({ ...prev, [messageId]: kind }));
    const { error } = await supabase.functions.invoke('learning-pipeline', {
      body: { action: 'feedback', interactionId, type: kind === 'up' ? 'thumbs_up' : 'thumbs_down' },
    });
    if (error) { toast.error('Could not save feedback'); return; }
    toast.success(kind === 'up' ? 'Thanks — glad it helped!' : 'Thanks — we\'ll improve.');
  }, []);

  const deleteChat = async (chatId: string) => {
    await supabase.from('chats').delete().eq('id', chatId);
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChat === chatId) { setActiveChat(null); setMessages([]); }
  };

  const renameChat = async (chatId: string) => {
    if (!editTitle.trim()) return;
    await supabase.from('chats').update({ title: editTitle }).eq('id', chatId);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: editTitle } : c));
    setEditingChat(null);
  };

  const handleSuggestionClick = useCallback(async (text: string) => {
    if (!activeChat) await createChat();
    setInput(text);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeChat]);

  const sendMessage = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || !activeChat || isLoading || isSendingRef.current) return;

    // Enforce 60 messages per conversation
    if (messages.length >= MAX_MESSAGES_PER_CONVERSATION) {
      toast.error(`Conversation limit reached (${MAX_MESSAGES_PER_CONVERSATION} messages). Start a new chat.`);
      return;
    }

    const allowed = await checkAndIncrement('chat_messages');
    if (!allowed) return;

    isSendingRef.current = true;
    setIsLoading(true);

    const fileContext = buildFileContext(uploadedFiles);
    const userContent = input.trim() + fileContext;
    setInput('');
    setUploadedFiles([]);

    const startedAt = Date.now();
    try {
      const optimisticUserMessage: Message = {
        id: crypto.randomUUID(), role: 'user', content: userContent, created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimisticUserMessage]);

      if (detectGenerateIntent(userContent)) {
        const jobId = crypto.randomUUID();
        const placeholder: Message = { id: jobId, role: 'assistant', content: '__GEN_JOB__', created_at: new Date().toISOString() };
        setMessages(prev => [...prev, placeholder]);
        setGenJobs(prev => ({ ...prev, [jobId]: { id: jobId, stage: 'setup', initialTopic: userContent.replace(/^(generate|make|create)\s+(notes|exam|paper|study notes|a paper)\s*(for|on|about)?\s*/i, '').trim() || userContent, lines: [], artifacts: [] } }));
        void supabase.from('chat_messages').insert({ chat_id: activeChat, role: 'user', content: userContent });
        if (messages.length === 0) {
          const title = userContent.slice(0, 50);
          setChats(prev => prev.map(c => c.id === activeChat ? { ...c, title } : c));
          void supabase.from('chats').update({ title }).eq('id', activeChat);
        }
        isSendingRef.current = false;
        setIsLoading(false);
        return;
      }

      const persistPromise = supabase.from('chat_messages').insert({ chat_id: activeChat, role: 'user', content: userContent }).select().single();
      void persistPromise.then(({ data }) => {
        if (data) setMessages(prev => prev.map(m => m.id === optimisticUserMessage.id ? data : m));
      });

      if (messages.length === 0) {
        const title = userContent.slice(0, 50) + (userContent.length > 50 ? '...' : '');
        setChats(prev => prev.map(c => c.id === activeChat ? { ...c, title } : c));
        void supabase.from('chats').update({ title }).eq('id', activeChat);
      }

      const allMessages = [...messages, { role: 'user', content: userContent }]
        .slice(-MAX_CONTEXT_MESSAGES)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ messages: allMessages, mode: selectedMode }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        toast.error(`Chat failed: ${resp.status} ${errText.slice(0, 100)}`);
        return;
      }
      if (!resp.body) { toast.error('No response stream.'); return; }

      const placeholderId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: placeholderId, role: 'assistant', content: '', created_at: new Date().toISOString() }]);

      const streamBuffer = createBufferedTextAccumulator((text) => {
        setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: text } : m));
      });

      await streamSSE(resp, {
        onMeta: (meta) => { setActiveMode(meta.mode ?? null); setActiveModel(meta.model ?? null); },
        onDelta: (chunk) => streamBuffer.push(chunk),
      });

      streamBuffer.flushNow();
      const fullContent = streamBuffer.getText();
      const latencyMs = Date.now() - startedAt;

      if (fullContent) {
        const { data: savedMsg } = await supabase.from('chat_messages').insert({ chat_id: activeChat, role: 'assistant', content: fullContent }).select().single();
        const finalMsgId = savedMsg?.id ?? placeholderId;
        if (savedMsg) setMessages(prev => prev.map(m => m.id === placeholderId ? savedMsg : m));

        // Fire-and-forget: extract durable memory
        void supabase.functions.invoke('extract-memory', {
          body: { userMessage: userContent, assistantMessage: fullContent },
        }).catch((e) => console.warn('extract-memory failed:', e));

        // Production training-data pipeline (PII-scrubbed, anonymized, quality-scored)
        void supabase.functions.invoke('learning-pipeline', {
          body: {
            action: 'capture',
            question: userContent,
            answer: fullContent,
            sessionId: sessionIdRef.current,
            source: 'chat',
            modelUsed: activeModel ?? undefined,
            latencyMs,
          },
        }).then(({ data }) => {
          if (data?.id) interactionMapRef.current[finalMsgId] = data.id;
        }).catch((e) => console.warn('learning-pipeline failed:', e));
      } else {
        toast.error('Empty response. Try again.');
        setMessages(prev => prev.filter(m => m.id !== placeholderId));
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Connection failed. Try again.');
    } finally {
      isSendingRef.current = false;
      setIsLoading(false);
    }
  };

  const activeChatTitle = chats.find(c => c.id === activeChat)?.title;
  const sidebarProps = { chats, activeChat, editingChat, editTitle, setEditTitle, setEditingChat, setActiveChat, createChat, deleteChat, renameChat };
  const currentMode = MODE_OPTIONS.find(o => o.value === selectedMode);

  /* ─── Welcome / Empty State ─── */
  const welcomeView = (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-lg w-full"
      >
        {/* Animated Logo */}
        <motion.div
          className="relative w-20 h-20 mx-auto mb-6"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/5 backdrop-blur-xl border border-primary/20 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.4)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-9 h-9 text-primary" />
          </div>
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent mb-2">
          What do you want to learn?
        </h2>
        <p className="text-sm text-muted-foreground/50 mb-8">
          I can explain topics, solve problems, write code, create quizzes — anything you need.
        </p>

        {/* Suggestion chips */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-8">
          {SUGGESTIONS.map((s, i) => (
            <motion.button
              key={s.text}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              onClick={() => handleSuggestionClick(s.text)}
              className="group text-left px-3 py-2.5 rounded-xl border border-border/10 bg-muted/5 hover:bg-primary/5 hover:border-primary/20 transition-all duration-300 hover:shadow-[0_0_20px_-8px_hsl(var(--primary)/0.2)]"
            >
              <span className="text-base mb-0.5 block">{s.icon}</span>
              <span className="text-[11px] text-muted-foreground/60 group-hover:text-foreground/80 transition-colors leading-tight line-clamp-2">{s.text}</span>
            </motion.button>
          ))}
        </div>

        <Button
          onClick={createChat}
          className="h-11 px-6 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.4)] hover:shadow-[0_4px_30px_-4px_hsl(var(--primary)/0.6)] transition-all duration-300"
        >
          <Plus className="w-4 h-4 mr-2" /> Start Chatting
        </Button>
      </motion.div>
    </div>
  );

  /* ─── Active Chat View ─── */
  const activeChatView = (
    <>
      {/* Header Bar */}
      <div className="h-13 border-b border-border/8 flex items-center px-4 md:px-5 gap-3 bg-background/60 backdrop-blur-md">
        {isMobile && (
          <button onClick={() => setActiveChat(null)} className="p-1.5 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-30" />
          </div>
          <span className="text-sm font-medium text-foreground/90 truncate">{activeChatTitle || 'New Chat'}</span>
          {activeMode && (
            <span className={`text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r ${MODE_OPTIONS.find(m => m.value === activeMode)?.color || 'from-primary to-primary'} text-white font-semibold capitalize whitespace-nowrap shadow-sm`}>
              {activeMode === 'long_context' ? 'Deep Dive' : activeMode}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeModel && (
            <span className="text-[9px] text-muted-foreground/30 truncate max-w-[120px] hidden md:block">
              {activeModel.split('/').pop()?.replace(':free', '')}
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => {
                const md = messages.map(m => `## ${m.role === 'user' ? '📝 You' : '✨ Lumina'}\n\n${m.content}`).join('\n\n---\n\n');
                const blob = new Blob([`# ${activeChatTitle || 'Chat'}\n\n---\n\n${md}`], { type: 'text/markdown' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `lumina-${(activeChatTitle || 'chat').slice(0, 30).replace(/\s+/g, '-')}.md`;
                a.click(); toast.success('Exported!');
              }}
              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 transition-all"
              title="Export"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-border/15 scrollbar-track-transparent">
        <div className="max-w-3xl mx-auto px-3 md:px-6 py-4 md:py-6 space-y-1">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isStreaming = !isUser && isLoading && msg.id === messages[messages.length - 1]?.id;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className={`flex gap-2.5 py-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isUser
                      ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm shadow-primary/20'
                      : 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-primary border border-primary/10'
                  }`}>
                    {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  </div>

                  {/* Message */}
                  <div className={`max-w-[82%] md:max-w-[75%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`rounded-2xl px-4 py-2.5 ${
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-sm shadow-primary/10'
                        : 'bg-muted/15 border border-border/8 rounded-tl-sm'
                    }`}>
                      <div className={`text-[13px] md:text-[14px] leading-[1.7] ${isUser ? '' : 'text-foreground/90'}`}>
                        {isUser ? (
                          <span className="whitespace-pre-wrap">{msg.content}</span>
                        ) : msg.content === '__GEN_JOB__' && genJobs[msg.id] ? (
                          <div className="space-y-3 min-w-[280px] md:min-w-[480px]">
                            {genJobs[msg.id].stage === 'setup' && (
                              <GenerateSetupCard
                                initialTopic={genJobs[msg.id].initialTopic}
                                onConfirm={(cfg) => startGeneration(msg.id, cfg)}
                                onCancel={() => setMessages(prev => prev.filter(m => m.id !== msg.id))}
                              />
                            )}
                            {(genJobs[msg.id].stage === 'running' || genJobs[msg.id].stage === 'done' || genJobs[msg.id].stage === 'error') && (
                              <GenerationTerminal
                                lines={genJobs[msg.id].lines}
                                done={genJobs[msg.id].stage !== 'running'}
                                error={genJobs[msg.id].error}
                                onRetry={() => setGenJobs(prev => ({ ...prev, [msg.id]: { ...prev[msg.id], stage: 'setup', error: undefined } }))}
                              />
                            )}
                            {genJobs[msg.id].artifacts.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {genJobs[msg.id].artifacts.map(a => <ArtifactCard key={a.id} artifact={a} />)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <MarkdownRenderer streaming={isStreaming}>{msg.content}</MarkdownRenderer>
                        )}
                      </div>
                    </div>
                    {isStreaming && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1 mt-1 ml-1"
                      >
                        <div className="flex gap-0.5">
                          {[0,1,2].map(i => (
                            <motion.span
                              key={i}
                              className="w-1 h-1 rounded-full bg-primary/50"
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                            />
                          ))}
                        </div>
                        <span className="text-[9px] text-muted-foreground/30">streaming</span>
                      </motion.div>
                    )}
                    {!isUser && !isStreaming && msg.content.length > 30 && (
                      <div className="flex items-center gap-1 mt-1.5 ml-1 opacity-60 hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleFeedback(msg.id, 'up')}
                          className={`p-1 rounded-md transition-colors ${feedbackMap[msg.id] === 'up' ? 'bg-primary/15 text-primary' : 'hover:bg-muted/30 text-muted-foreground'}`}
                          aria-label="Helpful"
                          title="Helpful"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleFeedback(msg.id, 'down')}
                          className={`p-1 rounded-md transition-colors ${feedbackMap[msg.id] === 'down' ? 'bg-destructive/15 text-destructive' : 'hover:bg-muted/30 text-muted-foreground'}`}
                          aria-label="Not helpful"
                          title="Not helpful"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>


          {/* Typing Indicator */}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2.5 py-3"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-primary border border-primary/10 flex items-center justify-center flex-shrink-0">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles className="w-3.5 h-3.5" />
                </motion.div>
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-muted/15 border border-border/8 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary/40"
                      animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
                    />
                  ))}
                  <span className="text-[10px] text-muted-foreground/30 ml-1.5">Lumina is thinking...</span>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border/8 bg-background/70 backdrop-blur-xl p-3 md:p-4">
        <div className="max-w-3xl mx-auto">
          {/* Mode Selector */}
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-none pb-0.5">
            {MODE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isActive = selectedMode === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelectedMode(opt.value)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? `bg-gradient-to-r ${opt.color} text-white shadow-sm`
                      : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/10'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {uploadedFiles.length > 0 && (
            <div className="mb-2">
              <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} compact />
            </div>
          )}

          {/* Input Bar */}
          <div className="flex items-center gap-2 bg-muted/8 border border-border/12 rounded-2xl px-3 md:px-4 py-1 transition-all duration-300 focus-within:border-primary/25 focus-within:bg-muted/15 focus-within:shadow-[0_0_30px_-8px_hsl(var(--primary)/0.15)]">
            {uploadedFiles.length === 0 && (
              <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} compact />
            )}
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask Lumina anything..."
              className="border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-sm placeholder:text-muted-foreground/30 px-0"
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
              <Button
                onClick={sendMessage}
                disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
                size="icon"
                className="h-8 w-8 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shrink-0 disabled:opacity-15 transition-all duration-200 shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          </div>
          <p className="text-[9px] text-muted-foreground/20 text-center mt-2 hidden md:block">
            Lumina can make mistakes · Verify important info
          </p>
        </div>
      </div>
    </>
  );

  /* ─── Mobile: show list OR chat ─── */
  if (isMobile) {
    return (
      <>
        <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
        <div className="flex flex-col h-[calc(100vh-3.5rem)] -mx-4 -my-6 bg-background">
          {activeChat ? activeChatView : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ChatSidebar {...sidebarProps} />
              <div className="border-t border-border/10">{welcomeView}</div>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ─── Desktop: sidebar + chat ─── */
  return (
    <>
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <div className="flex h-[calc(100vh-3.5rem)] -mx-4 md:-mx-8 -my-6 md:-my-8 bg-background">
        <div className="w-[260px] border-r border-border/8 bg-background/50 flex-col hidden md:flex flex-shrink-0">
          <ChatSidebar {...sidebarProps} />
        </div>
        <div className="flex-1 flex flex-col bg-background overflow-hidden min-w-0">
          {activeChat ? activeChatView : welcomeView}
        </div>
      </div>
    </>
  );
};

export default ChatPage;
