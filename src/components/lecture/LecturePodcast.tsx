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
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const getVoice = (speaker: 'ALEX' | 'SAM'): SpeechSynthesisVoice | null => {
    if (!voices.length) return null;
    const enVoices = voices.filter(v => v.lang.startsWith('en'));
    const maleKw = ['male', 'daniel', 'james', 'david', 'mark', 'guy'];
    const femaleKw = ['female', 'samantha', 'karen', 'victoria', 'fiona', 'zira'];

    if (speaker === 'ALEX') {
      return enVoices.find(v => maleKw.some(k => v.name.toLowerCase().includes(k)))
        || enVoices[0] || voices[0];
    }
    return enVoices.find(v => femaleKw.some(k => v.name.toLowerCase().includes(k)))
      || enVoices[1] || enVoices[0] || voices[0];
  };

  const speakLine = (line: ScriptLine): Promise<void> => {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(line.text);
      const voice = getVoice(line.speaker);
      if (voice) utterance.voice = voice;
      utterance.rate = line.speaker === 'ALEX' ? 0.95 : 1.0;
      utterance.pitch = line.speaker === 'ALEX' ? 0.9 : 1.1;
      utterance.onend = () => resolve();
      utterance.onerror = (e) => e.error === 'canceled' ? resolve() : reject(e);
      speechSynthesis.speak(utterance);
    });
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

      if (!resp.ok || !resp.body) throw new Error('Failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullScript = '';

      while (true) {
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
          if (jsonStr === '[DONE]') break;
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

      const lines: ScriptLine[] = [];
      for (const l of fullScript.split('\n')) {
        const trimmed = l.trim();
        if (trimmed.startsWith('ALEX:')) lines.push({ speaker: 'ALEX', text: trimmed.slice(5).trim() });
        else if (trimmed.startsWith('SAM:')) lines.push({ speaker: 'SAM', text: trimmed.slice(4).trim() });
      }
      setParsedScript(lines);
      toast.success('Podcast script generated!');
    } catch {
      toast.error('Failed to generate script');
    } finally {
      setGeneratingScript(false);
    }
  }, [notes]);

  const playPodcast = useCallback(async () => {
    if (!parsedScript.length) return;
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
  }, [parsedScript, voices]);

  const stopPodcast = () => {
    isCancelledRef.current = true;
    speechSynthesis.cancel();
    setIsPlaying(false);
    setCurrentLineIdx(-1);
  };

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
            Two AI hosts will discuss your lecture notes in a friendly, educational conversation.
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
                  const isAlex = trimmed.startsWith('ALEX:');
                  const isSam = trimmed.startsWith('SAM:');
                  return (
                    <div key={i} className={`mb-2 ${isAlex || isSam ? '' : 'text-muted-foreground text-xs italic'}`}>
                      {isAlex && <span className="text-primary font-semibold text-xs mr-1">ALEX:</span>}
                      {isSam && <span className="text-secondary font-semibold text-xs mr-1">SAM:</span>}
                      <span className="text-sm text-foreground/80">
                        {isAlex ? trimmed.slice(5).trim() : isSam ? trimmed.slice(4).trim() : trimmed}
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