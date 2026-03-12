import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Podcast, Play, Square, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  notes: string;
}

interface ScriptLine {
  speaker: 'ALEX' | 'SAM';
  text: string;
}

const QUALITY_HINTS = ['neural', 'natural', 'wavenet', 'premium', 'enhanced', 'studio', 'siri', 'google', 'microsoft'];
const ALEX_HINTS = ['guy', 'daniel', 'james', 'david', 'mark', 'matthew', 'roger', 'male'];
const SAM_HINTS = ['aria', 'jenny', 'samantha', 'victoria', 'fiona', 'zira', 'female'];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const LecturePodcast = ({ notes }: Props) => {
  const [script, setScript] = useState('');
  const [parsedScript, setParsedScript] = useState<ScriptLine[]>([]);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIdx, setCurrentLineIdx] = useState(-1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const isCancelledRef = useRef(false);

  useEffect(() => {
    const loadVoices = () => {
      const available = speechSynthesis.getVoices();
      if (available.length > 0) setVoices(available);
    };

    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      speechSynthesis.cancel();
    };
  }, []);

  const getVoice = useCallback(
    (speaker: 'ALEX' | 'SAM'): SpeechSynthesisVoice | null => {
      if (!voices.length) return null;

      const hints = speaker === 'ALEX' ? ALEX_HINTS : SAM_HINTS;

      const ranked = voices
        .filter((voice) => voice.lang.toLowerCase().startsWith('en'))
        .map((voice) => {
          const lowerName = voice.name.toLowerCase();
          const lowerLang = voice.lang.toLowerCase();

          let score = 0;
          if (lowerLang.startsWith('en-us')) score += 3;
          if (lowerLang.startsWith('en')) score += 2;
          if (!voice.localService) score += 1;
          if (QUALITY_HINTS.some((hint) => lowerName.includes(hint))) score += 4;
          if (hints.some((hint) => lowerName.includes(hint))) score += 5;

          return { voice, score };
        })
        .sort((a, b) => b.score - a.score);

      return ranked[0]?.voice ?? voices[0];
    },
    [voices]
  );

  const splitLineForNaturalSpeech = (text: string) => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];

    const sentencePieces = normalized
      .split(/(?<=[.!?])\s+/)
      .map((piece) => piece.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    for (const piece of sentencePieces) {
      if (piece.length <= 180) {
        chunks.push(piece);
        continue;
      }

      const commaChunks = piece
        .split(/(?<=,)\s+/)
        .map((part) => part.trim())
        .filter(Boolean);

      if (commaChunks.length > 1) chunks.push(...commaChunks);
      else chunks.push(piece);
    }

    return chunks;
  };

  const speakSegment = useCallback(
    (segment: string, speaker: 'ALEX' | 'SAM'): Promise<void> => {
      return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(segment);
        const voice = getVoice(speaker);
        if (voice) utterance.voice = voice;

        utterance.rate = speaker === 'ALEX' ? 0.98 : 1.03;
        utterance.pitch = speaker === 'ALEX' ? 0.96 : 1.08;
        utterance.volume = 1;

        utterance.onend = () => resolve();
        utterance.onerror = (event) => (event.error === 'canceled' ? resolve() : reject(event));

        speechSynthesis.speak(utterance);
      });
    },
    [getVoice]
  );

  const speakLine = useCallback(
    async (line: ScriptLine) => {
      const chunks = splitLineForNaturalSpeech(line.text);

      for (let i = 0; i < chunks.length; i++) {
        if (isCancelledRef.current) break;
        await speakSegment(chunks[i], line.speaker);
        if (i < chunks.length - 1) await wait(120);
      }
    },
    [speakSegment]
  );

  const parseScriptLines = (fullScript: string): ScriptLine[] => {
    const parsed: ScriptLine[] = [];
    const lines = fullScript.split('\n').map((line) => line.trim());

    for (const line of lines) {
      if (!line) continue;
      const match = line.match(/^(ALEX|SAM)\s*:\s*(.+)$/i);
      if (!match) continue;

      parsed.push({
        speaker: match[1].toUpperCase() as 'ALEX' | 'SAM',
        text: match[2].trim(),
      });
    }

    return parsed;
  };

  const generateScript = useCallback(async () => {
    setGeneratingScript(true);
    setScript('');
    setParsedScript([]);
    setCurrentLineIdx(-1);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-podcast-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ notes }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: 'Failed to generate script' }));
        throw new Error(err.error || 'Failed to generate script');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullScript = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '' || !line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullScript += content;
              setScript(fullScript);
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }

      const lines = parseScriptLines(fullScript);
      setParsedScript(lines);

      if (!lines.length) {
        throw new Error('Script came back in an invalid format. Please retry.');
      }

      toast.success('Podcast script generated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate script');
    } finally {
      setGeneratingScript(false);
    }
  }, [notes]);

  const playPodcast = useCallback(async () => {
    if (!parsedScript.length) return;

    if (!voices.length) {
      toast.info('Loading device voices... please try play once more in a second.');
    }

    setIsPlaying(true);
    isCancelledRef.current = false;

    try {
      for (let i = 0; i < parsedScript.length; i++) {
        if (isCancelledRef.current) break;

        setCurrentLineIdx(i);
        await speakLine(parsedScript[i]);
      }

      if (!isCancelledRef.current) toast.success('Podcast finished!');
    } catch {
      toast.error('Playback error');
    } finally {
      setIsPlaying(false);
      setCurrentLineIdx(-1);
    }
  }, [parsedScript, speakLine, voices.length]);

  const stopPodcast = useCallback(() => {
    isCancelledRef.current = true;
    speechSynthesis.cancel();
    setIsPlaying(false);
    setCurrentLineIdx(-1);
  }, []);

  if (!notes) {
    return (
      <div className="flex flex-col items-center py-16">
        <Podcast className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-display font-bold text-foreground mb-2">Lecture Podcast</h3>
        <p className="text-muted-foreground text-sm">Generate notes first to create a podcast.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!script && !generatingScript && (
        <div className="flex flex-col items-center py-12">
          <Podcast className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-display font-bold text-foreground mb-2">Generate Podcast</h3>
          <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
            Two hosts will break your notes into a fast, concept-first conversation.
          </p>
          <Button onClick={generateScript} className="h-11 px-6 rounded-2xl">
            <Podcast className="w-4 h-4 mr-2" /> Generate Script
          </Button>
        </div>
      )}

      {generatingScript && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Writing podcast script...
        </div>
      )}

      {script && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/30 bg-card/40 p-5 max-h-[300px] overflow-y-auto" id="podcast-script-container">
            {parsedScript.length > 0
              ? parsedScript.map((line, i) => (
                  <div
                    key={i}
                    className={`mb-2 rounded-lg px-2 py-1 transition-colors ${
                      i === currentLineIdx ? 'bg-primary/10 border-l-2 border-primary' : ''
                    }`}
                  >
                    <span className={`font-semibold text-xs mr-1 ${line.speaker === 'ALEX' ? 'text-primary' : 'text-secondary'}`}>
                      {line.speaker}:
                    </span>
                    <span className="text-sm text-foreground/80">{line.text}</span>
                  </div>
                ))
              : script.split('\n').map((line, i) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;

                  const isAlex = /^ALEX\s*:/i.test(trimmed);
                  const isSam = /^SAM\s*:/i.test(trimmed);

                  return (
                    <div key={i} className={`mb-2 ${isAlex || isSam ? '' : 'text-muted-foreground text-xs italic'}`}>
                      {isAlex && <span className="text-primary font-semibold text-xs mr-1">ALEX:</span>}
                      {isSam && <span className="text-secondary font-semibold text-xs mr-1">SAM:</span>}
                      <span className="text-sm text-foreground/80">
                        {isAlex
                          ? trimmed.replace(/^ALEX\s*:/i, '').trim()
                          : isSam
                            ? trimmed.replace(/^SAM\s*:/i, '').trim()
                            : trimmed}
                      </span>
                    </div>
                  );
                })}
          </div>

          <div className="flex items-center gap-3">
            {!isPlaying ? (
              <Button onClick={playPodcast} className="h-11 px-6 rounded-2xl" disabled={!parsedScript.length}>
                <Play className="w-4 h-4 mr-2" /> Play Podcast
              </Button>
            ) : (
              <Button onClick={stopPodcast} variant="destructive" className="h-11 px-6 rounded-2xl">
                <Square className="w-4 h-4 mr-2" /> Stop
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={generateScript} className="rounded-xl" disabled={isPlaying}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Redo Script
            </Button>
            {isPlaying && currentLineIdx >= 0 && (
              <span className="text-xs text-muted-foreground">
                Line {currentLineIdx + 1}/{parsedScript.length}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturePodcast;
