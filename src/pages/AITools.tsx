import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  MessageSquare, HelpCircle, FileText, Zap,
  Mic, PenTool, Layers, FlaskConical, Brain, Sparkles,
  Code2, Target, ChevronRight, Plus, Search
} from 'lucide-react';

const categories = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'study', label: 'Study', icon: Brain },
  { id: 'create', label: 'Create', icon: Plus },
  { id: 'practice', label: 'Practice', icon: Target },
];

const tools = [
  { title: 'AI Chat', desc: 'Ask anything. Get clear explanations and examples.', icon: MessageSquare, path: '/chat', category: 'study', accent: '#7C5CFC' },
  { title: 'Computer', desc: 'Build websites and apps with AI. Describe what you want, get working code.', icon: Code2, path: '/lumina-computer', category: 'create', accent: '#7C5CFC' },
  { title: 'Doubt Solver', desc: 'Paste a question, get a step-by-step solution.', icon: HelpCircle, path: '/doubt-solver', category: 'study', accent: '#A78BFA' },
  { title: 'Notes', desc: 'Generate study notes in different styles.', icon: FileText, path: '/notes-generator', category: 'create', accent: '#2DD4BF' },
  { title: 'Quick Study', desc: 'Quick topic breakdowns with key points and practice questions.', icon: Zap, path: '/quick-study', category: 'study', accent: '#FBBF24' },
  { title: 'Lecture AI', desc: 'Upload documents or record — get notes, flashcards, and quizzes.', icon: Mic, path: '/lecture-ai', category: 'create', accent: '#6366F1' },
  { title: 'Notebook', desc: 'AI notebook that creates notes and summaries from your documents.', icon: PenTool, path: '/smart-notebook', category: 'create', accent: '#38BDF8' },
  { title: 'Flashcards', desc: 'Spaced repetition flashcards with difficulty tracking.', icon: Layers, path: '/flashcards', category: 'practice', accent: '#F472B6' },
  { title: 'Tests', desc: 'Generate practice tests with scoring and explanations.', icon: FlaskConical, path: '/tests', category: 'practice', accent: '#34D399' },
  { title: 'Brain Hub', desc: 'Your dashboard — see your activity, memories, and progress.', icon: Brain, path: '/hub', category: 'study', accent: '#A78BFA' },
];

export default function AITools() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  // Fetch real usage data
  useEffect(() => {
    if (!user) return;
    async function fetchUsage() {
      try {
        const { data: chats } = await supabase
          .from('chats')
          .select('id')
          .eq('user_id', user.id)
          .limit(100);
        setUsageCounts({ chats: chats?.length || 0 });
      } catch (e) {
        console.error('Usage fetch error:', e);
      }
    }
    fetchUsage();
  }, [user]);

  const filtered = tools.filter(tool => {
    const matchesSearch = !search || tool.title.toLowerCase().includes(search.toLowerCase()) || tool.desc.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 pt-8 text-center"
      >
        <h1 className="font-display text-4xl md:text-5xl text-white mb-3 leading-[1.05]">
          AI Tools
        </h1>
        <p className="text-gray-400 text-base max-w-md mx-auto">
          Everything you need to study smarter. Pick a tool and get started.
        </p>
      </motion.div>

      {/* Search + Categories */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand/40"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {categories.map(cat => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-all ${
                  active ? 'bg-brand text-white' : 'bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tools Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory + search}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {filtered.map((tool, i) => {
            const Icon = tool.icon;
            return (
              <motion.button
                key={tool.path}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(tool.path)}
                className="group relative text-left rounded-xl p-5 bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${tool.accent}15` }}>
                    <Icon className="w-5 h-5" style={{ color: tool.accent }} />
                  </div>
                </div>
                <h3 className="text-[14px] font-semibold text-white mb-1 group-hover:text-brand transition-colors">
                  {tool.title}
                </h3>
                <p className="text-[12px] text-gray-500 leading-relaxed mb-3">
                  {tool.desc}
                </p>
                <div className="flex items-center gap-1 text-[11px] font-medium text-brand/50 group-hover:text-brand transition-colors">
                  Open <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">No tools match your search.</p>
          <button onClick={() => { setSearch(''); setActiveCategory('all'); }} className="mt-2 text-xs text-brand hover:underline">
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
