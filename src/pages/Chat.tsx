import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Send, Trash2, Edit3, Check, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ReactMarkdown from 'react-markdown';

type Chat = { id: string; title: string; created_at: string };
type Message = { id: string; role: string; content: string; created_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const Chat = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingChat, setEditingChat] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const sendMessage = async () => {
    if (!input.trim() || !activeChat || isLoading) return;
    const userContent = input.trim();
    setInput('');
    setIsLoading(true);

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

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMessages }),
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

  return (
    <div className="flex h-[calc(100vh-5rem)] -m-6 gap-0">
      {/* Sidebar */}
      <div className="w-72 border-r border-border/20 bg-card/20 flex flex-col">
        <div className="p-3">
          <Button onClick={createChat} className="w-full gradient-primary text-primary-foreground rounded-xl" size="sm">
            <Plus className="w-4 h-4 mr-2" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-auto px-2 space-y-0.5">
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                activeChat === chat.id ? 'bg-muted/30 text-foreground' : 'hover:bg-muted/15 text-muted-foreground'
              }`}
              onClick={() => setActiveChat(chat.id)}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
              {editingChat === chat.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-6 text-xs bg-background rounded-lg" onKeyDown={e => e.key === 'Enter' && renameChat(chat.id)} autoFocus />
                  <Check className="w-3 h-3 cursor-pointer text-success" onClick={() => renameChat(chat.id)} />
                  <X className="w-3 h-3 cursor-pointer text-destructive" onClick={() => setEditingChat(null)} />
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm truncate">{chat.title}</span>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <Edit3 className="w-3 h-3 hover:text-primary" onClick={e => { e.stopPropagation(); setEditingChat(chat.id); setEditTitle(chat.title); }} />
                    <Trash2 className="w-3 h-3 hover:text-destructive" onClick={e => { e.stopPropagation(); deleteChat(chat.id); }} />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Main */}
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <AnimatePresence>
                {messages.map(msg => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user' ? 'gradient-primary text-primary-foreground' : 'border border-border/20 bg-card/60 backdrop-blur-xl'
                    }`}>
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="border border-border/20 bg-card/60 backdrop-blur-xl rounded-2xl px-4 py-3">
                    <div className="flex gap-1.5">
                      {[0, 0.2, 0.4].map((d, i) => (
                        <span key={i} className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${d}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-border/20">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  className="bg-muted/20 border-border/30 rounded-xl"
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                />
                <Button onClick={sendMessage} disabled={isLoading} className="gradient-primary text-primary-foreground rounded-xl">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-14 h-14 text-muted-foreground/15 mx-auto mb-4" />
              <h2 className="text-xl font-display font-semibold text-foreground mb-2">AI Study Chat</h2>
              <p className="text-muted-foreground text-sm mb-4">Start a conversation to learn anything</p>
              <Button onClick={createChat} className="gradient-primary text-primary-foreground rounded-2xl h-11 px-6">
                <Plus className="w-4 h-4 mr-2" /> New Chat
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
