import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Sparkles, Brain, Wand2, BookOpen, Target,
  Zap, Layers, LineChart, Check, Star, Menu, X, ChevronDown,
  Play, Shield, Clock, Users, TrendingUp, Cpu, FileText,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   TOKENS — Deep cinematic palette
   ═══════════════════════════════════════════════════════════════ */
const C = {
  bg: '#050508',
  surface: '#0a0a10',
  surface2: '#0f0f18',
  line: 'rgba(255,255,255,0.05)',
  lineStrong: 'rgba(255,255,255,0.10)',
  ink: '#f0f0f5',
  ink2: '#c0c4d0',
  inkMute: '#888c9a',
  inkFaint: '#4a4e5a',
  teal: '#2dd4bf',
  violet: '#a855f7',
  amber: '#fbbf24',
  sky: '#38bdf8',
};

const ease = [0.16, 1, 0.3, 1] as const;

/* ═══════════════════════════════════════════════════════════════
   NAV
   ═══════════════════════════════════════════════════════════════ */
const Nav = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        backdropFilter: scrolled ? 'saturate(180%) blur(24px)' : 'none',
        background: scrolled ? 'rgba(5,5,8,0.80)' : 'transparent',
        borderBottom: scrolled ? `0.5px solid ${C.line}` : '0.5px solid transparent',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-[68px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center rounded-[10px]" style={{ width: 30, height: 30, background: `linear-gradient(135deg, ${C.teal}, ${C.violet})` }}>
            <Sparkles className="text-black" style={{ width: 15, height: 15 }} />
          </div>
          <span className="font-medium tracking-tight" style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: C.ink, lineHeight: 1 }}>Lumina</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-[13px]" style={{ color: C.inkMute }}>
          {['Features', 'How it works', 'Pricing', 'FAQ'].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="hover:text-white transition-colors">{item}</a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => navigate('/auth')} className="text-[13px] px-3 h-9 rounded-[8px] hover:bg-white/[0.06] transition-colors" style={{ color: C.ink, background: 'none', border: 'none', cursor: 'pointer' }}>Sign in</button>
          <button onClick={() => navigate('/auth')} className="inline-flex items-center justify-center gap-1.5 rounded-[10px] px-5 h-10 text-[13px] font-semibold transition-all hover:opacity-90 hover:translate-y-[-1px]" style={{ background: C.ink, color: C.bg, border: 'none', cursor: 'pointer', boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 8px 24px -8px rgba(45,212,191,0.35)' }}>
            Get started <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-md" style={{ color: C.ink, background: 'none', border: 'none', cursor: 'pointer' }}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="md:hidden border-t px-6 py-4 flex flex-col gap-3" style={{ borderColor: C.line, background: 'rgba(5,5,8,0.96)' }}>
            {['Features', 'How it works', 'Pricing', 'FAQ'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => setOpen(false)} className="text-[14px]" style={{ color: C.inkMute }}>{item}</a>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => navigate('/auth')} className="flex-1 h-10 rounded-[10px] text-[13px] font-medium" style={{ color: C.ink, border: `0.5px solid ${C.lineStrong}`, background: 'none', cursor: 'pointer' }}>Sign in</button>
              <button onClick={() => navigate('/auth')} className="flex-1 h-10 rounded-[10px] text-[13px] font-semibold" style={{ background: C.ink, color: C.bg, border: 'none', cursor: 'pointer' }}>Get started</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

/* ═══════════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════════ */
const Hero = () => {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.4]);

  return (
    <section ref={ref} className="relative pt-[160px] pb-[100px] overflow-hidden">
      {/* Aurora mesh */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[1200px] h-[700px] rounded-full opacity-[0.30] blur-[140px]" style={{ background: `radial-gradient(circle at 30% 50%, ${C.teal} 0%, transparent 60%), radial-gradient(circle at 70% 50%, ${C.violet} 0%, transparent 60%)` }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 0.5px, transparent 0.5px), linear-gradient(90deg, rgba(255,255,255,0.5) 0.5px, transparent 0.5px)', backgroundSize: '80px 80px', maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)' }} />
      </div>

      <motion.div style={{ y, opacity }} className="max-w-[1200px] mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-medium" style={{ color: C.inkMute, background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${C.lineStrong}`, letterSpacing: '0.04em' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.teal, boxShadow: `0 0 8px ${C.teal}` }} />
            Trusted by 12,000+ students across JEE, NEET, SAT, IB
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.05 }} className="mx-auto max-w-[960px] tracking-[-0.04em] leading-[1.0]" style={{ fontFamily: "'Instrument Serif', serif", fontSize: 'clamp(52px, 7.5vw, 96px)', color: C.ink, fontWeight: 400 }}>
          Stop reviewing.
          <br />
          <span style={{ background: `linear-gradient(110deg, ${C.teal} 0%, ${C.violet} 50%, ${C.amber} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontStyle: 'italic' }}>
            Start knowing.
          </span>
        </motion.h1>

        {/* Subhead */}
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.15 }} className="mx-auto mt-8 max-w-[580px] text-[17px] md:text-[18px] leading-[1.6]" style={{ color: C.inkMute }}>
          Lumina maps every concept you've touched, watches where you stumble, and rewires your study plan in real time.
        </motion.p>

        {/* CTA row */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.25 }} className="mt-10 flex items-center justify-center gap-3 flex-wrap">
          <button onClick={() => navigate('/auth')} className="group relative inline-flex items-center justify-center gap-2 rounded-[12px] px-6 h-12 text-[14px] font-semibold transition-all hover:opacity-90 hover:translate-y-[-1px]" style={{ background: C.ink, color: C.bg, border: 'none', cursor: 'pointer', boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 12px 32px -8px rgba(45,212,191,0.35)' }}>
            Start learning free <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center justify-center gap-2 rounded-[12px] px-6 h-12 text-[14px] font-medium transition-all hover:bg-white/[0.06]" style={{ color: C.ink, border: `0.5px solid ${C.lineStrong}`, background: 'none', cursor: 'pointer' }}>
            <Play className="w-4 h-4" /> See it in action
          </button>
        </motion.div>

        {/* Social proof */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }} className="mt-6 text-[12px]" style={{ color: C.inkFaint }}>
          Free forever · No credit card · Trusted by students at IITs, MIT, Oxford
        </motion.div>

        {/* Product preview */}
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease, delay: 0.4 }} className="relative mt-20 mx-auto max-w-[1100px]">
          <div className="relative rounded-[20px] overflow-hidden p-2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))', border: `0.5px solid ${C.lineStrong}`, boxShadow: '0 60px 140px -30px rgba(45,212,191,0.2), 0 40px 100px -20px rgba(168,85,247,0.15)' }}>
            <ProductPreview />
          </div>
          <div className="absolute inset-x-10 -bottom-10 h-40 -z-10 blur-[80px] opacity-40" style={{ background: `linear-gradient(90deg, ${C.teal}, ${C.violet})` }} />
        </motion.div>
      </motion.div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PRODUCT PREVIEW
   ═══════════════════════════════════════════════════════════════ */
const ProductPreview = () => (
  <div className="rounded-[14px] overflow-hidden text-left" style={{ background: C.surface, border: `0.5px solid ${C.line}` }}>
    <div className="flex items-center gap-2 px-4 h-9 border-b" style={{ borderColor: C.line }}>
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f56' }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ffbd2e' }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#27c93f' }} />
      </div>
      <div className="ml-3 text-[11px]" style={{ color: C.inkFaint, fontFamily: "'JetBrains Mono', monospace" }}>lumina · study session</div>
    </div>
    <div className="grid grid-cols-[200px_1fr] min-h-[460px]">
      <div className="border-r p-4 space-y-1" style={{ borderColor: C.line, background: 'rgba(255,255,255,0.01)' }}>
        {[
          { icon: Sparkles, label: 'Chat', active: true },
          { icon: BookOpen, label: 'Notebook' },
          { icon: Target, label: 'Tests' },
          { icon: Brain, label: 'Flashcards' },
          { icon: LineChart, label: 'Performance' },
          { icon: Wand2, label: 'AI Tools' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] text-[12px]" style={{ background: item.active ? 'rgba(45,212,191,0.08)' : 'transparent', color: item.active ? C.teal : C.inkMute }}>
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </div>
          );
        })}
      </div>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.violet})` }}>
            <Sparkles className="w-3.5 h-3.5 text-black" />
          </div>
          <div className="text-[13px] font-medium" style={{ color: C.ink }}>Lumina</div>
        </div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.5 }} className="rounded-[12px] p-4 max-w-[440px]" style={{ background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${C.line}` }}>
          <div className="text-[13px] leading-[1.6]" style={{ color: C.ink }}>
            I noticed you missed two questions on <span style={{ color: C.teal }}>angular momentum conservation</span>. Let's rebuild the intuition together — three minutes, then a quick check.
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.5 }} className="flex flex-wrap gap-2">
          {['Start lesson', 'Show the math', 'Try a problem'].map(t => (
            <div key={t} className="px-3 py-1.5 rounded-full text-[11px]" style={{ color: C.inkMute, background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${C.line}` }}>{t}</div>
          ))}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 0.5 }} className="grid grid-cols-3 gap-3 pt-6">
          {[
            { label: 'Mastery', value: '84%', color: C.teal },
            { label: 'Streak', value: '12d', color: C.amber },
            { label: 'XP', value: '2,340', color: C.violet },
          ].map(s => (
            <div key={s.label} className="rounded-[10px] p-3" style={{ background: 'rgba(255,255,255,0.02)', border: `0.5px solid ${C.line}` }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: C.inkFaint }}>{s.label}</div>
              <div className="text-[20px] font-semibold mt-1" style={{ color: s.color, fontFamily: "'Instrument Serif', serif" }}>{s.value}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   LOGO STRIP
   ═══════════════════════════════════════════════════════════════ */
const LogoStrip = () => (
  <section className="py-14 border-y" style={{ borderColor: C.line }}>
    <div className="max-w-[1200px] mx-auto px-6">
      <div className="text-center text-[11px] uppercase tracking-[0.2em] mb-7" style={{ color: C.inkFaint }}>Trusted by students preparing for</div>
      <div className="flex flex-wrap justify-center items-center gap-x-14 gap-y-4 text-[22px]" style={{ color: C.inkMute, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>
        {['JEE', 'NEET', 'SAT', 'IB', 'A-Levels', 'AP', 'GCSE', 'CBSE'].map(t => (
          <span key={t} className="opacity-60 hover:opacity-100 transition-opacity">{t}</span>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════════ */
const SectionHeader = ({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) => (
  <div className="max-w-[700px]">
    {eyebrow && <div className="text-[11px] uppercase tracking-[0.18em] mb-4" style={{ color: C.teal }}>{eyebrow}</div>}
    <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] leading-[1.15]" style={{ color: C.ink }}>{title}</h2>
    {subtitle && <p className="mt-5 text-[15px] md:text-[16px] leading-[1.6]" style={{ color: C.inkMute }}>{subtitle}</p>}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   FEATURE CARD
   ═══════════════════════════════════════════════════════════════ */
const FeatureCard = ({ icon: Icon, color, title, desc, visual, span = 'md:col-span-4', tall }: {
  icon: React.ElementType; color: string; title: string; desc: string; visual?: React.ReactNode; span?: string; tall?: boolean;
}) => (
  <div className={`group relative rounded-[20px] p-7 md:p-8 overflow-hidden ${span} ${tall ? 'min-h-[360px]' : ''}`} style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: `0.5px solid ${C.line}` }}>
    <div className="absolute top-0 right-0 w-[200px] h-[200px] rounded-full opacity-[0.05] blur-[60px]" style={{ background: color }} />
    <div className="relative z-10">
      <div className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-5" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <h3 className="text-[17px] font-semibold mb-2" style={{ color: C.ink }}>{title}</h3>
      <p className="text-[14px] leading-[1.65] max-w-[420px]" style={{ color: C.inkMute }}>{desc}</p>
      {visual && <div className="mt-7">{visual}</div>}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   ADAPTIVE VISUAL
   ═══════════════════════════════════════════════════════════════ */
const AdaptiveVisual = () => (
  <div className="space-y-4 max-w-[380px]">
    {[
      { topic: 'Gravitation', pct: 84, color: C.teal },
      { topic: 'Angular momentum', pct: 31, color: '#f87171' },
      { topic: 'Thermodynamics', pct: 58, color: C.amber },
    ].map((item, i) => (
      <motion.div key={item.topic} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[13px]" style={{ color: C.ink2 }}>{item.topic}</span>
          <span className="text-[13px] font-semibold tabular-nums" style={{ color: item.color }}>{item.pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${item.pct}%` }} transition={{ delay: 1 + i * 0.1, duration: 0.8, ease }} className="h-full rounded-full" style={{ background: item.color }} />
        </div>
      </motion.div>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   SOURCES VISUAL
   ═══════════════════════════════════════════════════════════════ */
const SourcesVisual = () => (
  <div className="rounded-[16px] p-7 max-w-[340px] text-center" style={{ border: `1px dashed ${C.lineStrong}`, background: 'rgba(255,255,255,0.02)' }}>
    <div className="flex justify-center gap-4 mb-4">
      {[{ icon: FileText, label: 'PDF' }, { icon: Play, label: 'YouTube' }, { icon: Brain, label: 'Notes' }].map(s => (
        <div key={s.label} className="w-14 h-14 rounded-[12px] flex flex-col items-center justify-center gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${C.line}` }}>
          <s.icon className="w-5 h-5" style={{ color: C.inkMute }} />
          <span className="text-[9px]" style={{ color: C.inkFaint }}>{s.label}</span>
        </div>
      ))}
    </div>
    <div className="text-[13px]" style={{ color: C.inkFaint }}>Drop any source — Lumina reads it all</div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   FEATURES
   ═══════════════════════════════════════════════════════════════ */
const Features = () => (
  <section id="features" className="py-36">
    <div className="max-w-[1200px] mx-auto px-6">
      <SectionHeader eyebrow="Features" title="A thinking partner, not a search bar." subtitle="Every feature in Lumina is designed around how you actually learn — slowly, then suddenly." />
      <div className="mt-20 grid grid-cols-12 gap-5">
        <FeatureCard icon={Brain} color={C.teal} title="Adaptive intelligence" desc="Lumina watches what you struggle with and quietly rewires every quiz, explanation, and lesson around your blind spots." visual={<AdaptiveVisual />} span="md:col-span-7" tall />
        <FeatureCard icon={Wand2} color={C.violet} title="From any source" desc="Drop a PDF, paste a YouTube link, record a lecture — Lumina turns it into notes, flashcards, and tests in seconds." visual={<SourcesVisual />} span="md:col-span-5" tall />
        <FeatureCard icon={Target} color={C.amber} title="Weakness radar" desc="A live map of every concept you've touched, color-coded by mastery." span="md:col-span-4" />
        <FeatureCard icon={Layers} color={C.sky} title="Smart flashcards" desc="AI-generated from your own notes, with spaced repetition built in." span="md:col-span-4" />
        <FeatureCard icon={LineChart} color={C.teal} title="Honest analytics" desc="No vanity metrics. Just clear signals on what you know, what you don't, and what to do next." span="md:col-span-4" />
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════════════════════════ */
const HowItWorks = () => {
  const steps = [
    { n: '01', title: 'Bring your material', desc: 'PDFs, YouTube links, voice notes, typed text — Lumina reads it all and builds your knowledge map.', icon: FileText },
    { n: '02', title: 'Study out loud', desc: 'Ask anything. Lumina draws, derives, and quizzes — calibrated to exactly where you are.', icon: Brain },
    { n: '03', title: 'Watch the gaps close', desc: 'Your mastery map updates after every session. You can feel the difference in a week.', icon: TrendingUp },
  ];

  return (
    <section id="how" className="py-36" style={{ background: C.surface }}>
      <div className="max-w-[1200px] mx-auto px-6">
        <SectionHeader eyebrow="How it works" title="Three steps. Then it runs itself." subtitle="No setup. Drop in your material, ask a question, and Lumina builds your study map." />
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div key={step.n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.5, ease }} className="relative rounded-[20px] p-8" style={{ background: 'rgba(255,255,255,0.02)', border: `0.5px solid ${C.line}` }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-[11px] font-bold tabular-nums" style={{ color: C.teal, fontFamily: "'JetBrains Mono', monospace" }}>{step.n}</span>
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: `${C.teal}10`, border: `1px solid ${C.teal}20` }}>
                  <step.icon className="w-4 h-4" style={{ color: C.teal }} />
                </div>
              </div>
              <h3 className="text-[18px] font-semibold mb-2" style={{ color: C.ink }}>{step.title}</h3>
              <p className="text-[14px] leading-[1.65]" style={{ color: C.inkMute }}>{step.desc}</p>
              {i < 2 && <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px" style={{ background: C.line }} />}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════
   TESTIMONIALS
   ═══════════════════════════════════════════════════════════════ */
const Testimonials = () => (
  <section className="py-36">
    <div className="max-w-[1200px] mx-auto px-6">
      <SectionHeader eyebrow="What early users say" title="Built for real classrooms, not a launch headline." />
      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { quote: "Good, valuable options. Helpful for any student and teacher. Truly a gem that's needed by many.", author: "Beta reviewer", score: "9/10" },
          { quote: "The adaptive test generation is genuinely useful. It found gaps I didn't know I had.", author: "JEE aspirant", score: "8/10" },
          { quote: "Clean interface, fast AI responses. The flashcard system alone is worth it.", author: "NEET student", score: "9/10" },
        ].map((t, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5, ease }} className="rounded-[20px] p-7 md:p-8" style={{ background: 'rgba(255,255,255,0.02)', border: `0.5px solid ${C.line}` }}>
            <div className="flex items-center gap-1 mb-5">
              {[...Array(parseInt(t.score.split('/')[0]))].map((_, j) => <Star key={j} className="w-3.5 h-3.5" style={{ color: C.amber, fill: C.amber }} />)}
              <span className="ml-2 text-[11px] font-medium" style={{ color: C.inkFaint }}>{t.score}</span>
            </div>
            <p className="text-[17px] leading-[1.7] mb-6 italic" style={{ color: C.ink2, fontFamily: "'Instrument Serif', serif" }}>"{t.quote}"</p>
            <div className="text-[12px]" style={{ color: C.inkFaint }}>— {t.author}</div>
          </motion.div>
        ))}
      </div>
      <p className="text-center text-[12px] mt-7" style={{ color: C.inkFaint }}>We're a new platform. You'll see more voices here as they come in — never invented ones.</p>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════════════════
   PRICING
   ═══════════════════════════════════════════════════════════════ */
const Pricing = () => {
  const navigate = useNavigate();
  const plans = [
    { name: 'Free', price: '₹0', period: 'forever', desc: 'For getting started', features: ['AI Chat', 'Basic flashcards', '5 tests/month', 'Performance dashboard'], cta: 'Get started', featured: false },
    { name: 'Pro', price: '₹499', period: '/month', desc: 'For serious students', features: ['Everything in Free', 'Brain Hub (10 engines)', 'Unlimited tests', 'Lecture AI', 'Notes Generator', 'Weakness Radar', 'Priority AI speed'], cta: 'Start free trial', featured: true },
    { name: 'Team', price: '₹299', period: '/seat', desc: 'For coaching institutes', features: ['Everything in Pro', 'Batch analytics', 'Custom material', 'Teacher dashboard', 'Priority support'], cta: 'Contact us', featured: false },
  ];

  return (
    <section id="pricing" className="py-36" style={{ background: C.surface }}>
      <div className="max-w-[1200px] mx-auto px-6">
        <SectionHeader eyebrow="Pricing" title="Start free. Scale when you're ready." subtitle="No credit card required. Upgrade anytime." />
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, i) => (
            <motion.div key={plan.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5, ease }} className="relative rounded-[20px] p-8" style={{ background: plan.featured ? 'linear-gradient(180deg, rgba(168,85,247,0.08), rgba(168,85,247,0.02))' : 'rgba(255,255,255,0.02)', border: plan.featured ? '1px solid rgba(168,85,247,0.3)' : `0.5px solid ${C.line}` }}>
              {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold" style={{ background: C.violet, color: '#fff' }}>Most popular</div>}
              <div className="text-[13px] font-semibold mb-1" style={{ color: C.ink }}>{plan.name}</div>
              <div className="flex items-baseline gap-1 mb-1"><span className="text-[38px] font-semibold tracking-[-0.02em]" style={{ color: C.ink }}>{plan.price}</span><span className="text-[13px]" style={{ color: C.inkFaint }}>{plan.period}</span></div>
              <div className="text-[13px] mb-7" style={{ color: C.inkMute }}>{plan.desc}</div>
              <button onClick={() => navigate('/auth')} className="w-full h-11 rounded-[10px] text-[14px] font-semibold transition-all hover:opacity-90" style={{ background: plan.featured ? C.ink : 'rgba(255,255,255,0.06)', color: plan.featured ? C.bg : C.ink, border: 'none', cursor: 'pointer' }}>{plan.cta}</button>
              <div className="mt-7 space-y-2.5">{plan.features.map(f => <div key={f} className="flex items-center gap-2.5 text-[13px]" style={{ color: C.inkMute }}><Check className="w-3.5 h-3.5" style={{ color: C.teal }} />{f}</div>)}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════
   FAQ
   ═══════════════════════════════════════════════════════════════ */
const FAQ = () => {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: 'How does the AI generate personalized tests?', a: 'Lumina analyzes your learning history, weak areas, and study patterns to create custom tests that target exactly where you need practice. Each test adapts to your current level to maximize learning efficiency.' },
    { q: 'What subjects does Lumina support?', a: "Lumina supports all major academic subjects including Physics, Chemistry, Mathematics, Biology, and more. Our AI can generate content for any topic you're studying, from high school through university level." },
    { q: 'Is Lumina available on mobile?', a: 'Yes! Lumina is fully responsive and works seamlessly on phones, tablets, and desktops. Study anywhere, anytime — your progress syncs across all devices.' },
    { q: 'How does the adaptive learning algorithm work?', a: 'Our algorithm tracks your performance across topics, identifies knowledge gaps, and adjusts difficulty in real-time. It uses spaced repetition science to schedule reviews at optimal intervals, ensuring long-term retention of what you learn.' },
    { q: 'Is there a free plan?', a: 'Yes! Lumina is free to use with AI Chat, basic flashcards, 5 tests per month, and a performance dashboard. Upgrade to Pro for unlimited access to all 10 Brain Hub engines.' },
  ];

  return (
    <section id="faq" className="py-36">
      <div className="max-w-[700px] mx-auto px-6">
        <SectionHeader eyebrow="FAQ" title="Common questions" />
        <div className="mt-14 space-y-2">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-[14px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: `0.5px solid ${C.line}` }}>
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="text-[14px] font-medium pr-4" style={{ color: C.ink }}>{f.q}</span>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} style={{ color: C.inkFaint }} />
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="px-5 pb-4 text-[13px] leading-[1.7]" style={{ color: C.inkMute }}>{f.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════
   CTA
   ═══════════════════════════════════════════════════════════════ */
const CTASection = () => {
  const navigate = useNavigate();
  return (
    <section className="py-36">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="relative rounded-[28px] overflow-hidden p-14 md:p-24 text-center" style={{ background: 'linear-gradient(135deg, #0c1a30, #1a0d2e)' }}>
          <div className="absolute top-10 left-10 w-[200px] h-[200px] rounded-full opacity-20 blur-[80px]" style={{ background: C.violet }} />
          <div className="absolute bottom-10 right-10 w-[250px] h-[250px] rounded-full opacity-15 blur-[80px]" style={{ background: C.teal }} />
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-semibold mb-5" style={{ color: C.ink }}>Ready to learn smarter?</h2>
            <p className="text-[16px] mb-10 leading-relaxed" style={{ color: C.inkMute }}>Join thousands of students who are already using Lumina to master their subjects. Start free, upgrade when you're ready.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => navigate('/auth')} className="inline-flex items-center justify-center gap-2 rounded-[12px] px-7 h-12 text-[14px] font-semibold transition-all hover:opacity-90 hover:translate-y-[-1px]" style={{ background: C.ink, color: C.bg, border: 'none', cursor: 'pointer' }}>Start learning free <ArrowRight className="w-4 h-4" /></button>
              <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center justify-center gap-2 rounded-[12px] px-7 h-12 text-[14px] font-medium transition-all hover:bg-white/[0.06]" style={{ color: C.ink, border: `0.5px solid ${C.lineStrong}`, background: 'none', cursor: 'pointer' }}>View pricing</button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════ */
const Footer = () => (
  <footer className="border-t py-14" style={{ borderColor: C.line }}>
    <div className="max-w-[1200px] mx-auto px-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[6px] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.violet})` }}><Sparkles className="w-3.5 h-3.5 text-black" /></div>
          <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: C.ink }}>Lumina</span>
        </div>
        <div className="flex items-center gap-6 text-[12px]" style={{ color: C.inkFaint }}>
          <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-white transition-colors">Terms</a>
          <span>© 2025 Lumina. Built for students who mean it.</span>
        </div>
      </div>
    </div>
  </footer>
);

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */
const Landing = () => (
  <div style={{ background: C.bg, minHeight: '100vh' }}>
    <Nav />
    <Hero />
    <LogoStrip />
    <Features />
    <HowItWorks />
    <Testimonials />
    <Pricing />
    <FAQ />
    <CTASection />
    <Footer />
  </div>
);

export default Landing;
