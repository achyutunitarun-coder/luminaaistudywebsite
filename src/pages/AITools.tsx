import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, HelpCircle, FileText, BookOpen, Zap, 
  Mic, PenTool, CreditCard, Brain, FlaskConical, Layers
} from 'lucide-react';

const tools = [
  { title: 'AI Chat', desc: 'Chat with an intelligent tutor', icon: MessageSquare, path: '/chat', color: 'from-blue-500/20 to-cyan-500/20', iconColor: 'text-blue-400' },
  { title: 'Doubt Solver', desc: 'Step-by-step explanations', icon: HelpCircle, path: '/doubt-solver', color: 'from-purple-500/20 to-pink-500/20', iconColor: 'text-purple-400' },
  { title: 'Notes Generator', desc: 'Generate structured notes', icon: FileText, path: '/notes-generator', color: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-400' },
  { title: 'Quick Study', desc: 'Rapid topic breakdowns', icon: Zap, path: '/quick-study', color: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-400' },
  { title: 'Note to Quiz', desc: 'Convert notes into quizzes', icon: Brain, path: '/note-to-quiz', color: 'from-rose-500/20 to-red-500/20', iconColor: 'text-rose-400' },
  { title: 'Lecture AI', desc: 'Record & analyze lectures', icon: Mic, path: '/lecture-ai', color: 'from-indigo-500/20 to-violet-500/20', iconColor: 'text-indigo-400' },
  { title: 'Smart Notebook', desc: 'AI-powered note editor', icon: PenTool, path: '/smart-notebook', color: 'from-cyan-500/20 to-blue-500/20', iconColor: 'text-cyan-400' },
  { title: 'Flashcards', desc: 'AI-generated flashcard decks', icon: Layers, path: '/flashcards', color: 'from-fuchsia-500/20 to-pink-500/20', iconColor: 'text-fuchsia-400' },
  { title: 'Tests', desc: 'Generate & take tests', icon: FlaskConical, path: '/tests', color: 'from-green-500/20 to-emerald-500/20', iconColor: 'text-green-400' },
];

const AITools = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground tracking-tight mb-2">AI Tools</h1>
        <p className="text-muted-foreground text-sm">Your complete suite of AI-powered study tools</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool, i) => {
          const Icon = tool.icon;
          return (
            <motion.button
              key={tool.path}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(tool.path)}
              className="text-left rounded-2xl liquid-glass p-5 border border-border/10 hover:border-primary/20 transition-all duration-300 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <Icon className={`w-6 h-6 ${tool.iconColor}`} />
              </div>
              <h3 className="text-base font-display font-semibold text-foreground mb-1">{tool.title}</h3>
              <p className="text-xs text-muted-foreground/70">{tool.desc}</p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default AITools;
