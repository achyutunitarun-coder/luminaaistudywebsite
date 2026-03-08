import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: 'primary' | 'secondary' | 'xp' | 'warning' | 'success';
  delay?: number;
};

const colorMap = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  xp: 'text-xp',
  warning: 'text-warning',
  success: 'text-success',
};

const bgMap = {
  primary: 'bg-primary/8',
  secondary: 'bg-secondary/8',
  xp: 'bg-xp/8',
  warning: 'bg-warning/8',
  success: 'bg-success/8',
};

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(({ icon: Icon, label, value, color, delay = 0 }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, y: 16, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    className="rounded-2xl border border-border/15 bg-card/50 backdrop-blur-2xl p-5 card-hover group"
  >
    <div className={`w-9 h-9 rounded-xl ${bgMap[color]} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110`}>
      <Icon className={`w-[18px] h-[18px] ${colorMap[color]}`} />
    </div>
    <p className="text-[28px] font-display font-bold text-foreground tracking-tight leading-none">{value}</p>
    <p className="text-[13px] text-muted-foreground mt-1.5 font-medium">{label}</p>
  </motion.div>
));

StatCard.displayName = 'StatCard';
