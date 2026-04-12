import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { motion } from 'framer-motion';

const faqs = [
  {
    q: 'How does the AI generate personalized tests?',
    a: 'Lumina analyzes your learning history, weak areas, and study patterns to create custom tests that target exactly where you need practice. Each test adapts to your current level to maximize learning efficiency.',
  },
  {
    q: 'What subjects does Lumina support?',
    a: 'Lumina supports all major academic subjects including Physics, Chemistry, Mathematics, Biology, and more. Our AI can generate content for any topic you\'re studying, from high school through university level.',
  },
  {
    q: 'Is Lumina available on mobile?',
    a: 'Yes! Lumina is fully responsive and works seamlessly on phones, tablets, and desktops. Study anywhere, anytime — your progress syncs across all devices.',
  },
  {
    q: 'How does the adaptive learning algorithm work?',
    a: 'Our algorithm tracks your performance across topics, identifies knowledge gaps, and adjusts difficulty in real-time. It uses spaced repetition science to schedule reviews at optimal intervals, ensuring long-term retention of what you learn.',
  },
];

export const FAQ = () => (
  <section className="py-12 max-w-2xl mx-auto">
    <motion.h2
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-2xl font-bold text-center mb-8"
      style={{ color: '#f1f5f9' }}
    >
      Frequently Asked Questions
    </motion.h2>
    <Accordion type="single" collapsible className="space-y-2">
      {faqs.map((f, i) => (
        <AccordionItem key={i} value={`faq-${i}`} className="rounded-[14px] px-4" style={{ background: '#111827', border: '0.5px solid rgba(255,255,255,0.07)' }}>
          <AccordionTrigger className="text-[14px] font-medium hover:no-underline py-4" style={{ color: '#f1f5f9' }}>
            {f.q}
          </AccordionTrigger>
          <AccordionContent className="text-[13px] leading-relaxed pb-4" style={{ color: '#94a3b8' }}>
            {f.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </section>
);
