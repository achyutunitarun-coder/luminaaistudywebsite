import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Layers, HelpCircle, FileText, ArrowLeft, Loader2, RefreshCw, Search, GraduationCap, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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

  // Fetch existing resource
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

  // Generate resource
  const generateMutation = useMutation({
    mutationFn: async ({ type, regenerate }: { type: ResourceType; regenerate?: boolean }) => {
      const allowed = await checkAndIncrement('resources');
      if (!allowed) throw new Error('Usage limit reached');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
    onSuccess: (data) => {
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

  // Content rendering
  const resourceContent = resource?.content as ResourceContent | null;

  const renderNotes = () => {
    const notes = resourceContent?.notes;
    if (!notes) return null;
    return (
      <div className="prose prose-invert max-w-none">
        <MarkdownRenderer content={notes} />
      </div>
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
            onClick={() => setFlippedCard(flippedCard === i ? null : i)}
            className="cursor-pointer rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-5 min-h-[120px] flex items-center justify-center text-center transition-all hover:border-primary/30"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-2">
                {flippedCard === i ? 'Answer' : 'Question'}
              </span>
              <p className="text-sm text-foreground leading-relaxed">
                {flippedCard === i ? card.back : card.front}
              </p>
            </div>
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
          <Card key={i} className="bg-card/30">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{i + 1}. {q.question}</p>
                <Badge variant="outline" className="text-[10px] shrink-0">{q.difficulty}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {q.options.map((opt, j) => (
                  <button
                    key={j}
                    onClick={() => setTestAnswers(prev => ({ ...prev, [i]: j }))}
                    className={`text-left text-sm p-3 rounded-xl border transition-all ${
                      testAnswers[i] === j
                        ? j === q.answer
                          ? 'border-green-500/50 bg-green-500/10 text-green-300'
                          : 'border-red-500/50 bg-red-500/10 text-red-300'
                        : 'border-border/30 hover:border-primary/30 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt}
                  </button>
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
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-primary">{totalCorrect}/{questions.length}</p>
              <p className="text-sm text-muted-foreground">Score</p>
            </CardContent>
          </Card>
        )}
        {questions.map((q, i) => (
          <Card key={i} className="bg-card/30">
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{i + 1}. {q.question}</p>
              <div className="grid grid-cols-1 gap-2">
                {q.options.map((opt, j) => (
                  <button
                    key={j}
                    onClick={() => {
                      if (!showTestResults) setTestAnswers(prev => ({ ...prev, [i]: j }));
                    }}
                    className={`text-left text-sm p-3 rounded-xl border transition-all ${
                      showTestResults
                        ? j === q.answer
                          ? 'border-green-500/50 bg-green-500/10 text-green-300'
                          : testAnswers[i] === j
                            ? 'border-red-500/50 bg-red-500/10 text-red-300'
                            : 'border-border/20 text-muted-foreground/50'
                        : testAnswers[i] === j
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border/30 hover:border-primary/30 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {showTestResults && q.explanation && (
                <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl">
                  {q.explanation}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {!showTestResults && Object.keys(testAnswers).length === questions.length && (
          <Button onClick={() => setShowTestResults(true)} className="w-full rounded-2xl h-12">
            Submit Test
          </Button>
        )}
      </div>
    );
  };

  // ─── CURRICULUM SELECTION ───
  if (!selectedCurriculum) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
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
          {Object.entries(groupedCurricula).map(([region, curricula]) => (
            <motion.div key={region} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{region}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {curricula.map(c => (
                  <motion.div key={c.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Card
                      className="cursor-pointer hover:border-primary/30 transition-all group"
                      onClick={() => setSelectedCurriculum(c.id)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.subjects.length} subjects</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── SUBJECT SELECTION ───
  if (!selectedSubject) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {curriculum?.subjects.map(subject => (
            <motion.div key={subject} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className="cursor-pointer hover:border-primary/30 transition-all group"
                onClick={() => setSelectedSubject(subject)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">{subject}</p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── TOPIC SELECTION ───
  if (!activeTopic) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" size="sm" onClick={() => setSelectedSubject(null)} className="mb-4 rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Subjects
          </Button>
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">{selectedSubject}</h1>
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
          {topics.map(topic => (
            <motion.div key={topic} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className="cursor-pointer hover:border-primary/30 transition-all group"
                onClick={() => { setSelectedTopic(topic); setCustomTopic(''); }}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">{topic}</p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </CardContent>
              </Card>
            </motion.div>
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
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
            <div className="flex flex-col items-center py-16">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : isGenerating ? (
            <div className="flex flex-col items-center py-16">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Generating {activeTab}...</p>
              <p className="text-xs text-muted-foreground/60 mt-1">This may take a moment</p>
            </div>
          ) : hasContent ? (
            <div>
              <div className="flex justify-end mb-4">
                <Button variant="ghost" size="sm" onClick={() => handleGenerate(true)} className="rounded-xl text-xs">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate
                </Button>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  {activeTab === 'notes' && renderNotes()}
                  {activeTab === 'flashcards' && renderFlashcards()}
                  {activeTab === 'questions' && renderQuestions()}
                  {activeTab === 'test' && renderTest()}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center py-16">
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
              <Button onClick={() => handleGenerate()} className="h-11 px-6 rounded-2xl">
                Generate {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </Button>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default Resources;
