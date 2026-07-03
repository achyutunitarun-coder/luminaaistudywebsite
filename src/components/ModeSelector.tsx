import { useState } from "react";
import { Zap, Rocket, Brain } from "lucide-react";

type ModeId = 'normal' | 'quick' | 'beast' | 'deep-research';

export default function ModeSelector({ active, onChange }: { active: ModeId; onChange: (m: ModeId) => void }) {
  const [hover, setHover] = useState<ModeId | null>(null);
  const modes: { id: ModeId; label: string; color: string; Icon: any }[] = [
    { id: 'normal', label: 'Normal', color: 'var(--mode-normal)', Icon: Brain },
    { id: 'quick', label: 'Quick', color: 'var(--mode-quick)', Icon: Zap },
    { id: 'beast', label: 'Beast', color: 'var(--mode-beast)', Icon: Rocket },
    { id: 'deep-research', label: 'Deep', color: 'var(--mode-research)', Icon: Brain },
  ];

  return (
    <div className="inline-flex items-center gap-2 p-1 rounded-full" style={{ background: 'var(--bg-tertiary)' }} role="tablist">
      {modes.map((m) => {
        const activeCls = m.id === active ? { background: 'var(--bg-surface)', boxShadow: 'var(--shadow-glow)', border: '1px solid var(--border-active)' } : {};
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={m.id === active}
            onMouseEnter={() => setHover(m.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange(m.id)}
            className="flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-medium"
            style={{ color: m.id === active ? 'var(--text-primary)' : 'var(--text-muted)', border: '1px solid transparent', transition: 'all 150ms var(--ease-out)', ...(activeCls as any) }}
          >
            <m.Icon className="w-3.5 h-3.5" style={{ color: m.color }} />
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
