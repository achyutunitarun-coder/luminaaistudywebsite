import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Sparkles, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type MCQ = { question: string; options: string[]; correct: number; explanation: string };
type ShortAnswer = { question: string; answer: string };

const NoteToQuiz = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [quiz, setQuiz] = useState<{ mcq: MCQ[]; short_answer: ShortAnswer[]; conceptual: ShortAnswer[] } | null>(null);
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});
  const [showAnswers, setShowAnswers] = useState(false);
  const [activeTab, setActiveTab] = useState<'mcq' | 'short' | 'conceptual'>('mcq');
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();

  const generate = async () => {
    if (!notes.trim()) return;
    const allowed = await checkAndIncrement('note_to_quiz');
    if (!allowed) return;
    setGenerating(true);
    setQuiz(null);
    setMcqAnswers({});
    setShowAnswers(false);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/note-to-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ notes }),
      });
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      setQuiz(data);
      // Auto-save quiz to tests table
      if (user && data) {
        try {
          const questions = [
            ...(data.mcq || []).map((q: MCQ) => ({ ...q, type: 'mcq' })),
            ...(data.short_answer || []).map((q: ShortAnswer) => ({ ...q, type: 'short_answer' })),
            ...(data.conceptual || []).map((q: ShortAnswer) => ({ ...q, type: 'conceptual' })),
          ];
          await supabase.from('tests').insert({
            user_id: user.id,
            title: `Quiz from Notes (${new Date().toLocaleDateString()})`,
            questions: questions as any,
            total_questions: questions.length,
            status: 'pending',
            subject: 'Note-to-Quiz',
          });
        } catch (e) { console.error('Auto-save quiz failed:', e); }
      }
      toast.success('Quiz generated & saved!');
    } catch {
      toast.error('Failed to generate quiz');
    }
    setGenerating(false);
  };

  return (
    <>
    <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--primary))] flex items-center justify-center shadow-lg shadow-secondary/20">
            <FileText className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Note-to-Quiz</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Paste your notes and get instant quiz questions</p>
          </div>
        </div>
      </motion.div>

      {!quiz ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="relative rounded-[2rem] liquid-glass-intense overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--secondary)/0.06),transparent_60%)]" />
            <div className="relative z-10 p-8 space-y-5">
              <Textarea
                placeholder="Paste your notes, study material, or any text here..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="bg-muted/20 border-border/30 rounded-xl min-h-[200px] px-5 py-4 text-sm leading-relaxed resize-none"
              />
              <Button onClick={generate} disabled={generating || !notes.trim()} className="gradient-primary text-primary-foreground h-13 px-8 rounded-2xl shadow-lg shadow-primary/20">
                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Generate Quiz
              </Button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-2xl liquid-glass-subtle">
            {(['mcq', 'short', 'conceptual'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab ? 'liquid-glass-intense text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'mcq' ? 'Multiple Choice' : tab === 'short' ? 'Short Answer' : 'Conceptual'}
                <span className="ml-1 text-[10px] opacity-50">
                  ({tab === 'mcq' ? quiz.mcq?.length || 0 : tab === 'short' ? quiz.short_answer?.length || 0 : quiz.conceptual?.length || 0})
                </span>
              </button>
            ))}
          </div>

          {/* MCQ */}
          {activeTab === 'mcq' && quiz.mcq?.map((q, qi) => (
            <motion.div key={qi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qi * 0.04 }}
              className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-xl p-5"
            >
              <p className="text-xs text-primary font-bold mb-2">Question {qi + 1}</p>
              <p className="text-foreground font-medium mb-3 text-sm">{q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  let cls = 'w-full text-left px-4 py-3 rounded-xl text-sm border transition-all font-medium ';
                  if (showAnswers) {
                    if (oi === q.correct) cls += 'border-success/30 bg-success/10 text-success';
                    else if (mcqAnswers[qi] === oi) cls += 'border-destructive/30 bg-destructive/10 text-destructive';
                    else cls += 'border-border/10 bg-muted/5 text-muted-foreground opacity-50';
                  } else if (mcqAnswers[qi] === oi) {
                    cls += 'border-primary/40 bg-primary/10 text-primary';
                  } else {
                    cls += 'border-border/20 bg-muted/5 text-foreground hover:border-primary/30';
                  }
                  return (
                    <button key={oi} className={cls} onClick={() => !showAnswers && setMcqAnswers(p => ({ ...p, [qi]: oi }))} disabled={showAnswers}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {showAnswers && <p className="mt-3 text-xs text-muted-foreground bg-muted/10 rounded-xl p-3 border border-border/10">💡 {q.explanation}</p>}
            </motion.div>
          ))}

          {/* Short Answer & Conceptual */}
          {(activeTab === 'short' ? quiz.short_answer : activeTab === 'conceptual' ? quiz.conceptual : [])?.map((q, qi) => (
            <motion.div key={qi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-xl p-5"
            >
              <p className="text-xs text-secondary font-bold mb-2">Question {qi + 1}</p>
              <p className="text-foreground font-medium mb-3 text-sm">{q.question}</p>
              {showAnswers && (
                <div className="bg-muted/10 rounded-xl p-3 border border-border/10">
                  <p className="text-sm text-muted-foreground">{q.answer}</p>
                </div>
              )}
            </motion.div>
          ))}

          <div className="flex gap-3">
            {!showAnswers ? (
              <Button onClick={() => setShowAnswers(true)} className="gradient-primary text-primary-foreground h-12 px-8 rounded-2xl shadow-lg shadow-primary/20">
                <CheckCircle className="w-4 h-4 mr-2" /> Show Answers
              </Button>
            ) : (
              <Button onClick={() => { setQuiz(null); setNotes(''); }} variant="outline" className="h-12 px-8 rounded-2xl">
                <ArrowLeft className="w-4 h-4 mr-2" /> Generate New Quiz
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default NoteToQuiz;
