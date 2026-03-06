import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Question = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

const Tests = () => {
  const { user } = useAuth();
  const [syllabus, setSyllabus] = useState('');
  const [subject, setSubject] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);

  const generateTest = async () => {
    if (!syllabus.trim() || !user) return;
    setGenerating(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ syllabus, subject, numQuestions }),
      });

      if (!resp.ok) throw new Error('Failed to generate test');
      const data = await resp.json();
      
      if (data.questions) {
        setQuestions(data.questions);
        // Save test
        const { data: test } = await supabase.from('tests').insert({
          user_id: user.id,
          title: subject || 'AI Generated Test',
          subject,
          syllabus,
          total_questions: data.questions.length,
          questions: data.questions,
          status: 'in_progress',
        }).select().single();
        if (test) setTestId(test.id);
      }
    } catch (error) {
      toast.error('Failed to generate test. Please try again.');
    }
    setGenerating(false);
  };

  const submitTest = async () => {
    if (!testId) return;
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) correct++;
    });
    const score = (correct / questions.length) * 100;

    await supabase.from('tests').update({
      correct_answers: correct,
      score,
      answers,
      status: 'completed',
    }).eq('id', testId);

    setSubmitted(true);
    toast.success(`Test completed! Score: ${score.toFixed(0)}%`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-display font-bold text-foreground mb-1">AI Test Generator</h1>
        <p className="text-muted-foreground">Input your syllabus and let AI create adaptive tests</p>
      </motion.div>

      {questions.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6 space-y-4">
          <Input
            placeholder="Subject (e.g., Mathematics, Physics)"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="bg-muted/50"
          />
          <Textarea
            placeholder="Enter your syllabus, topics, or curriculum here..."
            value={syllabus}
            onChange={e => setSyllabus(e.target.value)}
            className="bg-muted/50 min-h-[120px]"
          />
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground">Questions:</label>
            <Input
              type="number"
              value={numQuestions}
              onChange={e => setNumQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
              className="w-20 bg-muted/50"
              min={1}
              max={20}
            />
          </div>
          <Button onClick={generateTest} disabled={generating || !syllabus.trim()} className="gradient-primary text-primary-foreground">
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate Test
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <motion.div
              key={qi}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: qi * 0.1 }}
              className="glass rounded-xl p-6"
            >
              <p className="text-sm text-primary font-semibold mb-2">Question {qi + 1}</p>
              <p className="text-foreground font-medium mb-4">{q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  let optClass = 'glass rounded-lg px-4 py-3 cursor-pointer transition-all text-sm';
                  if (submitted) {
                    if (oi === q.correct) optClass += ' border-success/50 bg-success/10 text-success';
                    else if (answers[qi] === oi) optClass += ' border-destructive/50 bg-destructive/10 text-destructive';
                  } else if (answers[qi] === oi) {
                    optClass += ' border-primary/50 bg-primary/10 text-primary';
                  } else {
                    optClass += ' hover:border-primary/30';
                  }
                  return (
                    <button
                      key={oi}
                      className={optClass + ' w-full text-left'}
                      onClick={() => !submitted && setAnswers(prev => ({ ...prev, [qi]: oi }))}
                      disabled={submitted}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className="mt-3 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                  {q.explanation}
                </p>
              )}
            </motion.div>
          ))}
          {!submitted ? (
            <Button
              onClick={submitTest}
              disabled={Object.keys(answers).length !== questions.length}
              className="gradient-primary text-primary-foreground"
            >
              Submit Test
            </Button>
          ) : (
            <Button onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); }} variant="outline">
              Generate New Test
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Tests;
