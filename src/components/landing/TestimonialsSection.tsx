import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Founder & CEO',
    company: 'TechVentures',
    avatar: 'SC',
    color: '#06b6d4',
    text: 'Lumina has fundamentally changed how we approach market research. What used to take a team of five a full week now takes our AI agents a few hours. The depth and quality of analysis is extraordinary.',
    metric: 'Saved 20 hours per week',
  },
  {
    name: 'Marcus Williams',
    role: 'Research Director',
    company: 'Global Insights Institute',
    avatar: 'MW',
    color: '#8b5cf6',
    text: 'The multi-agent collaboration is unlike anything I\'ve seen. Research Agent pulls sources, Market Agent validates trends, Writer Agent synthesizes — all working in perfect harmony. Research quality improved 300%.',
    metric: 'Research quality +300%',
  },
  {
    name: 'Priya Patel',
    role: 'PhD Candidate',
    company: 'Stanford University',
    avatar: 'PP',
    color: '#10b981',
    text: 'My dissertation research was transformed. Lumina\'s ability to cross-reference thousands of papers and identify research gaps accelerated my literature review by months.',
    metric: 'Months saved on research',
  },
  {
    name: 'James O\'Brien',
    role: 'VP of Strategy',
    company: 'Fortune 500',
    avatar: 'JO',
    color: '#f59e0b',
    text: 'We deploy Lumina across our strategy team for competitive intelligence. The autonomous monitoring and insight generation gives us a significant edge in decision-making speed.',
    metric: 'Decision speed increased 4x',
  },
];

export const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="relative py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Trusted by{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Thinkers</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            From founders to researchers, teams worldwide rely on Lumina.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          {testimonials.map((t, idx) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="group liquid-glass rounded-2xl p-6 hover:scale-[1.01] transition-all duration-300"
            >
              <Quote className="w-6 h-6 mb-4" style={{ color: `${t.color}40` }} />
              <p className="text-sm md:text-base text-white/70 leading-relaxed mb-6">
                "{t.text}"
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{ background: `${t.color}20`, color: t.color }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-white/40">{t.role} · {t.company}</div>
                  </div>
                </div>
                <div className="hidden md:block text-right">
                  <div className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                    {t.metric}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
