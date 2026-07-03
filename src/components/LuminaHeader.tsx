import { Cpu, Eye, Plus, Sparkles } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useCallback, useState } from "react";
import ModeSelector from "@/components/ModeSelector";

export default function LuminaHeader({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { profile } = useProfile();
  const [mode, setMode] = useState<'normal' | 'quick' | 'beast' | 'deep-research'>('normal');

  const handleNew = useCallback(() => {
    console.log("New workspace requested");
  }, []);

  return (
    <header className="hidden md:flex items-center gap-3 px-6 h-14 border-b flex-shrink-0" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: `linear-gradient(135deg, var(--teal), var(--brand))` }}>
          <Cpu className="w-4 h-4 text-white" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight">Lumina Computer</span>
      </div>

      <div className="flex items-center gap-2 ml-6">
        <ModeSelector active={mode} onChange={(m) => setMode(m)} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button onClick={handleNew} className="flex items-center gap-2 px-3 h-9 rounded-md text-[12px] font-medium" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
          <Plus className="w-3 h-3" /> New
        </button>
        <button className="flex items-center gap-2 px-3 h-9 rounded-md text-[12px] font-medium" style={{ background: "transparent", color: "var(--text-secondary)" }}>
          <Eye className="w-3 h-3" /> Preview
        </button>
      </div>
    </header>
  );
}
