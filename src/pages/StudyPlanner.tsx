import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Plus, X, Loader2, Sparkles, BookOpen, Clock, Wand2,
  GraduationCap, ChevronRight, Layers, Target, CheckCircle2,
  FileText, Table, ArrowRight, CalendarDays, Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';
import MarkdownRenderer from '@/components/MarkdownRenderer';

type PlanDay = {
  day: number;
  date: string;
  tasks: { subject: string; topic: string; duration_minutes: number; type: string; time?: string }[];
};

const typeColors: Record<string, { dot: string; bg: string; text: string }> = {
  study: { dot: 'bg-primary', bg: 'bg-primary/8', text: 'text-primary' },
  practice: { dot: 'bg-secondary', bg: 'bg-secondary/8', text: 'text-secondary' },
  review: { dot: 'bg-warning', bg: 'bg-warning/8', text: 'text-warning' },
  test: { dot: 'bg-destructive', bg: 'bg-destructive/8', text: 'text-destructive' },
  break: { dot: 'bg-muted-foreground', bg: 'bg-muted/10', text: 'text-muted-foreground' },
};

const StudyPlanner = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'study' | 'exam'>('study');

  const [subjects, setSubjects] = useState<string[]>(['']);
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const [examSubject, setExamSubject] = useState('');
  const [examSyllabus, setExamSyllabus] = useState('');
  const [examDateExam, setExamDateExam] = useState('');
  const [examDailyHours, setExamDailyHours] = useState(3);
  const [wakeUpTime, setWakeUpTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('22:00');
  const [generatingExam, setGeneratingExam] = useState(false);
  const [examPlanResult, setExamPlanResult] = useState<string | null>(null);

  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();

  const userPrefs = useMemo(() => {
    if (!profile?.extra_preferences) return null;
    try { return JSON.parse(profile.extra_preferences as string); } catch { return null; }
  }, [profile?.extra_preferences]);

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
    const allowed = await checkAndIncrement('study_planners');
    if (!allowed) return;
    setGenerating(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          subjects: filteredSubjects,
          examDate,
          dailyHours,
          mode: 'study',
        }),
      });
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      await supabase.from('study_plans').insert({
        user_id: user.id, exam_date: examDate, subjects: filteredSubjects,
        daily_hours: dailyHours, plan_data: data.days || data.plan || [],
      });
      queryClient.invalidateQueries({ queryKey: ['study_plans'] });
      toast.success('Study plan generated!');
    } catch {
      toast.error('Failed to generate plan');
    }
    setGenerating(false);
  };

  const generateExamPlan = async () => {
    if (!examSubject.trim() || !examSyllabus.trim() || !examDateExam || !user) return;
    const allowed = await checkAndIncrement('study_planners');
    if (!allowed) return;
    setGeneratingExam(true);
    setExamPlanResult(null);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          subjects: [examSubject],
          examDate: examDateExam,
          dailyHours: examDailyHours,
          mode: 'exam',
          syllabus: examSyllabus,
          wakeUpTime,
          sleepTime,
        }),
      });
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();

      if (data.markdown) {
        setExamPlanResult(data.markdown);
        // Auto-save exam markdown plan to DB
        await supabase.from('study_plans').insert({
          user_id: user.id, exam_date: examDateExam, subjects: [examSubject],
          daily_hours: examDailyHours, plan_data: { markdown: data.markdown },
        });
        queryClient.invalidateQueries({ queryKey: ['study_plans'] });
      } else if (data.plan || data.days) {
        await supabase.from('study_plans').insert({
          user_id: user.id, exam_date: examDateExam, subjects: [examSubject],
          daily_hours: examDailyHours, plan_data: data.days || data.plan || [],
        });
        queryClient.invalidateQueries({ queryKey: ['study_plans'] });
        setExamPlanResult(data.markdown || '✅ Exam plan generated! Check your plans below.');
      }
      toast.success('Exam plan saved automatically!');
    } catch {
      toast.error('Failed to generate exam plan');
    }
    setGeneratingExam(false);
  };

  const daysUntilExam = examDate ? Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000) : null;
  const daysUntilExamExam = examDateExam ? Math.ceil((new Date(examDateExam).getTime() - Date.now()) / 86400000) : null;

  return (
    <>
    <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    <div className="max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-xl shadow-primary/20">
            <Wand2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Study Planner</h1>
            <p className="text-muted-foreground text-sm mt-0.5">AI-powered schedules with timetables & structured planning</p>
          </div>
        </div>
      </motion.div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'study' | 'exam')}>
        <TabsList className="w-full grid grid-cols-2 h-12 rounded-2xl bg-muted/20 p-1">
          <TabsTrigger value="study" className="rounded-xl text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Study Planner
          </TabsTrigger>
          <TabsTrigger value="exam" className="rounded-xl text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-2">
            <Brain className="w-4 h-4" /> Exam Planner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="study" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-[2rem] liquid-glass-intense overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.06),transparent_60%)] z-[2]" />
            <div className="relative z-10 p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <label className="text-sm font-semibold text-foreground">Subjects</label>
                  </div>
                  <div className="space-y-2.5">
                    {subjects.map((s, i) => (
                      <div key={i} className="flex gap-2 group">
                        <Input
                          placeholder={`Subject ${i + 1}${userPrefs?.subjects?.[i] ? ` (e.g. ${userPrefs.subjects[i]})` : ''}`}
                          value={s}
                          onChange={e => setSubjects(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                          className="bg-muted/20 border-border/30 rounded-xl h-12 px-4 text-sm"
                        />
                        {subjects.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => setSubjects(prev => prev.filter((_, j) => j !== i))}
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12">
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSubjects(prev => [...prev, ''])} className="text-primary hover:bg-primary/10 rounded-xl">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Subject
                  </Button>
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Calendar className="w-4 h-4 text-secondary" />
                      <label className="text-sm font-semibold text-foreground">Target Date</label>
                    </div>
                    <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="bg-muted/20 border-border/30 rounded-xl h-12 px-4 text-sm" />
                    {daysUntilExam !== null && daysUntilExam > 0 && (
                      <p className="text-xs text-primary font-semibold mt-2">{daysUntilExam} days remaining</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Clock className="w-4 h-4 text-warning" />
                      <label className="text-sm font-semibold text-foreground">Daily Hours</label>
                    </div>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 6, 8].map(h => (
                        <button key={h} onClick={() => setDailyHours(h)}
                          className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all ${
                            dailyHours === h ? 'gradient-primary text-primary-foreground shadow-md shadow-primary/20'
                              : 'liquid-glass-subtle text-muted-foreground hover:bg-muted/40'
                          }`}>{h}h</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={generatePlan}
                disabled={generating || !subjects.some(s => s.trim()) || !examDate}
                className="gradient-primary text-primary-foreground h-14 px-10 text-base rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all mt-8 w-full md:w-auto"
              >
                {generating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Crafting plan...</> : <><Table className="w-5 h-5 mr-2" /> Generate Timetable</>}
              </Button>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="exam" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-[2rem] liquid-glass-intense overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--secondary)/0.06),transparent_60%)] z-[2]" />
            <div className="relative z-10 p-8 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                      <GraduationCap className="w-4 h-4 text-secondary" /> Exam Subject
                    </label>
                    <Input
                      placeholder="e.g. Physics, Mathematics, English..."
                      value={examSubject}
                      onChange={e => setExamSubject(e.target.value)}
                      className="bg-muted/20 border-border/30 rounded-xl h-12 px-4 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-primary" /> Syllabus / Topics
                    </label>
                    <Textarea
                      placeholder={"Paste your syllabus here...\n\ne.g.\nChapter 1: Mechanics — Newton's Laws, Motion\nChapter 2: Thermodynamics — Heat, Energy\nChapter 3: Waves — Sound, Light"}
                      value={examSyllabus}
                      onChange={e => setExamSyllabus(e.target.value)}
                      rows={6}
                      className="bg-muted/20 border-border/30 rounded-xl px-4 py-3 text-sm resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-destructive" /> Exam Date
                    </label>
                    <Input type="date" value={examDateExam} onChange={e => setExamDateExam(e.target.value)} className="bg-muted/20 border-border/30 rounded-xl h-12 px-4 text-sm" />
                    {daysUntilExamExam !== null && daysUntilExamExam > 0 && (
                      <p className="text-xs text-secondary font-semibold mt-2">{daysUntilExamExam} days until exam</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Wake Up</label>
                      <Input type="time" value={wakeUpTime} onChange={e => setWakeUpTime(e.target.value)} className="bg-muted/20 border-border/30 rounded-xl h-11 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Sleep Time</label>
                      <Input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} className="bg-muted/20 border-border/30 rounded-xl h-11 text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2.5">
                      <Clock className="w-4 h-4 text-warning" /> Study Hours / Day
                    </label>
                    <div className="flex gap-1.5">
                      {[2, 3, 4, 6, 8, 10].map(h => (
                        <button key={h} onClick={() => setExamDailyHours(h)}
                          className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all ${
                            examDailyHours === h ? 'bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground shadow-md'
                              : 'liquid-glass-subtle text-muted-foreground hover:bg-muted/40'
                          }`}>{h}h</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={generateExamPlan}
                disabled={generatingExam || !examSubject.trim() || !examSyllabus.trim() || !examDateExam}
                className="bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground h-14 px-10 text-base rounded-2xl shadow-lg shadow-secondary/20 hover:shadow-xl transition-all w-full md:w-auto"
              >
                {generatingExam ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Building exam schedule...</> : <><Brain className="w-5 h-5 mr-2" /> Generate Exam Timetable</>}
              </Button>
            </div>
          </motion.div>

          <AnimatePresence>
            {examPlanResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-[2rem] liquid-glass p-8"
              >
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-secondary/15 flex items-center justify-center">
                      <Table className="w-4 h-4 text-secondary" />
                    </div>
                    <h3 className="font-display font-bold text-foreground">Your Exam Timetable</h3>
                  </div>
                  <div className="max-w-none text-muted-foreground">
                    <MarkdownRenderer>{examPlanResult}</MarkdownRenderer>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>
      </Tabs>

      {plans && plans.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Your Plans
          </h2>
          {plans.map((plan, pi) => {
            const rawPlanData = plan.plan_data as any;
            // Handle markdown-format exam plans
            const isMarkdownPlan = rawPlanData && typeof rawPlanData === 'object' && !Array.isArray(rawPlanData) && rawPlanData.markdown;
            const days: PlanDay[] = Array.isArray(rawPlanData) ? rawPlanData : [];
            const isExpanded = expandedPlan === plan.id;
            const displayDays = isExpanded ? days : days.slice(0, 7);
            const totalTasks = days.reduce((sum: number, d: PlanDay) => sum + (d.tasks?.length || 0), 0);

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: pi * 0.06 }}
                className="rounded-[2rem] liquid-glass overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="p-6 pb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-foreground">{(plan.subjects as string[])?.join(' · ')}</h3>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {plan.exam_date}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {plan.daily_hours}h/day</span>
                          {!isMarkdownPlan && <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {totalTasks} tasks</span>}
                          {isMarkdownPlan && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Exam Timetable</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full">{isMarkdownPlan ? 'Exam' : `${days.length}d`}</span>
                  </div>

                  <div className="px-6 pb-4">
                    {isMarkdownPlan ? (
                      <div className="max-w-none text-muted-foreground">
                        <MarkdownRenderer>{rawPlanData.markdown}</MarkdownRenderer>
                      </div>
                    ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {displayDays.map((day, di) => (
                        <motion.div
                          key={di}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: di * 0.02 }}
                          className="rounded-xl liquid-glass-subtle p-4 hover:border-primary/20 transition-all"
                        >
                          <div className="flex items-baseline justify-between mb-3">
                            <span className="text-xs font-bold text-foreground">Day {day.day || di + 1}</span>
                            {day.date && <span className="text-[10px] text-muted-foreground">{day.date}</span>}
                          </div>
                          <div className="space-y-1.5">
                            {day.tasks?.map((task, ti) => {
                              const color = typeColors[task.type] || typeColors.study;
                              return (
                                <div key={ti} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${color.bg}`}>
                                  <div className={`w-1.5 h-1.5 rounded-full ${color.dot} flex-shrink-0`} />
                                  <span className={`text-[11px] font-medium ${color.text} truncate flex-1`}>{task.topic}</span>
                                  {task.time && <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">{task.time}</span>}
                                  <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{task.duration_minutes}m</span>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {days.length > 7 && (
                      <button
                        onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                        className="w-full mt-3 py-3 text-xs font-medium text-primary hover:bg-primary/5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                      >
                        {isExpanded ? 'Show less' : `Show all ${days.length} days`}
                        <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                    )}
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
};

export default StudyPlanner;
