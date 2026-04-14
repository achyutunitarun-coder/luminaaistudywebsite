import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Copy, Check, Crown, MessageSquare, Zap, Trophy, UserPlus, LogOut, Loader2, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const MAX_MEMBERS = 12;

const Squad = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [squadName, setSquadName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'create' | 'join'>('create');

  // Get user's squad membership
  const { data: myMembership } = useQuery({
    queryKey: ['my-squad-membership', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('squad_members').select('*, squads(*)').eq('user_id', user!.id).limit(1).single();
      return data;
    },
    enabled: !!user,
  });

  const squadId = (myMembership as any)?.squad_id;
  const squad = (myMembership as any)?.squads;

  // Get squad members
  const { data: members = [] } = useQuery({
    queryKey: ['squad-members', squadId],
    queryFn: async () => {
      const { data } = await supabase.from('squad_members').select('*').eq('squad_id', squadId);
      return data || [];
    },
    enabled: !!squadId,
    refetchInterval: 10000,
  });

  // Get squad activity
  const { data: activity = [] } = useQuery({
    queryKey: ['squad-activity', squadId],
    queryFn: async () => {
      const { data } = await supabase.from('squad_activity').select('*').eq('squad_id', squadId).order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!squadId,
    refetchInterval: 15000,
  });

  // Realtime subscription for squad activity
  useEffect(() => {
    if (!squadId) return;
    const channel = supabase
      .channel(`squad-${squadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'squad_activity', filter: `squad_id=eq.${squadId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['squad-activity', squadId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_members', filter: `squad_id=eq.${squadId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['squad-members', squadId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [squadId, queryClient]);

  const createSquad = async () => {
    if (!squadName.trim() || !user) return;
    setCreating(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).single();
      const { data: newSquad, error } = await supabase.from('squads').insert({ name: squadName.trim(), created_by: user.id }).select().single();
      if (error) throw error;
      await supabase.from('squad_members').insert({ squad_id: newSquad.id, user_id: user.id, display_name: profile?.display_name || 'You' });
      await supabase.from('squad_activity').insert({ squad_id: newSquad.id, user_id: user.id, activity_type: 'created_squad', description: `Created the squad "${squadName.trim()}"` });
      queryClient.invalidateQueries({ queryKey: ['my-squad-membership'] });
      toast.success('Squad created! Share the invite code with your friends.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create squad');
    }
    setCreating(false);
  };

  const joinSquad = async () => {
    if (!joinCode.trim() || !user) return;
    setJoining(true);
    try {
      const { data: squads } = await supabase.from('squads').select('*').eq('invite_code', joinCode.trim());
      if (!squads?.length) { toast.error('Invalid invite code'); setJoining(false); return; }
      const targetSquad = squads[0];
      const { data: existingMembers } = await supabase.from('squad_members').select('id').eq('squad_id', targetSquad.id);
      if ((existingMembers?.length || 0) >= MAX_MEMBERS) { toast.error(`This squad is full (max ${MAX_MEMBERS} members)`); setJoining(false); return; }
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).single();
      await supabase.from('squad_members').insert({ squad_id: targetSquad.id, user_id: user.id, display_name: profile?.display_name || 'Student' });
      await supabase.from('squad_activity').insert({ squad_id: targetSquad.id, user_id: user.id, activity_type: 'joined', description: `${profile?.display_name || 'A student'} joined the squad!` });
      queryClient.invalidateQueries({ queryKey: ['my-squad-membership'] });
      toast.success(`Joined "${targetSquad.name}"!`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to join squad');
    }
    setJoining(false);
  };

  const leaveSquad = async () => {
    if (!squadId || !user) return;
    await supabase.from('squad_members').delete().eq('squad_id', squadId).eq('user_id', user.id);
    queryClient.invalidateQueries({ queryKey: ['my-squad-membership'] });
    toast.success('Left the squad');
  };

  const copyInviteCode = () => {
    if (!squad?.invite_code) return;
    navigator.clipboard.writeText(squad.invite_code);
    setCopied(true);
    toast.success('Invite code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const colors = ['#2dd4bf', '#a855f7', '#fbbf24', '#60a5fa', '#f472b6', '#34d399', '#fb923c', '#818cf8', '#e879f9', '#38bdf8', '#a3e635', '#f87171'];

  // ── No Squad View ──
  if (!squad) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Study Squads</h1>
          <p className="text-muted-foreground">Team up with friends. Share AI tools. Learn together.</p>
          <p className="text-xs text-muted-foreground/60">Max {MAX_MEMBERS} members per squad</p>
        </motion.div>

        <div className="flex gap-2 justify-center">
          <button onClick={() => setTab('create')} className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${tab === 'create' ? 'bg-primary/15 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground'}`}>
            <Plus className="w-4 h-4 inline mr-1.5" />Create Squad
          </button>
          <button onClick={() => setTab('join')} className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${tab === 'join' ? 'bg-primary/15 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground'}`}>
            <UserPlus className="w-4 h-4 inline mr-1.5" />Join Squad
          </button>
        </div>

        <AnimatePresence mode="wait">
          {tab === 'create' ? (
            <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <Card className="border-border/20 bg-card/50">
                <CardContent className="p-6 space-y-4">
                  <Input
                    placeholder="Squad name (e.g. Physics Legends)"
                    value={squadName}
                    onChange={e => setSquadName(e.target.value)}
                    className="h-12 text-sm bg-muted/20 rounded-xl"
                    onKeyDown={e => e.key === 'Enter' && createSquad()}
                  />
                  <Button onClick={createSquad} disabled={creating || !squadName.trim()} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold">
                    {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Create Squad
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="join" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <Card className="border-border/20 bg-card/50">
                <CardContent className="p-6 space-y-4">
                  <Input
                    placeholder="Enter invite code"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    className="h-12 text-sm bg-muted/20 rounded-xl font-mono tracking-wider"
                    onKeyDown={e => e.key === 'Enter' && joinSquad()}
                  />
                  <Button onClick={joinSquad} disabled={joining || !joinCode.trim()} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold">
                    {joining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                    Join Squad
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Squad Dashboard ──
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Users className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{squad.name}</h1>
            <p className="text-sm text-muted-foreground">{members.length}/{MAX_MEMBERS} members</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={leaveSquad} className="text-destructive hover:bg-destructive/10">
          <LogOut className="w-4 h-4 mr-1.5" /> Leave
        </Button>
      </motion.div>

      {/* Invite Code Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Hash className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Invite Code</p>
              <p className="font-mono text-lg font-bold text-primary tracking-widest">{squad.invite_code}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={copyInviteCode} className="rounded-xl border-primary/30 text-primary">
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Members */}
        <Card className="border-border/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Members</span>
            </div>
            <div className="space-y-2">
              {members.map((m: any, i: number) => (
                <div key={m.id} className="flex items-center gap-3 py-1.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs font-bold" style={{ background: `${colors[i % colors.length]}20`, color: colors[i % colors.length] }}>
                      {(m.display_name || '?')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-foreground flex-1">{m.display_name || 'Student'}</span>
                  {m.user_id === squad.created_by && (
                    <Crown className="w-4 h-4 text-warning" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="border-border/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-warning" />
              <span className="text-sm font-semibold text-foreground">Live Activity</span>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {activity.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 py-4 text-center">No activity yet. Start studying!</p>
              ) : activity.map((a: any) => (
                <div key={a.id} className="flex items-start gap-2 py-1.5 border-b border-border/10 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-foreground/80">{a.description}</p>
                    <p className="text-[10px] text-muted-foreground/40">{new Date(a.created_at).toLocaleTimeString()}</p>
                  </div>
                  {a.xp_earned > 0 && (
                    <span className="text-[10px] text-primary font-bold ml-auto">+{a.xp_earned} XP</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shared Tools Info */}
      <Card className="border-border/20 bg-gradient-to-r from-primary/5 to-purple-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Shared AI Tools</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            All AI-generated content (notes, flashcards, chats) created by squad members is shared with the entire squad.
            When a member generates notes or uses AI Chat, everyone can access those results.
          </p>
          <div className="flex flex-wrap gap-2">
            {['AI Chat', 'Notes', 'Flashcards', 'Tests', 'Quick Study'].map(tool => (
              <span key={tool} className="px-3 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                {tool}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Squad;
