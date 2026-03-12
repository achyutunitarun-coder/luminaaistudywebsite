import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Podcast, Play, Square, RotateCcw, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  notes: string;
  onScriptChange?: (script: string) => void;
}

interface ScriptLine {
  speaker: 'ALEX' | 'SAM';
  text: string;
}

// Select distinct, high-quality voices for the two hosts
const getVoicePair = (): { alex: SpeechSynthesisVoice | null; sam: SpeechSynthesisVoice | null } => {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return { alex: null, sam: null };

  const en = voices.filter(v => v.lang.startsWith('en'));

  // Rank voices by quality indicators
  const rank = (v: SpeechSynthesisVoice) => {
    let score = 0;
    const n = v.name.toLowerCase();
    if (/natural|neural|premium|enhanced|wavenet|studio/i.test(n)) score += 10;
    if (/google|microsoft|apple/i.test(n)) score += 5;
    if (!v.localService) score += 3; // cloud voices tend to sound better
    return score;
  };

  const sorted = [...en].sort((a, b) => rank(b) - rank(a));

  // Try to pick a male-sounding and female-sounding voice
  const maleRe = /daniel|james|george|brian|liam|guy|aaron|tom|mark|david|eric|roger|charlie|male|adam|ryan/i;
  const femaleRe = /sarah|samantha|alice|karen|fiona|moira|victoria|zoe|female|lisa|kate|emma|jenny|aria/i;

  const alexVoice = sorted.find(v => maleRe.test(v.name)) || sorted[0] || null;
  let samVoice = sorted.find(v => femaleRe.test(v.name) && v !== alexVoice) || sorted.find(v => v !== alexVoice) || sorted[0] || null;

  return { alex: alexVoice, sam: samVoice };
};

const LecturePodcast = ({ notes, onScriptChange }: Props) => {
  const [script, setScript] = useState('');
  const [parsedScript, setParsedScript] = useState<ScriptLine[]>([]);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentLineIdx, setCurrentLineIdx] = useState(-1);

  const isCancelledRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Preload voices (some browsers load async)
    speechSynthesis.getVoices();
    const handler = () => speechSynthesis.getVoices();
    speechSynthesis.addEventListener('voiceschanged', handler);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', handler);
      speechSynthesis.cancel();
    };
  }, []);

  const parseScriptLines = (fullScript: string): ScriptLine[] => {
    const parsed: ScriptLine[] = [];
    const lines = fullScript.split('\n').map(l => l.trim());
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
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullScript += content;
              setScript(fullScript);
            }
          } catch {}
        }
      }

      const lines = parseScriptLines(fullScript);
      setParsedScript(lines);
      onScriptChange?.(fullScript);
      if (!lines.length) throw new Error('Script format invalid. Please retry.');
      toast.success('Podcast script ready! Click Play to hear it.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate script');
    } finally {
      setGeneratingScript(false);
    }
  }, [notes, onScriptChange]);

  const waitForVoices = useCallback((timeoutMs = 1500): Promise<void> => {
    if (speechSynthesis.getVoices().length) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        speechSynthesis.removeEventListener('voiceschanged', done);
        resolve();
      };

      speechSynthesis.addEventListener('voiceschanged', done);
      setTimeout(done, timeoutMs);
    });
  }, []);

  const splitForSpeech = (text: string, maxChars = 220): string[] => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];
    if (normalized.length <= maxChars) return [normalized];

    const chunks: string[] = [];
    let remaining = normalized;

    while (remaining.length > maxChars) {
      let splitAt = remaining.lastIndexOf('.', maxChars);
      if (splitAt < Math.floor(maxChars * 0.4)) splitAt = remaining.lastIndexOf('?', maxChars);
      if (splitAt < Math.floor(maxChars * 0.4)) splitAt = remaining.lastIndexOf('!', maxChars);
      if (splitAt < Math.floor(maxChars * 0.4)) splitAt = remaining.lastIndexOf(',', maxChars);
      if (splitAt < Math.floor(maxChars * 0.4)) splitAt = remaining.lastIndexOf(' ', maxChars);

      const fallbackCut = Math.min(maxChars, remaining.length);
      const cut = splitAt > 0 ? splitAt + 1 : fallbackCut;
      const part = remaining.slice(0, cut).trim();
      if (part) chunks.push(part);
      remaining = remaining.slice(cut).trim();
    }

    if (remaining) chunks.push(remaining);
    return chunks;
  };

  const speakChunk = (
    text: string,
    voice: SpeechSynthesisVoice | null,
    pitch: number,
    rate: number,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const utt = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utt;
      if (voice) utt.voice = voice;
      utt.pitch = pitch;
      utt.rate = rate;
      utt.volume = 1;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      utt.onend = finish;
      utt.onerror = (e) => {
        if (settled) return;
        settled = true;
        if (e.error === 'canceled' || e.error === 'interrupted') {
          resolve();
          return;
        }
        reject(new Error(e.error || 'synthesis-failed'));
      };

      speechSynthesis.speak(utt);
    });
  };

  const speakLine = async (
    text: string,
    voice: SpeechSynthesisVoice | null,
    pitch: number,
    rate: number,
  ): Promise<void> => {
    const chunks = splitForSpeech(text);

    for (const chunk of chunks) {
      if (isCancelledRef.current) break;
      try {
        await speakChunk(chunk, voice, pitch, rate);
      } catch {
        // Fallback with default browser voice/settings for reliability.
        await speakChunk(chunk, null, 1, 1);
      }

      if (!isCancelledRef.current) {
        await new Promise((r) => setTimeout(r, 60));
      }
    }
  };

  const playPodcast = useCallback(async () => {
    if (!parsedScript.length) return;

    if (isPaused) {
      speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    await waitForVoices();

    // Clear any stale queue before starting a new run.
    speechSynthesis.cancel();
    await new Promise((r) => setTimeout(r, 30));

    const { alex, sam } = getVoicePair();

    setIsPlaying(true);
    setIsPaused(false);
    isCancelledRef.current = false;

    try {
      for (let i = 0; i < parsedScript.length; i++) {
        if (isCancelledRef.current) break;

        setCurrentLineIdx(i);
        const line = parsedScript[i];
        const isAlex = line.speaker === 'ALEX';

        await speakLine(
          line.text,
          isAlex ? alex : sam,
          isAlex ? 1.0 : 1.12,
          isAlex ? 0.95 : 1.0,
        );

        if (i < parsedScript.length - 1 && parsedScript[i + 1].speaker !== line.speaker) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }

      if (!isCancelledRef.current) toast.success('Podcast finished!');
    } catch {
      if (!isCancelledRef.current) {
        toast.error('Speech synthesis failed in this browser. Try Chrome desktop for best results.');
      }
    } finally {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentLineIdx(-1);
    }
  }, [parsedScript, isPaused]);

  const pausePodcast = useCallback(() => {
    if (!speechSynthesis.speaking) return;
    speechSynthesis.pause();
    setIsPaused(true);
  }, []);

  const stopPodcast = useCallback(() => {
    isCancelledRef.current = true;
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentLineIdx(-1);
  }, []);

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLineIdx >= 0) {
      document.getElementById(`podcast-line-${currentLineIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentLineIdx]);

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
            Two AI hosts will break your notes into an engaging, concept-first conversation.
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
          <div className="rounded-2xl border border-border/30 bg-card/40 p-5 max-h-[300px] overflow-y-auto">
            {parsedScript.length > 0
              ? parsedScript.map((line, i) => (
                  <div
                    key={i}
                    id={`podcast-line-${i}`}
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
                        {isAlex ? trimmed.replace(/^ALEX\s*:/i, '').trim() : isSam ? trimmed.replace(/^SAM\s*:/i, '').trim() : trimmed}
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
              <>
                <Button onClick={isPaused ? playPodcast : pausePodcast} variant="outline" className="h-11 px-5 rounded-2xl">
                  {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button onClick={stopPodcast} variant="destructive" className="h-11 px-5 rounded-2xl">
                  <Square className="w-4 h-4 mr-2" /> Stop
                </Button>
              </>
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
