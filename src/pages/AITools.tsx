import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, HelpCircle, FileText, BookOpen, Zap,
  Mic, PenTool, Layers, FlaskConical, Brain, Sparkles,
  ArrowRight, Search, Code2, Target, Globe, Wand2,
  ChevronRight, Star, Clock, TrendingUp
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const categories = [
  { id: 'all', label: 'All Tools', icon: Sparkles },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'create', label: 'Create', icon: Wand2 },
  { id: 'practice', label: 'Practice', icon: Target },
  { id: 'ai', label: 'AI Lab', icon: Brain },
];

const tools = [
  {
    title: 'AI Chat',
    desc: 'Intelligent conversations with your personal AI tutor. Ask anything, get structured explanations with examples.',
    icon: MessageSquare,
    path: '/chat',
    category: 'study',
    accent: '#7C5CFC',
    tag: 'Popular',
    usage: '12.4k',
    rating: 4.9,
  },
  {
    title: 'Lumina Computer',
    desc: 'Build complete websites and apps with AI. Describe what you want, get production-grade code instantly.',
    icon: Code2,
    path: '/computer',
    category: 'create',
    accent: '#7C5CFC',
    tag: 'New',
    usage: '8.2k',
    rating: 4.8,
  },
  {
    title: 'Doubt Solver',
    desc: 'Paste any question → get crystal-clear step-by-step solutions with visual explanations.',
    icon: HelpCircle,
    path: '/doubt-solver',
    category: 'study',
    accent: '#A78BFA',
    usage: '10.1k',
    rating: 4.7,
  },
  {
    title: 'Notes Generator',
    desc: 'Beautifully structured study notes in 8 styles — exam-ready, comprehensive, with diagrams.',
    icon: FileText,
    path: '/notes-generator',
    category: 'create',
    accent: '#2DD4BF',
    tag: 'Power',
    usage: '9.8k',
    rating: 4.8,
  },
  {
    title: 'Quick Study',
    desc: 'Rapid topic breakdowns with key concepts, summaries, and practice questions in seconds.',
    icon: Zap,
    path: '/quick-study',
    category: 'study',
    accent: '#FBBF24',
    usage: '7.3k',
    rating: 4.6,
  },
  {
    title: 'Lecture AI',
    desc: 'Record lectures or upload documents → auto-generate notes, flashcards, quizzes, and podcasts.',
    icon: Mic,
    path: '/lecture-ai',
    category: 'create',
    accent: '#6366F1',
    tag: 'Suite',
    usage: '5.9k',
    rating: 4.7,
  },
  {
    title: 'Smart Notebook',
    desc: 'AI-powered notebook that generates notes, flowcharts, and overviews from any document.',
    icon: PenTool,
    path: '/smart-notebook',
    category: 'create',
    accent: '#38BDF8',
    usage: '6.1k',
    rating: 4.5,
  },
  {
    title: 'Flashcards',
    desc: 'AI-generated spaced repetition decks with difficulty tracking and mastery scores.',
    icon: Layers,
    path: '/flashcards',
    category: 'practice',
    accent: '#F472B6',
    usage: '11.2k',
    rating: 4.8,
  },
  {
    title: 'Tests',
    desc: 'Generate challenging MCQ tests with detailed explanations, scoring, and analytics.',
    icon: FlaskConical,
    path: '/tests',
    category: 'practice',
    accent: '#34D399',
    usage: '8.7k',
    rating: 4.6,
  },
  {
    title: 'Brain Hub',
    desc: 'Your intelligence dashboard — memory visualization, agent activity, insights, and context.',
    icon: Brain,
    path: '/hub',
    category: 'ai',
    accent: '#A78BFA',
    tag: 'Beta',
    usage: '4.2k',
    rating: 4.5,
  },
  {
    title: 'Study Planner',
    desc: 'AI-optimized study schedules that adapt to your progress, deadlines, and learning pace.',
    icon: Target,
    path: '/study-planner',
    category: 'study',
    accent: '#FB923C',
    usage: '6.8k',
    rating: 4.7,
  },
  {
    title: 'Flashcard AI',
    desc: 'Import any content and get AI-generated flashcards with smart scheduling algorithms.',
    icon: Globe,
    path: '/flashcards',
    category: 'ai',
    accent: '#22D3EE',
    usage: '5.5k',
    rating: 4.4,
  },
];

const AITools = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered = tools.filter(tool => {
    const matchesSearch = !search || tool.title.toLowerCase().includes(search.toLowerCase()) || tool.desc.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 pt-8 text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-tint border border-brand/20 mb-5">
          <Sparkles className="w-3.5 h-3.5 text-brand" />
          <span className="text-xs font-semibold text-brand tracking-wide">{tools.length} AI-Powered Tools</span>
        </div>
        <h1 className="font-display text-4xl md:text-5xl text-white mb-4 leading-[1.05]">
          Your Study Arsenal
        </h1>
        <p className="text-gray-400 text-base max-w-lg mx-auto leading-relaxed">
          Every tool you need to learn faster, study smarter, and ace exams — powered by OWL-Alpha.
        </p>

        {/* Search */}
        <div className="relative max-w-md mx-auto mt-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-12 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm text-white placeholder:text-gray-500 focus:border-brand/50 focus:ring-1 focus:ring-brand/25"
          />
        </div>
      </motion.div>

      {/* Categories */}
      <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
        {categories.map(cat => {
          const Icon = cat.icon;
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 h-9 rounded-full text-xs font-medium transition-all ${
                active
                  ? 'bg-brand text-white shadow-lg shadow-brand/25'
                  : 'bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Tools Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory + search}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map((tool, i) => {
            const Icon = tool.icon;
            return (
              <motion.button
                key={tool.path + tool.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(tool.path)}
                className="group relative text-left rounded-2xl p-6 bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.12] backdrop-blur-sm transition-all duration-300 cursor-pointer hover:bg-white/[0.04]"
              >
                {/* Tag */}
                {tool.tag && (
                  <div className="absolute top-4 right-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-brand bg-brand/10 border border-brand/20">
                      {tool.tag}
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${tool.accent}18`, border: `1px solid ${tool.accent}30` }}
                >
                  <Icon className="w-5 h-5" style={{ color: tool.accent }} />
                </div>

                {/* Content */}
                <h3 className="text-[15px] font-semibold text-white mb-1.5 group-hover:text-brand transition-colors">
                  {tool.title}
                </h3>
                <p className="text-[13px] text-gray-500 leading-relaxed mb-4 line-clamp-2">
                  {tool.desc}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      {tool.rating}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-600">
                      <TrendingUp className="w-3 h-3" />
                      {tool.usage}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-brand/60 group-hover:text-brand transition-colors">
                    Open <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* Hover glow */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(400px circle at 50% 0%, ${tool.accent}08, transparent 60%)` }}
                />
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-gray-400 text-sm">No tools match your search.</p>
          <button onClick={() => { setSearch(''); setActiveCategory('all'); }} className="mt-3 text-xs text-brand hover:underline">
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};

export default AITools;
