import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { useNavigate, NavLink } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  Brain,
  Wand2,
  BookOpen,
  Target,
  Zap,
  Layers,
  LineChart,
  ShieldCheck,
  Infinity as InfinityIcon,
  Check,
  Star,
  Menu,
  X,
} from 'lucide-react';
import { openPricing } from '@/lib/pricing';

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */
const C = {
  bg: '#07080d',
  surface: '#0d1018',
  surface2: '#11141e',
  hairline: 'rgba(255,255,255,0.06)',
  hairlineStrong: 'rgba(255,255,255,0.12)',
  ink: '#f4f5f7',
  inkMute: '#9ba3b4',
  inkFaint: '#5b6172',
  teal: '#2dd4bf',
  violet: '#a855f7',
  amber: '#fbbf24',
  sky: '#38bdf8',
};

const ease = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ */
/* Atoms                                                               */
/* ------------------------------------------------------------------ */
const Wordmark = ({ size = 22 }: { size?: number }) => (
  <div className="flex items-center gap-2.5">
    <div
      className="relative flex items-center justify-center rounded-[8px]"
      style={{
        width: size + 6,
        height: size + 6,
        background: 'linear-gradient(135deg, #2dd4bf 0%, #a855f7 100%)',
      }}
    >
      <Sparkles className="text-black" style={{ width: size * 0.6, height: size * 0.6 }} />
    </div>
    <span
      className="font-medium tracking-tight"
      style={{ fontFamily: "'Instrument Serif', serif", fontSize: size, color: C.ink, lineHeight: 1 }}
    >
      Lumina
    </span>
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-semibold border"
      style={{
        background: 'rgba(59,130,246,0.12)',
        color: C.ink,
        borderColor: 'rgba(59,130,246,0.25)',
        fontFamily: "'Inter Tight', sans-serif",
      }}
    >
      BETA
    </span>
  </div>
);

const Pill = ({ children }: { children: React.ReactNode }) => (
  <div
    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
    style={{
      color: C.inkMute,
      background: 'rgba(255,255,255,0.03)',
      border: `0.5px solid ${C.hairlineStrong}`,
      letterSpacing: '0.02em',
    }}
  >
    {children}
  </div>
);

const PrimaryBtn = ({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) => (
  <button
    onClick={onClick}
    className={`group relative inline-flex items-center justify-center gap-1.5 rounded-[10px] px-5 h-10 text-[13px] font-semibold transition-all hover:opacity-90 hover:translate-y-[-1px] ${className}`}
    style={{
      background: '#f4f5f7',
      color: '#07080d',
      boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 8px 24px -8px rgba(45,212,191,0.35)',
    }}
  >
    {children}
  </button>
);

const GhostBtn = ({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-1.5 rounded-[10px] px-5 h-10 text-[13px] font-medium transition-all hover:bg-white/[0.06] ${className}`}
    style={{ color: C.ink, border: `0.5px solid ${C.hairlineStrong}` }}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ */
/* Nav                                                                 */
/* ------------------------------------------------------------------ */
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
      className="fixed top-0 inset-x-0 z-50 transition-all"
      style={{
        backdropFilter: scrolled ? 'saturate(180%) blur(20px)' : 'none',
        background: scrolled ? 'rgba(7,8,13,0.72)' : 'transparent',
        borderBottom: scrolled ? `0.5px solid ${C.hairline}` : '0.5px solid transparent',
      }}
    >
      <div className="max-w-[1180px] mx-auto px-6 h-[64px] flex items-center justify-between">
        <Wordmark />
        <nav className="hidden md:flex items-center gap-7 text-[13px]" style={{ color: C.inkMute }}>
          <a href="#vs" className="hover:text-white transition-colors">vs ChatGPT</a>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how" className="hover:text-white transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </nav>
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => navigate('/auth')}
            className="text-[13px] px-3 h-9 rounded-[8px] hover:bg-white/[0.06] transition-colors"
            style={{ color: C.ink }}
          >
            Sign in
          </button>
          <PrimaryBtn onClick={() => navigate('/auth')}>
            Get started <ArrowRight className="w-3.5 h-3.5" />
          </PrimaryBtn>
        </div>
        <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-md" style={{ color: C.ink }}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="md:hidden border-t px-6 py-4 flex flex-col gap-3"
            style={{ borderColor: C.hairline, background: 'rgba(7,8,13,0.96)' }}
          >
            {['vs', 'features', 'how', 'pricing', 'faq'].map((id) => (
              <a key={id} href={`#${id}`} onClick={() => setOpen(false)} className="text-[14px]" style={{ color: C.inkMute }}>
                {id === 'vs' ? 'vs ChatGPT' : id === 'how' ? 'How it works' : id[0].toUpperCase() + id.slice(1)}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <GhostBtn onClick={() => navigate('/auth')}>Sign in</GhostBtn>
              <PrimaryBtn onClick={() => navigate('/auth')}>Get started</PrimaryBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
const Hero = () => {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.4]);

  return (
    <section ref={ref} className="relative pt-[140px] pb-[80px] overflow-hidden">
      {/* Aurora mesh */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div
          className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[1100px] h-[600px] rounded-full opacity-[0.35] blur-[120px]"
          style={{ background: 'radial-gradient(circle at 30% 50%, #2dd4bf 0%, transparent 60%), radial-gradient(circle at 70% 50%, #a855f7 0%, transparent 60%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 0.5px, transparent 0.5px), linear-gradient(90deg, rgba(255,255,255,0.5) 0.5px, transparent 0.5px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)',
          }}
        />
      </div>

      <motion.div style={{ y, opacity }} className="max-w-[1180px] mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="flex justify-center mb-6"
        >
          <Pill>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.teal, boxShadow: `0 0 8px ${C.teal}` }} />
            Not a chatbot. A learning system.
          </Pill>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.05 }}
          className="mx-auto max-w-[920px] tracking-[-0.03em] leading-[1.02]"
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 'clamp(48px, 7vw, 92px)',
            color: C.ink,
            fontWeight: 400,
          }}
        >
          Know exactly
          <br />
          <span
            style={{
              background: 'linear-gradient(110deg, #2dd4bf 0%, #a855f7 50%, #fbbf24 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontStyle: 'italic',
            }}
          >
            what to study next.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.15 }}
          className="mx-auto mt-7 max-w-[640px] text-[16px] md:text-[17px] leading-[1.55]"
          style={{ color: C.inkMute }}
        >
          ChatGPT answers your questions and forgets you the next day. Lumina remembers every topic
          you've touched, finds your weak spots before the exam does, and guides the next session
          automatically.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.25 }}
          className="mt-9 flex items-center justify-center gap-2.5 flex-wrap"
        >
          <PrimaryBtn onClick={() => navigate('/auth')}>
            Find your weak spots <ArrowRight className="w-3.5 h-3.5" />
          </PrimaryBtn>
          <GhostBtn onClick={() => document.getElementById('vs')?.scrollIntoView({ behavior: 'smooth' })}>
            Why not ChatGPT?
          </GhostBtn>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-5 text-[12px]"
          style={{ color: C.inkFaint }}
        >
          Free forever plan · No credit card · Built for JEE, NEET, IB, SAT, AP, A-Levels
        </motion.div>

        {/* Product preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease, delay: 0.4 }}
          className="relative mt-16 mx-auto max-w-[1080px]"
        >
          <div
            className="relative rounded-[20px] overflow-hidden p-2"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
              border: `0.5px solid ${C.hairlineStrong}`,
              boxShadow: '0 50px 120px -30px rgba(45,212,191,0.25), 0 30px 80px -20px rgba(168,85,247,0.2)',
            }}
          >
            <ProductPreview />
          </div>
          {/* glow under */}
          <div
            className="absolute inset-x-10 -bottom-10 h-40 -z-10 blur-[80px] opacity-50"
            style={{ background: 'linear-gradient(90deg, #2dd4bf, #a855f7)' }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
};

const ProductPreview = () => (
  <div
    className="rounded-[14px] overflow-hidden text-left"
    style={{ background: C.surface, border: `0.5px solid ${C.hairline}` }}
  >
    {/* fake titlebar */}
    <div className="flex items-center gap-2 px-4 h-9 border-b" style={{ borderColor: C.hairline }}>
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f56' }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ffbd2e' }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#27c93f' }} />
      </div>
      <div className="ml-3 text-[11px]" style={{ color: C.inkFaint, fontFamily: "'JetBrains Mono', monospace" }}>
        lumina · study session
      </div>
    </div>
    <div className="grid grid-cols-[200px_1fr] min-h-[440px]">
      {/* sidebar */}
      <div className="border-r p-4 space-y-1" style={{ borderColor: C.hairline, background: 'rgba(255,255,255,0.01)' }}>
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
            <div
              key={i}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] text-[12px]"
              style={{
                background: item.active ? 'rgba(45,212,191,0.08)' : 'transparent',
                color: item.active ? C.teal : C.inkMute,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </div>
          );
        })}
      </div>
      {/* main */}
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2dd4bf, #a855f7)' }}
          >
            <Sparkles className="w-3.5 h-3.5 text-black" />
          </div>
          <div className="text-[13px] font-medium" style={{ color: C.ink }}>Lumina</div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="rounded-[12px] p-4 max-w-[440px]"
          style={{ background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${C.hairline}` }}
        >
          <div className="text-[13px] leading-[1.6]" style={{ color: C.ink }}>
            I noticed you missed two questions on{' '}
            <span style={{ color: C.teal }}>angular momentum conservation</span>. Let's rebuild the
            intuition together — three minutes, then a quick check.
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.5 }}
          className="flex flex-wrap gap-2"
        >
          {['Start lesson', 'Show the math', 'Try a problem'].map((t) => (
            <div
              key={t}
              className="px-3 py-1.5 rounded-full text-[11px]"
              style={{
                color: C.inkMute,
                background: 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${C.hairline}`,
              }}
            >
              {t}
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.5 }}
          className="grid grid-cols-3 gap-3 pt-6"
        >
          {[
            { label: 'Mastery', value: '84%', color: C.teal },
            { label: 'Streak', value: '12d', color: C.amber },
            { label: 'XP', value: '2,340', color: C.violet },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-[10px] p-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: `0.5px solid ${C.hairline}` }}
            >
              <div className="text-[10px] uppercase tracking-wider" style={{ color: C.inkFaint }}>{s.label}</div>
              <div className="text-[20px] font-semibold mt-1" style={{ color: s.color, fontFamily: "'Instrument Serif', serif" }}>
                {s.value}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Logo strip                                                          */
/* ------------------------------------------------------------------ */
const LogoStrip = () => (
  <section className="py-12 border-y" style={{ borderColor: C.hairline }}>
    <div className="max-w-[1180px] mx-auto px-6">
      <div className="text-center text-[11px] uppercase tracking-[0.2em] mb-6" style={{ color: C.inkFaint }}>
        Built for students preparing for
      </div>
      <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4 text-[14px]" style={{ color: C.inkMute, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>
        {['JEE', 'NEET', 'SAT', 'IB', 'A-Levels', 'AP', 'GCSE', 'CBSE'].map((t) => (
          <span key={t} className="opacity-70 hover:opacity-100 transition-opacity text-[20px]">{t}</span>
        ))}
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/* Feature bento                                                       */
/* ------------------------------------------------------------------ */
const Features = () => {
  return (
    <section id="features" className="py-32">
      <div className="max-w-[1180px] mx-auto px-6">
        <SectionHeader
          eyebrow="What you actually get"
          title="Outcomes, not features."
          subtitle="Every part of Lumina exists to answer one question: what should I study next, and why?"
        />

        <div className="mt-16 grid grid-cols-12 gap-4">
          <FeatureCard
            span="md:col-span-7"
            icon={Brain}
            color={C.teal}
            title="Every mistake changes what happens next."
            desc="Lumina watches what you struggle with and quietly rewires every quiz, explanation, and lesson around your blind spots. You stop drilling what you already know."
            visual={<AdaptiveVisual />}
            tall
          />
          <FeatureCard
            span="md:col-span-5"
            icon={Wand2}
            color={C.violet}
            title="Turn any syllabus into a study system."
            desc="Drop a PDF, paste a YouTube link, record a lecture. Lumina ingests it, structures it, and remembers it forever — so future sessions build on it."
            visual={<SourcesVisual />}
            tall
          />
          <FeatureCard
            span="md:col-span-4"
            icon={Target}
            color={C.amber}
            title="See where your marks are leaking."
            desc="A live map of every concept you've touched, color-coded by mastery. The red ones are tomorrow's plan."
          />
          <FeatureCard
            span="md:col-span-4"
            icon={Layers}
            color={C.sky}
            title="A notebook that thinks with you."
            desc="Math, diagrams, code, and explanations render live as you work. No more re-copying notes the night before a test."
          />
          <FeatureCard
            span="md:col-span-4"
            icon={LineChart}
            color={C.teal}
            title="Know tomorrow's priority in seconds."
            desc="No vanity dashboards. One screen tells you exactly what to revise next and why it matters for your exam."
          />
        </div>
      </div>
    </section>
  );
};

const SectionHeader = ({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-100px' }}
    transition={{ duration: 0.6, ease }}
    className="text-center max-w-[680px] mx-auto"
  >
    <div className="text-[11px] uppercase tracking-[0.2em] mb-4" style={{ color: C.teal }}>
      {eyebrow}
    </div>
    <h2
      className="tracking-[-0.02em] leading-[1.1]"
      style={{
        fontFamily: "'Instrument Serif', serif",
        fontSize: 'clamp(32px, 4.5vw, 52px)',
        color: C.ink,
        fontWeight: 400,
      }}
    >
      {title}
    </h2>
    {subtitle && (
      <p className="mt-5 text-[15px] md:text-[16px] leading-[1.6]" style={{ color: C.inkMute }}>
        {subtitle}
      </p>
    )}
  </motion.div>
);

const FeatureCard = ({
  span,
  icon: Icon,
  color,
  title,
  desc,
  visual,
  tall,
}: {
  span: string;
  icon: any;
  color: string;
  title: string;
  desc: string;
  visual?: React.ReactNode;
  tall?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.6, ease }}
    className={`${span} col-span-12 group relative rounded-[18px] overflow-hidden`}
    style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',
      border: `0.5px solid ${C.hairline}`,
      minHeight: tall ? 380 : 220,
    }}
  >
    {visual && <div className="relative">{visual}</div>}
    <div className="p-7">
      <div
        className="w-9 h-9 rounded-[9px] flex items-center justify-center mb-4"
        style={{ background: `${color}15`, border: `0.5px solid ${color}30` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <h3 className="text-[18px] font-semibold tracking-tight mb-2" style={{ color: C.ink }}>
        {title}
      </h3>
      <p className="text-[13.5px] leading-[1.6]" style={{ color: C.inkMute }}>
        {desc}
      </p>
    </div>
  </motion.div>
);

const AdaptiveVisual = () => (
  <div className="px-7 pt-7 pb-2">
    <div
      className="rounded-[12px] p-5 space-y-3"
      style={{ background: C.surface, border: `0.5px solid ${C.hairline}` }}
    >
      {[
        { topic: 'Kinematics', mastery: 92, color: C.teal },
        { topic: 'Rotational motion', mastery: 64, color: C.amber },
        { topic: 'Angular momentum', mastery: 38, color: '#ef4444' },
        { topic: 'Gravitation', mastery: 81, color: C.teal },
      ].map((t, i) => (
        <motion.div
          key={t.topic}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
          className="flex items-center gap-3"
        >
          <div className="text-[12px] flex-1" style={{ color: C.ink }}>{t.topic}</div>
          <div className="w-32 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${t.mastery}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease }}
              className="h-full rounded-full"
              style={{ background: t.color }}
            />
          </div>
          <div className="text-[11px] w-10 text-right tabular-nums" style={{ color: t.color }}>
            {t.mastery}%
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const SourcesVisual = () => (
  <div className="px-7 pt-7 pb-2">
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: 'lecture.mp3', tag: 'Audio' },
        { label: 'biology-ch7.pdf', tag: 'PDF' },
        { label: 'youtube.com/…', tag: 'Video' },
        { label: 'notes.md', tag: 'Notes' },
      ].map((f, i) => (
        <motion.div
          key={f.label}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
          className="rounded-[10px] p-3"
          style={{ background: C.surface, border: `0.5px solid ${C.hairline}` }}
        >
          <div className="text-[10px] mb-1" style={{ color: C.violet }}>{f.tag}</div>
          <div className="text-[12px] truncate" style={{ color: C.ink, fontFamily: "'JetBrains Mono', monospace" }}>
            {f.label}
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */
const HowItWorks = () => {
  const steps = [
    { n: '01', title: 'Upload', desc: 'PDFs, lectures, videos, notes — anything from your syllabus. Lumina reads it all.', color: C.teal },
    { n: '02', title: 'Learn', desc: 'Ask, explore, practice. Every explanation is calibrated to where you are right now.', color: C.violet },
    { n: '03', title: 'Measure', desc: 'Tests and quizzes detect exactly which concepts haven\'t clicked yet.', color: C.amber },
    { n: '04', title: 'Adapt', desc: 'Tomorrow\'s session is rewritten automatically around your weak spots.', color: C.sky },
    { n: '05', title: 'Master', desc: 'Knowledge gaps shrink week over week. You can watch the map turn green.', color: C.teal },
  ];

  return (
    <section id="how" className="py-32 relative">
      <div className="max-w-[1180px] mx-auto px-6">
        <SectionHeader
          eyebrow="The learning loop"
          title="A flywheel, not a chat log."
          subtitle="Most AI tools start from zero every conversation. Lumina compounds. Every session feeds the next."
        />
        <div className="mt-16 grid md:grid-cols-5 gap-4 relative">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease, delay: i * 0.08 }}
              className="relative rounded-[18px] p-6"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',
                border: `0.5px solid ${C.hairline}`,
              }}
            >
              <div
                className="text-[12px] font-medium mb-4"
                style={{ color: s.color, fontFamily: "'JetBrains Mono', monospace" }}
              >
                {s.n}
              </div>
              <h3 className="text-[20px] tracking-tight mb-2" style={{ color: C.ink, fontFamily: "'Instrument Serif', serif" }}>
                {s.title}
              </h3>
              <p className="text-[13px] leading-[1.6]" style={{ color: C.inkMute }}>
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 text-center text-[12px]" style={{ color: C.inkFaint, fontFamily: "'JetBrains Mono', monospace" }}>
          upload → learn → measure → adapt → master → repeat
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Why not ChatGPT comparison                                          */
/* ------------------------------------------------------------------ */
const VsChatGPT = () => {
  const rows = [
    { feature: 'Memory of what you\'ve learned', chatgpt: 'Forgets across chats', lumina: 'Persistent knowledge graph' },
    { feature: 'Tracks mastery per concept', chatgpt: 'No', lumina: 'Live weakness radar' },
    { feature: 'Guides what to study next', chatgpt: 'You decide', lumina: 'Automatic, based on gaps' },
    { feature: 'Adaptive tests from your syllabus', chatgpt: 'Generic answers', lumina: 'Targeted at your weak spots' },
    { feature: 'Structured study plan', chatgpt: 'No', lumina: 'Built around your exam date' },
    { feature: 'Designed for', chatgpt: 'General Q&A', lumina: 'Exam preparation' },
  ];
  return (
    <section id="vs" className="py-32">
      <div className="max-w-[1080px] mx-auto px-6">
        <SectionHeader
          eyebrow="Lumina vs ChatGPT"
          title="One answers. One teaches."
          subtitle="ChatGPT is brilliant at answering questions. It just isn't built to help you master a syllabus."
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease }}
          className="mt-14 rounded-[18px] overflow-hidden"
          style={{ border: `0.5px solid ${C.hairline}`, background: 'rgba(255,255,255,0.015)' }}
        >
          <div className="grid grid-cols-[1.4fr_1fr_1fr] text-[12px] uppercase tracking-[0.14em] px-6 py-4 border-b" style={{ borderColor: C.hairline, color: C.inkFaint }}>
            <div>What you actually need</div>
            <div>ChatGPT</div>
            <div style={{ color: C.teal }}>Lumina</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.feature}
              className="grid grid-cols-[1.4fr_1fr_1fr] items-center px-6 py-5 text-[13.5px]"
              style={{
                borderTop: i === 0 ? 'none' : `0.5px solid ${C.hairline}`,
                background: i % 2 === 1 ? 'rgba(255,255,255,0.012)' : 'transparent',
              }}
            >
              <div style={{ color: C.ink }}>{r.feature}</div>
              <div className="flex items-center gap-2" style={{ color: C.inkMute }}>
                <X className="w-3.5 h-3.5" style={{ color: C.inkFaint }} />
                {r.chatgpt}
              </div>
              <div className="flex items-center gap-2" style={{ color: C.ink }}>
                <Check className="w-3.5 h-3.5" style={{ color: C.teal }} />
                {r.lumina}
              </div>
            </div>
          ))}
        </motion.div>
        <p className="mt-6 text-center text-[12.5px]" style={{ color: C.inkFaint }}>
          We love ChatGPT. We just don't think a search bar is what gets you through an exam.
        </p>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Who is this for                                                     */
/* ------------------------------------------------------------------ */
const WhoFor = () => {
  const cohorts = [
    { tag: 'JEE / NEET', line: 'Daily concept loops, full-length mocks, and a weakness map tuned to PCM/PCB.' },
    { tag: 'IB / A-Levels', line: 'Paper-style questions, IA support, and structured revision by syllabus point.' },
    { tag: 'SAT / AP', line: 'Adaptive sections, error-pattern detection, and targeted drills before test day.' },
    { tag: 'University', line: 'Lecture ingestion, exam-paper generation, and long-running notebooks per course.' },
  ];
  return (
    <section className="py-24">
      <div className="max-w-[1180px] mx-auto px-6">
        <SectionHeader eyebrow="Who it's for" title="One system. Every syllabus." />
        <div className="mt-14 grid md:grid-cols-2 gap-4">
          {cohorts.map((c, i) => (
            <motion.div
              key={c.tag}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease, delay: i * 0.06 }}
              className="rounded-[16px] p-6 flex items-start gap-5"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',
                border: `0.5px solid ${C.hairline}`,
              }}
            >
              <div
                className="px-2.5 py-1 rounded-[8px] text-[11px] font-semibold tracking-wider"
                style={{
                  background: 'rgba(45,212,191,0.10)',
                  color: C.teal,
                  border: `0.5px solid rgba(45,212,191,0.25)`,
                  fontFamily: "'JetBrains Mono', monospace",
                  whiteSpace: 'nowrap',
                }}
              >
                {c.tag}
              </div>
              <div className="text-[13.5px] leading-[1.6]" style={{ color: C.inkMute }}>{c.line}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Quote                                                               */
/* ------------------------------------------------------------------ */
const QuoteSection = () => (
  <section className="py-32">
    <div className="max-w-[860px] mx-auto px-6 text-center">
      <motion.blockquote
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease }}
        className="tracking-[-0.02em] leading-[1.2]"
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 'clamp(28px, 4vw, 44px)',
          color: C.ink,
          fontWeight: 400,
        }}
      >
        "I stopped opening ChatGPT for studying. Lumina actually{' '}
        <em style={{ color: C.teal }}>remembered</em> what I was weak at and quietly{' '}
        <em style={{ color: C.violet }}>built next week around it</em>."
      </motion.blockquote>
      <div className="mt-8 flex items-center justify-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold"
          style={{ background: `${C.teal}25`, color: C.teal }}
        >
          AR
        </div>
        <div className="text-left">
          <div className="text-[13px] font-medium" style={{ color: C.ink }}>Aanya R.</div>
          <div className="text-[11px]" style={{ color: C.inkFaint }}>JEE 2026 aspirant</div>
        </div>
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */
const TestimonialGrid = () => {
  // Honest early-stage section: one real piece of feedback (9/10),
  // no invented students, no fake numbers. We refuse to fake social proof.
  return (
    <section className="py-32">
      <div className="max-w-[820px] mx-auto px-6">
        <SectionHeader
          eyebrow="Early feedback"
          title="We're new. So we don't fake the reviews."
          subtitle="One real quote from a beta reviewer. More will appear here as real users share theirs."
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease }}
          className="mt-12 rounded-[20px] p-8 md:p-10"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))',
            border: `0.5px solid ${C.hairline}`,
          }}
        >
          <div className="flex gap-0.5 mb-5">
            {[...Array(9)].map((_, j) => (
              <Star key={j} className="w-3.5 h-3.5 fill-current" style={{ color: C.amber }} />
            ))}
            <Star className="w-3.5 h-3.5 opacity-30" style={{ color: C.amber }} />
            <span className="ml-2 text-[11px]" style={{ color: C.inkFaint }}>9 / 10</span>
          </div>
          <p className="text-[17px] md:text-[20px] leading-[1.6] mb-6" style={{ color: C.ink }}>
            "Good, valuable options. Helpful for any student and teacher.
            Truly a gem that's needed by many."
          </p>
          <div className="text-[12px]" style={{ color: C.inkFaint }}>
            — Beta reviewer · independent feedback
          </div>
        </motion.div>
      </div>
    </section>
  );
};


/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */
const Pricing = () => {
  const navigate = useNavigate();
  const tiers = [
    {
      name: 'Free',
      price: '₹0',
      cadence: 'forever',
      desc: 'Everything you need to start.',
      features: ['Daily AI chat with limits', 'Notes & flashcards', '10 tests / week', 'Weakness radar'],
      cta: 'Get started',
      onClick: () => navigate('/auth'),
      highlight: false,
    },
    {
      name: 'Ultimate',
      price: '₹199',
      cadence: '/ month',
      desc: 'For serious students.',
      features: ['Generous daily limits', 'All AI tools unlocked', 'Smart notebook', 'Priority routing'],
      cta: 'Upgrade',
      onClick: openPricing,
      highlight: true,
    },
    {
      name: 'PRO+',
      price: '₹499',
      cadence: '/ month',
      desc: 'For top performers.',
      features: ['Effectively unlimited usage', 'Lumina Hub neurocognitive suite', 'Smart paper & mock exams', 'Connectors: Drive, Gmail, Notion'],
      cta: 'Go PRO+',
      onClick: openPricing,
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-32">
      <div className="max-w-[1180px] mx-auto px-6">
        <SectionHeader
          eyebrow="Pricing"
          title="Honest pricing. No tricks."
          subtitle="Start free. Upgrade when Lumina has earned it."
        />
        <div className="mt-16 grid md:grid-cols-3 gap-4">
          {tiers.map((t) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease }}
              className="relative rounded-[18px] p-7 flex flex-col"
              style={{
                background: t.highlight
                  ? 'linear-gradient(180deg, rgba(45,212,191,0.08), rgba(168,85,247,0.05))'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',
                border: t.highlight ? `0.5px solid ${C.teal}50` : `0.5px solid ${C.hairline}`,
                boxShadow: t.highlight ? '0 20px 60px -20px rgba(45,212,191,0.25)' : 'none',
              }}
            >
              {t.highlight && (
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: C.teal, color: '#000' }}
                >
                  Most popular
                </div>
              )}
              <div className="text-[13px] font-medium mb-1" style={{ color: C.inkMute }}>
                {t.name}
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <div
                  className="text-[40px] tracking-tight"
                  style={{ color: C.ink, fontFamily: "'Instrument Serif', serif" }}
                >
                  {t.price}
                </div>
                <div className="text-[13px]" style={{ color: C.inkFaint }}>{t.cadence}</div>
              </div>
              <p className="text-[13px] mb-6" style={{ color: C.inkMute }}>{t.desc}</p>
              <ul className="space-y-2.5 mb-7 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px]" style={{ color: C.ink }}>
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: C.teal }} />
                    {f}
                  </li>
                ))}
              </ul>
              {t.highlight ? (
                <PrimaryBtn onClick={t.onClick} className="w-full">{t.cta}</PrimaryBtn>
              ) : (
                <GhostBtn onClick={t.onClick} className="w-full">{t.cta}</GhostBtn>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */
const FAQSection = () => {
  const faqs = [
    {
      q: 'Isn\'t this just ChatGPT with study features?',
      a: 'No. ChatGPT is a stateless chatbot — it answers, then forgets. Lumina keeps a persistent model of what you know, scores every concept by mastery, generates adaptive tests from your own material, and rewrites tomorrow\'s study plan based on what slipped today. It\'s a learning system. The chat is just one surface.',
    },
    {
      q: 'How does Lumina know what I should study next?',
      a: 'Every test, quiz, and explanation feeds a per-concept mastery score. The weakness radar surfaces the concepts where your marks are leaking. Study plans, mocks, and revision drills are then generated to attack those specific gaps — not generic syllabus dumps.',
    },
    {
      q: 'Will it work for my exam?',
      a: 'Yes — JEE, NEET, SAT, AP, IB, A-Levels, CBSE, ICSE and most undergrad coursework. You bring the syllabus or upload your material, and Lumina structures the rest.',
    },
    {
      q: 'Can I use my own notes and lectures?',
      a: 'That\'s the point. Upload PDFs, paste YouTube links, record lectures live. Lumina ingests everything and uses it as context for explanations, mock papers, and revisions — so the system is grounded in your actual syllabus, not generic answers.',
    },
    {
      q: 'Is my data private?',
      a: 'Yes. Your content is yours. We don\'t train on it, we don\'t share it, and you can delete it any time. Full controls in Settings → Privacy.',
    },
    {
      q: 'Do you have a free plan?',
      a: 'Always. Core features work on the free tier with daily limits. Upgrade only when Lumina has clearly earned a spot in your routine.',
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-32">
      <div className="max-w-[760px] mx-auto px-6">
        <SectionHeader eyebrow="FAQ" title="Questions, answered." />
        <div className="mt-12 space-y-2">
          {faqs.map((f, i) => (
            <div
              key={i}
              className="rounded-[14px] overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)', border: `0.5px solid ${C.hairline}` }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-[14px] font-medium" style={{ color: C.ink }}>{f.q}</span>
                <span className="text-[18px]" style={{ color: C.inkFaint }}>{open === i ? '−' : '+'}</span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 text-[13.5px] leading-[1.65]" style={{ color: C.inkMute }}>
                      {f.a}
                    </div>
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

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */
const FinalCTA = () => {
  const navigate = useNavigate();
  return (
    <section className="py-32">
      <div className="max-w-[1180px] mx-auto px-6">
        <div
          className="relative rounded-[24px] overflow-hidden text-center p-16 md:p-24"
          style={{
            background: 'linear-gradient(135deg, #0d1b2a 0%, #1a0d2e 100%)',
            border: `0.5px solid ${C.hairlineStrong}`,
          }}
        >
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-30 blur-[100px]"
            style={{ background: 'linear-gradient(90deg, #2dd4bf, #a855f7)' }}
          />
          <div className="relative">
            <h2
              className="tracking-[-0.02em] leading-[1.05] mx-auto max-w-[700px]"
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 'clamp(40px, 6vw, 72px)',
                color: C.ink,
                fontWeight: 400,
              }}
            >
              Know exactly what to study next.
            </h2>
            <p className="mt-6 text-[16px] max-w-[480px] mx-auto" style={{ color: C.inkMute }}>
              Upload one topic you're stuck on. Lumina will find the gap, build the plan, and guide every session from there.
            </p>
            <div className="mt-9 flex items-center justify-center gap-2.5 flex-wrap">
              <PrimaryBtn onClick={() => navigate('/auth')}>
                Build your study system <ArrowRight className="w-3.5 h-3.5" />
              </PrimaryBtn>
              <GhostBtn onClick={openPricing}>See pricing</GhostBtn>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */
const Footer = () => (
  <footer className="pt-16 pb-10 border-t" style={{ borderColor: C.hairline }}>
    <div className="max-w-[1180px] mx-auto px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <Wordmark />
        <div className="flex flex-wrap gap-6 text-[12.5px]" style={{ color: C.inkMute }}>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          <NavLink to="/privacy" className="hover:text-white transition-colors">Privacy</NavLink>
          <NavLink to="/terms" className="hover:text-white transition-colors">Terms</NavLink>
          <a href="https://instagram.com/luminastudyai" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            Instagram
          </a>
        </div>
      </div>
      <div className="mt-8 pt-6 border-t flex flex-col md:flex-row justify-between gap-2 text-[11px]" style={{ borderColor: C.hairline, color: C.inkFaint }}>
        <div>© {new Date().getFullYear()} Lumina AI. Made for students who refuse to settle.</div>
        <div>Built with care in India.</div>
      </div>
    </div>
  </footer>
);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
const Landing = () => {
  // Override the dark theme background for the landing page consistency.
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = C.bg;
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: '100vh' }}>
      <Nav />
      <main>
        <Hero />
        <LogoStrip />
        <VsChatGPT />
        <Features />
        <HowItWorks />
        <WhoFor />
        <QuoteSection />
        <TestimonialGrid />
        <Pricing />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
