import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { MessageSquare, Network, Play, Lightbulb, CheckCircle2 } from 'lucide-react';

const steps = [
  { icon: MessageSquare, label: 'Ask', desc: 'Pose any question or goal in natural language', color: '#06b6d4' },
  { icon: Network, label: 'Agents Plan', desc: 'AI agents decompose your request into a strategy', color: '#8b5cf6' },
  { icon: Play, label: 'Agents Execute', desc: 'Agents work in parallel across domains', color: '#10b981' },
  { icon: Lightbulb, label: 'Insights Generated', desc: 'Raw data becomes actionable intelligence', color: '#f59e0b' },
  { icon: CheckCircle2, label: 'Results Delivered', desc: 'Polished output with sources and reasoning', color: '#ec4899' },
];

export const HowItWorks = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  });

  return (
    <section id="how-it-works" ref={containerRef} className="relative py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            From Question to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Insight</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Lumina transforms your intent into results through autonomous agent collaboration.
          </p>
        </motion.div>

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8 md:gap-4">
          {/* Progress line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-white/5 -translate-y-1/2 z-0">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
              style={{ scaleX: scrollYProgress, transformOrigin: 'left' }}
            />
          </div>

          {steps.map((step, idx) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="relative z-10 flex md:flex-col items-center gap-4 md:gap-3 md:text-center w-full md:w-auto"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `${step.color}15`, border: `1px solid ${step.color}30` }}
              >
                <step.icon className="w-6 h-6 md:w-7 md:h-7" style={{ color: step.color }} />
              </motion.div>
              <div className="flex-1 md:flex-none">
                <div className="text-base md:text-lg font-semibold text-white mb-1">{step.label}</div>
                <div className="text-xs md:text-sm text-white/40 max-w-[200px]">{step.desc}</div>
              </div>
              {idx < steps.length - 1 && (
                <div className="hidden md:block w-8 h-0.5 bg-gradient-to-r from-white/10 to-transparent" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
