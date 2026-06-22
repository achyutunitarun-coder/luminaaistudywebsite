import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Sparkles, Activity, Database, Cpu, Network,
  MessageSquare, FileText, Target, Zap, Shield,
  ChevronRight, Clock, TrendingUp, Layers, Eye,
  RefreshCw, Settings2, Globe, Workflow
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

const stats = [
  { label: 'Active Memories', value: '2,847', change: '+124 today', icon: Database, accent: '#7C5CFC' },
  { label: 'Agent Actions', value: '189', change: '+23 today', icon: Cpu, accent: '#2DD4BF' },
  { label: 'Context Score', value: '94%', change: 'Excellent', icon: Eye, accent: '#FBBF24' },
  { label: 'Knowledge Nodes', value: '1.2k', change: 'Growing', icon: Network, accent: '#A78BFA' },
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
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {stats.map((stat, i) => {
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
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="rounded-xl bg-white/[0.025] border border-white/[0.06]"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
              <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
              <button className="text-[11px] text-gray-500 hover:text-brand transition-colors flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {recentItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.04, duration: 0.3 }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
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
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Memory Health */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="mt-4 rounded-xl p-5 bg-white/[0.025] border border-white/[0.06]"
          >
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
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full"
                      style={{ background: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default BrainHub;
