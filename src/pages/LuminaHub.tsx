import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Sparkles, Activity, Database, Cpu, Network,
  MessageSquare, FileText, Target, Zap, Shield,
  ChevronRight, Clock, TrendingUp, Layers, Eye,
  RefreshCw, Settings2, Globe, Workflow, Search,
  Trash2, Download, Plus, Hash
} from 'lucide-react';

const navItems = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'memory', label: 'Memory', icon: Database },
  { id: 'agents', label: 'Agents', icon: Workflow },
  { id: 'context', label: 'Context', icon: Layers },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

const recentItems = [
  { title: 'Quantum Entanglement Explanation', type: 'Memory', time: '2m ago', accent: '#7C5CFC' },
  { title: 'Thermodynamics Practice Set', type: 'Generated', time: '15m ago', accent: '#2DD4BF' },
  { title: 'Cell Division Notes', type: 'Notes', time: '1h ago', accent: '#FBBF24' },
  { title: 'Angular Momentum Weakness', type: 'Insight', time: '2h ago', accent: '#F87171' },
  { title: 'Photosynthesis Flashcards', type: 'Flashcards', time: '3h ago', accent: '#34D399' },
];

const memoryItems = [
  { title: 'Newton\'s Three Laws', category: 'Physics', strength: 92, lastReviewed: '1 day ago' },
  { title: 'Photosynthesis Process', category: 'Biology', strength: 78, lastReviewed: '3 days ago' },
  { title: 'Derivatives Chain Rule', category: 'Math', strength: 85, lastReviewed: '2 days ago' },
  { title: 'Chemical Bonding Types', category: 'Chemistry', strength: 64, lastReviewed: '1 week ago' },
  { title: 'World War II Timeline', category: 'History', strength: 71, lastReviewed: '5 days ago' },
  { title: 'JavaScript Promises', category: 'Coding', strength: 88, lastReviewed: '1 day ago' },
  { title: 'Mitochondria Function', category: 'Biology', strength: 90, lastReviewed: '2 days ago' },
  { title: 'Thermodynamics Laws', category: 'Physics', strength: 55, lastReviewed: '1 week ago' },
];

const agentItems = [
  { name: 'Study Planner', status: 'active', lastRun: '5m ago', tasks: 12, accent: '#7C5CFC' },
  { name: 'Flashcard Generator', status: 'idle', lastRun: '2h ago', tasks: 48, accent: '#2DD4BF' },
  { name: 'Notes Summarizer', status: 'active', lastRun: '10m ago', tasks: 7, accent: '#FBBF24' },
  { name: 'Weakness Detector', status: 'idle', lastRun: '1d ago', tasks: 3, accent: '#F87171' },
  { name: 'Quiz Builder', status: 'active', lastRun: '30m ago', tasks: 15, accent: '#34D399' },
];

const contextItems = [
  { topic: 'Current Focus', value: 'Angular Momentum in Rotational Dynamics', updated: '5m ago' },
  { topic: 'Study Streak', value: '12 days', updated: '1h ago' },
  { topic: 'Mastery Level', value: 'Intermediate Physics', updated: '2h ago' },
  { topic: 'Weak Areas', value: 'Cross-product torque, Moment of inertia', updated: '1h ago' },
  { topic: 'Strong Areas', value: 'Linear kinematics, Energy conservation', updated: '3h ago' },
  { topic: 'Last Session', value: 'Thermodynamics practice (84%)', updated: '15m ago' },
];

const BrainHub = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('overview');

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 pt-8 flex items-start justify-between"
      >
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="font-display text-3xl text-white leading-tight">Brain Hub</h1>
              <p className="text-xs text-gray-500 mt-0.5">Your central intelligence dashboard</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/chat')}
          className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-medium bg-brand/10 text-brand border border-brand/20 hover:bg-brand/15 transition-all"
        >
          <Zap className="w-3.5 h-3.5" />
          Ask Lumina
        </button>
      </motion.div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0">
          <div className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13px] font-medium transition-all ${
                    active
                      ? 'bg-brand/10 text-brand border border-brand/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeNav === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Active Memories', value: '2,847', change: '+124 today', icon: Database, accent: '#7C5CFC' },
                    { label: 'Agent Actions', value: '189', change: '+23 today', icon: Cpu, accent: '#2DD4BF' },
                    { label: 'Context Score', value: '94%', change: 'Excellent', icon: Eye, accent: '#FBBF24' },
                    { label: 'Knowledge Nodes', value: '1.2k', change: 'Growing', icon: Network, accent: '#A78BFA' },
                  ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.4 }}
                        className="rounded-xl p-4 bg-white/[0.025] border border-white/[0.06]"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.accent}15` }}>
                            <Icon className="w-4 h-4" style={{ color: stat.accent }} />
                          </div>
                          <span className="text-[10px] font-medium text-gray-600">{stat.change}</span>
                        </div>
                        <div className="text-xl font-semibold text-white mb-0.5">{stat.value}</div>
                        <div className="text-[11px] text-gray-500">{stat.label}</div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Recent Activity */}
                <div className="rounded-xl bg-white/[0.025] border border-white/[0.06]">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
                    <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
                    <button className="text-[11px] text-gray-500 hover:text-brand transition-colors flex items-center gap-1">
                      View all <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {recentItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer group">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.accent }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-white truncate group-hover:text-brand transition-colors">{item.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-500 font-medium">{item.type}</span>
                            <span className="text-[10px] text-gray-600 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {item.time}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Memory Health */}
                <div className="mt-4 rounded-xl p-5 bg-white/[0.025] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-white">Memory Health</h2>
                    <button className="text-[11px] text-gray-500 hover:text-brand transition-colors flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Study Progress', pct: 84, color: '#7C5CFC' },
                      { label: 'Concept Mastery', pct: 72, color: '#2DD4BF' },
                      { label: 'Retention Score', pct: 91, color: '#FBBF24' },
                      { label: 'Activity Level', pct: 67, color: '#A78BFA' },
                    ].map((item, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] text-gray-400">{item.label}</span>
                          <span className="text-[12px] font-medium text-white">{item.pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.pct}%` }}
                            transition={{ delay: 0.1 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-full"
                            style={{ background: item.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeNav === 'memory' && (
              <motion.div
                key="memory"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-white">Memory Bank</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                      <input placeholder="Search memories..." className="pl-9 pr-3 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white placeholder:text-gray-600 focus:outline-none focus:border-brand/40 w-48" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {memoryItems.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.3 }}
                      className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                        <Hash className="w-4 h-4 text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white truncate">{item.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500">{item.category}</span>
                          <span className="text-[10px] text-gray-600">·</span>
                          <span className="text-[10px] text-gray-500">Last: {item.lastReviewed}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[12px] font-medium text-white">{item.strength}%</div>
                          <div className="w-16 h-1 rounded-full bg-white/[0.06] mt-1 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${item.strength}%`, background: item.strength > 80 ? '#34D399' : item.strength > 60 ? '#FBBF24' : '#F87171' }} />
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeNav === 'agents' && (
              <motion.div
                key="agents"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-white">Active Agents</h2>
                  <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-medium bg-brand/10 text-brand border border-brand/20 hover:bg-brand/15 transition-all">
                    <Plus className="w-3.5 h-3.5" /> New Agent
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {agentItems.map((agent, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      className="rounded-xl p-4 bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.12] transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${agent.accent}15` }}>
                            <Cpu className="w-4 h-4" style={{ color: agent.accent }} />
                          </div>
                          <div>
                            <div className="text-[13px] font-medium text-white">{agent.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'bg-green-400' : 'bg-gray-500'}`} />
                              <span className="text-[10px] text-gray-500 capitalize">{agent.status}</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-500">{agent.lastRun}</span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                        <span className="text-[11px] text-gray-500">{agent.tasks} tasks completed</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeNav === 'context' && (
              <motion.div
                key="context"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-white">Context Engine</h2>
                  <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-medium bg-white/[0.04] text-gray-400 border border-white/[0.08] hover:text-white transition-all">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
                <div className="space-y-3">
                  {contextItems.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      className="flex items-start gap-4 px-4 py-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Eye className="w-4 h-4 text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">{item.topic}</div>
                        <div className="text-[13px] text-white">{item.value}</div>
                        <div className="text-[10px] text-gray-600 mt-1">Updated {item.updated}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeNav === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-lg font-semibold text-white mb-5">Settings</h2>
                <div className="space-y-4">
                  {[
                    { title: 'Memory Auto-Save', desc: 'Automatically save insights from conversations', enabled: true },
                    { title: 'Weakness Detection', desc: 'Identify and track areas where you struggle', enabled: true },
                    { title: 'Smart Scheduling', desc: 'AI-optimized study session timing', enabled: false },
                    { title: 'Context Persistence', desc: 'Remember context across sessions', enabled: true },
                    { title: 'Agent Auto-Retry', desc: 'Automatically retry failed agent actions', enabled: true },
                  ].map((setting, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      className="flex items-center justify-between px-4 py-4 rounded-xl bg-white/[0.025] border border-white/[0.06]"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-white">{setting.title}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{setting.desc}</div>
                      </div>
                      <button
                        className={`w-10 h-5.5 rounded-full transition-all relative ${setting.enabled ? 'bg-brand' : 'bg-white/[0.1]'}`}
                      >
                        <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all ${setting.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default BrainHub;
