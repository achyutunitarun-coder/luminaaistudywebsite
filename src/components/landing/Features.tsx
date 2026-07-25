import { motion } from 'framer-motion';
import { Bot, Search, Workflow, Brain, GitBranch, Lightbulb, Network, Shield } from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: 'Multi-Agent Collaboration',
    description: 'Multiple specialized AI agents work in concert — each with unique skills, sharing context and building on each other\'s results.',
    gradient: 'from-cyan-500/20 to-cyan-400/5',
    border: 'border-cyan-500/20',
    glow: 'shadow-cyan-500/10',
  },
  {
    icon: Search,
    title: 'Deep Research Engine',
    description: 'Autonomous research across thousands of sources, filtering, cross-referencing, and synthesizing information into actionable insights.',
    gradient: 'from-violet-500/20 to-violet-400/5',
    border: 'border-violet-500/20',
    glow: 'shadow-violet-500/10',
  },
  {
    icon: Workflow,
    title: 'Autonomous Task Execution',
    description: 'Define goals, and Lumina plans, executes, and iterates through complex multi-step tasks without human intervention.',
    gradient: 'from-emerald-500/20 to-emerald-400/5',
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-500/10',
  },
  {
    icon: Brain,
    title: 'Memory System',
    description: 'Persistent memory across sessions. Lumina remembers context, preferences, and past work to provide continuity.',
    gradient: 'from-amber-500/20 to-amber-400/5',
    border: 'border-amber-500/20',
    glow: 'shadow-amber-500/10',
  },
  {
    icon: GitBranch,
    title: 'Workflow Automation',
    description: 'Create custom workflows by chaining agent actions. Automate repetitive research and analysis pipelines.',
    gradient: 'from-pink-500/20 to-pink-400/5',
    border: 'border-pink-500/20',
    glow: 'shadow-pink-500/10',
  },
  {
    icon: Lightbulb,
    title: 'Insight Generation',
    description: 'AI identifies patterns, correlations, and opportunities you might miss, delivering high-signal insights.',
    gradient: 'from-cyan-500/20 to-violet-500/5',
    border: 'border-cyan-500/20',
    glow: 'shadow-cyan-500/10',
  },
  {
    icon: Network,
    title: 'Knowledge Graph',
    description: 'Automatically build a rich, interconnected knowledge graph from your research and interactions.',
    gradient: 'from-violet-500/20 to-pink-500/5',
    border: 'border-violet-500/20',
    glow: 'shadow-violet-500/10',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'SOC 2 compliant, end-to-end encrypted, with granular access controls and private knowledge storage.',
    gradient: 'from-emerald-500/20 to-cyan-500/5',
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-500/10',
  },
];

export const Features = () => {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Everything an{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Agentic</span>{' '}
            OS Needs
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            A comprehensive suite of AI capabilities, designed to work together seamlessly.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className={`group relative liquid-glass rounded-2xl p-6 border ${feature.border} hover:scale-[1.02] transition-all duration-500 cursor-default ${feature.glow}`}
            >
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-5 h-5 text-white/70" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{feature.description}</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
