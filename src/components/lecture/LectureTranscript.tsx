import { useState, useMemo } from 'react';
import { Search, Clock, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

interface Word { text: string; start: number; end: number; speaker?: string; }
interface Props { transcript: { text: string; words?: Word[] }; }

const LectureTranscript = ({ transcript }: Props) => {
  const [search, setSearch] = useState('');

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

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
      regex.test(part) ? <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">{part}</mark> : part
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search transcript..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-2xl bg-card/40 border-border/20 backdrop-blur-xl h-11 focus:border-primary/30"
        />
      </div>

      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-2">
        {filtered.map((seg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
            className="flex gap-3 group rounded-xl p-3 hover:bg-card/30 transition-colors"
          >
            <div className="flex-shrink-0 pt-0.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono bg-muted/15 px-2.5 py-1.5 rounded-xl border border-border/10">
                <Clock className="w-3 h-3" />
                {formatTime(seg.time)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {seg.speaker && (
                <span className="text-xs font-semibold text-primary uppercase tracking-[0.15em] block mb-1">
                  Speaker {seg.speaker}
                </span>
              )}
              <p className="text-sm text-foreground/80 leading-relaxed">{highlightSearch(seg.text)}</p>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-8 gap-2">
            <FileText className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">No results found for "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LectureTranscript;
