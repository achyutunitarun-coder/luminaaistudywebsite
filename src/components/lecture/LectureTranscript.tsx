import { useState, useMemo } from 'react';
import { Search, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Word {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

interface Props {
  transcript: { text: string; words?: Word[] };
}

const LectureTranscript = ({ transcript }: Props) => {
  const [search, setSearch] = useState('');

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // Group words into segments by speaker or time chunks (30s)
  const segments = useMemo(() => {
    if (!transcript.words?.length) return [{ time: 0, speaker: '', text: transcript.text }];
    
    const segs: { time: number; speaker: string; text: string }[] = [];
    let current = { time: transcript.words[0].start, speaker: transcript.words[0].speaker || '', text: '' };

    for (const w of transcript.words) {
      const newSpeaker = w.speaker || '';
      const timeDiff = w.start - current.time;
      if (newSpeaker !== current.speaker || timeDiff > 30) {
        if (current.text.trim()) segs.push({ ...current, text: current.text.trim() });
        current = { time: w.start, speaker: newSpeaker, text: '' };
      }
      current.text += w.text + ' ';
    }
    if (current.text.trim()) segs.push({ ...current, text: current.text.trim() });
    return segs;
  }, [transcript]);

  const filtered = useMemo(() => {
    if (!search.trim()) return segments;
    const q = search.toLowerCase();
    return segments.filter(s => s.text.toLowerCase().includes(q));
  }, [segments, search]);

  const highlightSearch = (text: string) => {
    if (!search.trim()) return text;
    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">{part}</mark> : part
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search transcript..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-xl bg-muted/20 border-border/30"
        />
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {filtered.map((seg, i) => (
          <div key={i} className="flex gap-3 group">
            <div className="flex-shrink-0 pt-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono bg-muted/20 px-2 py-1 rounded-lg">
                <Clock className="w-3 h-3" />
                {formatTime(seg.time)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {seg.speaker && (
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Speaker {seg.speaker}
                </span>
              )}
              <p className="text-sm text-foreground/80 leading-relaxed">
                {highlightSearch(seg.text)}
              </p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No results found for "{search}"</p>
        )}
      </div>
    </div>
  );
};

export default LectureTranscript;
