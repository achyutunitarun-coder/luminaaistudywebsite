import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Target, Brain, Trophy, ArrowLeft, CheckCircle, XCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { SavedItemsPanel } from '@/components/SavedItemsPanel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { FileUploadButton, buildFileContext, type UploadedFile } from '@/components/FileUploadButton';
import { useQueryClient } from '@tanstack/react-query';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';
import MarkdownRenderer from '@/components/MarkdownRenderer';

type Question = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

const Tests = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [syllabus, setSyllabus] = useState('');
  const [subject, setSubject] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const generateTest = async () => {
    if (!syllabus.trim() || !user) return;
    const allowed = await checkAndIncrement('test_generations');
    if (!allowed) return;
    setGenerating(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setCurrentQ(0);

    try {
      const fileContext = buildFileContext(uploadedFiles);
      const fullSyllabus = syllabus + fileContext;
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ syllabus: fullSyllabus, subject, numQuestions }),
      });
      
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: 'Unknown error' }));
        if (resp.status === 429) {
          toast.error('Rate limit exceeded. Please wait a moment and try again.');
        } else if (resp.status === 402) {
          toast.error('AI credits exhausted. Please add credits to continue.');
        } else {
          toast.error(errData.error || 'Failed to generate test. Please try again.');
        }
        setGenerating(false);
        return;
      }
      
      const data = await resp.json();
      if (data.questions) {
        setQuestions(data.questions);
        const { data: test } = await supabase.from('tests').insert({
          user_id: user.id, title: subject || 'AI Generated Test', subject, syllabus,
          total_questions: data.questions.length, questions: data.questions, status: 'in_progress',
        }).select().single();
        if (test) setTestId(test.id);
      } else {
        toast.error('No questions received. Please try again with more detailed topics.');
      }
    } catch {
      toast.error('Failed to generate test. Please check your connection and try again.');
    }
    setGenerating(false);
  };

  const submitTest = async () => {
    if (!testId || !user) return;
    let correct = 0;
    questions.forEach((q, i) => { if (answers[i] === q.correct) correct++; });
    const score = (correct / questions.length) * 100;
    
    await supabase.from('tests').update({ correct_answers: correct, score, answers, status: 'completed' }).eq('id', testId);
    
    // Award XP and coins for completing a test
    const xpEarned = 50; // 50 XP per test completed
    const coinsEarned = Math.max(5, Math.round(score / 10)); // 5-10 coins based on score
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp, coins, level')
        .eq('user_id', user.id)
        .single();
      
      if (profile) {
        const newXp = (profile.xp || 0) + xpEarned;
        const newCoins = (profile.coins || 0) + coinsEarned;
        // Level up every 100 XP
        const newLevel = Math.floor(newXp / 100) + 1;
        
        await supabase
          .from('profiles')
          .update({ 
            xp: newXp, 
            coins: newCoins, 
            level: newLevel,
            last_study_date: new Date().toISOString().split('T')[0],
          })
          .eq('user_id', user.id);
        
        // Invalidate profile query to refresh UI
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        
        if (newLevel > (profile.level || 1)) {
          toast.success(`🎉 Level Up! You're now Level ${newLevel}!`);
        }
      }
    } catch (err) {
      console.error('Failed to award XP/coins:', err);
    }
    
    // Track mistakes for weakness radar
    questions.forEach((q, i) => {
      if (answers[i] !== undefined && answers[i] !== q.correct) {
        supabase.from('mistakes').insert({
          user_id: user.id,
          topic: q.question.slice(0, 100),
          subject: subject || 'General',
          mistake_type: 'conceptual',
          question: q.question,
          correct_answer: q.options[q.correct],
          user_answer: q.options[answers[i]],
        }).then(() => {});
      }
    });
    
    setSubmitted(true);
    toast.success(`Score: ${score.toFixed(0)}% — Earned ${xpEarned} XP and ${coinsEarned} coins! 🎉`);
  };

  const scoreCount = submitted ? questions.reduce((acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0), 0) : 0;

  // ── Exam Mode (one question at a time with sidebar) ──
  if (questions.length > 0) {
    const q = questions[currentQ];
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex gap-6">
          {/* Left: Question Navigator */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:block w-64 flex-shrink-0"
          >
            <div className="sticky top-6 rounded-2xl liquid-glass p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-4 h-4 text-secondary" />
                <span className="text-sm font-bold text-foreground">{subject || 'Test'}</span>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{answeredCount}/{questions.length} answered</span>
                  <span>{Math.round((answeredCount / questions.length) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                    animate={{ width: `${(answeredCount / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question grid */}
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((_, i) => {
                  const isAnswered = answers[i] !== undefined;
                  const isCurrent = i === currentQ;
                  const isCorrect = submitted && answers[i] === questions[i].correct;
                  const isWrong = submitted && isAnswered && answers[i] !== questions[i].correct;

                  let cls = 'w-full aspect-square rounded-lg text-[11px] font-bold transition-all ';
                  if (submitted) {
                    if (isCorrect) cls += 'bg-success/20 text-success border border-success/30';
                    else if (isWrong) cls += 'bg-destructive/20 text-destructive border border-destructive/30';
                    else cls += 'bg-muted/20 text-muted-foreground border border-border/20';
                  } else if (isCurrent) {
                    cls += 'bg-primary text-primary-foreground shadow-md shadow-primary/20';
                  } else if (isAnswered) {
                    cls += 'bg-primary/15 text-primary border border-primary/20';
                  } else {
                    cls += 'bg-muted/10 text-muted-foreground border border-border/20 hover:border-primary/30';
                  }

                  return (
                    <button key={i} onClick={() => setCurrentQ(i)} className={cls}>
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              {!submitted ? (
                <Button
                  onClick={submitTest}
                  disabled={answeredCount !== questions.length}
                  className="w-full gradient-primary text-primary-foreground h-11 rounded-xl shadow-lg shadow-primary/20 text-sm"
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Submit Test
                </Button>
              ) : (
                <Button
                  onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); setSyllabus(''); setSubject(''); }}
                  variant="outline"
                  className="w-full h-11 rounded-xl text-sm"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> New Test
                </Button>
              )}
            </div>
          </motion.div>

          {/* Right: Current Question */}
          <div className="flex-1 space-y-5">
            {/* Score banner */}
            {submitted && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl liquid-glass p-6 flex items-center gap-5"
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  scoreCount === questions.length ? 'bg-success/10' : scoreCount >= questions.length / 2 ? 'bg-warning/10' : 'bg-destructive/10'
                }`}>
                  <Trophy className={`w-8 h-8 ${
                    scoreCount === questions.length ? 'text-success' : scoreCount >= questions.length / 2 ? 'text-warning' : 'text-destructive'
                  }`} />
                </div>
                <div>
                  <p className="text-3xl font-display font-bold text-foreground">{scoreCount}/{questions.length}</p>
                  <p className="text-sm text-muted-foreground">
                    {scoreCount === questions.length ? 'Perfect! 🎉' : scoreCount >= questions.length / 2 ? 'Good effort!' : 'Keep practicing'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Question card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="rounded-[2rem] liquid-glass-intense overflow-hidden"
              >
                <div className="p-8">
                  <div className="flex items-start gap-4 mb-8">
                    <span className={`text-sm font-bold px-3 py-1.5 rounded-xl flex-shrink-0 ${
                      submitted
                        ? answers[currentQ] === q.correct ? 'bg-success/10 text-success' : answers[currentQ] !== undefined ? 'bg-destructive/10 text-destructive' : 'bg-muted/30 text-muted-foreground'
                        : 'bg-secondary/10 text-secondary'
                    }`}>
                      Q{currentQ + 1}
                    </span>
                    <p className="text-lg text-foreground font-medium leading-relaxed flex-1">{q.question}</p>
                    <MarkdownRenderer className="text-lg text-foreground font-medium leading-relaxed flex-1 [&>div>p]:m-0">{q.question}</MarkdownRenderer>
                      answers[currentQ] === q.correct
                        ? <CheckCircle className="w-6 h-6 text-success flex-shrink-0" />
                        : answers[currentQ] !== undefined
                        ? <XCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                        : null
                    )}
                  </div>

                  <div className="space-y-3">
                    {q.options.map((opt, oi) => {
                      const isSelected = answers[currentQ] === oi;
                      const isCorrectOpt = oi === q.correct;
                      let cls = 'w-full text-left px-5 py-4 rounded-2xl transition-all border font-medium flex items-center gap-3 ';

                      if (submitted) {
                        if (isCorrectOpt) cls += 'bg-success/10 text-success border-success/30';
                        else if (isSelected) cls += 'bg-destructive/10 text-destructive border-destructive/30';
                        else cls += 'bg-muted/5 text-muted-foreground border-border/15 opacity-50';
                      } else if (isSelected) {
                        cls += 'bg-primary/10 text-primary border-primary/40 shadow-sm shadow-primary/10';
                      } else {
                        cls += 'bg-muted/5 text-foreground border-border/20 hover:border-primary/30 hover:bg-primary/5';
                      }

                      return (
                        <button key={oi} className={cls} onClick={() => !submitted && setAnswers(p => ({ ...p, [currentQ]: oi }))} disabled={submitted}>
                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            submitted
                              ? isCorrectOpt ? 'bg-success/20 text-success' : isSelected ? 'bg-destructive/20 text-destructive' : 'bg-muted/20 text-muted-foreground'
                              : isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground'
                          }`}>{String.fromCharCode(65 + oi)}</span>
                          <MarkdownRenderer className="text-sm [&>div>p]:m-0 inline">{opt}</MarkdownRenderer>
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence>
                    {submitted && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-6 text-sm text-muted-foreground leading-relaxed bg-muted/10 rounded-2xl p-5 border border-border/15"
                      >
                        💡 <MarkdownRenderer className="inline [&>div]:inline [&>div>p]:inline [&>div>p]:m-0">{q.explanation}</MarkdownRenderer>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center justify-between px-8 py-5 border-t border-border/15 bg-muted/5">
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                    disabled={currentQ === 0}
                    className="rounded-xl"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">{currentQ + 1} of {questions.length}</span>
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
                    disabled={currentQ === questions.length - 1}
                    className="rounded-xl"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Mobile submit */}
            <div className="lg:hidden">
              {!submitted ? (
                <Button
                  onClick={submitTest}
                  disabled={answeredCount !== questions.length}
                  className="w-full gradient-primary text-primary-foreground h-13 rounded-2xl shadow-lg shadow-primary/20"
                >
                  <CheckCircle className="w-5 h-5 mr-2" /> Submit Test
                </Button>
              ) : (
                <Button
                  onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); setSyllabus(''); setSubject(''); }}
                  variant="outline"
                  className="w-full h-12 rounded-2xl"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> New Test
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Generator Input ──
  return (
    <>
    <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    <div className="max-w-3xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--primary))] flex items-center justify-center shadow-xl shadow-secondary/20">
              <Brain className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">AI Test Generator</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                <Target className="w-3.5 h-3.5 inline mr-1" /> Adaptive tests from your syllabus
              </p>
            </div>
          </div>
          <SavedItemsPanel
            label="Past Tests"
            table="tests"
            select="id, title, created_at, score, status, total_questions, correct_answers"
            onLoad={(item) => {
              toast.info(`${item.title} — Score: ${item.score != null ? `${Number(item.score).toFixed(0)}%` : 'Not submitted'}`);
            }}
            renderMeta={(item) => (
              <>
                {item.status === 'completed' && <span className="text-success">• {Number(item.score).toFixed(0)}%</span>}
                {item.status === 'in_progress' && <span className="text-warning">• In progress</span>}
              </>
            )}
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-[2rem] liquid-glass-intense overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--secondary)/0.06),transparent_60%)]" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-primary/5 blur-[80px]" />

        <div className="relative z-10 p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2.5 block">Subject</label>
              <Input
                placeholder="e.g., Mathematics, Biology..."
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="bg-muted/20 border-border/30 rounded-xl h-13 px-5 text-base"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2.5 block">Questions</label>
              <div className="flex items-center gap-2">
                {[5, 10, 15, 20].map(n => (
                  <button
                    key={n}
                    onClick={() => setNumQuestions(n)}
                    className={`flex-1 h-13 rounded-xl text-sm font-bold transition-all ${
                      numQuestions === n
                        ? 'gradient-primary text-primary-foreground shadow-md shadow-primary/20'
                        : 'bg-muted/20 text-muted-foreground hover:bg-muted/40 border border-border/20'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-2.5 block">Syllabus / Topics</label>
            <Textarea
              placeholder="Enter your syllabus, chapters, or topics..."
              value={syllabus}
              onChange={e => setSyllabus(e.target.value)}
              className="bg-muted/20 border-border/30 rounded-xl min-h-[120px] px-5 py-4 text-sm leading-relaxed resize-none"
            />
            <div className="mt-3">
              <FileUploadButton files={uploadedFiles} onFilesChange={setUploadedFiles} />
            </div>
          </div>

          <Button
            onClick={generateTest}
            disabled={generating || !syllabus.trim()}
            className="gradient-primary text-primary-foreground h-14 px-10 text-base rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
          >
            {generating ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-5 h-5 mr-2" /> Generate Test</>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
    </>
  );
};

export default Tests;
