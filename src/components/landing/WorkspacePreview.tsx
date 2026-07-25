import { motion } from 'framer-motion';
import { Home, Bot, FolderKanban, Search, Brain, Workflow, Settings, MessageSquare, BarChart3, FileText, Globe, Eye } from 'lucide-react';

const sidebarItems = [
  { icon: Home, label: 'Home', active: true },
  { icon: Bot, label: 'Agents', active: false },
  { icon: FolderKanban, label: 'Projects', active: false },
  { icon: Search, label: 'Research', active: false },
  { icon: Brain, label: 'Knowledge', active: false },
  { icon: Workflow, label: 'Workflows', active: false },
  { icon: Settings, label: 'Settings', active: false },
];

const conversationMessages = [
  { role: 'user', text: 'Analyze recent trends in quantum computing startups' },
  { role: 'agent', text: 'I\'ll launch a multi-agent research workflow to analyze this.' },
  { role: 'system', text: 'Research Agent: Found 247 relevant sources across 12 databases' },
  { role: 'system', text: 'Market Agent: Identified 8 key startups with Series A+ funding' },
  { role: 'agent', text: 'Here\'s your comprehensive analysis with investment recommendations.' },
];

const insightCards = [
  { icon: FileText, label: 'Reports', count: 12, color: '#06b6d4' },
  { icon: Globe, label: 'Sources', count: 247, color: '#8b5cf6' },
  { icon: Eye, label: 'Insights', count: 34, color: '#10b981' },
  { icon: BarChart3, label: 'Visualizations', count: 8, color: '#f59e0b' },
];

export const WorkspacePreview = () => {
  return (
    <section id="workspace" className="relative py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Agentic</span>{' '}
            Workspace
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            A futuristic dashboard where you command AI agents, manage projects, and watch insights come alive.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="liquid-glass-elevated rounded-3xl overflow-hidden shadow-2xl"
        >
          <div className="flex h-[520px]">
            <div className="w-16 md:w-56 border-r border-white/5 flex flex-col bg-black/20">
              <div className="p-3 md:p-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
                    <span className="text-white font-bold text-[10px]">L</span>
                  </div>
                  <span className="hidden md:block text-sm font-semibold text-white">Lumina</span>
                </div>
              </div>
              <nav className="flex-1 p-2 space-y-0.5">
                {sidebarItems.map((item) => (
                  <button
                    key={item.label}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                      item.active
                        ? 'bg-white/10 text-white'
                        : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="hidden md:block">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex">
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {conversationMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.15 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-white/5 text-white'
                            : msg.role === 'agent'
                            ? 'bg-white/5 border border-white/5 text-white'
                            : 'bg-white/[0.02] border border-white/[0.03] text-white/60'
                        }`}
                      >
                        {msg.role !== 'user' && (
                          <div className="flex items-center gap-2 mb-1.5">
                            {msg.role === 'agent' ? (
                              <Bot className="w-3.5 h-3.5 text-cyan-400" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full bg-violet-500/30 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                              </div>
                            )}
                            <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">
                              {msg.role === 'agent' ? 'Lumina' : msg.role}
                            </span>
                          </div>
                        )}
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                  <div className="flex items-center gap-2 px-4">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-xs text-white/20">AI agent is analyzing...</span>
                  </div>
                </div>

                <div className="w-56 xl:w-64 border-l border-white/5 p-4 hidden md:block overflow-y-auto">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Live Insights</h3>
                  <div className="space-y-3">
                    {insightCards.map((card) => (
                      <div key={card.label} className="liquid-glass rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <card.icon className="w-4 h-4" style={{ color: card.color }} />
                          <span className="text-xs font-bold text-white">{card.count}</span>
                        </div>
                        <div className="text-xs text-white/40">{card.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 p-3 flex items-center gap-3">
                <div className="flex-1 bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white/20 border border-white/5">
                  Ask Lumina to research, analyze, or create something...
                </div>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
