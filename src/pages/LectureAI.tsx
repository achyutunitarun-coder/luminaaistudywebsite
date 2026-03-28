import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileAudio, ArrowLeft, Save, FolderOpen, Trash2, Clock } from 'lucide-react';
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

  // Saved lectures list
  const [savedLectures, setSavedLectures] = useState<SavedLecture[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);

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
  }, []);

  const handleDocumentTextReady = useCallback((_text: string) => {
    setIsDocumentSource(true);
  }, []);

  const handleSetNotes = useCallback((content: string) => {
    setNotes(content);
    // Trigger auto-save when notes change
    if (content && user && transcript) {
      autoSaveDebounced(content);
    }
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
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center shadow-xl shadow-primary/25">
              <FileAudio className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Lecture AI</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Record, upload audio or documents → Notes → Flashcards → Quiz → Podcast</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => setShowSaved(!showSaved)}
          >
            <FolderOpen className="w-4 h-4 mr-1.5" />
            My Lectures
          </Button>
        </div>
      </motion.div>

      {/* Saved Lectures Panel */}
      {showSaved && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/30 bg-card/50 p-5">
          <h3 className="font-display font-bold text-foreground mb-3">Saved Lectures</h3>
          {loadingSaved ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : savedLectures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved lectures yet. Create one and click Save!</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {savedLectures.map((lec) => (
                <div key={lec.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/10 hover:bg-muted/20 transition-colors group">
                  <button onClick={() => loadLecture(lec)} className="flex-1 text-left">
                    <div className="text-sm font-medium text-foreground">{lec.title}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Clock className="w-3 h-3" />
                      {format(new Date(lec.created_at), 'MMM d, yyyy')}
                      {lec.notes && <span className="text-primary">• Has notes</span>}
                      {lec.podcast_script && <span className="text-secondary">• Has podcast</span>}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteLecture(lec.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {!transcript ? (
        <LectureRecorder
          onTranscriptReady={handleTranscriptReady}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
          onDocumentTextReady={handleDocumentTextReady}
        />
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Title + Save */}
          <div className="flex items-center gap-3">
            <Input
              value={lectureTitle}
              onChange={(e) => setLectureTitle(e.target.value)}
              className="rounded-xl bg-card/40 border-border/30 font-display font-semibold text-lg h-11 flex-1"
              placeholder="Lecture title..."
            />
            <Button onClick={saveLecture} disabled={saving} className="h-11 px-5 rounded-2xl">
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>

          <div className="rounded-[2rem] border border-border/30 bg-card/50 backdrop-blur-2xl overflow-hidden">
            <Tabs defaultValue={isDocumentSource ? "notes" : "transcript"} className="w-full">
              <div className="px-5 pt-5">
                <TabsList className="w-full grid grid-cols-5 h-11 rounded-xl bg-muted/20">
                  <TabsTrigger value="transcript" className="rounded-lg text-xs data-[state=active]:bg-background">
                    {isDocumentSource ? 'Source' : 'Transcript'}
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="rounded-lg text-xs data-[state=active]:bg-background">Notes</TabsTrigger>
                  <TabsTrigger value="flashcards" className="rounded-lg text-xs data-[state=active]:bg-background">Flashcards</TabsTrigger>
                  <TabsTrigger value="quiz" className="rounded-lg text-xs data-[state=active]:bg-background">Quiz</TabsTrigger>
                  <TabsTrigger value="podcast" className="rounded-lg text-xs data-[state=active]:bg-background">Podcast</TabsTrigger>
                </TabsList>
              </div>

              <div className="p-5">
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
                  />
                </TabsContent>
                <TabsContent value="flashcards" className="mt-0">
                  <LectureFlashcards notes={notes} />
                </TabsContent>
                <TabsContent value="quiz" className="mt-0">
                  <LectureQuiz notes={notes} />
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

          <Button onClick={reset} variant="outline" className="h-12 px-8 rounded-2xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> New Lecture
          </Button>
        </motion.div>
      )}
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
};

export default LectureAI;
