import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, ChevronRight, Loader2, Clock, CheckCircle2, XCircle, Lightbulb, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Question = {
  number: number; type: string; text: string; options?: string[];
  marks: number; negative_marks?: number; topic: string; concept: string;
  difficulty: string; correct_answer: string; solution: string; hint: string;
};
type Section = { name: string; instructions: string; questions: Question[] };
type Paper = { title: string; duration_minutes: number; total_marks: number; sections: Section[] };

const SmartPaper = () => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [exam, setExam] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState('');
  const [totalMarks, setTotalMarks] = useState(40);
  const [timeLimit, setTimeLimit] = useState(60);
  const [difficultyMix, setDifficultyMix] = useState({ easy: 30, medium: 50, hard: 20 });
  const [focusWeak, setFocusWeak] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showSolutions, setShowSolutions] = useState<Record<string, boolean>>({});

  // Timer
  useEffect(() => {
    if (!paper || submitted || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(t => t > 0 ? t - 1 : 0), 1000);
    return () => clearInterval(timer);
  }, [paper, submitted, timeLeft]);

  const addSubject = () => {
    if (subjectInput.trim() && !subjects.includes(subjectInput.trim())) {
      setSubjects(p => [...p, subjectInput.trim()]);
      setSubjectInput('');
    }
  };

  const generatePaper = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-paper', {
        body: { exam, subjects, totalMarks, timeLimit, difficultyMix, questionTypes: ['MCQ'], weakTopics: focusWeak ? [] : [] },
      });
      if (error) throw error;
      setPaper(data as Paper);
      setTimeLeft((data as Paper).duration_minutes * 60);
    } catch (e) {
      toast.error('Failed to generate paper. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  const submitPaper = async () => {
    if (!paper || !user) return;
    setSubmitted(true);

    let correct = 0;
    let total = 0;
    const responses: any[] = [];

    paper.sections.forEach(section => {
      section.questions.forEach(q => {
        const key = `${section.name}-${q.number}`;
        const ans = answers[key] || '';
        const isCorrect = ans.toUpperCase().trim() === q.correct_answer.toUpperCase().trim();
        if (isCorrect) correct++;
        total++;
        responses.push({
          user_id: user.id,
          question_text: q.text,
          correct_answer: q.correct_answer,
          student_answer: ans,
          is_correct: isCorrect,
          subject: subjects[0] || exam,
          topic: q.topic,
          concept: q.concept,
          difficulty: q.difficulty,
        });
      });
    });

    // Save test attempt
    const { data: attempt } = await supabase.from('test_attempts').insert({
      user_id: user.id,
      subject: subjects.join(', '),
      score: (correct / total) * 100,
      max_score: 100,
      time_taken_seconds: (paper.duration_minutes * 60) - timeLeft,
    } as any).select().single();

    if (attempt) {
      const withAttempt = responses.map(r => ({ ...r, attempt_id: attempt.id }));
      await supabase.from('question_responses').insert(withAttempt as any);

      // Tag mistakes
      const wrongResponses = withAttempt.filter(r => !r.is_correct);
      if (wrongResponses.length > 0) {
        await supabase.functions.invoke('tag-mistake', { body: { responses: wrongResponses } });
      }
    }

    toast.success(`Score: ${correct}/${total} (${Math.round((correct / total) * 100)}%)`);
  };

  const timerStr = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`;

  // Wizard steps
  if (!paper) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-blue-500/20 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Smart Paper</h1>
              <p className="text-sm text-muted-foreground">AI-generated practice papers tailored to you</p>
            </div>
          </div>
        </motion.div>

        {/* Progress */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? 'bg-primary' : 'bg-muted/20'}`} />
          ))}
        </div>

        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl p-6"
          style={{ background: 'hsl(230 20% 11% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.05)' }}
        >
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">What exam are you preparing for?</h2>
              <Input value={exam} onChange={e => setExam(e.target.value)} placeholder="e.g. JEE Main, NEET, SAT..."
                className="bg-background/50 border-border/20 rounded-xl" />
              <Button onClick={() => exam && setStep(2)} disabled={!exam} className="gradient-primary text-primary-foreground rounded-xl w-full">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Select subjects</h2>
              <div className="flex gap-2">
                <Input value={subjectInput} onChange={e => setSubjectInput(e.target.value)} placeholder="Add subject..."
                  className="bg-background/50 border-border/20 rounded-xl" onKeyDown={e => e.key === 'Enter' && addSubject()} />
                <Button onClick={addSubject} variant="outline" className="rounded-xl">Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {subjects.map(s => (
                  <span key={s} className="px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium cursor-pointer hover:bg-destructive/15 hover:text-destructive"
                    onClick={() => setSubjects(p => p.filter(x => x !== s))}>{s} ×</span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setStep(1)} variant="ghost" className="rounded-xl">Back</Button>
                <Button onClick={() => subjects.length && setStep(3)} disabled={!subjects.length} className="gradient-primary text-primary-foreground rounded-xl flex-1">
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Configure paper</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Total Marks</label>
                  <Input type="number" value={totalMarks} onChange={e => setTotalMarks(+e.target.value)}
                    className="bg-background/50 border-border/20 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Time (minutes)</label>
                  <Input type="number" value={timeLimit} onChange={e => setTimeLimit(+e.target.value)}
                    className="bg-background/50 border-border/20 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Difficulty Mix</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {(['easy', 'medium', 'hard'] as const).map(d => (
                    <div key={d}>
                      <span className="capitalize text-muted-foreground">{d}</span>
                      <Input type="number" value={difficultyMix[d]}
                        onChange={e => setDifficultyMix(p => ({ ...p, [d]: +e.target.value }))}
                        className="bg-background/50 border-border/20 rounded-xl mt-1" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setStep(2)} variant="ghost" className="rounded-xl">Back</Button>
                <Button onClick={() => setStep(4)} className="gradient-primary text-primary-foreground rounded-xl flex-1">
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Focus Mode</h2>
              <label className="flex items-center gap-3 p-4 rounded-xl bg-muted/10 cursor-pointer" onClick={() => setFocusWeak(!focusWeak)}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${focusWeak ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                  {focusWeak && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Emphasize my weak areas</p>
                  <p className="text-xs text-muted-foreground">Uses your mistake history to weight questions</p>
                </div>
              </label>
              <div className="flex gap-2">
                <Button onClick={() => setStep(3)} variant="ghost" className="rounded-xl">Back</Button>
                <Button onClick={generatePaper} disabled={generating} className="gradient-primary text-primary-foreground rounded-xl flex-1">
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating...</> : <>Generate Paper <ArrowRight className="w-4 h-4 ml-1" /></>}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Paper View
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 z-10 py-3 px-4 -mx-4 rounded-xl"
        style={{ background: 'hsl(230 20% 8% / 0.9)', backdropFilter: 'blur(12px)', border: '1px solid hsl(0 0% 100% / 0.05)' }}
      >
        <div>
          <h1 className="text-lg font-bold text-foreground">{paper.title}</h1>
          <p className="text-xs text-muted-foreground">{paper.total_marks} marks</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${timeLeft < 300 ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono text-sm font-bold">{timerStr}</span>
        </div>
      </div>

      {/* Questions */}
      {paper.sections.map(section => (
        <div key={section.name} className="space-y-4">
          <div className="px-4 py-2 rounded-xl bg-muted/10">
            <h2 className="text-sm font-bold text-foreground">{section.name}</h2>
            <p className="text-xs text-muted-foreground">{section.instructions}</p>
          </div>
          {section.questions.map(q => {
            const key = `${section.name}-${q.number}`;
            const isCorrect = submitted && answers[key]?.toUpperCase().trim() === q.correct_answer.toUpperCase().trim();
            const isWrong = submitted && answers[key] && !isCorrect;
            return (
              <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-5"
                style={{
                  background: submitted ? (isCorrect ? 'hsl(160 60% 15% / 0.2)' : isWrong ? 'hsl(0 60% 15% / 0.2)' : 'hsl(230 20% 11% / 0.5)') : 'hsl(230 20% 11% / 0.5)',
                  border: `1px solid ${submitted ? (isCorrect ? 'hsl(160 60% 40% / 0.2)' : isWrong ? 'hsl(0 60% 40% / 0.2)' : 'hsl(0 0% 100% / 0.05)') : 'hsl(0 0% 100% / 0.05)'}`,
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xs font-bold text-muted-foreground bg-muted/15 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0">
                    {q.number}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-foreground leading-relaxed">{q.text}</p>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/15 text-muted-foreground">{q.marks}m</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${q.difficulty === 'hard' ? 'bg-destructive/15 text-destructive' : q.difficulty === 'medium' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>
                        {q.difficulty}
                      </span>
                    </div>
                  </div>
                  {submitted && (isCorrect ? <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" /> : isWrong ? <XCircle className="w-5 h-5 text-destructive flex-shrink-0" /> : null)}
                </div>
                {q.options && (
                  <div className="space-y-1.5 ml-10">
                    {q.options.map((opt, i) => {
                      const letter = opt.charAt(0);
                      const selected = answers[key]?.toUpperCase() === letter.toUpperCase();
                      const isCorrectOpt = submitted && letter.toUpperCase() === q.correct_answer.toUpperCase();
                      return (
                        <button key={i}
                          onClick={() => !submitted && setAnswers(p => ({ ...p, [key]: letter }))}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                            submitted ? (isCorrectOpt ? 'bg-success/15 text-success border border-success/20' : selected ? 'bg-destructive/15 text-destructive border border-destructive/20' : 'text-muted-foreground')
                            : selected ? 'bg-primary/15 text-primary border border-primary/20' : 'hover:bg-muted/10 text-muted-foreground'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!q.options && !submitted && (
                  <Input value={answers[key] || ''} onChange={e => setAnswers(p => ({ ...p, [key]: e.target.value }))}
                    placeholder="Your answer..." className="ml-10 bg-background/50 border-border/20 rounded-xl text-sm" />
                )}
                {submitted && (
                  <div className="ml-10 mt-3">
                    <button onClick={() => setShowSolutions(p => ({ ...p, [key]: !p[key] }))}
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" /> {showSolutions[key] ? 'Hide' : 'Show'} Solution
                    </button>
                    {showSolutions[key] && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed bg-muted/5 p-3 rounded-lg">{q.solution}</p>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ))}

      {!submitted && (
        <Button onClick={submitPaper} className="w-full gradient-primary text-primary-foreground rounded-xl h-12 text-base font-semibold">
          Submit Paper
        </Button>
      )}
    </div>
  );
};

export default SmartPaper;
