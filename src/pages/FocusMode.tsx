import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Pause, Play, X, StickyNote, Plus, Eye, EyeOff, Shield, AlertTriangle, Zap, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useFaceAttention, type AttentionLevel, type DistractionEvent } from '@/hooks/useFaceAttention';
import FocusToolsWidget from '@/components/FocusToolsWidget';

const ATTENTION_CONFIG: Record<AttentionLevel, { label: string; color: string; bgClass: string; icon: React.ReactNode }> = {
  focused: {
    label: 'Focused',
    color: 'text-success',
    bgClass: 'bg-success/15 border-success/30',
    icon: <Eye className="w-3.5 h-3.5" />,
  },
  slightly_distracted: {
    label: 'Attention Drifting',
    color: 'text-warning',
    bgClass: 'bg-warning/15 border-warning/30',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  distracted: {
    label: 'Distracted',
    color: 'text-destructive',
    bgClass: 'bg-destructive/15 border-destructive/30',
    icon: <EyeOff className="w-3.5 h-3.5" />,
  },
};

// Generate siren using Web Audio API
const createSiren = () => {
  let ctx: AudioContext | null = null;
  let oscillator: OscillatorNode | null = null;
  let gainNode: GainNode | null = null;
  let lfoOsc: OscillatorNode | null = null;
  let lfoGain: GainNode | null = null;
  let isPlaying = false;

  const start = () => {
    if (isPlaying) return;
    try {
      ctx = new AudioContext();
      oscillator = ctx.createOscillator();
      gainNode = ctx.createGain();
      lfoOsc = ctx.createOscillator();
      lfoGain = ctx.createGain();

      // Siren: LFO modulates frequency
      lfoOsc.frequency.value = 2; // 2Hz wobble
      lfoGain.gain.value = 300;   // frequency deviation
      lfoOsc.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);

      oscillator.type = 'sawtooth';
      oscillator.frequency.value = 680;
      gainNode.gain.value = 0.35;

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      lfoOsc.start();
      isPlaying = true;
    } catch {}
  };

  const stop = () => {
    if (!isPlaying) return;
    try {
      oscillator?.stop();
      lfoOsc?.stop();
      ctx?.close();
    } catch {}
    oscillator = null;
    lfoOsc = null;
    gainNode = null;
    lfoGain = null;
    ctx = null;
    isPlaying = false;
  };

  return { start, stop, get playing() { return isPlaying; } };
};

const FocusMode = () => {
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [task, setTask] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [attentionEnabled, setAttentionEnabled] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAlertRef = useRef(0);

  // Tab switch siren state
  const [sirenEnabled, setSirenEnabled] = useState(true);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [tabSwitchWarning, setTabSwitchWarning] = useState('');
  const sirenRef = useRef(createSiren());

  // BroadcastChannel: detect if user switched to another Lumina tab (same origin)
  const luminaTabActiveRef = useRef(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const bc = new BroadcastChannel('lumina-focus');
    broadcastChannelRef.current = bc;

    // When THIS tab becomes visible, broadcast so other Focus tabs know
    const broadcastVisible = () => {
      if (!document.hidden) {
        bc.postMessage({ type: 'lumina-tab-active', timestamp: Date.now() });
      }
    };
    document.addEventListener('visibilitychange', broadcastVisible);

    // Listen for other Lumina tabs becoming active
    bc.onmessage = () => {
      // Another Lumina tab just became visible — flag it briefly
      luminaTabActiveRef.current = true;
      setTimeout(() => { luminaTabActiveRef.current = false; }, 500);
    };

    return () => {
      document.removeEventListener('visibilitychange', broadcastVisible);
      bc.close();
      broadcastChannelRef.current = null;
    };
  }, []);

  const attention = useFaceAttention(active && attentionEnabled && !paused);

  // Timer
  useEffect(() => {
    if (active && !paused) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, paused]);

  // Tab visibility detection — siren on tab switch
  useEffect(() => {
    if (!active || paused) return;

    const handleVisibility = () => {
      if (document.hidden) {
        // User left the tab
        if (sirenEnabled) {
          sirenRef.current.start();
        }
        setTabSwitchCount(prev => {
          const next = prev + 1;
          return next;
        });
      } else {
        // User returned
        sirenRef.current.stop();
        setTabSwitchCount(prev => {
          if (prev > 3) {
            setTabSwitchWarning('Too many distractions detected. Please stay focused.');
          } else if (prev > 0) {
            setTabSwitchWarning('You switched tabs. Stay focused on your study session.');
          }
          return prev;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      sirenRef.current.stop();
    };
  }, [active, paused, sirenEnabled]);

  // Auto-dismiss tab switch warning after 4s
  useEffect(() => {
    if (!tabSwitchWarning) return;
    const t = setTimeout(() => setTabSwitchWarning(''), 4000);
    return () => clearTimeout(t);
  }, [tabSwitchWarning]);

  // "FOCUS" voice alert using Speech Synthesis — repeats while distracted
  const focusVoiceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSpeakingFocusRef = useRef(false);

  const speakFocus = useCallback(() => {
    if (!sirenEnabled || isSpeakingFocusRef.current) return;
    try {
      const utterance = new SpeechSynthesisUtterance('FOCUS');
      utterance.rate = 0.9;
      utterance.pitch = 0.8;
      utterance.volume = 1.0;
      isSpeakingFocusRef.current = true;
      utterance.onend = () => { isSpeakingFocusRef.current = false; };
      utterance.onerror = () => { isSpeakingFocusRef.current = false; };
      speechSynthesis.speak(utterance);
    } catch {}
  }, [sirenEnabled]);

  useEffect(() => {
    if (attention.attentionLevel === 'distracted' && sirenEnabled && active && !paused) {
      setDismissedWarning(false);
      // Say "FOCUS" immediately, then repeat every 2.5s
      speakFocus();
      focusVoiceIntervalRef.current = setInterval(speakFocus, 2500);
    } else {
      // Stop repeating
      if (focusVoiceIntervalRef.current) {
        clearInterval(focusVoiceIntervalRef.current);
        focusVoiceIntervalRef.current = null;
      }
      speechSynthesis.cancel();
      isSpeakingFocusRef.current = false;
    }
    return () => {
      if (focusVoiceIntervalRef.current) {
        clearInterval(focusVoiceIntervalRef.current);
        focusVoiceIntervalRef.current = null;
      }
    };
  }, [attention.attentionLevel, sirenEnabled, active, paused, speakFocus]);

  // Also play a beep for slightly_distracted
  useEffect(() => {
    if (attention.attentionLevel === 'slightly_distracted' && attention.distractionSeconds >= 3) {
      const now = Date.now();
      if (now - lastAlertRef.current > 5000) {
        lastAlertRef.current = now;
        setDismissedWarning(false);
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 520;
          gain.gain.value = 0.2;
          osc.start();
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
          osc.stop(ctx.currentTime + 0.6);
        } catch {}
      }
    }
  }, [attention.attentionLevel, attention.distractionSeconds]);

  useEffect(() => {
    if (attention.attentionLevel === 'focused') {
      setDismissedWarning(false);
    }
  }, [attention.attentionLevel]);

  // Cleanup siren + speech on unmount
  useEffect(() => {
    return () => {
      sirenRef.current.stop();
      speechSynthesis.cancel();
      if (focusVoiceIntervalRef.current) clearInterval(focusVoiceIntervalRef.current);
    };
  }, []);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const formatShortTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const addNote = () => {
    if (!noteInput.trim()) return;
    setNotes(p => [...p, noteInput.trim()]);
    setNoteInput('');
  };

  const endSession = () => {
    sirenRef.current.stop();
    speechSynthesis.cancel();
    if (focusVoiceIntervalRef.current) clearInterval(focusVoiceIntervalRef.current);
    setActive(false);
    setSeconds(0);
    setPaused(false);
    setShowLog(false);
    setTabSwitchCount(0);
    setTabSwitchWarning('');
  };

  const attentionInfo = ATTENTION_CONFIG[attention.attentionLevel];

  if (!active) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
            <Timer className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">Focus Mode</h1>
          <p className="text-muted-foreground text-sm mb-6">Distraction-free study with AI attention tracking & tab-switch siren</p>
          <Input
            placeholder="What are you studying?"
            value={task}
            onChange={e => setTask(e.target.value)}
            className="bg-muted/20 border-border/30 rounded-xl mb-4 text-center"
          />

          {/* Attention tracking toggle */}
          <div className="rounded-2xl liquid-glass p-4 mb-3 text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Attention Tracking</span>
              </div>
              <button
                onClick={() => setAttentionEnabled(!attentionEnabled)}
                className={`w-10 h-6 rounded-full transition-all duration-300 ${attentionEnabled ? 'bg-primary' : 'bg-muted'} relative`}
              >
                <div className={`w-4 h-4 rounded-full bg-primary-foreground absolute top-1 transition-all duration-300 ${attentionEnabled ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Uses your webcam to detect when you look away.</p>
            <div className="flex items-center gap-1.5 mt-2">
              <Shield className="w-3 h-3 text-success" />
              <span className="text-[11px] text-success">All processing happens locally — nothing is stored or uploaded</span>
            </div>
          </div>

          {/* Tab-switch siren toggle */}
          <div className="rounded-2xl liquid-glass p-4 mb-4 text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold text-foreground">Tab-Switch Siren</span>
              </div>
              <button
                onClick={() => setSirenEnabled(!sirenEnabled)}
                className={`w-10 h-6 rounded-full transition-all duration-300 ${sirenEnabled ? 'bg-destructive' : 'bg-muted'} relative`}
              >
                <div className={`w-4 h-4 rounded-full bg-primary-foreground absolute top-1 transition-all duration-300 ${sirenEnabled ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Plays a loud siren when you switch away from this tab to discourage distractions.</p>
          </div>

          <Button onClick={() => setActive(true)} size="lg" className="gradient-primary text-primary-foreground px-10 rounded-2xl h-12 shadow-lg shadow-primary/20">
            <Play className="w-5 h-5 mr-2" /> Start Focus Session
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] -m-6 p-6 bg-background relative">
      <button onClick={endSession} className="absolute top-20 right-8 text-muted-foreground hover:text-foreground transition-colors z-10">
        <X className="w-5 h-5" />
      </button>

      {/* Tab Switch Warning Overlay */}
      <AnimatePresence>
        {tabSwitchWarning && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-md"
          >
            <div className={`rounded-2xl liquid-glass-intense p-5 text-center border ${
              tabSwitchCount > 3 ? 'border-destructive/40' : 'border-warning/40'
            }`}>
              <AlertTriangle className={`w-6 h-6 mx-auto mb-2 ${tabSwitchCount > 3 ? 'text-destructive' : 'text-warning'}`} />
              <p className={`text-sm font-bold ${tabSwitchCount > 3 ? 'text-destructive' : 'text-warning'}`}>
                {tabSwitchWarning}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Distraction Warning Overlay (face attention) */}
      <AnimatePresence>
        {attention.attentionLevel === 'slightly_distracted' && attention.distractionSeconds >= 5 && !dismissedWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-md"
          >
            <div className="rounded-2xl border border-warning/30 bg-warning/10 backdrop-blur-xl p-4 text-center">
              <p className="text-sm font-semibold text-warning">Stay focused! 👀</p>
              <p className="text-xs text-muted-foreground mt-1">Please return your attention to the study material.</p>
            </div>
          </motion.div>
        )}
        {attention.attentionLevel === 'distracted' && !dismissedWarning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-md"
          >
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 backdrop-blur-xl p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-2" />
              <p className="text-sm font-bold text-destructive">You've been distracted for {attention.distractionSeconds}s</p>
              <p className="text-xs text-muted-foreground mt-1">Take a breath and refocus on your study material.</p>
              <Button size="sm" variant="outline" className="mt-3 rounded-xl text-xs" onClick={() => setDismissedWarning(true)}>
                I'm back
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6 w-full max-w-lg">
        {task && <p className="text-sm text-primary font-bold uppercase tracking-[0.15em]">{task}</p>}

        {/* Tab Switch Counter & Siren Toggle */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass text-xs font-semibold text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5" />
            Tab switches: <span className={tabSwitchCount > 3 ? 'text-destructive' : tabSwitchCount > 0 ? 'text-warning' : 'text-success'}>{tabSwitchCount}</span>
          </div>
          <button
            onClick={() => {
              setSirenEnabled(!sirenEnabled);
              if (sirenEnabled) sirenRef.current.stop();
              toast(sirenEnabled ? 'Siren disabled' : 'Siren enabled');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              sirenEnabled
                ? 'liquid-glass border-destructive/30 text-destructive'
                : 'liquid-glass-subtle text-muted-foreground'
            }`}
          >
            {sirenEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            Siren {sirenEnabled ? 'On' : 'Off'}
          </button>
        </div>

        {/* Attention Indicator */}
        {attentionEnabled && attention.cameraActive && (
          <div className="flex items-center justify-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${attentionInfo.bgClass} ${attentionInfo.color} transition-all duration-500`}>
              {attentionInfo.icon}
              {attentionInfo.label}
            </div>
            {attention.attentionLevel === 'focused' && attention.focusStreak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-xs font-medium text-success">
                <Zap className="w-3 h-3" />
                {formatShortTime(attention.focusStreak)} streak
              </div>
            )}
          </div>
        )}

        {attentionEnabled && attention.cameraError && (
          <p className="text-xs text-destructive">{attention.cameraError}</p>
        )}

        {attentionEnabled && !attention.cameraActive && !attention.cameraError && (
          <p className="text-xs text-muted-foreground animate-pulse">Initializing camera & face detection...</p>
        )}

        <div className="text-7xl md:text-8xl font-display font-bold text-foreground tabular-nums">
          {formatTime(seconds)}
        </div>

        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={() => setPaused(!paused)}
            size="lg"
            variant={paused ? 'default' : 'outline'}
            className={`rounded-2xl h-12 ${paused ? 'gradient-primary text-primary-foreground' : ''}`}
          >
            {paused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          {attentionEnabled && attention.distractionLog.length > 0 && (
            <Button
              onClick={() => setShowLog(!showLog)}
              size="lg"
              variant="outline"
              className="rounded-2xl h-12"
            >
              <Eye className="w-5 h-5 mr-2" />
              Log ({attention.distractionLog.length})
            </Button>
          )}
        </div>

        {/* Distraction Log */}
        <AnimatePresence>
          {showLog && attention.distractionLog.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-2xl liquid-glass p-4 text-left overflow-hidden"
            >
              <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">
                Distraction Events
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {attention.distractionLog.map((event, i) => {
                  const eventConfig = ATTENTION_CONFIG[event.level];
                  const time = new Date(event.timestamp);
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${event.level === 'distracted' ? 'bg-destructive' : 'bg-warning'}`} />
                        <span className="text-muted-foreground">
                          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={eventConfig.color}>{event.duration}s — {eventConfig.label}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Notes */}
        <div className="rounded-2xl liquid-glass p-4 text-left">
          <h3 className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
            <StickyNote className="w-3 h-3" /> Quick Notes
          </h3>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Add a note..."
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              className="bg-muted/20 border-border/30 rounded-xl text-sm"
              onKeyDown={e => e.key === 'Enter' && addNote()}
            />
            <Button size="icon" variant="ghost" onClick={addNote} className="rounded-xl">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <AnimatePresence>
            {notes.map((note, i) => (
              <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3 py-1 mb-1"
              >
                {note}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Privacy Notice */}
        {attentionEnabled && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60">
            <Shield className="w-3 h-3" />
            Webcam data is processed locally and never stored or uploaded.
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default FocusMode;
