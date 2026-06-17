/**
 * Lumina Design System — Production UI Components
 * Consistent, polished components for all pages.
 */
import { motion } from 'framer-motion';
import { type ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════
// Card Components
// ═══════════════════════════════════════════════════════════════

export const Card = ({ children, className = '', hover = false, onClick }: { children: ReactNode; className?: string; hover?: boolean; onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`rounded-2xl relative overflow-hidden ${hover ? 'card-hover cursor-pointer' : ''} ${className}`}
    style={{
      background: 'hsl(230 20% 11% / 0.5)',
      backdropFilter: 'blur(40px) saturate(1.8)',
      border: '1px solid hsl(0 0% 100% / 0.06)',
      boxShadow: '0 8px 32px hsl(0 0% 0% / 0.3), 0 2px 8px hsl(0 0% 0% / 0.15), inset 0 1px 0 hsl(0 0% 100% / 0.08)',
    }}
  >
    {children}
  </div>
);

export const CardHeader = ({ icon: Icon, title, subtitle, action }: { icon?: React.ElementType; title: string; subtitle?: string; action?: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 mb-4">
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'hsl(174 72% 56% / 0.12)' }}>
          <Icon className="w-5 h-5 text-primary" />
        </div>
      )}
      <div>
        <h3 className="text-base font-display font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

export const CardContent = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`relative z-10 ${className}`}>{children}</div>
);

// ═══════════════════════════════════════════════════════════════
// Stat Card
// ═══════════════════════════════════════════════════════════════

export const StatCard = ({ icon: Icon, value, label, sub, color = 'text-primary', bg }: { icon: React.ElementType; value: string | number; label: string; sub?: string; color?: string; bg?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl p-5 relative overflow-hidden group cursor-default"
    style={{
      background: 'hsl(230 20% 11% / 0.45)',
      backdropFilter: 'blur(24px)',
      border: '1px solid hsl(0 0% 100% / 0.05)',
      boxShadow: '0 4px 16px hsl(0 0% 0% / 0.2)',
    }}
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${bg || 'from-primary/5 to-primary/2'} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
    <div className="relative z-10 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg || 'bg-primary/10'}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-display font-bold text-foreground tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════
// Progress Bar
// ═══════════════════════════════════════════════════════════════

export const ProgressBar = ({ value, max = 100, color = 'bg-primary', height = 'h-2', showLabel = false, animated = true }: { value: number; max?: number; color?: string; height?: string; showLabel?: boolean; animated?: boolean }) => {
  const pct = Math.min(Math.round((value / max) * 100), 100);
  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 ${height} rounded-full overflow-hidden`} style={{ background: 'hsl(0 0% 100% / 0.06)' }}>
        <motion.div
          initial={animated ? { width: 0 } : { width: `${pct}%` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] as const }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      {showLabel && <span className="text-xs font-medium text-muted-foreground tabular-nums w-10 text-right">{pct}%</span>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Badge
// ═══════════════════════════════════════════════════════════════

export const Badge = ({ children, variant = 'default', size = 'sm' }: { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'primary' | 'secondary'; size?: 'sm' | 'xs' }) => {
  const variants: Record<string, string> = {
    default: 'bg-muted/10 text-muted-foreground border-border/10',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20',
    primary: 'bg-primary/10 text-primary border-primary/20',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20',
  };
  const sizes: Record<string, string> = { sm: 'px-2.5 py-1 text-[11px] font-semibold', xs: 'px-1.5 py-0.5 text-[10px] font-medium' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════════════

export const EmptyState = ({ icon: Icon, title, description, action }: { icon: React.ElementType; title: string; description?: string; action?: ReactNode }) => (
  <div className="rounded-2xl p-8 text-center" style={{ background: 'hsl(230 20% 11% / 0.4)', border: '1px solid hsl(0 0% 100% / 0.05)' }}>
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'hsl(0 0% 100% / 0.04)' }}>
      <Icon className="w-7 h-7 text-muted-foreground/40" />
    </div>
    <p className="text-sm font-medium text-foreground mb-1">{title}</p>
    {description && <p className="text-xs text-muted-foreground mb-4">{description}</p>}
    {action}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// Section Header
// ═══════════════════════════════════════════════════════════════

export const SectionHeader = ({ icon: Icon, title, subtitle, action }: { icon?: React.ElementType; title: string; subtitle?: string; action?: ReactNode }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2.5">
      {Icon && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      )}
      <div>
        <h2 className="text-base font-display font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// Button Group (Segmented Control)
// ═══════════════════════════════════════════════════════════════

export const ButtonGroup = ({ options, value, onChange }: { options: { value: string; label: string; icon?: React.ElementType }[]; value: string; onChange: (v: string) => void }) => (
  <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'hsl(230 20% 10% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.05)' }}>
    {options.map(opt => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
            active ? 'text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
          }`}
          style={active ? { background: 'linear-gradient(135deg, hsl(174 72% 56%), hsl(200 80% 50%))', boxShadow: '0 2px 8px hsl(174 72% 56% / 0.25)' } : {}}
        >
          {opt.icon && <opt.icon className="w-3.5 h-3.5" />}
          {opt.label}
        </button>
      );
    })}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// Skeleton Loader
// ═══════════════════════════════════════════════════════════════

export const Skeleton = ({ className = '', height = 'h-4' }: { className?: string; height?: string }) => (
  <div className={`${height} rounded-lg animate-pulse ${className}`} style={{ background: 'hsl(0 0% 100% / 0.04)' }} />
);

export const SkeletonCard = () => (
  <Card><CardContent className="space-y-3"><Skeleton height="h-5" className="w-2/3" /><Skeleton height="h-4" className="w-full" /><Skeleton height="h-4" className="w-4/5" /></CardContent></Card>
);
