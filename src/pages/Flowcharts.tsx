import { useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Plus, Trash2, Play, CheckCircle2, Lock, Zap, BookOpen, Target, Brain } from 'lucide-react';
import { FlowChart, type FlowNode, type FlowEdge } from '@/components/FlowChart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ease = [0.25, 0.1, 0.25, 1] as const;

const presetFlows = [
  {
    name: 'Math Mastery Path',
    nodes: [
      { id: '1', label: 'Algebra Basics', type: 'start' as const, status: 'completed' as const, icon: <BookOpen className="w-3.5 h-3.5" />, description: 'Equations & expressions' },
      { id: '2', label: 'Linear Equations', type: 'process' as const, status: 'completed' as const, icon: <Target className="w-3.5 h-3.5" />, description: 'Solve linear systems' },
      { id: '3', label: 'Quadratic Equations', type: 'process' as const, status: 'active' as const, icon: <Zap className="w-3.5 h-3.5" />, description: 'Factoring & formula' },
      { id: '4', label: 'Polynomials', type: 'process' as const, status: 'upcoming' as const, icon: <Brain className="w-3.5 h-3.5" />, description: 'Higher degree polynomials' },
      { id: '5', label: 'Calculus Intro', type: 'milestone' as const, status: 'locked' as const, icon: <Lock className="w-3.5 h-3.5" />, description: 'Limits & derivatives' },
      { id: '6', label: 'Mastery Test', type: 'end' as const, status: 'locked' as const, icon: <CheckCircle2 className="w-3.5 h-3.5" />, description: 'Final assessment' },
    ],
    edges: [
      { from: '1', to: '2', animated: true },
      { from: '2', to: '3', animated: true },
      { from: '3', to: '4' },
      { from: '4', to: '5' },
      { from: '5', to: '6' },
    ],
  },
  {
    name: 'Science Study Flow',
    nodes: [
      { id: 's1', label: 'Physics Basics', type: 'start' as const, status: 'completed' as const, icon: <BookOpen className="w-3.5 h-3.5" /> },
      { id: 's2', label: 'Chemistry Fundamentals', type: 'start' as const, status: 'active' as const, icon: <BookOpen className="w-3.5 h-3.5" /> },
      { id: 's3', label: 'Mechanics', type: 'process' as const, status: 'upcoming' as const, icon: <Target className="w-3.5 h-3.5" /> },
      { id: 's4', label: 'Organic Chemistry', type: 'process' as const, status: 'upcoming' as const, icon: <Target className="w-3.5 h-3.5" /> },
      { id: 's5', label: 'Lab Practice', type: 'decision' as const, status: 'locked' as const, icon: <Zap className="w-3.5 h-3.5" />, description: 'Hands-on experiments' },
      { id: 's6', label: 'Final Review', type: 'end' as const, status: 'locked' as const, icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    ],
    edges: [
      { from: 's1', to: 's3', animated: true },
      { from: 's2', to: 's4', animated: true },
      { from: 's3', to: 's5' },
      { from: 's4', to: 's5' },
      { from: 's5', to: 's6' },
    ],
  },
];

const Flowcharts = () => {
  const [activePreset, setActivePreset] = useState(0);
  const [customNodes, setCustomNodes] = useState<FlowNode[]>([]);
  const [customEdges, setCustomEdges] = useState<FlowEdge[]>([]);
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);

  const addCustomNode = () => {
    if (!newNodeLabel.trim()) return;
    const id = `c${Date.now()}`;
    const newNode: FlowNode = {
      id,
      label: newNodeLabel.trim(),
      type: 'process',
      status: 'upcoming',
      icon: <Target className="w-3.5 h-3.5" />,
    };

    // Connect to last node
    const newEdges = [...customEdges];
    if (customNodes.length > 0) {
      newEdges.push({ from: customNodes[customNodes.length - 1].id, to: id });
    }

    setCustomNodes(prev => [...prev, newNode]);
    setCustomEdges(newEdges);
    setNewNodeLabel('');
  };

  const removeCustomNode = (id: string) => {
    setCustomNodes(prev => prev.filter(n => n.id !== id));
    setCustomEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
  };

  const toggleNodeStatus = (id: string) => {
    setCustomNodes(prev => prev.map(n => {
      if (n.id !== id) return n;
      const statusCycle: FlowNode['status'][] = ['upcoming', 'active', 'completed', 'locked'];
      const currentIdx = statusCycle.indexOf(n.status || 'upcoming');
      return { ...n, status: statusCycle[(currentIdx + 1) % statusCycle.length] };
    }));
  };

  const preset = presetFlows[activePreset];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-xl shadow-primary/20">
            <GitBranch className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Study Flowcharts</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Visualize your learning paths and track progress</p>
          </div>
        </div>
      </motion.div>

      {/* Preset Selector */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, ease }}>
        <div className="flex items-center gap-2 mb-4">
          {presetFlows.map((p, i) => (
            <Button
              key={i}
              variant={activePreset === i && !showCustom ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setActivePreset(i); setShowCustom(false); }}
              className={`rounded-xl text-xs ${activePreset === i && !showCustom ? 'gradient-primary text-primary-foreground' : 'liquid-glass-subtle border-none'}`}
            >
              {p.name}
            </Button>
          ))}
          <Button
            variant={showCustom ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowCustom(true)}
            className={`rounded-xl text-xs ${showCustom ? 'gradient-primary text-primary-foreground' : 'liquid-glass-subtle border-none'}`}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Custom
          </Button>
        </div>
      </motion.div>

      {/* Flowchart Display */}
      {!showCustom && (
        <motion.div
          key={activePreset}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease }}
        >
          <FlowChart
            nodes={preset.nodes}
            edges={preset.edges}
            direction="vertical"
            className="h-[500px]"
            onNodeClick={setSelectedNode}
          />
        </motion.div>
      )}

      {/* Custom Flowchart Builder */}
      {showCustom && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="rounded-2xl liquid-glass p-6">
            <div className="relative z-10">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">Build Your Study Path</h3>
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Add a study topic..."
                  value={newNodeLabel}
                  onChange={e => setNewNodeLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomNode()}
                  className="bg-muted/20 border-border/30 rounded-xl"
                />
                <Button onClick={addCustomNode} className="gradient-primary text-primary-foreground rounded-xl">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {customNodes.length > 0 && (
                <div className="space-y-2 mb-4">
                  {customNodes.map(node => (
                    <div key={node.id} className="flex items-center gap-2 liquid-glass-subtle rounded-xl px-4 py-2.5">
                      <button onClick={() => toggleNodeStatus(node.id)} className="flex-shrink-0">
                        {node.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        ) : node.status === 'active' ? (
                          <Play className="w-4 h-4 text-primary" />
                        ) : node.status === 'locked' ? (
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Target className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                      <span className="text-sm text-foreground flex-1">{node.label}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{node.status}</span>
                      <button onClick={() => removeCustomNode(node.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {customNodes.length >= 2 && (
            <FlowChart
              nodes={customNodes}
              edges={customEdges}
              direction="vertical"
              className="h-[400px]"
              onNodeClick={setSelectedNode}
            />
          )}

          {customNodes.length < 2 && (
            <div className="rounded-2xl liquid-glass-subtle p-12 text-center">
              <GitBranch className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Add at least 2 topics to generate a flowchart</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Legend */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="rounded-2xl liquid-glass-subtle p-4"
      >
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {[
            { status: 'completed', label: 'Completed', color: 'text-success' },
            { status: 'active', label: 'In Progress', color: 'text-primary' },
            { status: 'upcoming', label: 'Upcoming', color: 'text-muted-foreground' },
            { status: 'locked', label: 'Locked', color: 'text-muted-foreground/50' },
          ].map(item => (
            <div key={item.status} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full" style={{
                background: statusColors[item.status]?.bg,
                border: `1.5px solid ${statusColors[item.status]?.border}`,
              }} />
              <span className={item.color}>{item.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

const statusColors = {
  completed: { bg: 'hsl(142 71% 45% / 0.2)', border: 'hsl(142 71% 45% / 0.5)' },
  active: { bg: 'hsl(174 72% 56% / 0.2)', border: 'hsl(174 72% 56% / 0.5)' },
  upcoming: { bg: 'hsl(230 20% 14% / 0.5)', border: 'hsl(0 0% 100% / 0.1)' },
  locked: { bg: 'hsl(230 20% 12% / 0.3)', border: 'hsl(0 0% 100% / 0.05)' },
};

export default Flowcharts;