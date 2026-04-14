import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah Johnson',
    major: 'Medical Student',
    initials: 'SJ',
    color: '#2dd4bf',
    text: 'Lumina has completely changed how I study for my boards. The AI-generated tests are incredibly accurate and help me focus on my weak areas.',
  },
  {
    name: 'David Chen',
    major: 'Computer Science Major',
    initials: 'DC',
    color: '#a855f7',
    text: 'The smart flashcards feature is a lifesaver. I can just upload my lecture slides and have a full deck ready in seconds. Highly recommended!',
  },
  {
    name: 'Emily Rodriguez',
    major: 'High School Senior',
    initials: 'ER',
    color: '#fbbf24',
    text: "I used to struggle with staying motivated, but the gamified progress in Lumina makes studying feel like a game. My grades have never been better.",
  },
];

const founders = [
  { name: 'Tarun Kartikeya', role: 'Co-Founder', initials: 'TK', color: '#2dd4bf' },
  { name: 'Akshaj Sai', role: 'Co-Founder', initials: 'AS', color: '#a855f7' },
];

export const Testimonials = () => (
  <section className="py-12 space-y-12">
    <div>
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-2xl font-bold text-center mb-8"
        style={{ color: '#f1f5f9' }}
      >
        Trusted by students worldwide
      </motion.h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="rounded-[14px] p-6 hover:translate-y-[-2px] transition-transform"
            style={{
              background: '#111827',
              border: '0.5px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="flex gap-0.5 mb-4">
              {[...Array(5)].map((_, j) => (
                <Star key={j} className="w-4 h-4 fill-current" style={{ color: '#fbbf24' }} />
              ))}
            </div>
            <p className="text-[15px] leading-relaxed mb-6 italic" style={{ color: '#cbd5e1' }}>
              "{t.text}"
            </p>
            <div className="flex items-center gap-3 mt-auto">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold"
                style={{ background: `${t.color}20`, color: t.color }}
              >
                {t.initials}
              </div>
              <div>
                <p className="text-[13px] font-bold" style={{ color: '#f1f5f9' }}>{t.name}</p>
                <p className="text-[11px]" style={{ color: '#64748b' }}>{t.major}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>

    {/* Founders Section */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-center space-y-6"
    >
      <h3 className="text-lg font-semibold" style={{ color: '#94a3b8' }}>Built by</h3>
      <div className="flex justify-center gap-8">
        {founders.map(f => (
          <div key={f.name} className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: `${f.color}15`, color: f.color, border: `1px solid ${f.color}30` }}
            >
              {f.initials}
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>{f.name}</p>
              <p className="text-[11px]" style={{ color: '#64748b' }}>{f.role}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  </section>
);
