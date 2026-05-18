import { Zap } from 'lucide-react';
import { useCreditsStore } from './useCreditsStore';

interface Props {
  onClick: () => void;
  className?: string;
}

export const CreditsDisplay = ({ onClick, className = '' }: Props) => {
  const { balance } = useCreditsStore();
  const isLow = balance < 3;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
        isLow
          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse hover:bg-rose-500/20'
          : 'bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20'
      } ${className}`}
      title={isLow ? 'Low credits — tap to top up' : 'Credits balance'}
    >
      <Zap className="w-3.5 h-3.5" fill="currentColor" />
      <span className="tabular-nums">{balance.toFixed(1)}</span>
      <span className="opacity-70">credit{balance === 1 ? '' : 's'}</span>
      {isLow && <span className="ml-1 text-[10px] uppercase tracking-wider opacity-90">Low</span>}
    </button>
  );
};
