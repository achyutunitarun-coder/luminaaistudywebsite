import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Copy, Plus, Loader2, Trophy, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const Squad = () => {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [squadName, setSquadName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Get user's squad
  const { data: membership, refetch } = useQuery({
    queryKey: ['squad-membership', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('squad_members')
        .select('*, squads(*)')
        .eq('user_id', user!.id)
        .limit(1) as any;
      return data?.[0] || null;
    },
    enabled: !!user,
  });

  const squad = membership?.squads;

  const { data: members } = useQuery({
    queryKey: ['squad-members', squad?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('squad_members')
        .select('*')
        .eq('squad_id', squad.id) as any;
      return data || [];
    },
    enabled: !!squad?.id,
  });

  const { data: activity } = useQuery({
    queryKey: ['squad-activity', squad?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('squad_activity')
        .select('*')
        .eq('squad_id', squad.id)
        .order('created_at', { ascending: false })
        .limit(20) as any;
      return data || [];
    },
    enabled: !!squad?.id,
  });

  // Realtime activity
  useEffect(() => {
    if (!squad?.id) return;
    const channel = supabase
      .channel('squad-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'squad_activity', filter: `squad_id=eq.${squad.id}` }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [squad?.id, refetch]);

  const createSquad = async () => {
    if (!squadName.trim() || !user) return;
    setCreating(true);
    try {
      const { data: newSquad } = await supabase.from('squads').insert({
        name: squadName.trim(), created_by: user.id,
      } as any).select().single();

      if (newSquad) {
        await supabase.from('squad_members').insert({
          squad_id: newSquad.id, user_id: user.id, display_name: user.user_metadata?.full_name || 'Student',
        } as any);
        toast.success('Squad created!');
        refetch();
      }
    } catch {
      toast.error('Failed to create squad');
    } finally {
      setCreating(false);
    }
  };

  const joinSquad = async () => {
    if (!joinCode.trim() || !user) return;
    setJoining(true);
    try {
      const { data: squad } = await supabase
        .from('squads')
        .select('id')
        .eq('invite_code', joinCode.trim())
        .single() as any;

      if (!squad) { toast.error('Invalid invite code'); return; }

      // Check member count
      const { count } = await supabase.from('squad_members').select('*', { count: 'exact', head: true }).eq('squad_id', squad.id);
      if ((count || 0) >= 6) { toast.error('Squad is full (max 6)'); return; }

      await supabase.from('squad_members').insert({
        squad_id: squad.id, user_id: user.id, display_name: user.user_metadata?.full_name || 'Student',
      } as any);

      toast.success('Joined squad!');
      refetch();
    } catch {
      toast.error('Failed to join');
    } finally {
      setJoining(false);
    }
  };

  // Empty state - no squad
  if (!squad) {
    return (
      <div className="max-w-md mx-auto py-16 space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
          <h1 className="text-2xl font-display font-bold text-foreground">Study Squad</h1>
          <p className="text-sm text-muted-foreground mt-2">Study together, stay accountable. Max 6 members.</p>
        </motion.div>

        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: 'hsl(230 20% 11% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.05)' }}>
            <h3 className="text-sm font-semibold text-foreground mb-3">Create a Squad</h3>
            <Input value={squadName} onChange={e => setSquadName(e.target.value)} placeholder="Squad name..."
              className="bg-background/50 border-border/20 rounded-xl mb-2" />
            <Button onClick={createSquad} disabled={creating || !squadName.trim()} className="w-full gradient-primary text-primary-foreground rounded-xl">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Create</>}
            </Button>
          </div>

          <div className="rounded-2xl p-5" style={{ background: 'hsl(230 20% 11% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.05)' }}>
            <h3 className="text-sm font-semibold text-foreground mb-3">Join with Code</h3>
            <Input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter invite code..."
              className="bg-background/50 border-border/20 rounded-xl mb-2" />
            <Button onClick={joinSquad} disabled={joining || !joinCode.trim()} variant="outline" className="w-full rounded-xl">
              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join Squad'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Squad view
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">{squad.name}</h1>
              <p className="text-xs text-muted-foreground">{members?.length || 0} members</p>
            </div>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(squad.invite_code); toast.success('Code copied!'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/15 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Copy className="w-3 h-3" /> {squad.invite_code}
          </button>
        </div>
      </motion.div>

      {/* Members */}
      <div className="rounded-2xl p-5" style={{ background: 'hsl(230 20% 11% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.05)' }}>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-warning" /> This Week
        </h2>
        <div className="space-y-2">
          {members?.map((m: any, i: number) => (
            <div key={m.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${m.user_id === user?.id ? 'bg-primary/8 border border-primary/15' : ''}`}>
              <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary-foreground">{(m.display_name || 'S')[0]}</span>
              </div>
              <span className="text-sm text-foreground flex-1">{m.display_name || 'Student'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="rounded-2xl p-5" style={{ background: 'hsl(230 20% 11% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.05)' }}>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> Activity
        </h2>
        {activity?.length ? (
          <div className="space-y-2">
            {activity.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 py-2">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="w-3 h-3 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-foreground">{a.description}</p>
                  {a.xp_earned > 0 && <span className="text-[10px] text-primary">+{a.xp_earned} XP</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No activity yet. Start studying!</p>
        )}
      </div>
    </div>
  );
};

export default Squad;
