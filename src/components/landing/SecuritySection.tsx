import { motion } from 'framer-motion';
import { Shield, Lock, Globe, Database, CheckCircle2 } from 'lucide-react';

const trustItems = [
  { icon: Shield, label: 'SOC 2 Type II', desc: 'Certified for security, availability, and confidentiality' },
  { icon: Globe, label: 'GDPR Compliant', desc: 'Full compliance with European data protection regulations' },
  { icon: Lock, label: 'End-to-End Encryption', desc: 'AES-256 encryption for all data in transit and at rest' },
  { icon: Database, label: 'Private Knowledge Storage', desc: 'Your data is isolated and never used for training' },
];

export const SecuritySection = () => {
  return (
    <section id="security" className="relative py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Enterprise-Grade{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Security</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Your data and privacy are protected by the highest standards.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {trustItems.map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="group liquid-glass rounded-2xl p-6 text-center hover:scale-[1.02] transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border border-white/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <item.icon className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{item.label}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
              <div className="mt-4 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400/70">Active</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
