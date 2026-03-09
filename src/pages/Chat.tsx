import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Send, Trash2, Edit3, Check, X, MessageSquare, Sparkles, User, Menu, ArrowLeft } from 'lucide-react';
import { FileUploadButton, buildFileContext, type UploadedFile } from '@/components/FileUploadButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import ReactMarkdown from 'react-markdown';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

type Chat = { id: string; title: string; created_at: string };
type Message = { id: string; role: string; content: string; created_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

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
const Chat = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingChat, setEditingChat] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      // Get recent chats (excluding current), limited to last 10
      const { data: recentChats } = await supabase
        .from('chats')
        .select('id, title')
        .neq('id', activeChat || '')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (!recentChats || recentChats.length === 0) return [];

      // Fetch last 4 messages from each chat for context
      const memoryContext = await Promise.all(
        recentChats.map(async (chat) => {
          const { data: msgs } = await supabase
            .from('chat_messages')
            .select('role, content')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(4);
          if (!msgs || msgs.length === 0) return null;
          return {
            title: chat.title,
            messages: msgs.reverse().map(m => ({
              role: m.role,
              content: m.content.slice(0, 300), // Truncate long messages
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
    if ((!input.trim() && uploadedFiles.length === 0) || !activeChat || isLoading) return;
    const fileContext = buildFileContext(uploadedFiles);
    const userContent = input.trim() + fileContext;
    setInput('');
    setUploadedFiles([]);

    const { data: userMsg } = await supabase.from('chat_messages').insert({ chat_id: activeChat, role: 'user', content: userContent }).select().single();
    if (userMsg) setMessages(prev => [...prev, userMsg]);

    if (messages.length === 0) {
      const title = userContent.slice(0, 50) + (userContent.length > 50 ? '...' : '');
      await supabase.from('chats').update({ title }).eq('id', activeChat);
      setChats(prev => prev.map(c => c.id === activeChat ? { ...c, title } : c));
    }

    const allMessages = [...messages, { role: 'user', content: userContent }].map(m => ({
      role: m.role as 'user' | 'assistant', content: m.content,
    }));

    // Fetch memory from past conversations
    const memoryContext = await fetchMemoryContext();

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMessages, memoryContext }),
      });
      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';
      let streamDone = false;
      const tempId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: tempId, role: 'assistant', content: '', created_at: new Date().toISOString() }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const content = JSON.parse(jsonStr).choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: assistantContent } : m));
            }
          } catch {}
        }
      }

      if (assistantContent) {
        const { data: savedMsg } = await supabase.from('chat_messages').insert({ chat_id: activeChat, role: 'assistant', content: assistantContent }).select().single();
        if (savedMsg) setMessages(prev => prev.map(m => m.id === tempId ? savedMsg : m));
      }
    } catch (error) {
      console.error('Chat error:', error);
    }
    setIsLoading(false);
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
                await createChat();
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
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
          <span className="text-sm font-medium text-foreground/80 truncate">
            {activeChatTitle || 'New Chat'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">
          <AnimatePresence>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex gap-2.5 md:gap-3"
              >
                <div className={`w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  msg.role === 'user' ? 'bg-primary/15 text-primary' : 'bg-secondary/15 text-secondary'
                }`}>
                  {msg.role === 'user' ? <User className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-1 block">
                    {msg.role === 'user' ? 'You' : 'Lumina'}
                  </span>
                  <div className={`text-[13px] md:text-[14px] leading-relaxed ${msg.role === 'user' ? 'text-foreground/90' : 'text-foreground/80'}`}>
                    <div className="prose prose-sm prose-invert max-w-none
                      prose-p:my-2 prose-p:leading-relaxed
                      prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-5 prose-headings:mb-2
                      prose-strong:text-foreground prose-strong:font-semibold
                      prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[12px] md:prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none
                      prose-pre:bg-muted/30 prose-pre:border prose-pre:border-border/10 prose-pre:rounded-xl prose-pre:p-3 md:prose-pre:p-4 prose-pre:overflow-x-auto
                      prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                      prose-blockquote:border-primary/30 prose-blockquote:text-muted-foreground
                    ">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5 md:gap-3">
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" />
              </div>
              <div className="pt-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-2 block">Lumina</span>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30"
                      animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/10 p-3 md:p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 bg-muted/15 border border-border/15 rounded-2xl px-3 md:px-4 py-1.5 focus-within:border-primary/30 focus-within:bg-muted/25 transition-all duration-200">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Message Lumina..."
              className="border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-sm placeholder:text-muted-foreground/40 px-0"
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="h-8 w-8 rounded-xl gradient-primary text-primary-foreground shrink-0 disabled:opacity-30 transition-opacity"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/30 text-center mt-2 hidden md:block">
            Lumina can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </>
  );

  /* ─── Mobile Layout: show list OR chat ─── */
  if (isMobile) {
    return (
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
    );
  }

  /* ─── Desktop Layout: sidebar + chat ─── */
  return (
    <div className="flex fixed inset-0 top-12 z-10 bg-background">
      <div className="w-[280px] border-r border-border/10 bg-background flex flex-col">
        <ChatSidebar {...sidebarProps} />
      </div>
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        {activeChat ? activeChatView : welcomeView}
      </div>
    </div>
  );
};

export default Chat;
