import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileAudio, ArrowLeft, Save, FolderOpen, Trash2, Clock, Sparkles, BookOpen, Layers, ClipboardList, Podcast, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import LectureRecorder from '@/components/lecture/LectureRecorder';
import LectureTranscript from '@/components/lecture/LectureTranscript';
import LectureNotes from '@/components/lecture/LectureNotes';
import LectureFlashcards from '@/components/lecture/LectureFlashcards';
import LectureQuiz from '@/components/lecture/LectureQuiz';
import LecturePodcast from '@/components/lecture/LecturePodcast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';

interface SavedLecture {
  id: string;
  title: string;
  transcript_text: string | null;
  notes: string | null;
  podcast_script: string | null;
  source_type: string | null;
  created_at: string;
}

const TAB_ITEMS = [
  { value: 'transcript', label: 'Transcript', icon: FileAudio, altLabel: 'Source' },
  { value: 'notes', label: 'Notes', icon: BookOpen },
  { value: 'flashcards', label: 'Cards', icon: Layers },
  { value: 'quiz', label: 'Quiz', icon: ClipboardList },
  { value: 'podcast', label: 'Podcast', icon: Podcast },
];

const LectureAI = () => {
  const { user } = useAuth();
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [transcript, setTranscript] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesGenerated, setNotesGenerated] = useState(false);
  const [isDocumentSource, setIsDocumentSource] = useState(false);
  const [lectureTitle, setLectureTitle] = useState('Untitled Lecture');
  const [currentLectureId, setCurrentLectureId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [podcastScript, setPodcastScript] = useState('');
  const [savedLectures, setSavedLectures] = useState<SavedLecture[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('transcript');

  const loadSavedLectures = useCallback(async () => {
    if (!user) return;
    setLoadingSaved(true);
    const { data } = await supabase
      .from('saved_lectures')
      .select('id, title, transcript_text, notes, podcast_script, source_type, created_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);
    setSavedLectures((data as SavedLecture[]) || []);
    setLoadingSaved(false);
  }, [user]);

  useEffect(() => {
    if (showSaved) loadSavedLectures();
  }, [showSaved, loadSavedLectures]);

  const handleTranscriptReady = useCallback((data: any) => {
    setTranscript(data);
    setActiveTab(data ? 'transcript' : 'transcript');
  }, []);

  const handleDocumentTextReady = useCallback((_text: string) => {
    setIsDocumentSource(true);
    setActiveTab('notes');
  }, []);

  const handleSetNotes = useCallback((content: string) => {
    setNotes(content);
    if (content && user && transcript) autoSaveDebounced(content);
  }, [user, transcript]);

  const autoSaveDebounced = useCallback((() => {
    let timer: NodeJS.Timeout | null = null;
    return (notesContent: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!user || !transcript) return;
        try {
          const payload = {
            user_id: user.id,
            title: lectureTitle || 'Untitled Lecture',
            transcript_text: transcript?.text || null,
            notes: notesContent || null,
            podcast_script: podcastScript || null,
            source_type: isDocumentSource ? 'document' : 'audio',
          };
          if (currentLectureId) {
            await supabase.from('saved_lectures').update(payload).eq('id', currentLectureId);
          } else {
            const { data } = await supabase.from('saved_lectures').insert(payload).select('id').single();
            if (data) setCurrentLectureId(data.id);
          }
        } catch (e) {
          console.error('Auto-save failed:', e);
        }
      }, 3000);
    };
  })(), [user, transcript, lectureTitle, podcastScript, currentLectureId, isDocumentSource]);

  const saveLecture = useCallback(async () => {
    if (!user || !transcript) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        title: lectureTitle || 'Untitled Lecture',
        transcript_text: transcript?.text || null,
        notes: notes || null,
        podcast_script: podcastScript || null,
        source_type: isDocumentSource ? 'document' : 'audio',
      };
      if (currentLectureId) {
        await supabase.from('saved_lectures').update(payload).eq('id', currentLectureId);
      } else {
        const { data } = await supabase.from('saved_lectures').insert(payload).select('id').single();
        if (data) setCurrentLectureId(data.id);
      }
      toast.success('Lecture saved!');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [user, transcript, notes, podcastScript, lectureTitle, currentLectureId, isDocumentSource]);

  const loadLecture = useCallback((lecture: SavedLecture) => {
    setTranscript({ text: lecture.transcript_text || '' });
    setNotes(lecture.notes || '');
    setNotesGenerated(!!lecture.notes);
    setPodcastScript(lecture.podcast_script || '');
    setLectureTitle(lecture.title);
    setCurrentLectureId(lecture.id);
    setIsDocumentSource(lecture.source_type === 'document');
    setShowSaved(false);
  }, []);

  const deleteLecture = useCallback(async (id: string) => {
    await supabase.from('saved_lectures').delete().eq('id', id);
    setSavedLectures(prev => prev.filter(l => l.id !== id));
    if (currentLectureId === id) setCurrentLectureId(null);
    toast.success('Lecture deleted');
  }, [currentLectureId]);

  const reset = () => {
    setTranscript(null);
    setNotes('');
    setNotesGenerated(false);
    setIsDocumentSource(false);
    setLectureTitle('Untitled Lecture');
    setCurrentLectureId(null);
    setPodcastScript('');
    setActiveTab('transcript');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="relative overflow-hidden rounded-3xl border border-border/20 bg-gradient-to-br from-card/90 via-card/70 to-card/50 backdrop-blur-3xl p-6 md:p-8">
          {/* Ambient glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[radial-gradient(circle,hsl(var(--primary)/0.15),transparent_60%)] blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-[radial-gradient(circle,hsl(var(--secondary)/0.1),transparent_60%)] blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.9)] to-[hsl(var(--secondary))] flex items-center justify-center shadow-2xl shadow-primary/30"
                whileHover={{ rotate: [0, -5, 5, 0], scale: 1.05 }}
                transition={{ duration: 0.6 }}
              >
                <FileAudio className="w-7 h-7 md:w-8 md:h-8 text-primary-foreground" />
              </motion.div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">Lecture AI</h1>
                  <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                </div>
                <p className="text-muted-foreground text-xs md:text-sm mt-0.5 max-w-md">
                  Record or upload → AI transforms it into notes, flashcards, quizzes & podcasts
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl border-border/30 bg-card/40 backdrop-blur-xl hover:bg-card/60 h-10 px-4"
              onClick={() => setShowSaved(!showSaved)}
            >
              <FolderOpen className="w-4 h-4 mr-1.5" />
              My Lectures
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Saved Lectures Panel */}
      <AnimatePresence>
        {showSaved && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-border/20 bg-card/60 backdrop-blur-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-foreground flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  Saved Lectures
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowSaved(false)} className="rounded-xl h-8 w-8 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {loadingSaved ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : savedLectures.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No saved lectures yet. Create one and it auto-saves!</p>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {savedLectures.map((lec, i) => (
                    <motion.div
                      key={lec.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/5 hover:bg-muted/15 border border-transparent hover:border-border/20 transition-all group cursor-pointer"
                      onClick={() => loadLecture(lec)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{lec.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3" />
                          {format(new Date(lec.created_at), 'MMM d, yyyy')}
                          {lec.notes && <span className="text-primary/80 font-medium">• Notes</span>}
                          {lec.podcast_script && <span className="text-secondary/80 font-medium">• Podcast</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive h-8 w-8 p-0 rounded-lg"
                        onClick={(e) => { e.stopPropagation(); deleteLecture(lec.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      {!transcript ? (
        <LectureRecorder
          onTranscriptReady={handleTranscriptReady}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
          onDocumentTextReady={handleDocumentTextReady}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5"
        >
          {/* Title + Save Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Input
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                className="rounded-2xl bg-card/50 backdrop-blur-xl border-border/20 font-display font-semibold text-lg h-12 pl-4 pr-4 focus:border-primary/40 transition-colors"
                placeholder="Lecture title..."
              />
            </div>
            <Button
              onClick={saveLecture}
              disabled={saving}
              className="h-12 px-6 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] hover:shadow-lg hover:shadow-primary/25 transition-all"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>

          {/* Workspace */}
          <div className="rounded-[1.75rem] border border-border/15 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-3xl overflow-hidden shadow-xl shadow-black/5">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Tab Navigation */}
              <div className="px-4 md:px-6 pt-5 pb-1">
                <TabsList className="w-full grid grid-cols-5 h-12 rounded-2xl bg-muted/15 p-1 gap-1">
                  {TAB_ITEMS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="rounded-xl text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:shadow-black/5 transition-all duration-200 flex items-center gap-1.5 px-2"
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="hidden sm:inline">
                          {tab.value === 'transcript' && isDocumentSource ? (tab.altLabel || tab.label) : tab.label}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* Tab Content */}
              <div className="p-4 md:p-6">
                <TabsContent value="transcript" className="mt-0">
                  <LectureTranscript transcript={transcript} />
                </TabsContent>
                <TabsContent value="notes" className="mt-0">
                  <LectureNotes
                    transcript={transcript.text}
                    notes={notes}
                    setNotes={handleSetNotes}
                    notesGenerated={notesGenerated}
                    setNotesGenerated={setNotesGenerated}
                    onBeforeGenerate={() => checkAndIncrement('lecture_notes')}
                  />
                </TabsContent>
                <TabsContent value="flashcards" className="mt-0">
                  <LectureFlashcards notes={notes} onBeforeGenerate={() => checkAndIncrement('lecture_flashcards')} />
                </TabsContent>
                <TabsContent value="quiz" className="mt-0">
                  <LectureQuiz notes={notes} onBeforeGenerate={() => checkAndIncrement('lecture_quiz')} />
                </TabsContent>
                <TabsContent value="podcast" className="mt-0">
                  <LecturePodcast
                    notes={notes}
                    onBeforeGenerate={() => checkAndIncrement('podcast_generation')}
                    onScriptChange={(script) => {
                      setPodcastScript(script);
                      if (script && user && currentLectureId) {
                        supabase.from('saved_lectures').update({ podcast_script: script }).eq('id', currentLectureId).then(() => {});
                      }
                    }}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* New Lecture Button */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              onClick={reset}
              variant="outline"
              className="h-12 px-8 rounded-2xl border-border/20 bg-card/30 backdrop-blur-xl hover:bg-card/50 transition-all w-full sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> New Lecture
            </Button>
          </motion.div>
        </motion.div>
      )}
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
};

export default LectureAI;
