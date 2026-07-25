import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bot, Brain, GitBranch, Lightbulb } from 'lucide-react';

const nodeTypes = [
  { label: 'Agents', icon: Bot, count: 128, color: '#06b6d4' },
  { label: 'Knowledge', icon: Brain, count: '2.4M', color: '#8b5cf6' },
  { label: 'Workflows', icon: GitBranch, count: '15K', color: '#10b981' },
  { label: 'Insights', icon: Lightbulb, count: '89K', color: '#f59e0b' },
];

export const NetworkSection = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = 800;
    let h = canvas.height = 600;
    let time = 0;

    const clusters = [
      { x: w * 0.2, y: h * 0.3, color: '45, 212, 191', nodes: 12 },
      { x: w * 0.8, y: h * 0.25, color: '139, 92, 246', nodes: 10 },
      { x: w * 0.3, y: h * 0.7, color: '16, 185, 129', nodes: 8 },
      { x: w * 0.7, y: h * 0.75, color: '245, 158, 11', nodes: 10 },
      { x: w * 0.5, y: h * 0.5, color: '236, 72, 153', nodes: 15 },
    ];

    const nodes: { x: number; y: number; cluster: number; phase: number; connections: number[]; size: number }[] = [];
    clusters.forEach((cluster, ci) => {
      for (let i = 0; i < cluster.nodes; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 60;
        nodes.push({
          x: cluster.x + Math.cos(angle) * radius,
          y: cluster.y + Math.sin(angle) * radius,
          cluster: ci,
          phase: Math.random() * Math.PI * 2,
          connections: [],
          size: 2 + Math.random() * 3,
        });
      }
    });

      nodes.forEach((n, i) => {
        const numConns = 1 + Math.floor(Math.random() * 3);
        for (let c = 0; c < numConns; c++) {
          const j = Math.floor(Math.random() * nodes.length);
          if (j !== i && !n.connections.includes(j)) n.connections.push(j);
      }
    });

    let animId: number;
    const draw = () => {
      time += 0.003;
      ctx.clearRect(0, 0, w, h);

      nodes.forEach((n) => {
        const cluster = clusters[n.cluster];
        const pulseX = Math.sin(time * 1.5 + n.phase) * 5;
        const pulseY = Math.cos(time * 1.2 + n.phase) * 5;
        const px = n.x + pulseX;
        const py = n.y + pulseY;

        n.connections.forEach((j) => {
          const other = nodes[j];
          const oCluster = clusters[other.cluster];
          const ox = other.x + Math.sin(time * 1.5 + other.phase) * 5;
          const oy = other.y + Math.cos(time * 1.2 + other.phase) * 5;

          const dist = Math.sqrt((ox - px) ** 2 + (oy - py) ** 2);
          if (dist > 300) return;

          const alpha = Math.max(0, 1 - dist / 300) * 0.3;
          ctx.beginPath();
          ctx.moveTo(px, py);
          const cpx = (px + ox) / 2 + Math.sin(time + n.phase) * 20;
          const cpy = (py + oy) / 2 + Math.cos(time + other.phase) * 20;
          ctx.quadraticCurveTo(cpx, cpy, ox, oy);
          ctx.strokeStyle = `rgba(${cluster.color}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        const glow = ctx.createRadialGradient(px, py, 0, px, py, n.size * 4);
        glow.addColorStop(0, `rgba(${cluster.color}, 0.3)`);
        glow.addColorStop(1, `rgba(${cluster.color}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, n.size * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, n.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cluster.color}, 0.8)`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = canvas.width = rect.width;
      h = canvas.height = rect.height;
    };
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section id="network" className="relative py-24 md:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            The{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Intelligence</span>{' '}
            Network
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Observe the living neural network of agents, knowledge, and workflows powering every interaction.
          </p>
        </motion.div>

        <div className="liquid-glass-elevated rounded-3xl p-4 md:p-6">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="w-full h-[400px] md:h-[500px] rounded-2xl"
            />
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-3">
              {nodeTypes.map((type) => (
                <div
                  key={type.label}
                  className="liquid-glass rounded-xl px-3 py-2 flex items-center gap-2"
                >
                  <type.icon className="w-3.5 h-3.5" style={{ color: type.color }} />
                  <span className="text-xs text-white/60">{type.label}</span>
                  <span className="text-xs font-bold text-white">{type.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
