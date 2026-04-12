import { motion } from 'framer-motion';

type Props = {
  subjects: string[];
  active: string;
  onChange: (s: string) => void;
};

export const SubjectTabs = ({ subjects, active, onChange }: Props) => (
  <div className="flex gap-2 flex-wrap">
    {subjects.map((s) => (
      <button
        key={s}
        onClick={() => onChange(s)}
        className="relative px-4 py-1.5 text-[13px] font-medium rounded-[99px] transition-colors"
        style={{
          background: active === s ? 'rgba(45,212,191,0.12)' : 'transparent',
          color: active === s ? '#2dd4bf' : '#64748b',
          border: `0.5px solid ${active === s ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.07)'}`,
        }}
      >
        {active === s && (
          <motion.div
            layoutId="subject-tab"
            className="absolute inset-0 rounded-[99px]"
            style={{ background: 'rgba(45,212,191,0.12)' }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <span className="relative z-10 capitalize">{s}</span>
      </button>
    ))}
  </div>
);
