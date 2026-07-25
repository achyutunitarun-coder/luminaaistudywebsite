import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, Calculator, FileText, BarChart3, CheckCircle2, Loader2 } from 'lucide-react';

type AgentStatus = 'pending' | 'working' | 'done';

interface Agent {
  id: string;
  name: string;
  icon: typeof Search;
  color: string;
  steps: string[];
  status: AgentStatus;
  currentStep: number;
}

const agents: Agent[] = [
  { id: 'research', name: 'Research Agent', icon: Search, color: '#06b6d4', steps: ['Scanning academic databases...', 'Analyzing 200+ sources...', 'Filtering by relevance...', 'Compiling key findings...'], status: 'pending', currentStep: 0 },
  { id: 'market', name: 'Market Agent', icon: TrendingUp, color: '#8b5cf6', steps: ['Identifying market trends...', 'Analyzing growth patterns...', 'Mapping competitors...', 'Projecting trajectories...'], status: 'pending', currentStep: 0 },
  { id: 'finance', name: 'Finance Agent', icon: Calculator, color: '#10b981', steps: ['Building valuation models...', 'Analyzing revenue streams...', 'Calculating unit economics...', 'Generating projections...'], status: 'pending', currentStep: 0 },
  { id: 'writer', name: 'Writer Agent', icon: FileText, color: '#f59e0b', steps: ['Structuring report...', 'Drafting executive summary...', 'Integrating insights...', 'Polishing narrative...'], status: 'pending', currentStep: 0 },
  { id: 'visualizer', name: 'Visualizer Agent', icon: BarChart3, color: '#ec4899', steps: ['Creating market charts...', 'Generating growth graphs...', 'Building comparison tables...', 'Assembling dashboard...'], status: 'pending', currentStep: 0 },
];

const DEMO_OUTPUT = `# EV Market Investment Thesis

## Executive Summary
The electric vehicle market is positioned for exponential growth with a projected CAGR of 21.7% through 2030.

## Key Insights
- **Market Size**: $500B+ by 2030
- **Growth Drivers**: Battery technology, charging infrastructure, regulatory support
- **Leading Players**: Tesla maintains 18% market share; Chinese OEMs growing rapidly
- **Emerging Opportunities**: Solid-state batteries, V2G technology, autonomous EV fleets

## Recommendation
**Strong Buy** — Market leaders and innovative battery manufacturers present the highest risk-adjusted returns over a 5-year horizon.`;

export const AgentDemo = () => {
  const [started, setStarted] = useState(false);
  const [agentStates, setAgentStates] = useState<Agent[]>(agents);
  const [showOutput, setShowOutput] = useState(false);
  const [displayedOutput, setDisplayedOutput] = useState('');

  const startDemo = useCallback(() => {
    setStarted(true);
    setShowOutput(false);
    setDisplayedOutput('');
    setAgentStates(agents.map(a => ({ ...a, status: 'pending' as AgentStatus, currentStep: 0 })));

    agents.forEach((_, idx) => {
      setTimeout(() => {
        setAgentStates(prev => prev.map((a, i) => {
          if (i < idx) return { ...a, status: 'done' as AgentStatus, currentStep: a.steps.length };
          if (i === idx) return { ...a, status: 'working' as AgentStatus, currentStep: 0 };
          return a;
        }));

        let step = 0;
        const stepInterval = setInterval(() => {
          step++;
          setAgentStates(prev => prev.map((a, i) => {
            if (i === idx) return { ...a, currentStep: step };
            return a;
          }));
          if (step >= agents[idx].steps.length) {
            clearInterval(stepInterval);
            setAgentStates(prev => prev.map((a, i) => {
              if (i === idx) return { ...a, status: 'done' as AgentStatus };
              return a;
            }));
            if (idx === agents.length - 1) {
              setTimeout(() => {
                setShowOutput(true);
                let charIdx = 0;
                const outputInterval = setInterval(() => {
                  charIdx++;
                  setDisplayedOutput(DEMO_OUTPUT.slice(0, charIdx));
                  if (charIdx >= DEMO_OUTPUT.length) clearInterval(outputInterval);
                }, 10);
              }, 500);
            }
          }
        }, 600 + Math.random() * 400);
      }, idx * 2500);
    });
  }, []);

  return (
    <section id="demo" className="relative py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            See Agents in{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Action</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Watch multiple AI agents collaborate in real-time to research, analyze, and deliver insights.
          </p>
        </motion.div>

        <div className="liquid-glass-elevated rounded-3xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
            <div className="flex-1 bg-white/5 rounded-2xl px-5 py-3.5 text-sm text-white/30 border border-white/5 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Analyze the EV market and create an investment thesis</span>
            </div>
            {!started ? (
              <button
                onClick={startDemo}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold text-sm hover:from-cyan-400 hover:to-violet-400 transition-all shadow-lg shadow-cyan-500/20 whitespace-nowrap"
              >
                Run Demo
              </button>
            ) : (
              <div className="px-6 py-3 rounded-2xl bg-emerald-500/10 text-emerald-400 font-semibold text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Running
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {agentStates.map((agent, idx) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`liquid-glass rounded-2xl p-4 transition-all duration-500 ${agent.status === 'working' ? 'border-cyan-500/30 shadow-lg shadow-cyan-500/5' : agent.status === 'done' ? 'border-emerald-500/20' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${agent.color}20` }}>
                      <agent.icon className="w-4 h-4" style={{ color: agent.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{agent.name}</div>
                      <div className="text-xs text-white/40">
                        {agent.status === 'pending' && 'Waiting...'}
                        {agent.status === 'working' && agent.steps[agent.currentStep]?.slice(0, 40)}
                        {agent.status === 'done' && 'Complete'}
                      </div>
                    </div>
                    <div>
                      {agent.status === 'pending' && <div className="w-5 h-5 rounded-full border border-white/10" />}
                      {agent.status === 'working' && <Loader2 className="w-5 h-5 animate-spin" style={{ color: agent.color }} />}
                      {agent.status === 'done' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    </div>
                  </div>
                  {agent.status === 'working' && (
                    <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: agent.color }}
                        initial={{ width: '0%' }}
                        animate={{ width: `${(agent.currentStep / agent.steps.length) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <div className="relative">
              <AnimatePresence>
                {showOutput && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="liquid-glass rounded-2xl p-5 h-full max-h-[420px] overflow-y-auto"
                  >
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-xs font-medium text-white/60">Final Output — Investment Thesis</span>
                    </div>
                    <pre className="text-xs text-white/80 leading-relaxed font-mono whitespace-pre-wrap">
                      {displayedOutput}
                      {displayedOutput.length < DEMO_OUTPUT.length && (
                        <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-0.5" />
                      )}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
              {!showOutput && started && (
                <div className="liquid-glass rounded-2xl p-5 h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-3" />
                    <p className="text-sm text-white/40">Agents are working...</p>
                  </div>
                </div>
              )}
              {!started && (
                <div className="liquid-glass rounded-2xl p-5 h-full flex items-center justify-center">
                  <div className="text-center text-white/20">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Click "Run Demo" to see agents in action</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
