import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { openPricing } from '@/lib/pricing';

export const CTASection = () => {
  const navigate = useNavigate();
  return (
    <section className="relative rounded-[14px] overflow-hidden p-10 md:p-16 text-center" style={{ background: 'linear-gradient(135deg, #0f1f3d, #1a0d2e)' }}>
      <div className="absolute top-10 left-10 w-[200px] h-[200px] rounded-full opacity-20 blur-[80px]" style={{ background: '#a855f7' }} />
      <div className="absolute bottom-10 right-10 w-[250px] h-[250px] rounded-full opacity-15 blur-[80px]" style={{ background: '#2dd4bf' }} />
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative z-10 max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#f1f5f9' }}>Ready to transform your learning?</h2>
        <p className="text-[15px] mb-8 leading-relaxed" style={{ color: '#94a3b8' }}>
          Join thousands of students who are already using Lumina to master their subjects and achieve their academic goals.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button
            onClick={() => navigate('/auth')}
            className="rounded-[10px] px-6 text-[14px] font-semibold"
            style={{ background: 'linear-gradient(135deg, #2dd4bf, #0ea5e9)', color: '#0a0c15' }}
          >
            Get Started for Free <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
          <Button
            variant="outline"
            onClick={openPricing}
            className="rounded-[10px] px-6 text-[14px] font-semibold"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#f1f5f9' }}
          >
            View Pricing
          </Button>
        </div>
      </motion.div>
    </section>
  );
};
