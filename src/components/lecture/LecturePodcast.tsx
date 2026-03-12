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

const LecturePodcast = ({ notes }: Props) => {
  const [script, setScript] = useState('');
  const [parsedScript, setParsedScript] = useState<ScriptLine[]>([]);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIdx, setCurrentLineIdx] = useState(-1);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioSegments, setAudioSegments] = useState<{ url: string; speaker: string }[]>([]);
  const [preloadProgress, setPreloadProgress] = useState(0);

  const isCancelledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Cleanup blob URLs
      audioSegments.forEach((seg) => URL.revokeObjectURL(seg.url));
    };
  }, []);

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
    setAudioSegments([]);

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

  const synthesizeLine = useCallback(async (text: string, speaker: 'ALEX' | 'SAM'): Promise<string> => {
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        text,
        voice: speaker === 'SAM' ? 'sam' : 'alex',
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) throw new Error('Voice synthesis rate limited. Wait a moment and retry.');
      if (resp.status === 402) throw new Error('Voice synthesis credits exhausted.');
      throw new Error('Voice synthesis failed');
    }

    const audioBlob = await resp.blob();
    return URL.createObjectURL(audioBlob);
  }, []);

  const playAudioUrl = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Audio playback failed'));
      audio.play().catch(reject);
    });
  };

  const playPodcast = useCallback(async () => {
    if (!parsedScript.length) return;

    setIsPlaying(true);
    setLoadingAudio(true);
    isCancelledRef.current = false;

    try {
      // Pre-synthesize all lines for smoother playback
      const segments: { url: string; speaker: string }[] = [];

      // Batch synthesize: process 2 at a time
      for (let i = 0; i < parsedScript.length; i += 2) {
        if (isCancelledRef.current) break;

        const batch = parsedScript.slice(i, i + 2);
        const urls = await Promise.all(
          batch.map((line) => synthesizeLine(line.text, line.speaker))
        );

        urls.forEach((url, j) => {
          segments.push({ url, speaker: batch[j].speaker });
        });

        setPreloadProgress(Math.round(((i + batch.length) / parsedScript.length) * 100));

        // Start playing once we have the first segment ready
        if (i === 0) setLoadingAudio(false);
      }

      setAudioSegments(segments);
      setLoadingAudio(false);
      setPreloadProgress(100);

      // Play sequentially
      for (let i = 0; i < segments.length; i++) {
        if (isCancelledRef.current) break;
        setCurrentLineIdx(i);
        await playAudioUrl(segments[i].url);
      }

      if (!isCancelledRef.current) toast.success('Podcast finished!');
    } catch (e: any) {
      toast.error(e.message || 'Playback error');
    } finally {
      setIsPlaying(false);
      setCurrentLineIdx(-1);
      setLoadingAudio(false);
    }
  }, [parsedScript, synthesizeLine]);

  const stopPodcast = useCallback(() => {
    isCancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentLineIdx(-1);
    setLoadingAudio(false);
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
            Two AI hosts will break your notes into an engaging, concept-first conversation with natural-sounding voices.
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
                        {isAlex ? trimmed.replace(/^ALEX\s*:/i, '').trim() : isSam ? trimmed.replace(/^SAM\s*:/i, '').trim() : trimmed}
                      </span>
                    </div>
                  );
                })}
          </div>

          {loadingAudio && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Volume2 className="w-4 h-4 animate-pulse" /> Synthesizing natural voices...
              </div>
              <Progress value={preloadProgress} className="h-1.5" />
            </div>
          )}

          <div className="flex items-center gap-3">
            {!isPlaying ? (
              <Button onClick={playPodcast} className="h-11 px-6 rounded-2xl" disabled={!parsedScript.length || loadingAudio}>
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
