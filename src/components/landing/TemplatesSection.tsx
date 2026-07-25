import { motion } from 'framer-motion';
import { TrendingUp, Building2, Landmark, GraduationCap, Target, Rocket, TrendingDown } from 'lucide-react';

const templates = [
  { icon: TrendingUp, title: 'Market Research', desc: 'Deep market analysis with competitive landscape mapping', color: '#06b6d4' },
  { icon: Building2, title: 'Startup Analysis', desc: 'Comprehensive startup evaluation and due diligence', color: '#8b5cf6' },
  { icon: Landmark, title: 'MUN Research', desc: 'Policy research and position paper generation', color: '#10b981' },
  { icon: GraduationCap, title: 'Academic Research', desc: 'Literature review and research synthesis', color: '#f59e0b' },
  { icon: Target, title: 'Competitive Intelligence', desc: 'Track competitors, market positioning, and threats', color: '#ec4899' },
  { icon: Rocket, title: 'Product Launch Planning', desc: 'Go-to-market strategy and launch execution', color: '#06b6d4' },
  { icon: TrendingDown, title: 'Growth Strategy', desc: 'Data-driven growth frameworks and roadmaps', color: '#8b5cf6' },
];

export const TemplatesSection = () => {
  return (
    <section id="templates" className="relative py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Agent{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Templates</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Pre-built agentic workflows to accelerate your most important work.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((template, idx) => (
            <motion.div
              key={template.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className="group liquid-glass rounded-2xl p-5 hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                style={{ background: `${template.color}15` }}
              >
                <template.icon className="w-5 h-5" style={{ color: template.color }} />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{template.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{template.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-xs text-white/20 group-hover:text-white/50 transition-colors">
                <span>Use template</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
