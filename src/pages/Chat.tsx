import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Send, Trash2, Edit3, Check, X, MessageSquare, Sparkles, User, Menu, ArrowLeft, Download, Brain, Code2, Zap, BookOpen, FileText, Palette, MessagesSquare, ChevronDown } from 'lucide-react';
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
import { toast } from 'sonner';

type Chat = { id: string; title: string; created_at: string };
type Message = { id: string; role: string; content: string; created_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const MAX_CONTEXT_MESSAGES = 12;
const MAX_MEMORY_CHATS = 3;
const MAX_MEMORY_MESSAGES_PER_CHAT = 2;
const MAX_MEMORY_MESSAGE_CHARS = 180;

/* ─── Chat History Sidebar Content ─── */
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
  <div className="flex flex-col h-full">
    <div className="p-4 pb-3">
      <Button
        onClick={() => { createChat(); onSelect?.(); }}
        className="w-full h-11 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all duration-200 font-medium text-sm"
        variant="ghost"
      >
        <Plus className="w-4 h-4 mr-2" /> New conversation
      </Button>
    </div>

    <div className="px-4 pb-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">Recent</span>
    </div>

    <div className="flex-1 overflow-auto px-2 space-y-0.5">
      {chats.map(chat => (
        <div
          key={chat.id}
          className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150 ${
            activeChat === chat.id ? 'bg-muted/40 text-foreground' : 'hover:bg-muted/20 text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => { setActiveChat(chat.id); onSelect?.(); }}
        >
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
          {editingChat === chat.id ? (
            <div className="flex-1 flex items-center gap-1.5">
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="h-7 text-xs bg-background/80 rounded-lg border-border/30"
                onKeyDown={e => e.key === 'Enter' && renameChat(chat.id)}
                autoFocus
              />
              <button onClick={() => renameChat(chat.id)} className="p-0.5 hover:text-primary transition-colors">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditingChat(null)} className="p-0.5 hover:text-destructive transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <span className="flex-1 text-[13px] truncate">{chat.title}</span>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                  className="p-1 rounded-md hover:bg-muted/40 transition-colors"
                  onClick={e => { e.stopPropagation(); setEditingChat(chat.id); setEditTitle(chat.title); }}
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  className="p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={e => { e.stopPropagation(); deleteChat(chat.id); }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {chats.length === 0 && (
        <div className="px-3 py-8 text-center">
          <p className="text-xs text-muted-foreground/40">No conversations yet</p>
        </div>
      )}
    </div>
  </div>
);

/* ─── Main Chat Component ─── */
const ChatPage = () => {
  const { user } = useAuth();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSendingRef = useRef(false);

  const MODE_OPTIONS = [
    { value: 'auto', label: 'Auto', icon: Zap, desc: 'AI picks best mode' },
    { value: 'reasoning', label: 'Reasoning', icon: Brain, desc: 'Math & logic' },
    { value: 'coding', label: 'Coding', icon: Code2, desc: 'Programming' },
    { value: 'general', label: 'General', icon: MessagesSquare, desc: 'Chat & explain' },
    { value: 'fast', label: 'Fast', icon: Zap, desc: 'Quick answers' },
    { value: 'study', label: 'Study', icon: BookOpen, desc: 'Structured learning' },
    { value: 'long_context', label: 'Long Context', icon: FileText, desc: 'Summaries' },
    { value: 'creative', label: 'Creative', icon: Palette, desc: 'Writing & stories' },
  ];

  useEffect(() => { if (user) loadChats(); }, [user]);
  useEffect(() => { if (activeChat) loadMessages(activeChat); }, [activeChat]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadChats = async () => {
    const { data } = await supabase.from('chats').select('*').order('updated_at', { ascending: false });
    if (data) setChats(data);
  };

  const loadMessages = async (chatId: string) => {
    const { data } = await supabase.from('chat_messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const createChat = async () => {
    if (!user) return;
    const { data } = await supabase.from('chats').insert({ user_id: user.id, title: 'New Chat' }).select().single();
    if (data) { setChats(prev => [data, ...prev]); setActiveChat(data.id); setMessages([]); }
  };

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

  const fetchMemoryContext = async () => {
    if (!user) return [];
    try {
      const { data: recentChats } = await supabase
        .from('chats')
        .select('id, title')
        .neq('id', activeChat || '')
        .order('updated_at', { ascending: false })
        .limit(MAX_MEMORY_CHATS);

      if (!recentChats || recentChats.length === 0) return [];

      const memoryContext = await Promise.all(
        recentChats.map(async (chat) => {
          const { data: msgs } = await supabase
            .from('chat_messages')
            .select('role, content')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(MAX_MEMORY_MESSAGES_PER_CHAT);
          if (!msgs || msgs.length === 0) return null;
          return {
            title: chat.title,
            messages: msgs.reverse().map(m => ({
              role: m.role,
              content: m.content.slice(0, MAX_MEMORY_MESSAGE_CHARS),
            })),
          };
        })
      );

      return memoryContext.filter(Boolean);
    } catch (err) {
      console.error('Failed to fetch memory context:', err);
      return [];
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || !activeChat || isLoading || isSendingRef.current) return;

    const allowed = await checkAndIncrement('chat_messages');
    if (!allowed) return;

    isSendingRef.current = true;
    setIsLoading(true);

    const memoryContextPromise = fetchMemoryContext();
    const fileContext = buildFileContext(uploadedFiles);
    const userContent = input.trim() + fileContext;
    setInput('');
    setUploadedFiles([]);

    try {
      const { data: userMsg } = await supabase
        .from('chat_messages')
        .insert({ chat_id: activeChat, role: 'user', content: userContent })
        .select()
        .single();

      if (userMsg) setMessages(prev => [...prev, userMsg]);

      if (messages.length === 0) {
        const title = userContent.slice(0, 50) + (userContent.length > 50 ? '...' : '');
        await supabase.from('chats').update({ title }).eq('id', activeChat);
        setChats(prev => prev.map(c => c.id === activeChat ? { ...c, title } : c));
      }

      const allMessages = [...messages, { role: 'user', content: userContent }]
        .slice(-MAX_CONTEXT_MESSAGES)
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const memoryContext = await memoryContextPromise;

      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          memoryContext,
          ...(selectedMode !== 'auto' ? { mode: selectedMode } : {}),
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: 'Unknown error' }));
        if (resp.status === 429) {
          toast.error('Rate limit exceeded. Please wait a moment and try again.');
        } else {
          toast.error(errorData.error || 'Failed to get AI response. Please try again.');
        }
        return;
      }

      // Handle SSE streaming
      const reader = resp.body?.getReader();
      if (!reader) {
        toast.error('Failed to get AI response stream.');
        return;
      }

      const placeholderId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: placeholderId, role: 'assistant', content: '', created_at: new Date().toISOString() }]);

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

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
            // Capture model/mode metadata
            if (parsed.lumina_meta) {
              setActiveMode(parsed.lumina_meta.mode);
              setActiveModel(parsed.lumina_meta.model);
              continue;
            }
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: fullContent } : m));
            }
          } catch {}
        }
      }

      if (fullContent) {
        const { data: savedMsg } = await supabase
          .from('chat_messages')
          .insert({ chat_id: activeChat, role: 'assistant', content: fullContent })
          .select()
          .single();

        if (savedMsg) setMessages(prev => prev.map(m => m.id === placeholderId ? savedMsg : m));
      } else {
        toast.error('AI returned an empty response. Please try again.');
        setMessages(prev => prev.filter(m => m.id !== placeholderId));
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to connect to AI. Please try again.');
    } finally {
      isSendingRef.current = false;
      setIsLoading(false);
    }
  };

  const activeChatTitle = chats.find(c => c.id === activeChat)?.title;

  const sidebarProps = {
    chats, activeChat, editingChat, editTitle, setEditTitle, setEditingChat,
    setActiveChat, createChat, deleteChat, renameChat,
  };

  const welcomeView = (
    <div className="flex-1 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md w-full"
      >
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5 md:mb-6">
          <Sparkles className="w-6 h-6 md:w-7 md:h-7 text-primary" />
        </div>
        <h2 className="text-xl md:text-2xl font-display font-semibold text-foreground mb-2 tracking-tight">
          How can I help you study?
        </h2>
        <p className="text-sm text-muted-foreground/60 mb-6 md:mb-8 leading-relaxed">
          Ask me anything — from explaining complex topics to solving problems step by step.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-2.5 mb-6 md:mb-8">
          {[
            'Explain quantum mechanics simply',
            'Help me solve calculus problems',
            'Summarize the French Revolution',
            'Quiz me on organic chemistry',
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={async () => {
                if (!activeChat) {
                  await createChat();
                }
                setInput(suggestion);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="text-left px-4 py-3 rounded-xl border border-border/15 bg-muted/10 hover:bg-muted/25 hover:border-border/30 text-xs text-muted-foreground/70 hover:text-foreground transition-all duration-200"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <Button
          onClick={createChat}
          className="h-11 px-8 rounded-2xl gradient-primary text-primary-foreground font-medium"
        >
          <Plus className="w-4 h-4 mr-2" /> Start a conversation
        </Button>
      </motion.div>
    </div>
  );

  const activeChatView = (
    <>
      {/* Header */}
      <div className="h-12 md:h-14 border-b border-border/10 flex items-center px-4 md:px-6 gap-2">
        {isMobile && (
          <button onClick={() => setActiveChat(null)} className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        {!isMobile && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground transition-colors md:hidden">
                <Menu className="w-4 h-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <ChatSidebar {...sidebarProps} onSelect={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>
        )}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
          <span className="text-sm font-medium text-foreground/80 truncate">
            {activeChatTitle || 'New Chat'}
          </span>
          {activeMode && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium capitalize whitespace-nowrap">
              {activeMode === 'long_context' ? 'Long Context' : activeMode}
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => {
              const md = messages.map(m => 
                `## ${m.role === 'user' ? '📝 You' : '✨ Lumina'}\n\n${m.content}`
              ).join('\n\n---\n\n');
              const header = `# Study Notes: ${activeChatTitle || 'Chat'}\n_Exported from Lumina AI on ${new Date().toLocaleDateString()}_\n\n---\n\n`;
              const blob = new Blob([header + md], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `lumina-notes-${(activeChatTitle || 'chat').slice(0, 30).replace(/\s+/g, '-')}.md`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Study notes exported!');
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Export as study notes"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-border/20 scrollbar-track-transparent">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-4 md:space-y-5">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94], delay: idx === messages.length - 1 ? 0.05 : 0 }}
                  className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                    className={`w-7 h-7 md:w-8 md:h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 shadow-sm ${
                      isUser
                        ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
                        : 'bg-gradient-to-br from-secondary/20 to-accent/20 text-secondary border border-border/10'
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  </motion.div>

                  {/* Message Bubble */}
                  <div className={`max-w-[85%] md:max-w-[80%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
                    <span className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 block ${
                      isUser ? 'text-right text-primary/50' : 'text-left text-secondary/50'
                    }`}>
                      {isUser ? 'You' : 'Lumina'}
                    </span>
                    <div className={`rounded-2xl px-4 py-3 transition-all duration-200 ${
                      isUser
                        ? 'bg-primary/10 border border-primary/15 rounded-tr-md'
                        : 'bg-muted/20 border border-border/10 rounded-tl-md shadow-sm'
                    }`}>
                      <div className={`text-[13px] md:text-[14px] leading-[1.7] ${isUser ? 'text-foreground' : 'text-foreground/85'}`}>
                        <div className="prose prose-sm prose-invert max-w-none
                          prose-p:my-2 prose-p:leading-[1.75]
                          prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-5 prose-headings:mb-2
                          prose-strong:text-foreground prose-strong:font-semibold
                          prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[12px] md:prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none
                          prose-pre:bg-card/50 prose-pre:border prose-pre:border-border/10 prose-pre:rounded-xl prose-pre:p-3 md:prose-pre:p-4 prose-pre:overflow-x-auto prose-pre:shadow-inner
                          prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                          prose-blockquote:border-primary/30 prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:text-muted-foreground prose-blockquote:py-1
                          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                        ">
                          <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                        </div>
                      </div>
                    </div>
                    <span className={`text-[9px] text-muted-foreground/25 mt-1 block ${isUser ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Typing Indicator */}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="flex gap-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 text-secondary border border-border/10 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </motion.div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-secondary/50 mb-1.5 block">Lumina</span>
                <div className="rounded-2xl rounded-tl-md bg-muted/20 border border-border/10 px-5 py-3.5 shadow-sm">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="w-2 h-2 rounded-full bg-secondary/50"
                        animate={{
                          y: [0, -6, 0],
                          opacity: [0.4, 1, 0.4],
                          scale: [1, 1.2, 1],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.15,
                          ease: 'easeInOut',
                        }}
                      />
                    ))}
                    <span className="text-[11px] text-muted-foreground/40 ml-2 italic">thinking...</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/10 bg-background/80 backdrop-blur-sm p-3 md:p-4">
        <div className="max-w-3xl mx-auto">
          {uploadedFiles.length > 0 && (
            <div className="mb-2">
              <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} compact />
            </div>
          )}
          <motion.div
            className="flex items-center gap-2 bg-muted/10 border border-border/15 rounded-2xl px-3 md:px-4 py-1.5 transition-all duration-300 focus-within:border-primary/30 focus-within:bg-muted/20 focus-within:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.15)]"
            whileFocus={{ scale: 1.01 }}
          >
            {uploadedFiles.length === 0 && (
              <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} compact />
            )}
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Message Lumina..."
              className="border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-sm placeholder:text-muted-foreground/35 px-0"
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={sendMessage}
                disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
                size="icon"
                className="h-8 w-8 rounded-xl gradient-primary text-primary-foreground shrink-0 disabled:opacity-20 transition-all duration-200 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          </motion.div>
          <p className="text-[10px] text-muted-foreground/25 text-center mt-2.5 hidden md:block">
            Lumina can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </>
  );

  /* ─── Mobile Layout: show list OR chat ─── */
  if (isMobile) {
    return (
      <>
        <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
        <div className="flex flex-col fixed inset-0 top-12 z-10 bg-background">
          {activeChat ? (
            activeChatView
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ChatSidebar {...sidebarProps} />
              <div className="border-t border-border/10">
                {welcomeView}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ─── Desktop Layout: sidebar + chat ─── */
  return (
    <>
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <div className="flex fixed inset-0 top-12 z-10 bg-background">
        <div className="w-[280px] border-r border-border/10 bg-background flex flex-col">
          <ChatSidebar {...sidebarProps} />
        </div>
        <div className="flex-1 flex flex-col bg-background overflow-hidden">
          {activeChat ? activeChatView : welcomeView}
        </div>
      </div>
    </>
  );
};

export default ChatPage;
