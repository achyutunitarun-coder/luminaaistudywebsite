import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Sparkles, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type MCQ = { question: string; options: string[]; correct: number; explanation: string };
type ShortAnswer = { question: string; answer: string };

const NoteToQuiz = () => {
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [quiz, setQuiz] = useState<{ mcq: MCQ[]; short_answer: ShortAnswer[]; conceptual: ShortAnswer[] } | null>(null);
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});
  const [showAnswers, setShowAnswers] = useState(false);
  const [activeTab, setActiveTab] = useState<'mcq' | 'short' | 'conceptual'>('mcq');

  const generate = async () => {
    if (!notes.trim()) return;
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
      toast.success('Quiz generated!');
    } catch {
      toast.error('Failed to generate quiz');
    }
    setGenerating(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-secondary" /> Note-to-Quiz Generator
        </h1>
        <p className="text-muted-foreground text-sm">Paste your notes and get instant quiz questions</p>
      </motion.div>

      {!quiz ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6 space-y-4">
          <Textarea
            placeholder="Paste your notes, study material, or any text here..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="bg-muted/50 min-h-[200px]"
          />
          <Button onClick={generate} disabled={generating || !notes.trim()} className="gradient-primary text-primary-foreground">
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate Quiz
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            {(['mcq', 'short', 'conceptual'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab ? 'bg-primary/10 text-primary border border-primary/30' : 'glass text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'mcq' ? 'Multiple Choice' : tab === 'short' ? 'Short Answer' : 'Conceptual'}
                <span className="ml-1 text-xs opacity-60">
                  ({tab === 'mcq' ? quiz.mcq?.length || 0 : tab === 'short' ? quiz.short_answer?.length || 0 : quiz.conceptual?.length || 0})
                </span>
              </button>
            ))}
          </div>

          {/* MCQ */}
          {activeTab === 'mcq' && quiz.mcq?.map((q, qi) => (
            <motion.div key={qi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qi * 0.05 }} className="glass rounded-xl p-5">
              <p className="text-xs text-primary font-semibold mb-2">Question {qi + 1}</p>
              <p className="text-foreground font-medium mb-3">{q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  let cls = 'glass rounded-lg px-4 py-3 text-sm w-full text-left transition-all';
                  if (showAnswers) {
                    if (oi === q.correct) cls += ' border-success/50 bg-success/10 text-success';
                    else if (mcqAnswers[qi] === oi) cls += ' border-destructive/50 bg-destructive/10 text-destructive';
                  } else if (mcqAnswers[qi] === oi) {
                    cls += ' border-primary/50 bg-primary/10 text-primary';
                  } else {
                    cls += ' hover:border-primary/30';
                  }
                  return (
                    <button key={oi} className={cls} onClick={() => !showAnswers && setMcqAnswers(p => ({ ...p, [qi]: oi }))} disabled={showAnswers}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {showAnswers && <p className="mt-3 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">{q.explanation}</p>}
            </motion.div>
          ))}

          {/* Short Answer & Conceptual */}
          {(activeTab === 'short' ? quiz.short_answer : activeTab === 'conceptual' ? quiz.conceptual : [])?.map((q, qi) => (
            <motion.div key={qi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
              <p className="text-xs text-secondary font-semibold mb-2">Question {qi + 1}</p>
              <p className="text-foreground font-medium mb-3">{q.question}</p>
              {showAnswers && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">{q.answer}</p>
                </div>
              )}
            </motion.div>
          ))}

          <div className="flex gap-2">
            {!showAnswers ? (
              <Button onClick={() => setShowAnswers(true)} className="gradient-primary text-primary-foreground">
                <CheckCircle className="w-4 h-4 mr-2" /> Show Answers
              </Button>
            ) : (
              <Button onClick={() => { setQuiz(null); setNotes(''); }} variant="outline">
                Generate New Quiz
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteToQuiz;
