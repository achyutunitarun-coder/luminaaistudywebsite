import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Plus, X, Loader2, Sparkles, BookOpen, Clock, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type PlanDay = {
  day: number;
  date: string;
  tasks: { subject: string; topic: string; duration_minutes: number; type: string }[];
};

const typeColors: Record<string, string> = {
  study: 'bg-primary/10 text-primary border border-primary/20',
  practice: 'bg-secondary/10 text-secondary border border-secondary/20',
  review: 'bg-warning/10 text-warning border border-warning/20',
  test: 'bg-destructive/10 text-destructive border border-destructive/20',
};

const typeIcons: Record<string, string> = {
  study: '📖',
  practice: '✍️',
  review: '🔄',
  test: '📝',
};

const StudyPlanner = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [subjects, setSubjects] = useState<string[]>(['']);
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState(2);
  const [generating, setGenerating] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ['study_plans', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('study_plans').select('*').order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const generatePlan = async () => {
    const filteredSubjects = subjects.filter(s => s.trim());
    if (!filteredSubjects.length || !examDate || !user) return;
    setGenerating(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ subjects: filteredSubjects, examDate, dailyHours }),
      });
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();

      await supabase.from('study_plans').insert({
        user_id: user.id,
        exam_date: examDate,
        subjects: filteredSubjects,
        daily_hours: dailyHours,
        plan_data: data.days || [],
      });

      queryClient.invalidateQueries({ queryKey: ['study_plans'] });
      toast.success('Study plan generated!');
    } catch {
      toast.error('Failed to generate plan');
    }
    setGenerating(false);
  };

  const daysUntilExam = examDate ? Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Wand2 className="w-7 h-7 text-primary" /> Smart Study Planner
        </h1>
        <p className="text-muted-foreground mt-1">AI crafts a personalized schedule tailored to your goals</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-secondary/5 blur-[80px]" />

        <div className="relative z-10 space-y-6">
          <div>
            <label className="text-sm font-semibold text-foreground mb-3 block">Subjects</label>
            <div className="space-y-2">
              {subjects.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Subject ${i + 1} — e.g., Physics, Calculus...`}
                    value={s}
                    onChange={e => setSubjects(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                    className="bg-muted/50 rounded-xl"
                  />
                  {subjects.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setSubjects(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSubjects(prev => [...prev, ''])} className="text-primary mt-2">
              <Plus className="w-3 h-3 mr-1" /> Add Subject
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Exam Date</label>
              <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="bg-muted/50 rounded-xl" />
              {daysUntilExam !== null && daysUntilExam > 0 && (
                <p className="text-xs text-primary mt-1.5 font-medium">{daysUntilExam} days remaining</p>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Daily Study Hours</label>
              <Input type="number" value={dailyHours} onChange={e => setDailyHours(Number(e.target.value))} min={1} max={12} className="bg-muted/50 rounded-xl" />
            </div>
          </div>

          <Button onClick={generatePlan} disabled={generating} className="gradient-primary text-primary-foreground h-12 px-8 text-base" size="lg">
            {generating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
            Generate Study Plan
          </Button>
        </div>
      </motion.div>

      {/* Existing Plans */}
      {plans?.map((plan, pi) => {
        const days = (plan.plan_data as PlanDay[]) || [];
        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: pi * 0.1 }}
            className="glass rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-lg text-foreground">
                  {(plan.subjects as string[])?.join(' · ')}
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Exam: {plan.exam_date}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {plan.daily_hours}h/day
                  </span>
                </div>
              </div>
              <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">{days.length} days</span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-auto pr-2">
              {days.slice(0, 10).map((day, di) => (
                <motion.div
                  key={di}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: di * 0.03 }}
                  className="relative pl-6 pb-4"
                >
                  {/* Timeline dot & line */}
                  <div className="absolute left-0 top-1 w-3 h-3 rounded-full gradient-primary" />
                  {di < days.length - 1 && <div className="absolute left-[5px] top-4 w-0.5 h-full bg-primary/20" />}

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-foreground">Day {day.day}</span>
                    {day.date && <span className="text-xs text-muted-foreground">— {day.date}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {day.tasks?.map((task, ti) => (
                      <span key={ti} className={`text-xs px-3 py-1.5 rounded-xl ${typeColors[task.type] || 'bg-muted text-muted-foreground'}`}>
                        {typeIcons[task.type] || '📚'} {task.subject}: {task.topic} ({task.duration_minutes}m)
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
              {days.length > 10 && (
                <p className="text-xs text-muted-foreground text-center py-2">+ {days.length - 10} more days</p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default StudyPlanner;
