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
  primary: 'bg-primary/10',
  secondary: 'bg-secondary/10',
  xp: 'bg-xp/10',
  warning: 'bg-warning/10',
  success: 'bg-success/10',
};

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(({ icon: Icon, label, value, color, delay = 0 }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-xl p-5"
  >
    <div className={`w-10 h-10 rounded-xl ${bgMap[color]} flex items-center justify-center mb-3`}>
      <Icon className={`w-5 h-5 ${colorMap[color]}`} />
    </div>
    <p className="text-2xl font-display font-bold text-foreground">{value}</p>
    <p className="text-sm text-muted-foreground">{label}</p>
  </motion.div>
));

StatCard.displayName = 'StatCard';
