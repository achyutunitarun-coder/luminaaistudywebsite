import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type FlowNode = {
  id: string;
  label: string;
  description?: string;
  type?: 'start' | 'process' | 'decision' | 'end' | 'milestone';
  status?: 'completed' | 'active' | 'upcoming' | 'locked';
  icon?: React.ReactNode;
  color?: string;
  x?: number;
  y?: number;
};

export type FlowEdge = {
  from: string;
  to: string;
  label?: string;
  animated?: boolean;
};

type FlowChartProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction?: 'horizontal' | 'vertical';
  onNodeClick?: (node: FlowNode) => void;
  className?: string;
  interactive?: boolean;
};

const NODE_W = 180;
const NODE_H = 72;
const GAP_X = 80;
const GAP_Y = 100;

const statusColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  completed: {
    bg: 'hsl(142 71% 45% / 0.12)',
    border: 'hsl(142 71% 45% / 0.35)',
    text: 'hsl(142 71% 45%)',
    glow: '0 0 20px hsl(142 71% 45% / 0.2)',
  },
  active: {
    bg: 'hsl(174 72% 56% / 0.12)',
    border: 'hsl(174 72% 56% / 0.4)',
    text: 'hsl(174 72% 56%)',
    glow: '0 0 24px hsl(174 72% 56% / 0.25)',
  },
  upcoming: {
    bg: 'hsl(230 20% 14% / 0.5)',
    border: 'hsl(0 0% 100% / 0.08)',
    text: 'hsl(215 16% 52%)',
    glow: 'none',
  },
  locked: {
    bg: 'hsl(230 20% 12% / 0.3)',
    border: 'hsl(0 0% 100% / 0.04)',
    text: 'hsl(215 16% 35%)',
    glow: 'none',
  },
};

const typeShapes: Record<string, string> = {
  start: '50%',
  end: '50%',
  decision: '12px',
  process: '16px',
  milestone: '20px',
};

function autoLayout(nodes: FlowNode[], edges: FlowEdge[], direction: 'horizontal' | 'vertical'): FlowNode[] {
  if (nodes.every(n => n.x !== undefined && n.y !== undefined)) return nodes;

  // Simple topological layout
  const adj: Record<string, string[]> = {};
  const inDeg: Record<string, number> = {};
  nodes.forEach(n => { adj[n.id] = []; inDeg[n.id] = 0; });
  edges.forEach(e => {
    adj[e.from]?.push(e.to);
    inDeg[e.to] = (inDeg[e.to] || 0) + 1;
  });

  const levels: string[][] = [];
  let queue = nodes.filter(n => (inDeg[n.id] || 0) === 0).map(n => n.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    levels.push([...queue]);
    queue.forEach(id => visited.add(id));
    const next: string[] = [];
    queue.forEach(id => {
      adj[id]?.forEach(child => {
        if (!visited.has(child)) {
          inDeg[child]--;
          if (inDeg[child] <= 0 && !next.includes(child)) next.push(child);
        }
      });
    });
    queue = next;
  }

  // Add any unvisited nodes
  nodes.forEach(n => {
    if (!visited.has(n.id)) levels.push([n.id]);
  });

  const positioned = new Map<string, { x: number; y: number }>();
  levels.forEach((level, li) => {
    level.forEach((id, ni) => {
      const offset = (level.length - 1) / 2;
      if (direction === 'horizontal') {
        positioned.set(id, { x: li * (NODE_W + GAP_X), y: (ni - offset) * (NODE_H + GAP_Y) });
      } else {
        positioned.set(id, { x: (ni - offset) * (NODE_W + GAP_X), y: li * (NODE_H + GAP_Y) });
      }
    });
  });

  return nodes.map(n => ({
    ...n,
    x: positioned.get(n.id)?.x ?? 0,
    y: positioned.get(n.id)?.y ?? 0,
  }));
}

export const FlowChart = ({ nodes, edges, direction = 'vertical', onNodeClick, className = '', interactive = true }: FlowChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const layoutNodes = autoLayout(nodes, edges, direction);

  // Center the chart initially
  useEffect(() => {
    if (!containerRef.current || layoutNodes.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const minX = Math.min(...layoutNodes.map(n => n.x ?? 0));
    const maxX = Math.max(...layoutNodes.map(n => (n.x ?? 0) + NODE_W));
    const minY = Math.min(...layoutNodes.map(n => n.y ?? 0));
    const maxY = Math.max(...layoutNodes.map(n => (n.y ?? 0) + NODE_H));
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    setPan({
      x: (rect.width - contentW) / 2 - minX,
      y: (rect.height - contentH) / 2 - minY + 20,
    });
  }, [layoutNodes.length]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(2, Math.max(0.3, z * delta)));
  }, [interactive]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!interactive || e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [interactive, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const getNodeCenter = (node: FlowNode) => ({
    x: (node.x ?? 0) + NODE_W / 2,
    y: (node.y ?? 0) + NODE_H / 2,
  });

  const renderEdge = (edge: FlowEdge, i: number) => {
    const fromNode = layoutNodes.find(n => n.id === edge.from);
    const toNode = layoutNodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return null;

    const from = getNodeCenter(fromNode);
    const to = getNodeCenter(toNode);

    // Bezier curve
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const cx1 = from.x + dx * 0.4;
    const cy1 = from.y;
    const cx2 = to.x - dx * 0.4;
    const cy2 = to.y;

    const isActive = fromNode.status === 'completed' || fromNode.status === 'active';
    const pathD = `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`;

    return (
      <g key={`edge-${i}`}>
        <defs>
          {edge.animated && (
            <linearGradient id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(174 72% 56%)" stopOpacity="0.6">
                <animate attributeName="stopOpacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="hsl(264 67% 60%)" stopOpacity="0.6">
                <animate attributeName="stopOpacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
          )}
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke={edge.animated ? `url(#grad-${i})` : isActive ? 'hsl(174 72% 56% / 0.35)' : 'hsl(0 0% 100% / 0.06)'}
          strokeWidth={isActive ? 2.5 : 1.5}
          strokeDasharray={isActive ? 'none' : '6 4'}
        />
        {/* Arrow */}
        <circle cx={to.x} cy={to.y} r={3} fill={isActive ? 'hsl(174 72% 56% / 0.5)' : 'hsl(0 0% 100% / 0.1)'} />
        {edge.label && (
          <text
            x={(from.x + to.x) / 2}
            y={(from.y + to.y) / 2 - 8}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {edge.label}
          </text>
        )}
      </g>
    );
  };

  const renderNode = (node: FlowNode) => {
    const status = statusColors[node.status || 'upcoming'];
    const borderRadius = typeShapes[node.type || 'process'];
    const isHovered = hoveredNode === node.id;
    const isSelected = selectedNode === node.id;

    return (
      <motion.g
        key={node.id}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <foreignObject
          x={node.x ?? 0}
          y={node.y ?? 0}
          width={NODE_W}
          height={NODE_H}
          className="overflow-visible"
        >
          <div
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedNode(node.id === selectedNode ? null : node.id);
              onNodeClick?.(node);
            }}
            style={{
              background: status.bg,
              borderColor: isHovered || isSelected ? status.text : status.border,
              boxShadow: isHovered || isSelected ? status.glow : 'none',
              borderRadius,
              backdropFilter: 'blur(16px)',
            }}
            className={`w-full h-full border px-4 py-3 cursor-pointer transition-all duration-300 flex flex-col justify-center ${
              interactive ? 'hover:scale-[1.03]' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              {node.icon && <span className="flex-shrink-0">{node.icon}</span>}
              <span
                className="text-xs font-semibold truncate"
                style={{ color: status.text }}
              >
                {node.label}
              </span>
            </div>
            {node.description && (
              <p className="text-[10px] mt-1 opacity-60 truncate" style={{ color: status.text }}>
                {node.description}
              </p>
            )}
            {node.status === 'active' && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse" />
            )}
          </div>
        </foreignObject>
      </motion.g>
    );
  };

  return (
    <div className={`relative rounded-2xl liquid-glass overflow-hidden ${className}`}>
      {/* Zoom Controls */}
      {interactive && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 rounded-lg liquid-glass-subtle"
            onClick={() => setZoom(z => Math.min(2, z * 1.2))}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 rounded-lg liquid-glass-subtle"
            onClick={() => setZoom(z => Math.max(0.3, z * 0.8))}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 rounded-lg liquid-glass-subtle"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full min-h-[300px] cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width="100%"
          height="100%"
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Edges first (behind nodes) */}
          {edges.map((edge, i) => renderEdge(edge, i))}
          {/* Nodes */}
          {layoutNodes.map(renderNode)}
        </svg>
      </div>

      {/* Node Detail Popup */}
      <AnimatePresence>
        {selectedNode && (() => {
          const node = layoutNodes.find(n => n.id === selectedNode);
          if (!node) return null;
          const status = statusColors[node.status || 'upcoming'];
          return (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-3 left-3 right-3 z-10 liquid-glass-intense rounded-xl p-4"
            >
              <div className="relative z-10 flex items-start gap-3">
                {node.icon && <span className="mt-0.5">{node.icon}</span>}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold" style={{ color: status.text }}>{node.label}</h4>
                  {node.description && (
                    <p className="text-xs text-muted-foreground mt-1">{node.description}</p>
                  )}
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: status.bg, color: status.text, border: `1px solid ${status.border}` }}>
                    {node.status || 'upcoming'}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};