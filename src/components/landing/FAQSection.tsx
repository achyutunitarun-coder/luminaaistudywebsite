import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const faqs = [
  {
    q: 'What makes Lumina different from other AI tools?',
    a: 'Lumina is an agentic operating system, not just a chatbot. Multiple specialized AI agents collaborate autonomously to research, analyze, plan, and execute complex tasks. It\'s designed to handle multi-step workflows that require deep reasoning, cross-referencing, and synthesis — not just answering questions.',
  },
  {
    q: 'How does the multi-agent system work?',
    a: 'When you give Lumina a task, it automatically orchestrates a team of specialized agents. Each agent has a unique capability (research, analysis, finance, writing, visualization, etc.). They work in parallel, share context, and build on each other\'s outputs to deliver comprehensive results that no single AI model could produce alone.',
  },
  {
    q: 'Is my data secure and private?',
    a: 'Absolutely. Lumina is SOC 2 Type II certified and GDPR compliant. All data is encrypted with AES-256 at rest and TLS 1.3 in transit. Your knowledge bases are isolated per workspace and never used for model training. Enterprise customers can opt for dedicated infrastructure.',
  },
  {
    q: 'Can I integrate Lumina with my existing tools?',
    a: 'Yes. Lumina offers a comprehensive API, native integrations with popular tools like Slack, Notion, Google Workspace, and more. Our Enterprise plan includes custom integration support and SSO with your identity provider.',
  },
  {
    q: 'What kind of tasks can Lumina handle?',
    a: 'Lumina excels at knowledge-intensive tasks: market research, competitive analysis, academic research, investment thesis creation, strategic planning, report generation, data analysis, and any multi-step research workflow that requires depth and accuracy.',
  },
  {
    q: 'How do I get started?',
    a: 'Create a free account and immediately start using our pre-built agent templates. No setup, no configuration. As you grow, you can customize agents, create workflows, and invite team members. The Professional plan includes a 14-day free trial.',
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Frequently Asked{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">Questions</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="liquid-glass rounded-2xl px-5 border border-white/5 data-[state=open]:border-cyan-500/20 transition-all"
              >
                <AccordionTrigger className="text-sm md:text-base font-medium text-white hover:no-underline py-5 hover:text-white/80">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-white/50 leading-relaxed pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};
