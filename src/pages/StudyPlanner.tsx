import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Plus, X, Loader2, Sparkles, BookOpen, Clock } from 'lucide-react';
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
  study: 'bg-primary/10 text-primary',
  practice: 'bg-secondary/10 text-secondary',
  review: 'bg-warning/10 text-warning',
  test: 'bg-destructive/10 text-destructive',
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" /> Smart Study Planner
        </h1>
        <p className="text-muted-foreground text-sm">AI builds a personalized study schedule for you</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6 space-y-4">
        <div>
          <label className="text-sm font-semibold text-foreground mb-2 block">Subjects</label>
          {subjects.map((s, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <Input
                placeholder={`Subject ${i + 1}`}
                value={s}
                onChange={e => setSubjects(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                className="bg-muted/50"
              />
              {subjects.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => setSubjects(prev => prev.filter((_, j) => j !== i))}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setSubjects(prev => [...prev, ''])} className="text-primary">
            <Plus className="w-3 h-3 mr-1" /> Add Subject
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">Exam Date</label>
            <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="bg-muted/50" />
          </div>
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">Daily Study Hours</label>
            <Input type="number" value={dailyHours} onChange={e => setDailyHours(Number(e.target.value))} min={1} max={12} className="bg-muted/50" />
          </div>
        </div>

        <Button onClick={generatePlan} disabled={generating} className="gradient-primary text-primary-foreground">
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Generate Study Plan
        </Button>
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
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold text-foreground">
                  {(plan.subjects as string[])?.join(', ')}
                </h3>
                <p className="text-xs text-muted-foreground">Exam: {plan.exam_date} • {plan.daily_hours}h/day</p>
              </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-auto">
              {days.slice(0, 7).map((day, di) => (
                <div key={di} className="border-l-2 border-primary/30 pl-4">
                  <p className="text-xs font-semibold text-primary mb-1">Day {day.day} {day.date ? `— ${day.date}` : ''}</p>
                  <div className="flex flex-wrap gap-2">
                    {day.tasks?.map((task, ti) => (
                      <span key={ti} className={`text-xs px-3 py-1 rounded-full ${typeColors[task.type] || 'bg-muted text-muted-foreground'}`}>
                        <BookOpen className="w-3 h-3 inline mr-1" />
                        {task.subject}: {task.topic} ({task.duration_minutes}m)
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {days.length > 7 && <p className="text-xs text-muted-foreground text-center">+ {days.length - 7} more days</p>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default StudyPlanner;
