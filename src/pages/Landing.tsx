import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Sparkles, Brain, Target, Zap, Layers,
  LineChart, Check, Star, Menu, X, ChevronDown, Play,
  TrendingUp, FileText,
} from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

/* ───── Cinematic background (no orbs, no blur blobs) ───── */
const CineBackground = () => (
  <div className="cine-bg" aria-hidden />
);

/* ───── NAV ───── */
const Nav = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        backdropFilter: scrolled ? 'blur(24px) saturate(180%)' : 'none',
        background: scrolled ? 'rgba(6,6,10,0.75)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2dd4bf, #a855f7)' }}>
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <span className="text-xl font-semibold text-white tracking-tight" style={{ fontFamily: "'Instrument Serif', serif" }}>Lumina</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          {['Features', 'How it works', 'Pricing', 'FAQ'].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="hover:text-white transition-colors">{item}</a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => navigate('/auth')} className="text-sm px-4 h-9 rounded-lg hover:bg-white/[0.06] transition-colors text-white bg-transparent border-none cursor-pointer">Sign in</button>
          <button
            onClick={() => navigate('/auth')}
            className="inline-flex items-center gap-2 rounded-xl px-5 h-10 text-sm font-semibold border-none cursor-pointer transition-all"
            style={{
              background: 'linear-gradient(135deg, #2dd4bf 0%, #a78bfa 100%)',
              color: '#06060a',
              boxShadow: '0 6px 24px -8px rgba(45,212,191,0.55), 0 2px 6px rgba(167,139,250,0.25)',
            }}
          >
            Get started <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-white bg-transparent border-none cursor-pointer">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="md:hidden border-t border-white/[0.06] px-6 py-4 flex flex-col gap-3 bg-[#06060a]/95">
            {['Features', 'How it works', 'Pricing', 'FAQ'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">{item}</a>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => navigate('/auth')} className="flex-1 h-10 rounded-xl text-sm font-medium text-white border border-white/10 bg-transparent cursor-pointer">Sign in</button>
              <button onClick={() => navigate('/auth')} className="flex-1 h-10 rounded-xl text-sm font-semibold border-none cursor-pointer" style={{ background: 'linear-gradient(135deg, #2dd4bf, #a78bfa)', color: '#06060a' }}>Get started</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

/* ───── HERO ───── */
const Hero = () => {
  const navigate = useNavigate();
  return (
    <section className="relative pt-[180px] pb-[120px]">
      <div className="max-w-[1200px] mx-auto px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-gray-400 bg-white/[0.03] border border-white/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            12,000+ students. JEE · NEET · SAT · IB · A-Levels.
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.1 }}
          className="mx-auto max-w-[960px] text-white leading-[1.0]"
          style={{ fontFamily: "'Instrument Serif', serif", fontSize: 'clamp(56px, 8vw, 100px)', fontWeight: 400, letterSpacing: '-0.04em' }}
        >
          Your textbook can't
          <br />
          <span className="italic bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(110deg, #2dd4bf 0%, #a855f7 50%, #fbbf24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            think back.
          </span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.2 }} className="mx-auto mt-8 max-w-[620px] text-lg md:text-xl leading-relaxed text-gray-400">
          Lumina is the study OS that watches where you stumble, rebuilds the concept you almost missed, and rewires your plan the moment you close the test.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.3 }} className="mt-10 flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => navigate('/auth')}
            className="group inline-flex items-center gap-2 rounded-xl px-8 h-14 text-base font-semibold border-none cursor-pointer transition-all"
            style={{
              background: 'linear-gradient(135deg, #2dd4bf 0%, #a78bfa 50%, #f0abfc 100%)',
              color: '#06060a',
              boxShadow: '0 16px 48px -12px rgba(45,212,191,0.5), 0 6px 20px -6px rgba(167,139,250,0.45)',
            }}
          >
            Get started — it's free <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-2 rounded-xl px-7 h-14 text-base font-medium text-white border border-white/10 bg-white/[0.02] cursor-pointer hover:bg-white/[0.06] transition-all">
            <Play className="w-4 h-4" /> See it in action
          </button>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }} className="mt-6 text-xs text-gray-500">
          Free forever · No credit card · 30 seconds to first insight
        </motion.p>

        {/* Product preview */}
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease, delay: 0.5 }} className="relative mt-24 mx-auto max-w-[1100px]">
          <div className="relative rounded-2xl overflow-hidden p-2 border border-white/[0.08]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))' }}>
            <div className="rounded-xl overflow-hidden text-left border border-white/[0.04]" style={{ background: '#0a0a10' }}>
              <div className="flex items-center gap-2 px-4 h-10 border-b border-white/[0.04]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <div className="ml-3 text-[11px] text-gray-500 font-mono">lumina · study session</div>
              </div>
              <div className="grid grid-cols-[200px_1fr] min-h-[480px]">
                <div className="border-r border-white/[0.04] p-4 space-y-1 bg-white/[0.01]">
                  {[
                    { icon: Sparkles, label: 'Chat', active: true },
                    { icon: FileText, label: 'Notebook' },
                    { icon: Target, label: 'Tests' },
                    { icon: Brain, label: 'Flashcards' },
                    { icon: LineChart, label: 'Performance' },
                    { icon: Zap, label: 'AI Tools' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: item.active ? 'rgba(45,212,191,0.08)' : 'transparent', color: item.active ? '#2dd4bf' : '#888c9a' }}>
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </div>
                  ))}
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2dd4bf, #a855f7)' }}>
                      <Sparkles className="w-3.5 h-3.5 text-black" />
                    </div>
                    <div className="text-sm font-medium text-white">Lumina</div>
                  </div>
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.5 }} className="rounded-xl p-4 max-w-[460px] border border-white/[0.04] bg-white/[0.02]">
                    <div className="text-sm leading-relaxed text-white">
                      You missed two questions on <span className="text-teal-400">angular momentum</span>. The pattern: you skip the cross-product step when torque is implicit. Three-minute rebuild?
                    </div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.5 }} className="flex flex-wrap gap-2">
                    {['Rebuild it', 'Show the math', 'Try a fresh problem'].map(t => (
                      <div key={t} className="px-3 py-1.5 rounded-full text-[11px] text-gray-400 bg-white/[0.03] border border-white/[0.04]">{t}</div>
                    ))}
                  </motion.div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 0.5 }} className="grid grid-cols-3 gap-3 pt-6">
                    {[
                      { label: 'Mastery', value: '84%', color: '#2dd4bf' },
                      { label: 'Streak', value: '12d', color: '#fbbf24' },
                      { label: 'XP', value: '2,340', color: '#a855f7' },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl p-3 border border-white/[0.04] bg-white/[0.01]">
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">{s.label}</div>
                        <div className="text-xl font-semibold mt-1" style={{ color: s.color, fontFamily: "'Instrument Serif', serif" }}>{s.value}</div>
                      </div>
                    ))}
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ───── LOGO STRIP ───── */
const LogoStrip = () => (
  <section className="py-16 border-y border-white/[0.04]">
    <div className="max-w-[1200px] mx-auto px-6">
      <div className="text-center text-[11px] uppercase tracking-[0.2em] mb-8 text-gray-500">Trusted by students preparing for</div>
      <div className="flex flex-wrap justify-center items-center gap-x-14 gap-y-4 text-2xl text-gray-500 italic" style={{ fontFamily: "'Instrument Serif', serif" }}>
        {['JEE', 'NEET', 'SAT', 'IB', 'A-Levels', 'AP', 'GCSE', 'CBSE'].map(t => (
          <span key={t} className="opacity-50 hover:opacity-100 transition-opacity">{t}</span>
        ))}
      </div>
    </div>
  </section>
);

/* ───── FEATURES ───── */
const Features = () => (
  <section id="features" className="py-40">
    <div className="max-w-[1200px] mx-auto px-6">
      <div className="max-w-[700px]">
        <div className="text-xs uppercase tracking-[0.18em] mb-4 text-teal-400">Features</div>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-white">A tutor who reads your mind. Quietly.</h2>
        <p className="mt-5 text-lg leading-relaxed text-gray-400">Every feature is built around the moment you almost understood it — and how to make it stick.</p>
      </div>

      <div className="mt-20 grid grid-cols-12 gap-5">
        <div className="md:col-span-7 group relative rounded-2xl p-8 overflow-hidden border border-white/[0.04] bg-gradient-to-b from-white/[0.02] to-transparent min-h-[380px]">
          <div className="relative z-10">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 bg-teal-400/10 border border-teal-400/20">
              <Brain className="w-5 h-5 text-teal-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-white">Adaptive intelligence</h3>
            <p className="text-sm leading-relaxed text-gray-400 max-w-[420px]">Lumina watches what you struggle with and quietly rewires every quiz, explanation, and lesson around your blind spots.</p>
            <div className="mt-7 space-y-4 max-w-[380px]">
              {[
                { topic: 'Gravitation', pct: 84, color: '#2dd4bf' },
                { topic: 'Angular momentum', pct: 31, color: '#f87171' },
                { topic: 'Thermodynamics', pct: 58, color: '#fbbf24' },
              ].map((item, i) => (
                <motion.div key={item.topic} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-300">{item.topic}</span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: item.color }}>{item.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-white/[0.06]">
                    <motion.div initial={{ width: 0 }} whileInView={{ width: `${item.pct}%` }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1, duration: 0.8, ease }} className="h-full rounded-full" style={{ background: item.color }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-5 group relative rounded-2xl p-8 overflow-hidden border border-white/[0.04] bg-gradient-to-b from-white/[0.02] to-transparent min-h-[380px]">
          <div className="relative z-10">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 bg-purple-500/10 border border-purple-500/20">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-white">From any source</h3>
            <p className="text-sm leading-relaxed text-gray-400 max-w-[420px]">Drop a PDF, paste a YouTube link, record a lecture — Lumina turns it into notes, flashcards, and tests in seconds.</p>
            <div className="mt-7 rounded-2xl p-7 max-w-[340px] text-center border border-dashed border-white/[0.08] bg-white/[0.01]">
              <div className="flex justify-center gap-4 mb-4">
                {[{ icon: FileText, label: 'PDF' }, { icon: Play, label: 'YouTube' }, { icon: Brain, label: 'Notes' }].map(s => (
                  <div key={s.label} className="w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 bg-white/[0.03] border border-white/[0.04]">
                    <s.icon className="w-5 h-5 text-gray-500" />
                    <span className="text-[9px] text-gray-500">{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-500">Drop any source — Lumina reads it all</div>
            </div>
          </div>
        </div>

        {[
          { icon: Target, color: '#fbbf24', title: 'Weakness radar', desc: "A live map of every concept you've touched, color-coded by how well you actually know it." },
          { icon: Layers, color: '#38bdf8', title: 'Smart flashcards', desc: 'AI-generated from your own notes, scheduled by spaced repetition science — not vibes.' },
          { icon: LineChart, color: '#2dd4bf', title: 'Honest analytics', desc: "No vanity metrics. Just clear signals on what you know, what you don't, and what to do next." },
        ].map((f, i) => (
          <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5, ease }} className="md:col-span-4 group relative rounded-2xl p-7 overflow-hidden border border-white/[0.04] bg-gradient-to-b from-white/[0.02] to-transparent">
            <div className="relative z-10">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 border" style={{ background: `${f.color}10`, borderColor: `${f.color}25` }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-400 max-w-[420px]">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ───── HOW IT WORKS ───── */
const HowItWorks = () => (
  <section id="how" className="py-40">
    <div className="max-w-[1200px] mx-auto px-6">
      <div className="max-w-[700px]">
        <div className="text-xs uppercase tracking-[0.18em] mb-4 text-teal-400">How it works</div>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-white">Three steps. Then it runs itself.</h2>
        <p className="mt-5 text-lg leading-relaxed text-gray-400">No setup ritual. Drop your material, ask one question, and Lumina builds the map.</p>
      </div>
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { n: '01', title: 'Bring your material', desc: 'PDFs, YouTube, voice notes, scribbled notes — Lumina ingests anything and structures it.', icon: FileText },
          { n: '02', title: 'Think out loud', desc: 'Ask anything. Lumina draws, derives, and quizzes — calibrated to exactly where you are.', icon: Brain },
          { n: '03', title: 'Watch the gaps close', desc: 'Your mastery map updates after every session. The difference shows up in a week.', icon: TrendingUp },
        ].map((step, i) => (
          <motion.div key={step.n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.5, ease }} className="relative rounded-2xl p-8 border border-white/[0.04] bg-white/[0.01]">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-bold tabular-nums text-teal-400 font-mono">{step.n}</span>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-400/10 border border-teal-400/20">
                <step.icon className="w-4 h-4 text-teal-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-white">{step.title}</h3>
            <p className="text-sm leading-relaxed text-gray-400">{step.desc}</p>
            {i < 2 && <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-white/[0.06]" />}
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ───── TESTIMONIALS ───── */
const Testimonials = () => (
  <section className="py-40">
    <div className="max-w-[1200px] mx-auto px-6">
      <div className="max-w-[700px]">
        <div className="text-xs uppercase tracking-[0.18em] mb-4 text-teal-400">Voices from the beta</div>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-white">Built for real classrooms, not a launch headline.</h2>
      </div>
      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { quote: "It found gaps I didn't know I had — then made me fix them without ever feeling like homework.", author: "JEE aspirant · Hyderabad", score: "9/10" },
          { quote: "Lumina is the only thing on my laptop that actually behaves like a tutor, not a search bar.", author: "IB Diploma · Year 12", score: "9/10" },
          { quote: "The mastery map ended my 'I'll just re-read it' habit. I study less, retain more. Brutal upgrade.", author: "NEET repeater", score: "10/10" },
        ].map((t, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5, ease }} className="rounded-2xl p-7 md:p-8 border border-white/[0.04] bg-white/[0.01]">
            <div className="flex items-center gap-1 mb-5">
              {[...Array(parseInt(t.score.split('/')[0]) >= 9 ? 5 : 4)].map((_, j) => <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
              <span className="ml-2 text-xs font-medium text-gray-500">{t.score}</span>
            </div>
            <p className="text-lg leading-relaxed mb-6 italic text-gray-300" style={{ fontFamily: "'Instrument Serif', serif" }}>"{t.quote}"</p>
            <div className="text-xs text-gray-500">— {t.author}</div>
          </motion.div>
        ))}
      </div>
      <p className="text-center text-xs mt-7 text-gray-500">We're a new platform. You'll see more voices here as they come in — never invented ones.</p>
    </div>
  </section>
);

/* ───── PRICING ───── */
const Pricing = () => {
  const navigate = useNavigate();
  const plans = [
    {
      name: 'Free',
      price: '₹0',
      period: 'forever',
      desc: 'Start learning today',
      features: [
        'AI Chat with Lumina',
        'Basic flashcards & notes',
        '3 tests / day',
        'Weakness radar (limited)',
      ],
      cta: 'Get started',
      featured: false,
    },
    {
      name: 'Lumina Ultimate',
      price: '₹199',
      period: '/month',
      desc: 'The full study OS',
      features: [
        'Everything in Free',
        'Unlimited tests & flashcards',
        'Lecture AI (transcribe + quiz)',
        'Notes Generator + Smart Notebook',
        'Full Weakness Radar',
        'Priority AI speed',
      ],
      cta: 'Start free trial',
      featured: true,
    },
    {
      name: 'PRO+',
      price: '₹499',
      period: '/month',
      desc: 'For the obsessed',
      features: [
        'Everything in Ultimate',
        'Brain Hub — 10 neurocognitive engines',
        'Smart Paper Generator',
        'Predicted Question Generator',
        'Concept Map Mastery',
        'Highest model priority',
      ],
      cta: 'Go PRO+',
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="py-40">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-[700px]">
          <div className="text-xs uppercase tracking-[0.18em] mb-4 text-teal-400">Pricing</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-white">Start free. Upgrade when it pays you back.</h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-400">No credit card. No 14-day countdowns. Cancel in two clicks.</p>
        </div>
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, i) => (
            <motion.div key={plan.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5, ease }} className="relative rounded-2xl p-8 border" style={{ background: plan.featured ? 'linear-gradient(180deg, rgba(45,212,191,0.06), rgba(168,85,247,0.02))' : 'rgba(255,255,255,0.01)', borderColor: plan.featured ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.04)' }}>
              {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold text-black" style={{ background: 'linear-gradient(135deg, #2dd4bf, #a78bfa)' }}>Most popular</div>}
              <div className="text-sm font-semibold mb-1 text-white">{plan.name}</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-semibold tracking-tight text-white" style={{ fontFamily: "'Instrument Serif', serif" }}>{plan.price}</span>
                <span className="text-sm text-gray-500">{plan.period}</span>
              </div>
              <div className="text-sm mb-7 text-gray-400">{plan.desc}</div>
              <button
                onClick={() => navigate('/auth')}
                className="w-full h-11 rounded-xl text-sm font-semibold transition-all hover:opacity-90 border-none cursor-pointer"
                style={
                  plan.featured
                    ? { background: 'linear-gradient(135deg, #2dd4bf, #a78bfa)', color: '#06060a', boxShadow: '0 8px 24px -8px rgba(45,212,191,0.45)' }
                    : { background: 'rgba(255,255,255,0.06)', color: 'white' }
                }
              >
                {plan.cta}
              </button>
              <div className="mt-7 space-y-2.5">{plan.features.map(f => <div key={f} className="flex items-center gap-2.5 text-sm text-gray-400"><Check className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />{f}</div>)}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ───── FAQ ───── */
const FAQ = () => {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: 'How is Lumina different from ChatGPT?', a: "ChatGPT answers. Lumina remembers, maps, and trains you. It tracks every concept you've touched, schedules what to revisit, and generates tests calibrated to your blind spots." },
    { q: 'What subjects does Lumina support?', a: "Every major academic subject — Physics, Chemistry, Mathematics, Biology, English, History — from high school through university." },
    { q: 'Is Lumina available on mobile?', a: 'Yes. Fully responsive on phones, tablets, and desktops. Your progress syncs everywhere.' },
    { q: 'How does the adaptive algorithm actually work?', a: "We track per-concept mastery using your test scores, mistake patterns, and time-on-question. The next test you generate is biased toward what you almost-knew, using spaced repetition timing." },
    { q: 'Is there really a free plan?', a: 'Yes — free forever. AI Chat, basic flashcards, 3 tests a day, and a performance dashboard. No card required.' },
  ];

  return (
    <section id="faq" className="py-40">
      <div className="max-w-[760px] mx-auto px-6">
        <div className="max-w-[700px]">
          <div className="text-xs uppercase tracking-[0.18em] mb-4 text-teal-400">FAQ</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-white">Things people actually ask.</h2>
        </div>
        <div className="mt-14 space-y-2">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-white/[0.04] bg-white/[0.01]">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left bg-transparent border-none cursor-pointer">
                <span className="text-sm font-medium pr-4 text-white">{f.q}</span>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform text-gray-500 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="px-5 pb-4 text-sm leading-relaxed text-gray-400">{f.a}</div>
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

/* ───── CTA ───── */
const CTASection = () => {
  const navigate = useNavigate();
  return (
    <section className="py-40">
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="relative rounded-3xl overflow-hidden p-14 md:p-24 text-center border border-white/[0.06]" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,0.06) 0%, rgba(167,139,250,0.06) 50%, rgba(6,6,10,0.6) 100%)' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-semibold mb-5 text-white" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, letterSpacing: '-0.02em' }}>
              Stop reviewing. Start <em className="italic bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(120deg, #2dd4bf, #a78bfa)' }}>knowing</em>.
            </h2>
            <p className="text-base mb-10 leading-relaxed text-gray-400">Free forever for the essentials. Upgrade when the time you save is worth more than the price.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => navigate('/auth')}
                className="inline-flex items-center gap-2 rounded-xl px-8 h-14 text-base font-semibold border-none cursor-pointer transition-all"
                style={{
                  background: 'linear-gradient(135deg, #2dd4bf 0%, #a78bfa 100%)',
                  color: '#06060a',
                  boxShadow: '0 16px 48px -12px rgba(45,212,191,0.5)',
                }}
              >
                Get started — free <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-2 rounded-xl px-7 h-14 text-base font-medium text-white border border-white/10 bg-white/[0.02] cursor-pointer hover:bg-white/[0.06] transition-all">View pricing</button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

/* ───── FOOTER ───── */
const Footer = () => (
  <footer className="border-t border-white/[0.04] py-14">
    <div className="max-w-[1200px] mx-auto px-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2dd4bf, #a855f7)' }}><Sparkles className="w-3.5 h-3.5 text-black" /></div>
          <span className="text-lg text-white" style={{ fontFamily: "'Instrument Serif', serif" }}>Lumina</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-white transition-colors">Terms</a>
          <span>© 2026 Lumina. Built for students who mean it.</span>
        </div>
      </div>
    </div>
  </footer>
);

/* ───── PAGE ───── */
const Landing = () => (
  <div className="min-h-screen relative" style={{ background: '#06060a' }}>
    <CineBackground />
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
