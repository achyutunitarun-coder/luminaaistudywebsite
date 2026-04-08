import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Upload, Loader2, StopCircle, FileText, FileAudio, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  getPreferredRecordingMimeType,
  prepareAudioChunksForTranscription,
  type PreparedAudioChunk,
} from '@/components/lecture/audioUtils';
import { extractDocumentText, DOCUMENT_ACCEPT, type PdfProgressCallback } from '@/lib/extractDocumentText';
import { Progress } from '@/components/ui/progress';

interface Props {
  onTranscriptReady: (transcript: any) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  onDocumentTextReady?: (text: string) => void;
}

interface TranscriptWord { text: string; start?: number; end?: number; speaker?: string; }
interface TranscriptResult { text: string; words?: TranscriptWord[]; }

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const BASE_TRANSCRIPTION_CONCURRENCY = 3;
const POLL_INTERVAL_MS = 1800;

const extractTextFromFile = async (file: File): Promise<string> => {
  const text = await extractDocumentText(file);
  return text.trim();
};

const LectureRecorder = ({ onTranscriptReady, isProcessing, setIsProcessing, onDocumentTextReady }: Props) => {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [processingLabel, setProcessingLabel] = useState('Analyzing audio and extracting speech...');
  const [pdfProgress, setPdfProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
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
      method: 'POST', headers: { Authorization: authHeader }, body: formData,
    });
    if (!resp.ok) {
      if (resp.status === 546 && attempt < 3) { await delay(700 * attempt); return startTranscriptionJob(chunk, authHeader, attempt + 1); }
      const err = await resp.json().catch(() => ({ error: '' }));
      if (resp.status === 413) throw new Error('Audio chunk too large.');
      throw new Error(err.error || `Transcription failed: ${resp.status}`);
    }
    const data = await resp.json();
    if (!data.job_id) throw new Error('Failed to start transcription job');
    return data.job_id as string;
  }, []);

  const pollForResult = useCallback(async (jobId: string, authHeader: string): Promise<TranscriptResult> => {
    const timeoutMs = 60 * 60 * 1000;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-lecture?job_id=${jobId}`, { headers: { Authorization: authHeader } });
      if (!resp.ok) throw new Error('Failed to check transcription status');
      const data = await resp.json();
      if (data.status === 'complete') return data.result;
      if (data.status === 'failed') throw new Error(data.error || 'Transcription failed');
      await delay(POLL_INTERVAL_MS);
    }
    throw new Error('Transcription timed out.');
  }, []);

  const transcribeAudio = useCallback(async (audioBlob: Blob, filename: string) => {
    setIsProcessing(true);
    try {
      setProcessingLabel('Preparing audio for transcription...');
      const chunks = await prepareAudioChunksForTranscription(audioBlob, filename);
      const authHeader = await getAuthorizationHeader();
      if (chunks.length > 1) toast.info(`Split into ${chunks.length} parts for reliable transcription.`);
      const textParts = new Array<string>(chunks.length).fill('');
      const wordsByChunk: TranscriptWord[][] = Array.from({ length: chunks.length }, () => []);
      let completedChunks = 0;
      let nextChunkIndex = 0;
      const concurrency = chunks.length >= 8 ? BASE_TRANSCRIPTION_CONCURRENCY : Math.min(2, chunks.length);
      setProcessingLabel(`Transcribing audio... 0/${chunks.length} parts complete`);
      const worker = async () => {
        while (true) {
          const chunkIndex = nextChunkIndex++;
          if (chunkIndex >= chunks.length) return;
          const chunk = chunks[chunkIndex];
          const jobId = await startTranscriptionJob(chunk, authHeader);
          const result = await pollForResult(jobId, authHeader);
          if (result?.text?.trim()) textParts[chunkIndex] = result.text.trim();
          if (Array.isArray(result?.words)) {
            wordsByChunk[chunkIndex] = result.words.map((word) => ({
              ...word,
              start: typeof word.start === 'number' ? word.start + chunk.offsetSeconds : word.start,
              end: typeof word.end === 'number' ? word.end + chunk.offsetSeconds : word.end,
            }));
          }
          completedChunks += 1;
          setProcessingLabel(`Transcribing audio... ${completedChunks}/${chunks.length} parts complete`);
        }
      };
      await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
      const mergedTranscript: TranscriptResult = { text: textParts.filter(Boolean).join('\n\n').trim(), words: wordsByChunk.flat() };
      if (!mergedTranscript.text || mergedTranscript.text.length < 10) throw new Error('Could not detect enough speech.');
      onTranscriptReady(mergedTranscript);
      toast.success('Transcription complete!');
    } catch (e: any) {
      toast.error(String(e?.message || 'Transcription failed'));
    } finally {
      setIsProcessing(false);
      setProcessingLabel('Analyzing audio and extracting speech...');
    }
  }, [getAuthorizationHeader, onTranscriptReady, pollForResult, setIsProcessing, startTranscriptionJob]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 1 },
      });
      rawStreamRef.current = stream;
      let recordingStream: MediaStream = stream;
      try {
        const audioContext = new AudioContext({ sampleRate: 48000 });
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 3.0;
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -45;
        compressor.knee.value = 15;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.001;
        compressor.release.value = 0.1;
        const makeupGain = audioContext.createGain();
        makeupGain.gain.value = 1.5;
        const destination = audioContext.createMediaStreamDestination();
        source.connect(gainNode);
        gainNode.connect(compressor);
        compressor.connect(makeupGain);
        makeupGain.connect(destination);
        recordingStream = destination.stream;
        processedStreamRef.current = recordingStream;
      } catch {
        toast.info('Advanced audio processing unavailable — using direct mic input.');
      }
      const preferredMimeType = getPreferredRecordingMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(recordingStream, { mimeType: preferredMimeType, audioBitsPerSecond: 128000 })
        : new MediaRecorder(recordingStream, { audioBitsPerSecond: 128000 });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onerror = () => { toast.error('Recording failed.'); setRecording(false); if (timerRef.current) clearInterval(timerRef.current); void cleanupAudioPipeline(); };
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        const recorderMime = recorder.mimeType?.split(';')[0] || preferredMimeType.split(';')[0] || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: recorderMime });
        chunksRef.current = [];
        void cleanupAudioPipeline();
        if (blob.size < 2048) { toast.error('Recording is too short to transcribe.'); return; }
        const extension = recorderMime.includes('mp4') ? 'm4a' : recorderMime.includes('ogg') ? 'ogg' : 'webm';
        void transcribeAudio(blob, `lecture-recording-${Date.now()}.${extension}`);
      };
      recorder.start(500);
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);
      toast.success('Recording started — enhanced voice capture active.');
    } catch {
      toast.error('Microphone access denied');
    }
  }, [cleanupAudioPipeline, transcribeAudio]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state !== 'inactive') { recorder.requestData(); recorder.stop(); }
    mediaRecorderRef.current = null;
  }, []);

  const handleAudioUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    void transcribeAudio(file, file.name);
  }, [transcribeAudio]);

  const handleDocumentUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setIsProcessing(true);
    setPdfProgress(0);
    setProcessingLabel(file.name.toLowerCase().endsWith('.pdf') ? 'Extracting PDF text...' : 'Reading document...');
    try {
      const onProgress: PdfProgressCallback = (info) => {
        setProcessingLabel(info.stage);
        setPdfProgress(info.total > 0 ? Math.round((info.current / info.total) * 100) : 0);
      };
      const text = await extractDocumentText(file, false, onProgress);
      if (!text || text.length < 20) throw new Error('Document appears empty or too short.');
      onTranscriptReady({ text, words: [] });
      if (onDocumentTextReady) onDocumentTextReady(text);
      toast.success(`Document "${file.name}" loaded successfully!`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to read document');
    } finally {
      setIsProcessing(false);
      setPdfProgress(0);
      setProcessingLabel('Analyzing audio and extracting speech...');
    }
  }, [onTranscriptReady, onDocumentTextReady, setIsProcessing]);

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  if (isProcessing) {
    return (
      <div className="relative rounded-[2rem] border border-border/15 bg-gradient-to-b from-card/90 to-card/50 backdrop-blur-3xl overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06),transparent_70%)]" />
        <div className="relative z-10 flex flex-col items-center py-20 px-8">
          <div className="relative mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Waves className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-display font-bold text-foreground mb-2">Processing</h2>
          <p className="text-muted-foreground text-sm text-center max-w-sm">{processingLabel}</p>
          {pdfProgress > 0 && (
            <div className="mt-4 w-full max-w-xs">
              <Progress value={pdfProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center mt-1">{pdfProgress}%</p>
            </div>
          )}
          <div className="mt-4 flex gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <motion.div
                key={i}
                className="w-1.5 h-6 rounded-full bg-primary/40"
                animate={{ scaleY: [0.4, 1, 0.4] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-[2rem] border border-border/15 bg-gradient-to-b from-card/90 via-card/60 to-card/40 backdrop-blur-3xl overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[hsl(var(--primary)/0.03)] to-transparent" />

      <div className="relative z-10 flex flex-col items-center py-14 md:py-20 px-6 md:px-8">
        <AnimatePresence mode="wait">
          {recording ? (
            <motion.div
              key="rec"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              {/* Pulsing recording orb */}
              <div className="relative mb-8">
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.05, 0.15] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-[-20px] rounded-full bg-destructive"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.08, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  className="absolute inset-[-10px] rounded-full bg-destructive"
                />
                <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center shadow-2xl shadow-destructive/30">
                  <div className="w-5 h-5 rounded-md bg-destructive-foreground animate-pulse" />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2.5 h-2.5 rounded-full bg-destructive"
                />
                <span className="text-sm font-semibold text-destructive uppercase tracking-[0.2em]">Recording</span>
              </div>

              <span className="text-4xl font-mono font-bold text-foreground mb-2 tabular-nums tracking-wider">
                {formatTime(recordingTime)}
              </span>
              <p className="text-xs text-muted-foreground mb-8">Enhanced voice capture — picks up even quiet voices</p>

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  onClick={stopRecording}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground h-13 px-10 rounded-2xl text-base shadow-lg shadow-destructive/20"
                >
                  <StopCircle className="w-5 h-5 mr-2" /> Stop Recording
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              {/* Main mic button */}
              <motion.button
                onClick={startRecording}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.95 }}
                className="group relative w-32 h-32 md:w-36 md:h-36 rounded-full cursor-pointer mb-8"
              >
                {/* Outer glow ring */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] opacity-20 blur-xl group-hover:opacity-30 transition-opacity" />
                {/* Ping */}
                <motion.div
                  animate={{ scale: [1, 1.3], opacity: [0.15, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-primary"
                />
                {/* Main circle */}
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.9)] to-[hsl(var(--secondary))] shadow-2xl shadow-primary/30 flex items-center justify-center">
                  <Mic className="w-12 h-12 text-primary-foreground relative z-10 group-hover:scale-110 transition-transform" />
                </div>
              </motion.button>

              <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">Start Your Lecture</h2>
              <p className="text-muted-foreground text-sm text-center max-w-md mb-8 leading-relaxed">
                Record live audio, upload an audio file, or upload a document to instantly generate
                study materials with AI.
              </p>

              <div className="flex flex-wrap gap-3 justify-center">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    onClick={startRecording}
                    className="h-12 px-7 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all text-sm font-medium"
                  >
                    <Mic className="w-4 h-4 mr-2" /> Record Live
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    variant="outline"
                    onClick={() => audioInputRef.current?.click()}
                    className="h-12 px-7 rounded-2xl border-border/20 bg-card/40 backdrop-blur-xl hover:bg-card/60 text-sm font-medium"
                  >
                    <FileAudio className="w-4 h-4 mr-2" /> Upload Audio
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    variant="outline"
                    onClick={() => docInputRef.current?.click()}
                    className="h-12 px-7 rounded-2xl border-border/20 bg-card/40 backdrop-blur-xl hover:bg-card/60 text-sm font-medium"
                  >
                    <FileText className="w-4 h-4 mr-2" /> Upload Document
                  </Button>
                </motion.div>
                <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                <input ref={docInputRef} type="file" accept={DOCUMENT_ACCEPT} onChange={handleDocumentUpload} className="hidden" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LectureRecorder;
