import { useEffect } from 'react';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { AgentDemo } from '@/components/landing/AgentDemo';
import { WorkspacePreview } from '@/components/landing/WorkspacePreview';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { NetworkSection } from '@/components/landing/NetworkSection';
import { TemplatesSection } from '@/components/landing/TemplatesSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { SecuritySection } from '@/components/landing/SecuritySection';
import { FAQSection } from '@/components/landing/FAQSection';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { FooterSection } from '@/components/landing/FooterSection';

const Index = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#050816] overflow-hidden">
      <Header />
      <main>
        <Hero />
        <AgentDemo />
        <WorkspacePreview />
        <Features />
        <HowItWorks />
        <NetworkSection />
        <TemplatesSection />
        <TestimonialsSection />
        <PricingSection />
        <SecuritySection />
        <FAQSection />
        <FinalCTA />
      </main>
      <FooterSection />
    </div>
  );
};

export default Index;
