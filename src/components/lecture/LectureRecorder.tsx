import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Upload, Loader2, FileAudio, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  onTranscriptReady: (transcript: any) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}

const LectureRecorder = ({ onTranscriptReady, isProcessing, setIsProcessing }: Props) => {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        transcribeAudio(blob, 'recording.webm');
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
      toast.success('Recording started');
    } catch {
      toast.error('Microphone access denied');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/mp3'];
    if (!validTypes.some(t => file.type.includes(t.split('/')[1]))) {
      toast.error('Please upload an mp3, wav, or m4a file');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File must be under 20MB');
      return;
    }
    transcribeAudio(file, file.name);
  };

  const transcribeAudio = async (audioBlob: Blob, filename: string) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, filename);

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-transcribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Transcription failed' }));
        throw new Error(err.error || 'Transcription failed');
      }

      const data = await resp.json();
      onTranscriptReady(data);
      toast.success('Transcription complete!');
    } catch (e: any) {
      toast.error(e.message || 'Transcription failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center py-20">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-display font-bold text-foreground mb-1">Transcribing Audio</h2>
        <p className="text-muted-foreground text-sm">This may take a moment for longer recordings...</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-[2rem] border border-border/30 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-2xl overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_70%)]" />
      <div className="relative z-10 flex flex-col items-center py-16 px-8">
        <AnimatePresence mode="wait">
          {recording ? (
            <motion.div key="rec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
              <div className="relative mb-6">
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 rounded-full bg-destructive/20" />
                <div className="relative w-24 h-24 rounded-full bg-destructive/90 flex items-center justify-center shadow-xl shadow-destructive/30">
                  <div className="w-4 h-4 rounded-sm bg-destructive-foreground animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-semibold text-destructive uppercase tracking-wider">Recording</span>
              </div>
              <span className="text-3xl font-mono font-bold text-foreground mb-6 tabular-nums">{formatTime(recordingTime)}</span>
              <Button onClick={stopRecording} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground h-12 px-8 rounded-2xl">
                <StopCircle className="w-5 h-5 mr-2" /> Stop Recording
              </Button>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
              <motion.button
                onClick={startRecording}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative w-28 h-28 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-2xl shadow-primary/30 flex items-center justify-center mb-6 cursor-pointer"
              >
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-20" />
                <Mic className="w-10 h-10 text-primary-foreground relative z-10" />
              </motion.button>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">Record a Lecture</h2>
              <p className="text-muted-foreground text-sm text-center max-w-md mb-6">
                Record live or upload an audio file (mp3, wav, m4a). We'll transcribe it and generate study materials.
              </p>
              <div className="flex gap-3">
                <Button onClick={startRecording} className="h-11 px-6 rounded-2xl">
                  <Mic className="w-4 h-4 mr-2" /> Start Recording
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="h-11 px-6 rounded-2xl">
                  <Upload className="w-4 h-4 mr-2" /> Upload File
                </Button>
                <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,.webm,audio/*" onChange={handleFileUpload} className="hidden" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LectureRecorder;
