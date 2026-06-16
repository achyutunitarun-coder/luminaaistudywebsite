import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

/**
 * Honest early-stage marketing.
 * We don't have thousands of testimonials yet — so we don't fake them.
 * One real piece of feedback, sourced from a teacher-student review (9/10).
 */
export const Testimonials = () => (
  <section className="py-16">
    <div className="max-w-3xl mx-auto px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-3">
          What early users say
        </div>
        <h2 className="text-2xl md:text-3xl font-semibold mb-8" style={{ color: '#f1f5f9' }}>
          Built for real classrooms, not a launch headline.
        </h2>

        <div
          className="rounded-2xl p-8 md:p-10 text-left"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <Quote className="w-7 h-7 mb-4 opacity-40" style={{ color: '#a78bfa' }} />
          <p className="text-[17px] md:text-[19px] leading-[1.65] mb-6" style={{ color: '#e2e8f0' }}>
            "Good, valuable options. Helpful for any student and teacher.
            Truly a gem that's needed by many."
          </p>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1">
              {[...Array(9)].map((_, j) => (
                <Star key={j} className="w-3.5 h-3.5 fill-current" style={{ color: '#fbbf24' }} />
              ))}
              <Star className="w-3.5 h-3.5 opacity-30" style={{ color: '#fbbf24' }} />
              <span className="ml-2 text-[12px] text-muted-foreground">9 / 10 reviewer score</span>
            </div>
            <div className="text-[12px] text-muted-foreground">— Beta reviewer feedback</div>
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground mt-4">
          We're a new platform. You'll see more voices here as they come in — never invented ones.
        </p>
      </motion.div>
    </div>
  </section>
);
