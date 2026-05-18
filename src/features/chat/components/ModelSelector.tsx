import { Zap, Brain, BookOpen, Code2, Palette, Sparkles, Telescope } from 'lucide-react';

export type ModelMode = 'auto' | 'reasoning' | 'study' | 'coding' | 'deepDive' | 'creative' | 'fast';

const MODELS: { k: ModelMode; label: string; icon: typeof Zap; desc: string }[] = [
  { k: 'auto',      label: 'Auto',      icon: Sparkles,  desc: 'Smart routing' },
  { k: 'reasoning', label: 'Reasoning', icon: Brain,     desc: 'Step-by-step' },
  { k: 'study',     label: 'Study',     icon: BookOpen,  desc: 'Patient tutor' },
  { k: 'coding',    label: 'Coding',    icon: Code2,     desc: 'Code-focused' },
  { k: 'deepDive',  label: 'Deep Dive', icon: Telescope, desc: 'Long, thorough answers' },
  { k: 'creative',  label: 'Creative',  icon: Palette,   desc: 'Analogies' },
  { k: 'fast',      label: 'Fast',      icon: Zap,       desc: 'Concise' },
];

interface Props {
  value: ModelMode;
  onChange: (m: ModelMode) => void;
}

export const ModelSelector = ({ value, onChange }: Props) => (
  <div className="flex flex-wrap gap-1.5">
    {MODELS.map((m) => {
      const active = value === m.k;
      const Icon = m.icon;
      return (
        <button
          key={m.k}
          type="button"
          onClick={() => onChange(m.k)}
          title={m.desc}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            active
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
              : 'bg-card/40 text-muted-foreground hover:text-foreground border border-border hover:border-primary/40'
          }`}
        >
          <Icon className="w-3 h-3" />
          {m.label}
        </button>
      );
    })}
  </div>
);
