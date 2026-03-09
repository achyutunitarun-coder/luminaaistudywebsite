import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, MessageSquare, HelpCircle, FileText, BookOpen, 
  Layers, Zap, Youtube, X, PenTool
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// Lazy-load tool pages
import Chat from '@/pages/Chat';
import DoubtSolver from '@/pages/DoubtSolver';
import NotesGenerator from '@/pages/NotesGenerator';
import Tests from '@/pages/Tests';
import Flashcards from '@/pages/Flashcards';
import NoteToQuiz from '@/pages/NoteToQuiz';
import QuickStudy from '@/pages/QuickStudy';
import YouTubeSummary from '@/pages/YouTubeSummary';

const tools = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare, color: 'text-primary' },
  { id: 'doubt', label: 'Doubt Solver', icon: HelpCircle, color: 'text-success' },
  { id: 'notes', label: 'Notes', icon: FileText, color: 'text-warning' },
  { id: 'tests', label: 'Tests', icon: PenTool, color: 'text-destructive' },
  { id: 'flashcards', label: 'Flashcards', icon: Layers, color: 'text-primary' },
  { id: 'quiz', label: 'Note to Quiz', icon: BookOpen, color: 'text-success' },
  { id: 'quick', label: 'Quick Study', icon: Zap, color: 'text-warning' },
  { id: 'youtube', label: 'YT Summary', icon: Youtube, color: 'text-destructive' },
] as const;

type ToolId = typeof tools[number]['id'];

const toolComponents: Record<ToolId, React.FC> = {
  chat: Chat,
  doubt: DoubtSolver,
  notes: NotesGenerator,
  tests: Tests,
  flashcards: Flashcards,
  quiz: NoteToQuiz,
  quick: QuickStudy,
  youtube: YouTubeSummary,
};

const FocusToolsWidget = () => {
  const [expanded, setExpanded] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  const ActiveComponent = activeTool ? toolComponents[activeTool] : null;
  const activeToolInfo = activeTool ? tools.find(t => t.id === activeTool) : null;

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-2">
        <motion.button
          onClick={() => setExpanded(!expanded)}
          className="w-14 h-14 rounded-full gradient-primary shadow-lg shadow-primary/30 flex items-center justify-center text-primary-foreground hover:scale-105 transition-transform"
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            {expanded ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <X className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Sparkles className="w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Tool Icons */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl liquid-glass p-3 flex flex-col gap-1.5 w-44"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 pb-1">Study Tools</p>
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => { setActiveTool(tool.id); setExpanded(false); }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted/30 transition-colors text-left group"
                  >
                    <Icon className={`w-4 h-4 ${tool.color} transition-transform group-hover:scale-110`} />
                    <span className="text-xs font-medium text-foreground">{tool.label}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tool Dialog */}
      <Dialog open={!!activeTool} onOpenChange={(open) => { if (!open) setActiveTool(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden rounded-2xl border-border/30">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 bg-muted/10">
              <div className="flex items-center gap-2.5">
                {activeToolInfo && (
                  <>
                    <activeToolInfo.icon className={`w-4 h-4 ${activeToolInfo.color}`} />
                    <span className="text-sm font-semibold text-foreground">{activeToolInfo.label}</span>
                  </>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Focus Mode</span>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-auto p-5">
              {ActiveComponent && <ActiveComponent />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FocusToolsWidget;
