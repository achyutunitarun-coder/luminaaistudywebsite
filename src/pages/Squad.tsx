import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Send, Copy, Check, LogIn, LogOut, MessageSquare,
  Sparkles, User, Crown, Zap, BookOpen, Brain, FileText, HelpCircle,
  PenTool, Layers, Target, ClipboardList, Mic, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { createBufferedTextAccumulator, streamSSE } from '@/lib/aiStream';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type Squad = { id: string; name: string; invite_code: string | null; created_by: string | null; created_at: string | null };
type Member = { id: string; user_id: string; display_name: string | null; joined_at: string | null };
type Activity = { id: string; user_id: string; activity_type: string | null; description: string | null; xp_earned: number | null; created_at: string | null };
type SquadMessage = { id: string; squad_id: string; user_id: string; display_name: string | null; role: string; content: string; created_at: string };

const AI_TOOLS = [
  { name: 'AI Chat', icon: MessageSquare, color: 'from-violet-500 to-fuchsia-500', desc: 'Ask anything', route: '/chat' },
  { name: 'Doubt Solver', icon: HelpCircle, color: 'from-blue-500 to-cyan-500', desc: 'Clear doubts fast', route: '/doubt-solver' },
  { name: 'Notes', icon: FileText, color: 'from-emerald-500 to-green-500', desc: 'Generate notes', route: '/notes-generator' },
  { name: 'Quick Study', icon: Zap, color: 'from-amber-500 to-orange-500', desc: 'Speed revision', route: '/quick-study' },
  { name: 'Guided Lesson', icon: BookOpen, color: 'from-purple-500 to-pink-500', desc: 'Step-by-step', route: '/guided-lesson' },
  { name: 'Smart Notebook', icon: PenTool, color: 'from-teal-500 to-cyan-500', desc: 'AI writing', route: '/smart-notebook' },
  { name: 'Flashcards', icon: Layers, color: 'from-rose-500 to-pink-500', desc: 'SRS cards', route: '/flashcards' },
  { name: 'Tests', icon: Target, color: 'from-red-500 to-orange-500', desc: 'Practice tests', route: '/tests' },
  
  { name: 'Lecture AI', icon: Mic, color: 'from-sky-500 to-blue-500', desc: 'Audio analysis', route: '/lecture-ai' },
];

const SquadPage = () => {
  const { user, session } = useAuth();
  const { profile } = useProfile();
  const [tab, setTab] = useState<'my' | 'join' | 'create'>('my');
  const [squads, setSquads] = useState<Squad[]>([]);
  const [activeSquad, setActiveSquad] = useState<Squad | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newSquadName, setNewSquadName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string; user_name?: string }[]>([]);
  const [persistedMessages, setPersistedMessages] = useState<SquadMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (user) loadSquads(); }, [user]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, persistedMessages]);

  // Real-time subscription for squad messages
  useEffect(() => {
    if (!activeSquad) return;
    const channel = supabase
      .channel(`squad-${activeSquad.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'squad_messages',
        filter: `squad_id=eq.${activeSquad.id}`,
      }, (payload) => {
        const msg = payload.new as SquadMessage;
        setPersistedMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSquad?.id]);

  const loadSquads = async () => {
    if (!user) return;
    const { data: memberRows } = await supabase
      .from('squad_members')
      .select('squad_id')
      .eq('user_id', user.id);
    if (!memberRows?.length) { setSquads([]); return; }
    const ids = memberRows.map(r => r.squad_id).filter(Boolean);
    const { data } = await supabase.from('squads').select('*').in('id', ids);
    if (data) setSquads(data);
  };

  const openSquad = async (squad: Squad) => {
    setActiveSquad(squad);
    setChatMessages([]);
    // Load persisted messages
    const { data: msgs } = await supabase
      .from('squad_messages')
      .select('*')
      .eq('squad_id', squad.id)
      .order('created_at', { ascending: true })
      .limit(100);
    setPersistedMessages((msgs as SquadMessage[]) || []);
    const { data: m } = await supabase.from('squad_members').select('*').eq('squad_id', squad.id);
    if (m) setMembers(m);
    const { data: a } = await supabase.from('squad_activity').select('*').eq('squad_id', squad.id).order('created_at', { ascending: false }).limit(20);
    if (a) setActivities(a);
  };

  const createSquad = async () => {
    if (!newSquadName.trim() || !user) return;
    setCreating(true);
    try {
      // Generate invite code client-side to ensure it's always set
      const inviteCode = Math.random().toString(36).substring(2, 9).toUpperCase();
      const { data: squad, error: sqErr } = await supabase
        .from('squads')
        .insert({ name: newSquadName.trim(), created_by: user.id, invite_code: inviteCode })
        .select()
        .single();
      if (sqErr || !squad) {
        console.error('Squad creation failed:', sqErr);
        toast.error(`Failed to create squad: ${sqErr?.message || 'Unknown error'}`);
        setCreating(false);
        return;
      }
      const { error: memErr } = await supabase
        .from('squad_members')
        .insert({ squad_id: squad.id, user_id: user.id, display_name: profile?.display_name || 'You' });
      if (memErr) {
        console.error('Squad member insert failed:', memErr);
        toast.error(`Couldn't add you as member: ${memErr.message}`);
      }
      setNewSquadName('');
      await loadSquads();
      setTab('my');
      toast.success(`Squad "${squad.name}" created! Share code: ${squad.invite_code}`);
    } catch (e: any) {
      console.error('Squad create exception:', e);
      toast.error(e?.message || 'Failed to create squad');
    }
    setCreating(false);
  };

  const joinSquad = async () => {
    if (!joinCode.trim() || !user) return;
    setJoining(true);
    const code = joinCode.trim().toUpperCase();
    const { data: lookup, error: lookupErr } = await (supabase as any).rpc('lookup_squad_by_invite_code', { _code: code });
    if (lookupErr) console.error('Squad lookup error:', lookupErr);
    const squad = Array.isArray(lookup) ? lookup[0] : lookup;
    if (!squad) { toast.error('Invalid invite code'); setJoining(false); return; }
    const { data: existing } = await supabase.from('squad_members').select('id').eq('squad_id', squad.id).eq('user_id', user.id).maybeSingle();
    if (existing) { toast.info('Already in this squad'); setJoining(false); return; }
    const { data: countData } = await supabase.from('squad_members').select('id').eq('squad_id', squad.id);
    if (countData && countData.length >= 12) { toast.error('Squad is full (max 12)'); setJoining(false); return; }
    await supabase.from('squad_members').insert({ squad_id: squad.id, user_id: user.id, display_name: profile?.display_name || 'Student' });
    await supabase.from('squad_activity').insert({ squad_id: squad.id, user_id: user.id, activity_type: 'join', description: `${profile?.display_name || 'A student'} joined the squad` });
    setJoinCode('');
    await loadSquads();
    setTab('my');
    toast.success(`Joined ${squad.name}!`);
    setJoining(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Invite code copied!');
  };

  const leaveSquad = async (squadId: string) => {
    if (!user) return;
    await supabase.from('squad_members').delete().eq('squad_id', squadId).eq('user_id', user.id);
    setActiveSquad(null);
    await loadSquads();
    toast.success('Left squad');
  };

  const sendSquadChat = async () => {
    if (!chatInput.trim() || chatLoading || !activeSquad) return;
    setChatLoading(true);
    const userMsg = { role: 'user', content: chatInput.trim(), user_name: profile?.display_name || 'You' };
    setChatInput('');

    // Persist user message to DB (will appear via realtime)
    await supabase.from('squad_messages').insert({
      squad_id: activeSquad.id, user_id: user!.id, display_name: profile?.display_name || 'Student',
      role: 'user', content: userMsg.content,
    } as any);

    try {
      const recentMsgs = persistedMessages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant', content: m.content,
      }));
      recentMsgs.push({ role: 'user', content: userMsg.content });

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: recentMsgs, mode: 'study' }),
      });

      if (!resp.ok || !resp.body) { toast.error('AI error'); setChatLoading(false); return; }

      setChatMessages(prev => [...prev, { role: 'assistant', content: '', user_name: 'Lumina' }]);

      const buffer = createBufferedTextAccumulator((text) => {
        setChatMessages(prev => {
          const msgs = [...prev];
          msgs[msgs.length - 1] = { role: 'assistant', content: text, user_name: 'Lumina' };
          return msgs;
        });
      });

      await streamSSE(resp, { onDelta: (chunk) => buffer.push(chunk) });
      buffer.flushNow();

      // Get the final AI content and persist it
      const finalContent = chatMessages[chatMessages.length - 1]?.content;
      // We need to get it from the buffer directly
      setChatMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg.content) {
          // Persist AI response
          supabase.from('squad_messages').insert({
            squad_id: activeSquad.id, user_id: user!.id, display_name: 'Lumina',
            role: 'assistant', content: lastMsg.content,
          } as any);
        }
        return prev;
      });
    } catch {
      toast.error('Connection error');
    }
    setChatLoading(false);
  };

  // ─── Squad Room View ───
  if (activeSquad) {
    return (
      <div className="flex flex-col h-[calc(100vh-5rem)] -mx-4 -my-6">
        {/* Room Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border/10 bg-background/60 backdrop-blur-md flex-shrink-0">
          <button onClick={() => setActiveSquad(null)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/15">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">{activeSquad.name}</h2>
            <p className="text-[10px] text-muted-foreground">{members.length}/12 members</p>
          </div>
          <div className="flex items-center gap-2">
            {activeSquad.invite_code && (
              <button
                onClick={() => copyCode(activeSquad.invite_code!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/15 transition-colors"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {activeSquad.invite_code}
              </button>
            )}
            <button
              onClick={() => leaveSquad(activeSquad.id)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Chat */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
              {persistedMessages.length === 0 && chatMessages.length === 0 && (
                <div className="flex-1 flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                      <Brain className="w-7 h-7 text-primary/50" />
                    </div>
                    <p className="text-sm font-medium text-foreground/60 mb-1">Squad AI Chat</p>
                    <p className="text-[11px] text-muted-foreground/40 max-w-xs">Ask anything — the whole squad can see the AI's responses and learn together</p>
                  </div>
                </div>
              )}
              {persistedMessages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
                      : 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-primary border border-primary/10'
                  }`}>
                    {msg.role === 'user' ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted/15 border border-border/8 rounded-tl-sm'
                  }`}>
                    {msg.display_name && msg.role === 'user' && (
                      <p className="text-[10px] opacity-70 mb-0.5 font-medium">{msg.display_name}</p>
                    )}
                    <div className="text-[13px] leading-relaxed">
                      {msg.role === 'assistant' ? <MarkdownRenderer>{msg.content}</MarkdownRenderer> : msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {/* Streaming messages (not yet persisted) */}
              {chatMessages.map((msg, i) => (
                <div key={`stream-${i}`} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
                      : 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-primary border border-primary/10'
                  }`}>
                    {msg.role === 'user' ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted/15 border border-border/8 rounded-tl-sm'
                  }`}>
                    <div className="text-[13px] leading-relaxed">
                      {msg.role === 'assistant' ? <MarkdownRenderer>{msg.content}</MarkdownRenderer> : msg.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t border-border/8 p-3 bg-background/70 backdrop-blur-xl">
              <div className="flex items-center gap-2 bg-muted/8 border border-border/12 rounded-xl px-3 py-1">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Ask the squad AI..."
                  className="border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 h-10 text-sm px-0"
                  onKeyDown={e => e.key === 'Enter' && sendSquadChat()}
                />
                <Button
                  onClick={sendSquadChat}
                  disabled={chatLoading || !chatInput.trim()}
                  size="icon"
                  className="h-8 w-8 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shrink-0 disabled:opacity-20"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right sidebar: Members + Activity + Tools */}
          <div className="w-[260px] border-l border-border/8 bg-background/50 overflow-auto flex-col hidden lg:flex">
            {/* Members */}
            <div className="p-4 border-b border-border/8">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-2">Members ({members.length})</p>
              <div className="space-y-1.5">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                      {(m.display_name || '?')[0].toUpperCase()}
                    </div>
                    <span className="text-[12px] text-foreground/80 truncate">{m.display_name || 'Student'}</span>
                    {m.user_id === activeSquad.created_by && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            {/* AI Tools */}
            <div className="p-4 border-b border-border/8">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-2">Shared AI Tools</p>
              <div className="grid grid-cols-2 gap-1.5">
                {AI_TOOLS.slice(0, 8).map(tool => {
                  const Icon = tool.icon;
                  return (
                    <a
                      key={tool.name}
                      href={tool.route}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted/10 transition-colors group"
                    >
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${tool.color} flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[9px] text-muted-foreground/60 group-hover:text-foreground/80 text-center leading-tight">{tool.name}</span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Activity */}
            <div className="p-4 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-2">Recent Activity</p>
              <div className="space-y-2">
                {activities.slice(0, 10).map(a => (
                  <div key={a.id} className="flex items-start gap-2 py-1">
                    <div className="w-1 h-1 rounded-full bg-primary/40 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-foreground/70 leading-snug">{a.description || a.activity_type}</p>
                      {a.xp_earned ? <span className="text-[9px] text-primary/60">+{a.xp_earned} XP</span> : null}
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/30">No activity yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Squad List / Join / Create View ───
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-xl shadow-primary/10 border border-primary/15">
            <Users className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Study Squads</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Collaborate & learn together with shared AI tools</p>
          </div>
        </div>
      </motion.div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList className="w-full grid grid-cols-3 h-11 rounded-xl bg-muted/15 p-1">
          <TabsTrigger value="my" className="rounded-lg text-sm font-medium">My Squads</TabsTrigger>
          <TabsTrigger value="join" className="rounded-lg text-sm font-medium">Join</TabsTrigger>
          <TabsTrigger value="create" className="rounded-lg text-sm font-medium">Create</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="mt-4 space-y-3">
          {squads.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                <Users className="w-9 h-9 text-primary/30" />
              </div>
              <p className="text-foreground/50 text-sm font-medium mb-1">No squads yet</p>
              <p className="text-muted-foreground/40 text-xs mb-4">Create one or join with an invite code</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setTab('create')} className="rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm h-9 px-5">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Squad
                </Button>
                <Button onClick={() => setTab('join')} variant="outline" className="rounded-xl text-sm h-9 px-5 border-border/20">
                  <LogIn className="w-3.5 h-3.5 mr-1.5" /> Join Squad
                </Button>
              </div>
            </motion.div>
          ) : (
            squads.map((squad, i) => (
              <motion.div
                key={squad.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className="cursor-pointer hover:border-primary/20 transition-all duration-200 bg-card/50 border-border/10"
                  onClick={() => openSquad(squad)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
                      <Users className="w-5 h-5 text-primary/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">{squad.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {squad.invite_code && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {squad.invite_code}
                          </span>
                        )}
                        {squad.created_by === user?.id && (
                          <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5" /> Owner
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/30" />
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </TabsContent>

        <TabsContent value="join" className="mt-4">
          <Card className="bg-card/50 border-border/10">
            <CardContent className="p-6 space-y-4">
              <div className="text-center mb-2">
                <LogIn className="w-8 h-8 mx-auto mb-2 text-primary/50" />
                <h3 className="text-lg font-semibold text-foreground">Join a Squad</h3>
                <p className="text-xs text-muted-foreground/50 mt-1">Enter the invite code shared by your squad</p>
              </div>
              <Input
                placeholder="Enter invite code..."
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                className="h-12 text-center text-lg font-mono tracking-[0.3em] uppercase bg-muted/10 border-border/20 rounded-xl"
                onKeyDown={e => e.key === 'Enter' && joinSquad()}
              />
              <Button
                onClick={joinSquad}
                disabled={joining || !joinCode.trim()}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold"
              >
                {joining ? 'Joining...' : 'Join Squad'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="mt-4">
          <Card className="bg-card/50 border-border/10">
            <CardContent className="p-6 space-y-4">
              <div className="text-center mb-2">
                <Plus className="w-8 h-8 mx-auto mb-2 text-primary/50" />
                <h3 className="text-lg font-semibold text-foreground">Create a Squad</h3>
                <p className="text-xs text-muted-foreground/50 mt-1">An invite code will be auto-generated for sharing</p>
              </div>
              <Input
                placeholder="Squad name..."
                value={newSquadName}
                onChange={e => setNewSquadName(e.target.value)}
                className="h-12 bg-muted/10 border-border/20 rounded-xl"
                onKeyDown={e => e.key === 'Enter' && createSquad()}
              />
              <Button
                onClick={createSquad}
                disabled={creating || !newSquadName.trim()}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold"
              >
                {creating ? 'Creating...' : 'Create Squad'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SquadPage;