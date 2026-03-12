import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Upload, Loader2, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  getPreferredRecordingMimeType,
  prepareAudioChunksForTranscription,
  type PreparedAudioChunk,
} from '@/components/lecture/audioUtils';

interface Props {
  onTranscriptReady: (transcript: any) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}

interface TranscriptWord {
  text: string;
  start?: number;
  end?: number;
  speaker?: string;
}

interface TranscriptResult {
  text: string;
  words?: TranscriptWord[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const BASE_TRANSCRIPTION_CONCURRENCY = 3;
const POLL_INTERVAL_MS = 1800;

const LectureRecorder = ({ onTranscriptReady, isProcessing, setIsProcessing }: Props) => {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [processingLabel, setProcessingLabel] = useState('Analyzing audio and extracting speech...');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const cleanupAudioPipeline = useCallback(async () => {
    rawStreamRef.current?.getTracks().forEach((track) => track.stop());
    processedStreamRef.current?.getTracks().forEach((track) => track.stop());

    rawStreamRef.current = null;
    processedStreamRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close();
    }
    audioContextRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      void cleanupAudioPipeline();
    };
  }, [cleanupAudioPipeline]);

  const getAuthorizationHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return `Bearer ${token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
  }, []);

  const startTranscriptionJob = useCallback(async (chunk: PreparedAudioChunk, authHeader: string, attempt = 1) => {
    const formData = new FormData();
    formData.append('audio', chunk.blob, chunk.filename);

    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-lecture`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    });

    if (!resp.ok) {
      if (resp.status === 546 && attempt < 3) {
        await delay(700 * attempt);
        return startTranscriptionJob(chunk, authHeader, attempt + 1);
      }

      const err = await resp.json().catch(() => ({ error: '' }));
      if (resp.status === 413) {
        throw new Error('Audio chunk too large for backend processing. The file was stopped to avoid wasting credits.');
      }

      throw new Error(err.error || `Transcription failed: ${resp.status}`);
    }

    const data = await resp.json();
    if (!data.job_id) throw new Error('Failed to start transcription job');
    return data.job_id as string;
  }, []);

  const pollForResult = useCallback(async (jobId: string, authHeader: string): Promise<TranscriptResult> => {
    const timeoutMs = 60 * 60 * 1000; // 1 hour
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-lecture?job_id=${jobId}`, {
        headers: {
          Authorization: authHeader,
        },
      });

      if (!resp.ok) throw new Error('Failed to check transcription status');

      const data = await resp.json();
      if (data.status === 'complete') return data.result;
      if (data.status === 'failed') throw new Error(data.error || 'Transcription failed');

      await delay(3000);
    }

    throw new Error('Transcription timed out. Please retry with a smaller chunk.');
  }, []);

  const transcribeAudio = useCallback(async (audioBlob: Blob, filename: string) => {
    setIsProcessing(true);

    try {
      setProcessingLabel('Preparing audio for transcription...');
      const chunks = await prepareAudioChunksForTranscription(audioBlob, filename);
      const authHeader = await getAuthorizationHeader();

      if (chunks.length > 1) {
        toast.info(`Long audio detected: split into ${chunks.length} parts for reliable transcription.`);
      }

      if (chunks.length > 40) {
        toast.info(`Large lecture detected: ${chunks.length} parts queued. Processing may take several minutes.`);
      }

      const textParts: string[] = [];
      const mergedWords: TranscriptWord[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setProcessingLabel(`Transcribing part ${i + 1}/${chunks.length}...`);

        const jobId = await startTranscriptionJob(chunk, authHeader);
        const result = await pollForResult(jobId, authHeader);

        if (result?.text?.trim()) {
          textParts.push(result.text.trim());
        }

        if (Array.isArray(result?.words)) {
          mergedWords.push(
            ...result.words.map((word) => ({
              ...word,
              start: typeof word.start === 'number' ? word.start + chunk.offsetSeconds : word.start,
              end: typeof word.end === 'number' ? word.end + chunk.offsetSeconds : word.end,
            }))
          );
        }
      }

      const mergedTranscript: TranscriptResult = {
        text: textParts.join('\n\n').trim(),
        words: mergedWords,
      };

      if (!mergedTranscript.text || mergedTranscript.text.length < 10) {
        throw new Error('Could not detect enough speech. Try recording closer to the speaker.');
      }

      onTranscriptReady(mergedTranscript);
      toast.success('Transcription complete!');
    } catch (e: any) {
      const message = String(e?.message || 'Transcription failed');
      toast.error(message.includes('546') ? 'Transcription request overloaded. We auto-retry now with smaller payloads — please retry once.' : message);
    } finally {
      setIsProcessing(false);
      setProcessingLabel('Analyzing audio and extracting speech...');
    }
  }, [getAuthorizationHeader, onTranscriptReady, pollForResult, setIsProcessing, startTranscriptionJob]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      rawStreamRef.current = stream;

      let recordingStream: MediaStream = stream;
      try {
        const audioContext = new AudioContext({ sampleRate: 48000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 2.2;

        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -30;
        compressor.knee.value = 22;
        compressor.ratio.value = 10;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.2;

        const destination = audioContext.createMediaStreamDestination();

        source.connect(gainNode);
        gainNode.connect(compressor);
        compressor.connect(destination);

        recordingStream = destination.stream;
        processedStreamRef.current = recordingStream;
      } catch {
        toast.info('Advanced audio processing unavailable — using direct microphone input.');
      }

      const preferredMimeType = getPreferredRecordingMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(recordingStream, { mimeType: preferredMimeType, audioBitsPerSecond: 128000 })
        : new MediaRecorder(recordingStream, { audioBitsPerSecond: 128000 });

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        toast.error('Recording failed. Please retry.');
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        void cleanupAudioPipeline();
      };

      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);

        const recorderMime = recorder.mimeType?.split(';')[0] || preferredMimeType.split(';')[0] || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: recorderMime });
        chunksRef.current = [];

        void cleanupAudioPipeline();

        if (blob.size < 2048) {
          toast.error('Recording is too short to transcribe.');
          return;
        }

        const extension = recorderMime.includes('mp4') ? 'm4a' : recorderMime.includes('ogg') ? 'ogg' : 'webm';
        void transcribeAudio(blob, `lecture-recording-${Date.now()}.${extension}`);
      };

      recorder.start(800);
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);
      toast.success('Recording started — voice boost is active.');
    } catch {
      toast.error('Microphone access denied');
    }
  }, [cleanupAudioPipeline, transcribeAudio]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state !== 'inactive') {
      recorder.requestData();
      recorder.stop();
    }

    mediaRecorderRef.current = null;
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void transcribeAudio(file, file.name);
  }, [transcribeAudio]);

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center py-20">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-display font-bold text-foreground mb-1">Transcribing Audio</h2>
        <p className="text-muted-foreground text-sm text-center">{processingLabel}</p>
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
              <span className="text-3xl font-mono font-bold text-foreground mb-2 tabular-nums">{formatTime(recordingTime)}</span>
              <p className="text-xs text-muted-foreground mb-6">Optimized gain + dynamics capture quiet lecture voices</p>
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
                Record live or upload audio of any length. Long files are auto-split into chunks and merged into one transcript.
              </p>
              <div className="flex gap-3">
                <Button onClick={startRecording} className="h-11 px-6 rounded-2xl">
                  <Mic className="w-4 h-4 mr-2" /> Start Recording
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="h-11 px-6 rounded-2xl">
                  <Upload className="w-4 h-4 mr-2" /> Upload File
                </Button>
                <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LectureRecorder;
