import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const plans = [
  {
    name: 'Starter',
    desc: 'For individuals exploring agentic AI',
    price: 'Free',
    period: 'forever',
    features: ['1 AI Agent', '100 tasks/month', 'Basic research', 'Standard support', 'Community access'],
    cta: 'Get Started',
    featured: false,
  },
  {
    name: 'Professional',
    desc: 'For professionals and teams',
    price: '$49',
    period: '/month',
    features: ['Unlimited Agents', '10,000 tasks/month', 'Deep research engine', 'Priority support', 'Knowledge graph', 'Custom workflows', 'Team collaboration'],
    cta: 'Start Free Trial',
    featured: true,
  },
  {
    name: 'Enterprise',
    desc: 'For organizations at scale',
    price: 'Custom',
    period: '',
    features: ['Everything in Professional', 'Unlimited tasks', 'Enterprise SSO', 'Dedicated infrastructure', 'Custom agent training', 'SLA guarantee', '24/7 support', 'On-premise option'],
    cta: 'Contact Sales',
    featured: false,
  },
];

export const PricingSection = () => {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <section id="pricing" className="relative py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Simple{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Pricing</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Start free, scale as your ambitions grow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              onMouseEnter={() => setHoveredPlan(plan.name)}
              onMouseLeave={() => setHoveredPlan(null)}
              className={cn(
                'relative rounded-2xl p-6 md:p-8 transition-all duration-500',
                plan.featured
                  ? 'bg-gradient-to-b from-cyan-500/10 via-violet-500/10 to-transparent border-2 border-cyan-500/30 shadow-2xl shadow-cyan-500/10 scale-105'
                  : 'liquid-glass border border-white/5'
              )}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 text-white text-xs font-semibold">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-white/40">{plan.desc}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                {plan.period && <span className="text-sm text-white/40 ml-1">{plan.period}</span>}
              </div>

              <Button
                onClick={() => navigate('/auth')}
                className={cn(
                  'w-full rounded-xl mb-6 text-sm font-semibold',
                  plan.featured
                    ? 'bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white border-0 shadow-lg shadow-cyan-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                )}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>

              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-white/60">{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
