import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, BookOpen, Copy, Check, ArrowLeft, Radio, FileAudio, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradePopup } from '@/components/UpgradePopup';
import { createBufferedTextAccumulator, streamSSE } from '@/lib/aiStream';

type TranscriptionState = 'idle' | 'recording' | 'processing' | 'done';

const AudioAnalysis = () => {
  const { checkAndIncrement, showUpgrade, setShowUpgrade } = useUsageLimits();
  const [state, setState] = useState<TranscriptionState>('idle');
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [liveText, setLiveText] = useState('');
  const recognitionRef = useRef<any>(null);
  const fullTranscriptRef = useRef('');

  const startRecording = useCallback(async () => {
    const allowed = await checkAndIncrement('audio_analysis');
    if (!allowed) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    fullTranscriptRef.current = '';
    setLiveText('');
    setTranscript('');

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) fullTranscriptRef.current = final;
      setLiveText(fullTranscriptRef.current + interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        toast.error(`Recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still in recording state
      if (recognitionRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setState('recording');
    toast.success('Recording started — speak clearly');
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.stop();
    }
    const finalTranscript = fullTranscriptRef.current || liveText;
    setTranscript(finalTranscript);
    setLiveText('');

    if (finalTranscript.trim().length < 20) {
      setState('idle');
      toast.error('Not enough speech detected. Try again.');
      return;
    }
    generateNotes(finalTranscript);
  }, [liveText]);

  const generateNotes = async (text: string) => {
    setState('processing');
    setNotes('');
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          topic: 'Lecture Analysis',
          sourceText: `Transcribed lecture content:\n\n${text}`,
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        if (resp.status === 402) throw new Error('AI credits are exhausted right now. Please add credits.');
        throw new Error('Failed');
      }

      const streamBuffer = createBufferedTextAccumulator(setNotes);
      await streamSSE(resp, {
        onDelta: (chunk) => streamBuffer.push(chunk),
      });
      streamBuffer.flushNow();

      if (!streamBuffer.getText().trim()) throw new Error('Empty response');

      setState('done');
      toast.success('Lecture notes generated!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate notes');
      setState('idle');
    }
  };

  const copyNotes = () => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  const reset = () => {
    setState('idle');
    setTranscript('');
    setNotes('');
    setLiveText('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] flex items-center justify-center shadow-xl shadow-primary/25">
              <FileAudio className="w-7 h-7 text-primary-foreground" />
            </div>
            {state === 'recording' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive animate-pulse border-2 border-background" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Audio Analysis</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Record lectures → Get structured study notes instantly</p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Hero Record Card */}
            <div className="relative rounded-[2rem] border border-border/30 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-2xl overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_70%)]" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/5 blur-[100px]" />

              <div className="relative z-10 flex flex-col items-center py-20 px-8">
                <motion.button
                  onClick={startRecording}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative w-32 h-32 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-2xl shadow-primary/30 flex items-center justify-center mb-8 cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-20" />
                  <div className="absolute inset-2 rounded-full border-2 border-primary-foreground/20" />
                  <Mic className="w-12 h-12 text-primary-foreground relative z-10" />
                </motion.button>

                <h2 className="text-2xl font-display font-bold text-foreground mb-2">Tap to Record</h2>
                <p className="text-muted-foreground text-sm max-w-md text-center leading-relaxed">
                  Start recording your lecture, meeting, or any audio. Our AI will transcribe and transform it into comprehensive study notes.
                </p>

                <div className="flex items-center gap-6 mt-8">
                  {[
                    { icon: Mic, label: 'Record' },
                    { icon: Volume2, label: 'Transcribe' },
                    { icon: BookOpen, label: 'Notes' },
                  ].map((step, i) => (
                    <div key={step.label} className="flex items-center gap-3">
                      {i > 0 && <div className="w-8 h-px bg-border/50" />}
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-10 h-10 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-center">
                          <step.icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{step.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {state === 'recording' && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="relative rounded-[2rem] border border-destructive/20 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-2xl overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--destructive)/0.06),transparent_70%)]" />

              <div className="relative z-10 flex flex-col items-center py-16 px-8">
                {/* Pulsing indicator */}
                <div className="relative mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-destructive/20"
                  />
                  <div className="relative w-20 h-20 rounded-full bg-destructive/90 flex items-center justify-center shadow-xl shadow-destructive/30">
                    <Radio className="w-8 h-8 text-destructive-foreground animate-pulse" />
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-6">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-sm font-semibold text-destructive uppercase tracking-wider">Recording</span>
                </div>

                {/* Live transcript */}
                <div className="w-full max-w-2xl min-h-[160px] rounded-2xl bg-muted/10 border border-border/20 p-6">
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {liveText || <span className="text-muted-foreground italic">Listening... speak clearly into your microphone</span>}
                  </p>
                </div>

                <Button
                  onClick={stopRecording}
                  className="mt-8 bg-destructive hover:bg-destructive/90 text-destructive-foreground h-14 px-10 rounded-2xl shadow-lg shadow-destructive/20 text-base"
                >
                  <MicOff className="w-5 h-5 mr-2" /> Stop & Generate Notes
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {state === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="relative rounded-[2rem] border border-border/30 bg-card/50 backdrop-blur-2xl overflow-hidden">
              <div className="relative z-10 flex flex-col items-center py-20 px-8">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />
                <h2 className="text-xl font-display font-bold text-foreground mb-2">Analyzing Lecture</h2>
                <p className="text-muted-foreground text-sm">Transforming your recording into structured notes...</p>

                {notes && (
                  <div className="w-full mt-8 rounded-2xl bg-muted/10 border border-border/20 p-6 max-h-[400px] overflow-y-auto">
                    <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground">
                      <MarkdownRenderer streaming={state === 'processing'}>{notes}</MarkdownRenderer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {state === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-5"
          >
            {/* Transcript Card */}
            {transcript && (
              <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Original Transcript</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-h-32 overflow-y-auto">{transcript}</p>
              </div>
            )}

            {/* Notes Card */}
            <div className="relative rounded-[2rem] border border-border/30 bg-card/50 backdrop-blur-2xl overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/5 blur-[80px]" />

              <div className="flex items-center justify-between p-6 pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-bold text-foreground">Lecture Notes</h2>
                    <p className="text-xs text-muted-foreground">AI-generated from your recording</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={copyNotes} className="rounded-xl">
                  {copied ? <Check className="w-4 h-4 mr-1.5 text-success" /> : <Copy className="w-4 h-4 mr-1.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <div className="p-6 pt-4">
                <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-li:text-muted-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md">
                  <MarkdownRenderer>{notes}</MarkdownRenderer>
                </div>
              </div>
            </div>

            <Button onClick={reset} variant="outline" className="h-12 px-8 rounded-2xl">
              <ArrowLeft className="w-4 h-4 mr-2" /> Record New Lecture
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
};

export default AudioAnalysis;
