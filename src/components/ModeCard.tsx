import { FC } from 'react';

export type ModeId = 'normal' | 'quick' | 'beast' | 'deep-research';

const ModeCard: FC<{
  id: ModeId;
  label: string;
  description?: string;
  selected?: boolean;
  onSelect?: (id: ModeId) => void;
  children?: React.ReactNode;
}> = ({ id, label, description, selected, onSelect, children }) => {
  return (
    <button
      onClick={() => onSelect?.(id)}
      className={`p-4 rounded-lg text-left border transition-colors duration-150 ${selected ? 'border-indigo-400 bg-[var(--bg-elevated)]' : 'border-transparent hover:border-[var(--border-subtle)]'}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          {description && <div className="text-xs text-[var(--text-muted)] mt-1">{description}</div>}
        </div>
        <div className="ml-4">{children}</div>
      </div>
    </button>
  );
};

export default ModeCard;
