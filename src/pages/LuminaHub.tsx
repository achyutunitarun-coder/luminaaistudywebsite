import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Calendar, Shuffle, MessageSquare, HelpCircle,
  Eye, BarChart3, X, Send, Loader2, Sparkles, Lock,
  ChevronRight, Flame, Target, Lightbulb, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';
import { toast } from 'sonner';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type Module = {
  id: string;
  title: string;
  desc: string;
  icon: any;
  color: string;
  iconColor: string;
  freeLimit: string;
  feature: string;
};

const modules: Module[] = [
  { id: 'recall', title: 'Recall Mode', desc: 'Active recall engine — test your memory', icon: Brain, color: 'from-violet-500/20 to-purple-500/20', iconColor: 'text-violet-400', freeLimit: '20 questions/day', feature: 'recall_mode' },
  { id: 'spaced', title: 'Spaced Scheduler', desc: 'Optimize review timing for retention', icon: Calendar, color: 'from-blue-500/20 to-cyan-500/20', iconColor: 'text-blue-400', freeLimit: '5 concepts/day', feature: 'spaced_scheduler' },
  { id: 'shuffle', title: 'Smart Shuffle', desc: 'Interleaved practice across topics', icon: Shuffle, color: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-400', freeLimit: '2 topics/day', feature: 'smart_shuffle' },
  { id: 'explain', title: 'Explain Mode', desc: 'Feynman technique — teach to learn', icon: MessageSquare, color: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-400', freeLimit: '2 explanations/day', feature: 'explain_mode' },
  { id: 'why', title: 'Why Engine', desc: 'Deep elaboration — ask why endlessly', icon: HelpCircle, color: 'from-rose-500/20 to-red-500/20', iconColor: 'text-rose-400', freeLimit: '3 prompts/session', feature: 'why_engine' },
  { id: 'visualize', title: 'Visualize', desc: 'Dual coding — diagrams & mind maps', icon: Eye, color: 'from-indigo-500/20 to-violet-500/20', iconColor: 'text-indigo-400', freeLimit: '1 visual/day', feature: 'visualize_mode' },
  { id: 'cognitive', title: 'Cognitive Dashboard', desc: 'Metacognition — track your brain', icon: BarChart3, color: 'from-cyan-500/20 to-blue-500/20', iconColor: 'text-cyan-400', freeLimit: 'Last 7 days', feature: 'cognitive_dashboard' },
];

const SYSTEM_PROMPTS: Record<string, string> = {
  recall: `You are an active recall engine. Generate a question about the user's topic. After they answer, evaluate accuracy, provide feedback, and generate a follow-up "think deeper" question. Track confidence. Format: clear question, then after answer: ✅/❌ feedback + explanation + next question. Use LaTeX for math.`,
  spaced: `You are a spaced repetition scheduler. Help the user review concepts at optimal intervals (1d→3d→7d→14d→30d). Present concepts due for review, test recall, and adjust difficulty based on performance. Show memory strength as percentage.`,
  shuffle: `You are an interleaving practice engine. Mix questions across different topics the user provides. This helps build connections between subjects. Present mixed questions, evaluate answers, and highlight cross-topic connections.`,
  explain: `You are a Feynman technique coach. Ask the user to explain a concept as if teaching a 5-year-old. Evaluate their explanation for: clarity, accuracy, completeness, misconceptions. Highlight weak sentences and suggest improvements. Be encouraging but strict.`,
  why: `You are a "Why Engine" — an elaboration coach. For any concept, continuously ask "why?", "how?", "what if?" to push the user's understanding deeper. Track elaboration depth (Level 1-5). Each level gets harder. Never accept surface-level answers.`,
  visualize: `You are a dual-coding visualization assistant. For any concept, generate a structured text-based diagram, mind map, or flowchart using ASCII art or structured markdown. Explain the visual representation alongside text. Use clear formatting with boxes, arrows, and hierarchies.`,
  cognitive: `You are a metacognition coach. Analyze the user's study patterns and provide insights about: accuracy trends, recall speed, confidence vs correctness gaps, weak vs strong topics, and forgetting risk. Present data as structured analysis with actionable recommendations.`,
};

function HubSession({ module, onClose }: { module: Module; onClose: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState('');
  const [confidence, setConfidence] = useState([50]);
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendToAI = async (userMessage: string) => {
    if (!user) return;
    setIsLoading(true);

    const allMessages = [
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          systemPrompt: SYSTEM_PROMPTS[module.id],
          mode: 'study',
        }),
      });

      if (!resp.ok) throw new Error('Failed');

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            if (parsed.lumina_meta) continue;
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              full += c;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: full };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch {
      toast.error('Failed to connect. Please try again.');
    }
    setIsLoading(false);
  };

  const startSession = () => {
    if (!topic.trim()) return;
    setStarted(true);
    const msg = `Topic: ${topic}. ${module.id === 'recall' ? `Confidence level: ${confidence[0]}%. Generate a recall question.` : `Start a ${module.title} session.`}`;
    setMessages([{ role: 'user', content: msg }]);
    sendToAI(msg);
  };

  const sendReply = () => {
    if (!input.trim() || isLoading) return;
    const msg = module.id === 'recall' ? `${input.trim()} [Confidence: ${confidence[0]}%]` : input.trim();
    setMessages(prev => [...prev, { role: 'user', content: input.trim() }]);
    setInput('');
    sendToAI(msg);
  };

  const Icon = module.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col"
    >
      {/* Header */}
      <div className="h-14 border-b border-border/10 flex items-center px-4 md:px-6 gap-3">
        <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${module.iconColor}`} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{module.title}</h2>
          <p className="text-[10px] text-muted-foreground">{module.desc}</p>
        </div>
      </div>

      {/* Content */}
      {!started ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full text-center">
            <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${module.color} flex items-center justify-center mx-auto mb-6`}>
              <Icon className={`w-10 h-10 ${module.iconColor}`} />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">{module.title}</h2>
            <p className="text-sm text-muted-foreground mb-8">{module.desc}</p>

            <Input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Enter your topic (e.g., Photosynthesis, Calculus)"
              className="h-12 rounded-xl mb-4 text-center"
              onKeyDown={e => e.key === 'Enter' && startSession()}
            />

            {module.id === 'recall' && (
              <div className="mb-6">
                <label className="text-xs text-muted-foreground mb-2 block">Confidence Level: {confidence[0]}%</label>
                <Slider value={confidence} onValueChange={setConfidence} max={100} step={5} className="w-full" />
              </div>
            )}

            <Button onClick={startSession} className="h-12 px-8 rounded-2xl gradient-primary text-primary-foreground font-semibold">
              <Sparkles className="w-4 h-4 mr-2" /> Start Session
            </Button>
          </motion.div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto px-4 md:px-6 py-4 space-y-4">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${
                  msg.role === 'user' ? 'gradient-primary text-primary-foreground' : 'liquid-glass-subtle'
                }`}>
                  {msg.role === 'user' ? <Target className="w-3.5 h-3.5" /> : <Sparkles className={`w-3.5 h-3.5 ${module.iconColor}`} />}
                </div>
                <div className={`max-w-[85%] min-w-0 rounded-2xl px-4 py-3 ${
                  msg.role === 'user' ? 'gradient-primary text-primary-foreground rounded-tr-md' : 'liquid-glass rounded-tl-md'
                }`}>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                  </div>
                </div>
              </motion.div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg liquid-glass-subtle flex items-center justify-center">
                  <Sparkles className={`w-3.5 h-3.5 ${module.iconColor}`} />
                </div>
                <div className="rounded-2xl rounded-tl-md liquid-glass px-5 py-3">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map(j => (
                      <motion.span key={j} className="w-2 h-2 rounded-full bg-muted-foreground/30"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: j * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border/10">
            {module.id === 'recall' && (
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Confidence: {confidence[0]}%</span>
                <Slider value={confidence} onValueChange={setConfidence} max={100} step={5} className="flex-1" />
              </div>
            )}
            <div className="flex items-center gap-2 liquid-glass rounded-2xl px-3 py-1.5">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type your answer..."
                className="border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 h-10 text-sm px-0"
                onKeyDown={e => e.key === 'Enter' && sendReply()}
              />
              <Button onClick={sendReply} disabled={isLoading} size="icon" className="h-8 w-8 rounded-xl gradient-primary text-primary-foreground shrink-0">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

const LuminaHub = () => {
  const { isPro } = useSubscription();
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [activeModule, setActiveModule] = useState<Module | null>(null);

  const openModule = async (mod: Module) => {
    if (!isPro) {
      const allowed = await checkAndIncrement(mod.feature);
      if (!allowed) return;
    }
    setActiveModule(mod);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center shadow-xl">
            <Brain className="w-7 h-7 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Lumina Hub</h1>
            <p className="text-muted-foreground text-sm">Your AI-powered brain gym — 7 cognitive modules</p>
          </div>
        </div>
      </motion.div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod, i) => {
          const Icon = mod.icon;
          return (
            <motion.button
              key={mod.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openModule(mod)}
              className="text-left rounded-2xl liquid-glass p-5 border border-border/10 hover:border-primary/20 transition-all duration-300 group relative overflow-hidden"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <Icon className={`w-6 h-6 ${mod.iconColor}`} />
              </div>
              <h3 className="text-base font-display font-semibold text-foreground mb-1">{mod.title}</h3>
              <p className="text-xs text-muted-foreground/70 mb-3">{mod.desc}</p>
              {!isPro && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Free: {mod.freeLimit}
                </span>
              )}
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/20 group-hover:text-primary/50 transition-all group-hover:translate-x-1" />
            </motion.button>
          );
        })}
      </div>

      {/* Active Session Overlay */}
      <AnimatePresence>
        {activeModule && (
          <HubSession module={activeModule} onClose={() => setActiveModule(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LuminaHub;
