import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';

export const FinalCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="relative py-32 md:py-48 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-transparent blur-[150px]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6"
        >
          The Future of Work{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400">
            Isn't Faster.
          </span>
          <br />
          It's{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
            Agentic.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Join the next generation of thinkers, builders, researchers, and innovators.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            onClick={() => navigate('/auth')}
            className="group rounded-2xl px-8 py-6 text-base font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white shadow-2xl shadow-cyan-500/25 border-0 transition-all duration-300 hover:scale-[1.02]"
          >
            Start Free
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl px-8 py-6 text-base font-semibold border-white/10 text-white/80 hover:bg-white/5 hover:text-white"
          >
            <Play className="w-5 h-5 mr-2" />
            Book Demo
          </Button>
        </motion.div>
      </div>
    </section>
  );
};
