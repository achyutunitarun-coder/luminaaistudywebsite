import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { BookOpen, Layers, HelpCircle, FileText, ArrowLeft, RefreshCw, Search, GraduationCap, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRICULA, getTopicsForSubject } from '@/lib/curricula';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { useUsageLimits } from '@/hooks/useUsageLimits';

type ResourceType = 'notes' | 'flashcards' | 'questions' | 'test';

interface ResourceContent {
  notes?: string;
  flashcards?: Array<{ front: string; back: string }>;
  questions?: Array<{ question: string; options: string[]; answer: number; explanation: string; difficulty: string }>;
  test?: Array<{ question: string; options: string[]; answer: number; explanation: string }>;
}

const ease = [0.25, 0.1, 0.25, 1] as const;

// Subject theme gradients
const getSubjectTheme = (subject: string) => {
  const s = subject.toLowerCase();
  if (s.includes('math') || s.includes('algebra') || s.includes('calculus') || s.includes('geometry')) return 'from-purple-500/20 via-violet-500/15 to-fuchsia-500/10 border-purple-500/20';
  if (s.includes('physics') || s.includes('science') || s.includes('chemistry') || s.includes('biology')) return 'from-blue-500/20 via-cyan-500/15 to-teal-500/10 border-blue-500/20';
  if (s.includes('computer') || s.includes('programming') || s.includes('tech')) return 'from-emerald-500/20 via-green-500/15 to-lime-500/10 border-emerald-500/20';
  if (s.includes('history') || s.includes('geography') || s.includes('social') || s.includes('economics')) return 'from-amber-500/20 via-orange-500/15 to-yellow-500/10 border-amber-500/20';
  if (s.includes('english') || s.includes('literature') || s.includes('language')) return 'from-rose-500/20 via-pink-500/15 to-red-500/10 border-rose-500/20';
  return 'from-primary/20 via-primary/10 to-secondary/10 border-primary/20';
};

const getSubjectIcon = (subject: string) => {
  const s = subject.toLowerCase();
  if (s.includes('math')) return '📐';
  if (s.includes('physics')) return '⚛️';
  if (s.includes('chemistry')) return '🧪';
  if (s.includes('biology')) return '🧬';
  if (s.includes('computer') || s.includes('tech')) return '💻';
  if (s.includes('history')) return '📜';
  if (s.includes('geography')) return '🌍';
  if (s.includes('economics') || s.includes('business')) return '📊';
  if (s.includes('english') || s.includes('literature')) return '📚';
  return '📖';
};

// 3D Tilt Card Component
const TiltCard = ({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [6, -6]);
  const rotateY = useTransform(x, [-100, 100], [-6, 6]);

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(e.clientX - rect.left - rect.width / 2);
    y.set(e.clientY - rect.top - rect.height / 2);
  };

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, perspective: 800 }}
      onMouseMove={handleMouse}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      whileHover={{ scale: 1.03, z: 20 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`cursor-pointer transition-shadow duration-300 hover:shadow-xl hover:shadow-primary/5 ${className}`}
    >
      {children}
    </motion.div>
  );
};

const Resources = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { checkAndIncrement } = useUsageLimits();

  const [selectedCurriculum, setSelectedCurriculum] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [customTopic, setCustomTopic] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ResourceType>('notes');
  const [flippedCard, setFlippedCard] = useState<number | null>(null);
  const [testAnswers, setTestAnswers] = useState<Record<number, number>>({});
  const [showTestResults, setShowTestResults] = useState(false);

  const curriculum = CURRICULA.find(c => c.id === selectedCurriculum);
  const topics = selectedSubject ? getTopicsForSubject(selectedSubject) : [];
  const activeTopic = selectedTopic || customTopic;

  const { data: resource, isLoading: loadingResource } = useQuery({
    queryKey: ['resource', user?.id, selectedCurriculum, selectedSubject, activeTopic, activeTab],
    queryFn: async () => {
      if (!activeTopic || !selectedCurriculum || !selectedSubject) return null;
      const { data } = await supabase
        .from('resources')
        .select('*')
        .eq('user_id', user!.id)
        .eq('curriculum', selectedCurriculum)
        .eq('subject', selectedSubject)
        .eq('topic', activeTopic)
        .eq('resource_type', activeTab)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!selectedCurriculum && !!selectedSubject && !!activeTopic,
  });

  const generateMutation = useMutation({
    mutationFn: async ({ type, regenerate }: { type: ResourceType; regenerate?: boolean }) => {
      const allowed = await checkAndIncrement('resources');
      if (!allowed) throw new Error('Usage limit reached');

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          curriculum: selectedCurriculum,
          subject: selectedSubject,
          topic: activeTopic,
          type,
          userId: user!.id,
          regenerate,
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err || 'Generation failed');
      }
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource'] });
      toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} generated!`);
    },
    onError: (e: Error) => {
      if (!e.message.includes('Usage limit')) toast.error('Failed to generate resource');
    },
  });

  const handleGenerate = useCallback((regenerate = false) => {
    generateMutation.mutate({ type: activeTab, regenerate });
  }, [activeTab, generateMutation]);

  const filteredCurricula = CURRICULA.filter(c =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedCurricula = filteredCurricula.reduce((acc, c) => {
    if (!acc[c.region]) acc[c.region] = [];
    acc[c.region].push(c);
    return acc;
  }, {} as Record<string, typeof CURRICULA>);

  const resourceContent = resource?.content as ResourceContent | null;

  const renderNotes = () => {
    const notes = resourceContent?.notes;
    if (!notes) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-none text-muted-foreground"
      >
        <MarkdownRenderer>{notes}</MarkdownRenderer>
      </motion.div>
    );
  };

  const renderFlashcards = () => {
    const cards = resourceContent?.flashcards;
    if (!cards?.length) return null;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setFlippedCard(flippedCard === i ? null : i)}
            className="cursor-pointer rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-5 min-h-[140px] flex items-center justify-center text-center transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group"
            whileHover={{ scale: 1.02, rotateY: 2 }}
            whileTap={{ scale: 0.98 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={flippedCard === i ? 'back' : 'front'}
                initial={{ opacity: 0, rotateY: 90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: -90 }}
                transition={{ duration: 0.3 }}
              >
                <span className={`text-[10px] uppercase tracking-wider font-semibold block mb-2 ${flippedCard === i ? 'text-primary' : 'text-muted-foreground'}`}>
                  {flippedCard === i ? 'Answer' : 'Question'}
                </span>
                <p className="text-sm text-foreground leading-relaxed">
                  {flippedCard === i ? card.back : card.front}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    );
  };

  const renderQuestions = () => {
    const questions = resourceContent?.questions;
    if (!questions?.length) return null;
    return (
      <div className="space-y-4">
        {questions.map((q, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="bg-card/30 overflow-hidden">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{i + 1}. {q.question}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">{q.difficulty}</Badge>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {q.options.map((opt, j) => (
                    <motion.button
                      key={j}
                      onClick={() => setTestAnswers(prev => ({ ...prev, [i]: j }))}
                      className={`text-left text-sm p-3 rounded-xl border transition-all ${
                        testAnswers[i] === j
                          ? j === q.answer
                            ? 'border-green-500/50 bg-green-500/10 text-green-300'
                            : 'border-red-500/50 bg-red-500/10 text-red-300'
                          : 'border-border/30 hover:border-primary/30 text-muted-foreground hover:text-foreground'
                      }`}
                      whileHover={{ x: 4 }}
                    >
                      {opt}
                    </motion.button>
                  ))}
                </div>
                {testAnswers[i] !== undefined && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl"
                  >
                    <strong className="text-primary">Explanation:</strong> {q.explanation}
                  </motion.p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    );
  };

  const renderTest = () => {
    const questions = resourceContent?.test;
    if (!questions?.length) return null;
    const totalCorrect = Object.entries(testAnswers).filter(([i, a]) => questions[Number(i)]?.answer === a).length;

    return (
      <div className="space-y-4">
        {showTestResults && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-primary">{totalCorrect}/{questions.length}</p>
                <p className="text-sm text-muted-foreground">Score</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
        {questions.map((q, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="bg-card/30">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium text-foreground">{i + 1}. {q.question}</p>
                <div className="grid grid-cols-1 gap-2">
                  {q.options.map((opt, j) => (
                    <button
                      key={j}
                      onClick={() => { if (!showTestResults) setTestAnswers(prev => ({ ...prev, [i]: j })); }}
                      className={`text-left text-sm p-3 rounded-xl border transition-all ${
                        showTestResults
                          ? j === q.answer ? 'border-green-500/50 bg-green-500/10 text-green-300'
                            : testAnswers[i] === j ? 'border-red-500/50 bg-red-500/10 text-red-300'
                              : 'border-border/20 text-muted-foreground/50'
                          : testAnswers[i] === j ? 'border-primary/50 bg-primary/10 text-primary'
                            : 'border-border/30 hover:border-primary/30 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {showTestResults && q.explanation && (
                  <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl">{q.explanation}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {!showTestResults && Object.keys(testAnswers).length === questions.length && (
          <Button onClick={() => setShowTestResults(true)} className="w-full rounded-2xl h-12">Submit Test</Button>
        )}
      </div>
    );
  };

  // ─── Skeleton loader ───
  const SkeletonLoader = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );

  // ─── CURRICULUM SELECTION ───
  if (!selectedCurriculum) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-1">
            📚 Resource Library
          </h1>
          <p className="text-muted-foreground">Select your curriculum to access high-quality study materials</p>
        </motion.div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search curricula..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-2xl bg-card/40 border-border/30"
          />
        </div>

        <div className="space-y-6">
          {Object.entries(groupedCurricula).map(([region, curricula], ri) => (
            <motion.div key={region} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ri * 0.1 }}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{region}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {curricula.map((c, ci) => (
                  <TiltCard key={c.id} onClick={() => setSelectedCurriculum(c.id)}>
                    <Card className="hover:border-primary/30 transition-all group overflow-hidden">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.subjects.length} subjects</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </CardContent>
                    </Card>
                  </TiltCard>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── SUBJECT SELECTION with covers ───
  if (!selectedSubject) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" size="sm" onClick={() => setSelectedCurriculum(null)} className="mb-4 rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Curricula
          </Button>
          <h1 className="text-3xl font-display font-bold text-foreground mb-1">
            <GraduationCap className="inline w-8 h-8 mr-2 text-primary" />
            {curriculum?.name}
          </h1>
          <p className="text-muted-foreground">Choose a subject</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {curriculum?.subjects.map((subject, i) => (
            <TiltCard key={subject} onClick={() => setSelectedSubject(subject)}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card className={`overflow-hidden hover:border-primary/30 transition-all group border bg-gradient-to-br ${getSubjectTheme(subject)}`}>
                  <CardContent className="p-5">
                    <div className="text-3xl mb-3">{getSubjectIcon(subject)}</div>
                    <p className="font-bold text-foreground group-hover:text-primary transition-colors text-lg">{subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">{getTopicsForSubject(subject).length} topics available</p>
                  </CardContent>
                </Card>
              </motion.div>
            </TiltCard>
          ))}
        </div>
      </div>
    );
  }

  // ─── TOPIC SELECTION ───
  if (!activeTopic) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" size="sm" onClick={() => setSelectedSubject(null)} className="mb-4 rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Subjects
          </Button>
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">
            {getSubjectIcon(selectedSubject)} {selectedSubject}
          </h1>
          <p className="text-muted-foreground text-sm">{curriculum?.name} • Select or type a topic</p>
        </motion.div>

        <div className="flex gap-2">
          <Input
            placeholder="Type a custom topic..."
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            className="h-11 rounded-2xl bg-card/40 border-border/30 flex-1"
            onKeyDown={e => { if (e.key === 'Enter' && customTopic.trim()) setSelectedTopic(null); }}
          />
          {customTopic.trim() && (
            <Button onClick={() => {}} className="rounded-2xl h-11">Go</Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topics.map((topic, i) => (
            <TiltCard key={topic} onClick={() => { setSelectedTopic(topic); setCustomTopic(''); }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="hover:border-primary/30 transition-all group">
                  <CardContent className="p-4 flex items-center justify-between">
                    <p className="font-medium text-foreground group-hover:text-primary transition-colors">{topic}</p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              </motion.div>
            </TiltCard>
          ))}
        </div>
      </div>
    );
  }

  // ─── RESOURCE VIEWER ───
  const isGenerating = generateMutation.isPending;
  const hasContent = !!resource?.content && (
    (activeTab === 'notes' && !!(resource.content as any).notes) ||
    (activeTab === 'flashcards' && (resource.content as any).flashcards?.length > 0) ||
    (activeTab === 'questions' && (resource.content as any).questions?.length > 0) ||
    (activeTab === 'test' && (resource.content as any).test?.length > 0)
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" size="sm" onClick={() => { setSelectedTopic(null); setCustomTopic(''); setTestAnswers({}); setShowTestResults(false); }} className="mb-4 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Topics
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{activeTopic}</h1>
            <p className="text-sm text-muted-foreground">{curriculum?.name} • {selectedSubject}</p>
          </div>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as ResourceType); setTestAnswers({}); setShowTestResults(false); }}>
        <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-muted/30 p-1">
          <TabsTrigger value="notes" className="rounded-xl text-xs gap-1"><BookOpen className="w-3.5 h-3.5" /> Notes</TabsTrigger>
          <TabsTrigger value="flashcards" className="rounded-xl text-xs gap-1"><Layers className="w-3.5 h-3.5" /> Cards</TabsTrigger>
          <TabsTrigger value="questions" className="rounded-xl text-xs gap-1"><HelpCircle className="w-3.5 h-3.5" /> Q&A</TabsTrigger>
          <TabsTrigger value="test" className="rounded-xl text-xs gap-1"><FileText className="w-3.5 h-3.5" /> Test</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {loadingResource ? (
            <SkeletonLoader />
          ) : isGenerating ? (
            <SkeletonLoader />
          ) : hasContent ? (
            <div>
              <div className="flex justify-end mb-4">
                <Button variant="ghost" size="sm" onClick={() => handleGenerate(true)} className="rounded-xl text-xs">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate
                </Button>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {activeTab === 'notes' && renderNotes()}
                  {activeTab === 'flashcards' && renderFlashcards()}
                  {activeTab === 'questions' && renderQuestions()}
                  {activeTab === 'test' && renderTest()}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-16"
            >
              {activeTab === 'notes' && <BookOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />}
              {activeTab === 'flashcards' && <Layers className="w-12 h-12 text-muted-foreground/40 mb-4" />}
              {activeTab === 'questions' && <HelpCircle className="w-12 h-12 text-muted-foreground/40 mb-4" />}
              {activeTab === 'test' && <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />}
              <h3 className="text-lg font-display font-bold text-foreground mb-2">
                Generate {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h3>
              <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
                AI-powered {activeTab} tailored for {curriculum?.name} — {selectedSubject}: {activeTopic}
              </p>
              <Button onClick={() => handleGenerate()} className="h-11 px-6 rounded-2xl gradient-primary text-primary-foreground">
                Generate {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </Button>
            </motion.div>
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default Resources;
