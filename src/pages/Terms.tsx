import { Link } from "react-router-dom";
import { Scale, Sparkles, Instagram } from "lucide-react";

const Section = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 md:p-8 shadow-[0_10px_40px_-10px_rgba(20,184,166,0.15)]">
    <div className="flex items-baseline gap-3 mb-3">
      <span className="text-xs font-mono text-teal-400/70">{String(n).padStart(2, "0")}</span>
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', 'Inter', sans-serif" }}>{title}</h2>
    </div>
    <div className="text-[15px] leading-relaxed text-white/75 space-y-3">{children}</div>
  </section>
);

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#050508] text-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-20 w-[600px] h-[600px] rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[140px]" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#050508]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="https://luminaai.co.in" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Lumina</span>
          </a>
          <div className="flex items-center gap-5 text-sm text-white/60">
            <Link to="/privacy" className="hover:text-white transition">Privacy</Link>
            <a href="https://luminaai.co.in" className="hover:text-white transition">Back to app →</a>
          </div>
        </div>
      </nav>

      <header className="max-w-5xl mx-auto px-6 pt-16 pb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/5 px-3 py-1 text-xs text-teal-300 mb-6">
          <Scale className="w-3.5 h-3.5" /> Legal
        </div>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter mb-4" style={{ fontFamily: "'Cabinet Grotesk', 'Inter', sans-serif" }}>
          Terms of Service
        </h1>
        <p className="text-white/50 text-sm">Last updated: June 8, 2026</p>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-24 space-y-5">
        <Section n={1} title="Introduction">
          <p>These Terms govern your use of Lumina AI (luminaai.co.in). By using Lumina, you agree to these Terms. If you disagree, do not use the platform. Lumina is built and operated by its founders from Bangalore, India.</p>
        </Section>
        <Section n={2} title="Eligibility">
          <p>You must be at least 13 years old. Users under 18 need parental or guardian consent. By registering, you confirm eligibility.</p>
        </Section>
        <Section n={3} title="Account Registration">
          <p>Provide accurate, complete information. Maintain confidentiality of login credentials. You are responsible for all activity under your account. Lumina may suspend or terminate accounts violating these Terms.</p>
        </Section>
        <Section n={4} title="Acceptable Use">
          <p>Lumina is for educational purposes. Do NOT: cheat or commit academic dishonesty, upload malicious code, hack or disrupt the platform, generate hateful or discriminatory content, use unauthorised bots or scripts, or violate any laws. Lumina may remove content and suspend violating accounts.</p>
        </Section>
        <Section n={5} title="Intellectual Property">
          <p>Lumina's code, design, branding, and content are owned by the founders. AI-generated content is for personal educational use. You retain ownership of content you upload. You grant Lumina a limited licence to process uploaded content to provide services. Do not reproduce or sell Lumina's proprietary content without permission.</p>
        </Section>
        <Section n={6} title="Subscriptions and Payments">
          <p>Free tier (Basic) and paid plans (Ultimate, PRO+). Billed monthly or annually through Dodo Payments. Prices in Indian Rupees (₹), subject to change with notice. Subscription fees are non-refundable unless required by law. Cancel anytime — takes effect at billing period end. Credit packs are one-time purchases; credits never expire.</p>
        </Section>
        <Section n={7} title="Free Trial and Credits">
          <p>Basic plan provides limited access. Lumina may modify free tier limits. Credits consumed for Artifact downloads and Lecture AI processing. Monthly credits reset each billing cycle. Purchased credits never expire. Rollover limits apply per plan.</p>
        </Section>
        <Section n={8} title="Third-Party Services">
          <p>OpenRouter for AI models. Gmail, Calendar, Drive, Notion through their respective APIs. Lumina not responsible for third-party availability, accuracy, or performance. Connected services subject to those providers' terms.</p>
        </Section>
        <Section n={9} title="Disclaimer of Warranties">
          <p>Lumina is provided "as is" and "as available." No guarantee AI content is 100% accurate. Independently verify critical academic information. No guarantee of uninterrupted access.</p>
        </Section>
        <Section n={10} title="Limitation of Liability">
          <p>Lumina and its founders are not liable for indirect, incidental, or consequential damages. Total liability limited to amount paid in the 12 months preceding the claim. Not liable for academic outcomes or decisions based on AI content.</p>
        </Section>
        <Section n={11} title="Termination">
          <p>You may terminate your account anytime. Lumina may suspend or terminate for Terms violation. Access ceases upon termination. Data may be retained as required by law.</p>
        </Section>
        <Section n={12} title="Changes to Terms">
          <p>We may modify these Terms. Material changes communicated via email or platform notification. Continued use constitutes acceptance.</p>
        </Section>
        <Section n={13} title="Governing Law">
          <p>Governed by laws of India. Disputes subject to exclusive jurisdiction of courts in Bangalore, Karnataka.</p>
        </Section>
        <Section n={14} title="Contact">
          <p className="flex items-center gap-2"><Instagram className="w-4 h-4 text-teal-300" /> Instagram: <a href="https://www.instagram.com/luminastudyai/" className="text-teal-300 hover:underline">@luminastudyai</a></p>
          <p>Website: <a href="https://luminaai.co.in" className="text-teal-300 hover:underline">luminaai.co.in</a></p>
        </Section>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-white/40">
        © 2026 Lumina AI. All rights reserved. · <a href="https://luminaai.co.in" className="hover:text-white/70">luminaai.co.in</a>
      </footer>
    </div>
  );
}
