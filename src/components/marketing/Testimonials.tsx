import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah',
    major: 'Medical Student',
    initials: 'S',
    color: '#2dd4bf',
    text: 'Lumina completely changed how I study for anatomy. The AI-generated flashcards and spaced repetition helped me retain 40% more information before exams.',
  },
  {
    name: 'David',
    major: 'Computer Science Major',
    initials: 'D',
    color: '#a855f7',
    text: 'The doubt solver is incredible. I can ask complex algorithm questions and get step-by-step explanations instantly. It\'s like having a tutor available 24/7.',
  },
  {
    name: 'Emily',
    major: 'High School Senior',
    initials: 'E',
    color: '#fbbf24',
    text: 'I improved my physics score from 52% to 84% in just two months. The performance analytics showed me exactly where to focus my energy.',
  },
];

export const Testimonials = () => (
  <section className="py-12">
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
          className="rounded-[14px] p-5 hover:translate-y-[-2px] transition-transform"
          style={{
            background: '#111827',
            border: '0.5px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="flex gap-0.5 mb-3">
            {[...Array(5)].map((_, j) => (
              <Star key={j} className="w-3.5 h-3.5 fill-current" style={{ color: '#fbbf24' }} />
            ))}
          </div>
          <p className="text-[13px] leading-relaxed mb-4" style={{ color: '#94a3b8' }}>"{t.text}"</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold" style={{ background: `${t.color}20`, color: t.color }}>
              {t.initials}
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: '#f1f5f9' }}>{t.name}</p>
              <p className="text-[11px]" style={{ color: '#64748b' }}>{t.major}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  </section>
);
