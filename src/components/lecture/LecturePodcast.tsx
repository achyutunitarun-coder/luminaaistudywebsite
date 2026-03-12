import { useState, useCallback, useRef } from 'react';
import { Loader2, Podcast, Play, Pause, Download, RotateCcw } from 'lucide-react';
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
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generateScript = useCallback(async () => {
    setGeneratingScript(true);
    setScript('');
    setAudioUrl(null);
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

      // Parse script into lines
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

  const generateAudio = useCallback(async () => {
    if (!parsedScript.length) return;
    setGeneratingAudio(true);
    setTotalLines(parsedScript.length);

    try {
      const audioBlobs: Blob[] = [];

      for (let i = 0; i < parsedScript.length; i++) {
        setCurrentLineIdx(i + 1);
        const line = parsedScript[i];
        
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: line.text,
            voice: line.speaker === 'SAM' ? 'sam' : 'alex',
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          if (resp.status === 429) { toast.error('Rate limited. Try again later.'); break; }
          if (resp.status === 402) { toast.error('Insufficient ElevenLabs credits.'); break; }
          throw new Error(err.error || 'TTS failed');
        }

        const blob = await resp.blob();
        audioBlobs.push(blob);
      }

      if (audioBlobs.length > 0) {
        // Combine all audio blobs
        const combined = new Blob(audioBlobs, { type: 'audio/mpeg' });
        const url = URL.createObjectURL(combined);
        setAudioUrl(url);
        toast.success('Podcast audio ready!');
      }
    } catch (e: any) {
      toast.error(e.message || 'Audio generation failed');
    } finally {
      setGeneratingAudio(false);
    }
  }, [parsedScript]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = 'lecture-podcast.mp3';
    a.click();
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
      {/* Script Section */}
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
          <div className="rounded-2xl border border-border/30 bg-card/40 p-5 max-h-[300px] overflow-y-auto">
            {script.split('\n').map((line, i) => {
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

          {/* Audio Generation */}
          {!audioUrl && !generatingAudio && (
            <Button onClick={generateAudio} className="h-11 px-6 rounded-2xl">
              <Play className="w-4 h-4 mr-2" /> Generate Audio
            </Button>
          )}

          {generatingAudio && (
            <div className="rounded-2xl border border-border/30 bg-card/40 p-5">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-sm text-foreground">Generating audio... Line {currentLineIdx}/{totalLines}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(currentLineIdx / totalLines) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Audio Player */}
          {audioUrl && (
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Podcast className="w-5 h-5 text-primary" />
                  <span className="font-display font-bold text-foreground">Lecture Podcast</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={downloadAudio} className="rounded-xl">
                    <Download className="w-4 h-4 mr-1.5" /> Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={generateScript} className="rounded-xl">
                    <RotateCcw className="w-4 h-4 mr-1.5" /> Redo
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={togglePlay} size="icon" className="w-12 h-12 rounded-full">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </Button>
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onTimeUpdate={() => {
                    if (audioRef.current) {
                      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
                    }
                  }}
                  onEnded={() => setIsPlaying(false)}
                />
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    if (!audioRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    audioRef.current.currentTime = pct * audioRef.current.duration;
                  }}
                >
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LecturePodcast;
