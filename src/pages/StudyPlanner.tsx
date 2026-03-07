import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, X, Loader2, Sparkles, BookOpen, Clock, Wand2, GraduationCap, ChevronRight, Brain, Target, Layers } from 'lucide-react';
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

const typeConfig: Record<string, { bg: string; icon: string; label: string }> = {
  study: { bg: 'bg-primary/10 text-primary border-primary/20', icon: '📖', label: 'Study' },
  practice: { bg: 'bg-secondary/10 text-secondary border-secondary/20', icon: '✍️', label: 'Practice' },
  review: { bg: 'bg-warning/10 text-warning border-warning/20', icon: '🔄', label: 'Review' },
  test: { bg: 'bg-destructive/10 text-destructive border-destructive/20', icon: '📝', label: 'Test' },
};

const StudyPlanner = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [subjects, setSubjects] = useState<string[]>(['']);
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

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
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Wand2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Smart Study Planner</h1>
            <p className="text-muted-foreground text-sm mt-0.5">AI crafts a personalized schedule tailored to your goals</p>
          </div>
        </div>
      </motion.div>

      {/* Generator Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl overflow-hidden"
      >
        {/* Decorative orbs */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/8 blur-[80px]" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-secondary/8 blur-[60px]" />

        <div className="relative z-10 p-8 space-y-8">
          {/* Subjects Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-primary" />
              <label className="text-sm font-semibold text-foreground">Subjects</label>
            </div>
            <div className="space-y-3">
              {subjects.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-2 group"
                >
                  <div className="flex-1 relative">
                    <Input
                      placeholder={`Subject ${i + 1} — e.g., Physics, Calculus...`}
                      value={s}
                      onChange={e => setSubjects(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                      className="bg-muted/30 border-border/40 rounded-xl h-12 px-4 text-sm focus:border-primary/50 transition-all"
                    />
                    {s.trim() && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-success" />
                    )}
                  </div>
                  {subjects.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSubjects(prev => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </motion.div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSubjects(prev => [...prev, ''])}
              className="text-primary mt-3 hover:bg-primary/10 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Subject
            </Button>
          </div>

          {/* Date & Hours */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-secondary" />
                <label className="text-sm font-semibold text-foreground">Exam Date</label>
              </div>
              <Input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                className="bg-muted/30 border-border/40 rounded-xl h-12 px-4 text-sm"
              />
              {daysUntilExam !== null && daysUntilExam > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2 flex items-center gap-2"
                >
                  <div className="h-1.5 flex-1 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (30 / daysUntilExam) * 100)}%` }}
                      className="h-full rounded-full gradient-primary"
                    />
                  </div>
                  <span className="text-xs font-semibold text-primary whitespace-nowrap">{daysUntilExam}d left</span>
                </motion.div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-warning" />
                <label className="text-sm font-semibold text-foreground">Daily Study Hours</label>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={dailyHours}
                  onChange={e => setDailyHours(Number(e.target.value))}
                  min={1}
                  max={12}
                  className="bg-muted/30 border-border/40 rounded-xl h-12 px-4 text-sm w-24"
                />
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 6].map(h => (
                    <button
                      key={h}
                      onClick={() => setDailyHours(h)}
                      className={`w-9 h-9 rounded-lg text-xs font-medium transition-all ${
                        dailyHours === h
                          ? 'gradient-primary text-primary-foreground shadow-md shadow-primary/20'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={generatePlan}
            disabled={generating || !subjects.some(s => s.trim()) || !examDate}
            className="gradient-primary text-primary-foreground h-14 px-10 text-base rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all w-full md:w-auto"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                <span>Crafting your plan...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                <span>Generate Study Plan</span>
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Plans List */}
      <div className="space-y-6">
        {plans?.map((plan, pi) => {
          const days = (plan.plan_data as PlanDay[]) || [];
          const isExpanded = expandedPlan === plan.id;
          const displayDays = isExpanded ? days : days.slice(0, 5);
          const totalTasks = days.reduce((sum, d) => sum + (d.tasks?.length || 0), 0);

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pi * 0.08 }}
              className="rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl overflow-hidden"
            >
              {/* Plan Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mt-0.5">
                      <GraduationCap className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg text-foreground">
                        {(plan.subjects as string[])?.join(' · ')}
                      </h3>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" /> {plan.exam_date}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> {plan.daily_hours}h/day
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Layers className="w-3 h-3" /> {totalTasks} tasks
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                    {days.length} days
                  </span>
                </div>

                {/* Type Legend */}
                <div className="flex gap-2 mt-4 flex-wrap">
                  {Object.entries(typeConfig).map(([key, cfg]) => (
                    <span key={key} className={`text-[10px] px-2.5 py-1 rounded-full border ${cfg.bg} font-medium`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="px-6 pb-4">
                <div className="space-y-0">
                  {displayDays.map((day, di) => (
                    <motion.div
                      key={di}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: di * 0.02 }}
                      className="relative pl-8 py-3 group"
                    >
                      {/* Timeline connector */}
                      <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border/50 group-first:top-5 group-last:bottom-auto group-last:h-5" />
                      <div className="absolute left-1.5 top-[18px] w-3 h-3 rounded-full border-2 border-primary bg-background z-10" />

                      <div className="flex items-baseline gap-3 mb-2">
                        <span className="text-sm font-display font-bold text-foreground">Day {day.day}</span>
                        {day.date && <span className="text-xs text-muted-foreground">{day.date}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {day.tasks?.map((task, ti) => {
                          const cfg = typeConfig[task.type] || { bg: 'bg-muted text-muted-foreground', icon: '📚' };
                          return (
                            <span
                              key={ti}
                              className={`text-xs px-3 py-1.5 rounded-xl border font-medium ${cfg.bg} hover:scale-[1.02] transition-transform cursor-default`}
                            >
                              {cfg.icon} {task.subject}: {task.topic}
                              <span className="opacity-60 ml-1">({task.duration_minutes}m)</span>
                            </span>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {days.length > 5 && (
                  <button
                    onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                    className="w-full mt-2 py-3 text-xs font-medium text-primary hover:bg-primary/5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isExpanded ? 'Show less' : `Show all ${days.length} days`}
                    <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default StudyPlanner;
