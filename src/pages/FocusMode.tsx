import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Pause, Play, X, StickyNote, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

const FocusMode = () => {
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [task, setTask] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active && !paused) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, paused]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const addNote = () => {
    if (!noteInput.trim()) return;
    setNotes(p => [...p, noteInput.trim()]);
    setNoteInput('');
  };

  if (!active) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6 glow-primary">
            <Timer className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">Focus Mode</h1>
          <p className="text-muted-foreground mb-6">Distraction-free study environment with timer and quick notes</p>
          <Input
            placeholder="What are you studying?"
            value={task}
            onChange={e => setTask(e.target.value)}
            className="bg-muted/50 mb-4 text-center"
          />
          <Button onClick={() => setActive(true)} size="lg" className="gradient-primary text-primary-foreground px-10">
            <Play className="w-5 h-5 mr-2" /> Start Focus Session
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] -m-6 p-6 bg-background">
      {/* Exit button */}
      <button onClick={() => { setActive(false); setSeconds(0); setPaused(false); }} className="absolute top-20 right-8 text-muted-foreground hover:text-foreground transition-colors">
        <X className="w-5 h-5" />
      </button>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-8 w-full max-w-lg">
        {/* Task */}
        {task && (
          <p className="text-sm text-primary font-semibold uppercase tracking-wider">{task}</p>
        )}

        {/* Timer */}
        <div className="relative">
          <div className="text-7xl md:text-8xl font-display font-bold text-foreground tabular-nums">
            {formatTime(seconds)}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={() => setPaused(!paused)}
            size="lg"
            variant={paused ? 'default' : 'outline'}
            className={paused ? 'gradient-primary text-primary-foreground' : ''}
          >
            {paused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
        </div>

        {/* Quick Notes */}
        <div className="glass rounded-xl p-4 text-left">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
            <StickyNote className="w-3 h-3" /> Quick Notes
          </h3>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Add a note..."
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              className="bg-muted/50 text-sm"
              onKeyDown={e => e.key === 'Enter' && addNote()}
            />
            <Button size="icon" variant="ghost" onClick={addNote}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <AnimatePresence>
            {notes.map((note, i) => (
              <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3 py-1 mb-1">
                {note}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default FocusMode;
