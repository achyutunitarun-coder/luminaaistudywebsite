import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, HelpCircle, FileText, BookOpen, Zap, 
  Mic, PenTool, Layers, FlaskConical, Brain, Sparkles,
  ArrowRight, Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const tools = [
  { title: 'AI Chat', desc: 'Have intelligent conversations with your personal AI tutor. Ask anything, get structured explanations.', icon: MessageSquare, path: '/chat', gradient: 'from-blue-500 to-cyan-400', bgGlow: 'group-hover:shadow-blue-500/20', tag: 'Most Popular' },
  { title: 'Doubt Solver', desc: 'Paste any question and get crystal-clear step-by-step solutions with explanations.', icon: HelpCircle, path: '/doubt-solver', gradient: 'from-purple-500 to-pink-400', bgGlow: 'group-hover:shadow-purple-500/20' },
  { title: 'Notes Generator', desc: 'Generate beautifully structured study notes in 8 different styles — exam-ready and comprehensive.', icon: FileText, path: '/notes-generator', gradient: 'from-emerald-500 to-teal-400', bgGlow: 'group-hover:shadow-emerald-500/20', tag: 'Power Tool' },
  { title: 'Quick Study', desc: 'Rapid topic breakdowns with key concepts and practice questions in seconds.', icon: Zap, path: '/quick-study', gradient: 'from-amber-500 to-orange-400', bgGlow: 'group-hover:shadow-amber-500/20' },
  { title: 'Note to Quiz', desc: 'Convert any notes into MCQ, short answer, and conceptual quizzes instantly.', icon: Brain, path: '/note-to-quiz', gradient: 'from-rose-500 to-red-400', bgGlow: 'group-hover:shadow-rose-500/20' },
  { title: 'Lecture AI', desc: 'Record lectures or upload documents → auto-generate notes, flashcards, quizzes, and podcasts.', icon: Mic, path: '/lecture-ai', gradient: 'from-indigo-500 to-violet-400', bgGlow: 'group-hover:shadow-indigo-500/20', tag: 'Full Suite' },
  { title: 'Smart Notebook', desc: 'AI-powered notebook that generates notes, flowcharts, and overviews from any document.', icon: PenTool, path: '/smart-notebook', gradient: 'from-cyan-500 to-blue-400', bgGlow: 'group-hover:shadow-cyan-500/20' },
  { title: 'Flashcards', desc: 'AI-generated spaced repetition flashcard decks with difficulty tracking.', icon: Layers, path: '/flashcards', gradient: 'from-fuchsia-500 to-pink-400', bgGlow: 'group-hover:shadow-fuchsia-500/20' },
  { title: 'Tests', desc: 'Generate challenging MCQ tests on any topic with detailed explanations and scoring.', icon: FlaskConical, path: '/tests', gradient: 'from-green-500 to-emerald-400', bgGlow: 'group-hover:shadow-green-500/20' },
];

const AITools = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = tools.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) || 
    t.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="mb-10 text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary">9 AI-Powered Tools</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight mb-3">
          AI Study Arsenal
        </h1>
        <p className="text-muted-foreground text-base max-w-xl mx-auto">
          Every tool you need to learn faster, study smarter, and ace your exams — all powered by AI.
        </p>

        {/* Search */}
        <div className="relative max-w-md mx-auto mt-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-card/60 border-border/30 backdrop-blur-sm"
          />
        </div>
      </motion.div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((tool, i) => {
          const Icon = tool.icon;
          return (
            <motion.button
              key={tool.path}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(tool.path)}
              className={`group relative text-left rounded-2xl p-6 border border-border/20 bg-card/40 backdrop-blur-xl hover:border-border/40 transition-all duration-300 cursor-pointer hover:shadow-xl ${tool.bgGlow}`}
            >
              {/* Tag */}
              {tool.tag && (
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                    {tool.tag}
                  </span>
                </div>
              )}

              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                <Icon className="w-7 h-7 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-display font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                {tool.title}
              </h3>
              <p className="text-sm text-muted-foreground/80 leading-relaxed mb-4">
                {tool.desc}
              </p>

              {/* CTA */}
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary/70 group-hover:text-primary transition-colors">
                <span>Open Tool</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>

              {/* Hover glow effect */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300 pointer-events-none`} />
            </motion.button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No tools match your search.</p>
        </div>
      )}
    </div>
  );
};

export default AITools;
