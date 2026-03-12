import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileAudio, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import LectureRecorder from '@/components/lecture/LectureRecorder';
import LectureTranscript from '@/components/lecture/LectureTranscript';
import LectureNotes from '@/components/lecture/LectureNotes';
import LectureFlashcards from '@/components/lecture/LectureFlashcards';
import LectureQuiz from '@/components/lecture/LectureQuiz';
import LecturePodcast from '@/components/lecture/LecturePodcast';

const LectureAI = () => {
  const [transcript, setTranscript] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesGenerated, setNotesGenerated] = useState(false);
  const [isDocumentSource, setIsDocumentSource] = useState(false);

  const handleTranscriptReady = useCallback((data: any) => {
    setTranscript(data);
  }, []);

  const handleDocumentTextReady = useCallback((_text: string) => {
    setIsDocumentSource(true);
  }, []);

  const handleSetNotes = useCallback((content: string) => {
    setNotes(content);
  }, []);

  const handleSetNotesGenerated = useCallback((v: boolean) => {
    setNotesGenerated(v);
  }, []);

  const reset = () => {
    setTranscript(null);
    setNotes('');
    setNotesGenerated(false);
    setIsDocumentSource(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center shadow-xl shadow-primary/25">
            <FileAudio className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Lecture AI</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Record, upload audio or documents → Notes → Flashcards → Quiz → Podcast</p>
          </div>
        </div>
      </motion.div>

      {!transcript ? (
        <LectureRecorder
          onTranscriptReady={handleTranscriptReady}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
          onDocumentTextReady={handleDocumentTextReady}
        />
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
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
                    setNotesGenerated={handleSetNotesGenerated}
                  />
                </TabsContent>
                <TabsContent value="flashcards" className="mt-0">
                  <LectureFlashcards notes={notes} />
                </TabsContent>
                <TabsContent value="quiz" className="mt-0">
                  <LectureQuiz notes={notes} />
                </TabsContent>
                <TabsContent value="podcast" className="mt-0">
                  <LecturePodcast notes={notes} />
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <Button onClick={reset} variant="outline" className="h-12 px-8 rounded-2xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> New Lecture
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default LectureAI;
