import ModeCard, { ModeId } from './ModeCard';
import { Zap, Rocket, Brain, Feather } from 'lucide-react';

export default function ModePicker({ active, onChange }: { active: ModeId; onChange: (m: ModeId) => void }) {
  const modes: { id: ModeId; label: string; desc: string; Icon: any }[] = [
    { id: 'normal', label: 'Normal', desc: 'Balanced latency and depth', Icon: Brain },
    { id: 'quick', label: 'Quick', desc: 'Faster responses, less depth', Icon: Zap },
    { id: 'beast', label: 'Beast', desc: 'Max compute, aggressive exploration', Icon: Rocket },
    { id: 'deep-research', label: 'Deep', desc: 'Thorough multi-step reasoning', Icon: Feather },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {modes.map((m) => (
        <ModeCard key={m.id} id={m.id} label={m.label} description={m.desc} selected={m.id === active} onSelect={onChange}>
          <m.Icon className="w-5 h-5 text-[var(--text-muted)]" />
        </ModeCard>
      ))}
    </div>
  );
}
