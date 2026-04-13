import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Network, Search, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const MASTERY_COLORS = [
  { min: 75, color: '#34d399', label: 'Mastered' },
  { min: 50, color: '#2dd4bf', label: 'Strong' },
  { min: 25, color: '#fbbf24', label: 'Learning' },
  { min: 0, color: '#f87171', label: 'Explore' },
];

function getMasteryInfo(pct: number) {
  return MASTERY_COLORS.find(c => pct >= c.min) || MASTERY_COLORS[3];
}

const ConceptMap = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [showWeakOnly, setShowWeakOnly] = useState(false);

  const { data: nodes, isLoading } = useQuery({
    queryKey: ['concept-nodes', user?.id],
    queryFn: async () => {
      const { data: concepts } = await supabase
        .from('concept_nodes')
        .select('*')
        .limit(200) as any;

      if (!concepts?.length) return [];

      const { data: mastery } = await supabase
        .from('user_concept_mastery')
        .select('concept_id, mastery_pct, last_tested')
        .eq('user_id', user!.id) as any;

      const masteryMap: Record<string, any> = {};
      mastery?.forEach((m: any) => { masteryMap[m.concept_id] = m; });

      return concepts.map((c: any) => ({
        ...c,
        mastery: masteryMap[c.id]?.mastery_pct || 0,
        lastTested: masteryMap[c.id]?.last_tested,
      }));
    },
    enabled: !!user,
  });

  const filteredNodes = useMemo(() => {
    if (!nodes) return [];
    let filtered = nodes;
    if (showWeakOnly) filtered = filtered.filter((n: any) => n.mastery < 75);
    if (search) filtered = filtered.filter((n: any) => n.concept?.toLowerCase().includes(search.toLowerCase()));
    return filtered;
  }, [nodes, showWeakOnly, search]);

  const subjects = useMemo(() => {
    if (!nodes) return [];
    return [...new Set(nodes.map((n: any) => n.subject).filter(Boolean))];
  }, [nodes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/30 to-primary/20 flex items-center justify-center">
            <Network className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Concept Map</h1>
            <p className="text-sm text-muted-foreground">{nodes?.length || 0} concepts mapped</p>
          </div>
        </div>
      </motion.div>

      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search concepts..."
            className="pl-9 bg-background/50 border-border/20 rounded-xl" />
        </div>
        <Button variant={showWeakOnly ? 'default' : 'outline'} onClick={() => setShowWeakOnly(!showWeakOnly)}
          className="rounded-xl text-xs">
          {showWeakOnly ? 'Showing Weak' : 'Show Weak Only'}
        </Button>
      </div>

      {/* Legend */}
      <div className="flex gap-4">
        {MASTERY_COLORS.map(c => (
          <div key={c.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
            <span className="text-[10px] text-muted-foreground">{c.label}</span>
          </div>
        ))}
      </div>

      {filteredNodes.length === 0 ? (
        <div className="text-center py-16">
          <Network className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            {nodes?.length === 0 ? 'No concept data yet. Take tests to build your concept map.' : 'No concepts match your filter.'}
          </p>
        </div>
      ) : (
        <>
          {/* Grid view of concepts */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredNodes.map((node: any, i: number) => {
              const info = getMasteryInfo(node.mastery);
              return (
                <motion.div key={node.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                  className={`rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] ${selectedNode?.id === node.id ? 'ring-2 ring-primary' : ''}`}
                  style={{
                    background: 'hsl(230 20% 11% / 0.5)',
                    border: `1px solid ${info.color}30`,
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: info.color }} />
                    <span className="text-[10px] font-bold" style={{ color: info.color }}>{Math.round(node.mastery)}%</span>
                  </div>
                  <p className="text-xs font-medium text-foreground leading-tight">{node.concept}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{node.subject} · {node.chapter}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Selected node detail */}
          {selectedNode && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-6"
              style={{ background: 'hsl(230 20% 11% / 0.5)', border: '1px solid hsl(174 72% 56% / 0.15)' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedNode.concept}</h3>
                  <p className="text-xs text-muted-foreground">{selectedNode.subject} · {selectedNode.chapter}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: getMasteryInfo(selectedNode.mastery).color }}>{Math.round(selectedNode.mastery)}%</p>
                  <p className="text-[10px] text-muted-foreground">{getMasteryInfo(selectedNode.mastery).label}</p>
                </div>
              </div>
              {selectedNode.description && <p className="text-sm text-muted-foreground mb-4">{selectedNode.description}</p>}
              <div className="flex gap-2">
                <Button onClick={() => window.location.href = `/chat?topic=${selectedNode.concept}`} size="sm" className="gradient-primary text-primary-foreground rounded-xl text-xs">
                  Study this
                </Button>
                <Button onClick={() => window.location.href = '/tests'} size="sm" variant="outline" className="rounded-xl text-xs">
                  Practice questions
                </Button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
};

export default ConceptMap;
