import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Podcast, Play, Square, RotateCcw, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface Props {
  notes: string;
}

interface ScriptLine {
  speaker: 'ALEX' | 'SAM';
  text: string;
}

// Pick the best available voices for each speaker
const pickVoices = (): { alex: SpeechSynthesisVoice | null; sam: SpeechSynthesisVoice | null } => {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return { alex: null, sam: null };

  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  
  // Prefer high-quality / "natural" / "neural" voices
  const premium = enVoices.filter(v =>
    /natural|neural|premium|enhanced|online/i.test(v.name) || v.name.includes('Google')
  );
  
  const maleNames = /daniel|james|george|brian|liam|guy|aaron|tom|mark|david|eric|roger|charlie|male/i;
  const femaleNames = /sarah|samantha|alice|karen|fiona|moira|victoria|zoe|female|woman|lisa|kate|emma/i;

  const findVoice = (pool: SpeechSynthesisVoice[], pattern: RegExp) =>
    pool.find(v => pattern.test(v.name)) || pool[0] || null;

  const alexVoice = findVoice(premium.length ? premium : enVoices, maleNames);
  let samVoice = findVoice(premium.length ? premium : enVoices, femaleNames);
  
  // Make sure they're different voices
  if (samVoice === alexVoice) {
    samVoice = (premium.length ? premium : enVoices).find(v => v !== alexVoice) || samVoice;
  }

  return { alex: alexVoice, sam: samVoice };
};

const LecturePodcast = ({ notes }: Props) => {
  const [script, setScript] = useState('');
  const [parsedScript, setParsedScript] = useState<ScriptLine[]>([]);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIdx, setCurrentLineIdx] = useState(-1);

  const isCancelledRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Preload voices
    speechSynthesis.getVoices();
    const onVoices = () => speechSynthesis.getVoices();
    speechSynthesis.addEventListener('voiceschanged', onVoices);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', onVoices);
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
      if (!lines.length) throw new Error('Script format invalid. Please retry.');
      toast.success('Podcast script ready! Click Play to hear it.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate script');
    } finally {
      setGeneratingScript(false);
    }
  }, [notes]);

  const speakLine = (text: string, voice: SpeechSynthesisVoice | null, pitch: number, rate: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const utt = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utt;
      if (voice) utt.voice = voice;
      utt.pitch = pitch;
      utt.rate = rate;
      utt.volume = 1;
      utt.onend = () => resolve();
      utt.onerror = (e) => {
        if (e.error === 'canceled' || e.error === 'interrupted') resolve();
        else reject(new Error('Speech failed'));
      };
      speechSynthesis.speak(utt);
    });
  };

  const playPodcast = useCallback(async () => {
    if (!parsedScript.length) return;

    const { alex, sam } = pickVoices();
    if (!alex && !sam) {
      toast.error('No speech voices available in your browser.');
      return;
    }

    setIsPlaying(true);
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
          isAlex ? 1.0 : 1.15,   // slightly higher pitch for Sam
          isAlex ? 1.0 : 1.02,   // slightly faster for Sam
        );
      }
      if (!isCancelledRef.current) toast.success('Podcast finished!');
    } catch (e: any) {
      if (!isCancelledRef.current) toast.error(e.message || 'Playback error');
    } finally {
      setIsPlaying(false);
      setCurrentLineIdx(-1);
    }
  }, [parsedScript]);

  const stopPodcast = useCallback(() => {
    isCancelledRef.current = true;
    speechSynthesis.cancel();
    setIsPlaying(false);
    setCurrentLineIdx(-1);
  }, []);

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLineIdx >= 0) {
      const el = document.getElementById(`podcast-line-${currentLineIdx}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
