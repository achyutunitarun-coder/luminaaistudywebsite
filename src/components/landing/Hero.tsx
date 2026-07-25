import { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';

function useMousePosition() {
  const ref = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      ref.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, []);
  return ref;
}

const ParticleField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useMousePosition();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = {
      w: canvas.width = window.innerWidth,
      h: canvas.height = window.innerHeight,
    };
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];
    const count = 80;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * size.w,
        y: Math.random() * size.h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, size.w, size.h);
      const mx = mouse.current.x;
      const my = mouse.current.y;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = size.w;
        if (p.x > size.w) p.x = 0;
        if (p.y < 0) p.y = size.h;
        if (p.y > size.h) p.y = 0;

        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mx, my);
          ctx.strokeStyle = `rgba(45, 212, 191, ${0.08 * (1 - dist / 200)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.fill();
      });

      particles.forEach((a, i) => {
        for (let j2 = i + 1; j2 < particles.length; j2++) {
          const b = particles[j2];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(45, 212, 191, ${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    const resize = () => {
      size.w = canvas.width = window.innerWidth;
      size.h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [mouse]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
    />
  );
};

const AuroraBackground = () => (
  <div className="absolute inset-0 overflow-hidden">
    <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-cyan-500/20 via-transparent to-transparent blur-[120px]" />
    <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tl from-violet-500/20 via-transparent to-transparent blur-[120px]" />
    <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-gradient-to-r from-cyan-400/10 to-violet-400/10 blur-[100px]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(45,212,191,0.03)_0%,_transparent_70%)]" />
    <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
  </div>
);

const GridBackground = () => (
  <div className="absolute inset-0 z-[2] pointer-events-none overflow-hidden opacity-[0.04]">
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  </div>
);

const BrainVisualization = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useMousePosition();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = 400;
    const h = canvas.height = 400;
    let time = 0;

    const nodes: { x: number; y: number; phase: number; connections: number[] }[] = [];
    const numNodes = 30;

    for (let i = 0; i < numNodes; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 40 + Math.random() * 120;
      nodes.push({
        x: w / 2 + Math.cos(angle) * radius,
        y: h / 2 + Math.sin(angle) * radius,
        phase: Math.random() * Math.PI * 2,
        connections: [],
      });
    }

    nodes.forEach((n, i) => {
      const numConns = 2 + Math.floor(Math.random() * 3);
      for (let c = 0; c < numConns; c++) {
        const j = Math.floor(Math.random() * numNodes);
        if (j !== i && !n.connections.includes(j)) n.connections.push(j);
      }
    });

    const centralX = w / 2;
    const centralY = h / 2;

    let animId: number;
    const draw = () => {
      time += 0.005;
      ctx.clearRect(0, 0, w, h);

      const mx = mouse.current.x;
      const my = mouse.current.y;
      const mouseFactor = 0.03;

      nodes.forEach((n, i) => {
        const baseX = w / 2 + (n.x - w / 2);
        const baseY = h / 2 + (n.y - h / 2);
        const pulseX = Math.sin(time * 1.5 + n.phase) * 8;
        const pulseY = Math.cos(time * 1.2 + n.phase) * 8;

        const dx = (mx - window.innerWidth / 2) * mouseFactor;
        const dy = (my - window.innerHeight / 2) * mouseFactor;

        const px = baseX + pulseX + dx;
        const py = baseY + pulseY + dy;

        n.connections.forEach((j) => {
          const other = nodes[j];
          const ox = w / 2 + (other.x - w / 2) + Math.sin(time * 1.5 + other.phase) * 8 + (mouse.current.x - window.innerWidth / 2) * mouseFactor;
          const oy = h / 2 + (other.y - h / 2) + Math.cos(time * 1.2 + other.phase) * 8 + (mouse.current.y - window.innerHeight / 2) * mouseFactor;

          const dist = Math.sqrt((ox - px) ** 2 + (oy - py) ** 2);
          const alpha = Math.max(0, 1 - dist / 200) * 0.4;

          const gradient = ctx.createLinearGradient(px, py, ox, oy);
          gradient.addColorStop(0, `rgba(45, 212, 191, ${alpha})`);
          gradient.addColorStop(1, `rgba(168, 85, 247, ${alpha})`);

          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(ox, oy);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          const dataFlow = (time * 60 + i + j) % 60;
          if (dataFlow < 1) {
            const t = dataFlow;
            const fx = px + (ox - px) * t;
            const fy = py + (oy - py) * t;
            ctx.beginPath();
            ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(45, 212, 191, 0.8)`;
            ctx.fill();
          }
        });

        const nodeDist = Math.sqrt((mx - px - window.innerWidth / 2 + w / 2) ** 2 + (my - py - window.innerHeight / 2 + h / 2) ** 2);
        const hoverGlow = Math.max(0, 1 - nodeDist / 150) * 0.5;

        const gradient = ctx.createRadialGradient(px, py, 0, px, py, 15);
        gradient.addColorStop(0, `rgba(45, 212, 191, ${0.6 + hoverGlow})`);
        gradient.addColorStop(1, 'rgba(45, 212, 191, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + hoverGlow})`;
        ctx.fill();
      });

      const corePulse = 0.5 + Math.sin(time * 2) * 0.2;
      const coreGrad = ctx.createRadialGradient(centralX, centralY, 0, centralX, centralY, 60);
      coreGrad.addColorStop(0, `rgba(45, 212, 191, ${0.15 * corePulse})`);
      coreGrad.addColorStop(0.5, `rgba(168, 85, 247, ${0.1 * corePulse})`);
      coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centralX, centralY, 60, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [mouse]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      className="w-[320px] h-[320px] md:w-[400px] md:h-[400px]"
    />
  );
};

const metrics = [
  { value: '10M+', label: 'Tasks Completed' },
  { value: '99.9%', label: 'Accuracy' },
  { value: '120+', label: 'Countries' },
  { value: '5x', label: 'Productivity' },
];

export const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      <AuroraBackground />
      <GridBackground />
      <ParticleField />

      <div className="relative z-20 max-w-6xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Introducing Lumina 2.0
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.05] tracking-tight mb-6"
        >
          Intelligence That{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400">
            Doesn't Just Think.
          </span>
          <br />
          <span className="text-white/90">It Acts.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Lumina researches, analyzes, plans, creates, and executes tasks through autonomous AI agents working together.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          <Button
            onClick={() => navigate('/auth')}
            className="group rounded-2xl px-8 py-6 text-base font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white shadow-2xl shadow-cyan-500/25 border-0 transition-all duration-300 hover:scale-[1.02]"
          >
            Start Building
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl px-8 py-6 text-base font-semibold border-white/10 text-white/80 hover:bg-white/5 hover:text-white"
          >
            <Play className="w-5 h-5 mr-2" />
            Watch Demo
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="text-sm text-white/30 mb-12"
        >
          Trusted by founders, researchers, students, and teams worldwide.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
        >
          {metrics.map((m) => (
            <div key={m.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-white mb-1">{m.value}</div>
              <div className="text-xs text-white/40">{m.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
      >
        <div className="w-6 h-10 rounded-full border border-white/10 flex items-start justify-center p-1.5">
          <div className="w-1 h-3 rounded-full bg-white/30 animate-bounce" />
        </div>
      </motion.div>
    </section>
  );
};
