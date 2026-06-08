import { Link } from "react-router-dom";
import { Shield, Sparkles, Instagram } from "lucide-react";

const Section = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 md:p-8 shadow-[0_10px_40px_-10px_rgba(20,184,166,0.15)]">
    <div className="flex items-baseline gap-3 mb-3">
      <span className="text-xs font-mono text-teal-400/70">{String(n).padStart(2, "0")}</span>
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', 'Inter', sans-serif" }}>{title}</h2>
    </div>
    <div className="text-[15px] leading-relaxed text-white/75 space-y-3">{children}</div>
  </section>
);

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#050508] text-white" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-20 w-[600px] h-[600px] rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[140px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#050508]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="https://luminaai.co.in" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Lumina</span>
          </a>
          <div className="flex items-center gap-5 text-sm text-white/60">
            <Link to="/terms" className="hover:text-white transition">Terms</Link>
            <a href="https://luminaai.co.in" className="hover:text-white transition">Back to app →</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="max-w-5xl mx-auto px-6 pt-16 pb-12 print:pt-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/5 px-3 py-1 text-xs text-teal-300 mb-6">
          <Shield className="w-3.5 h-3.5" /> Legal
        </div>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter mb-4" style={{ fontFamily: "'Cabinet Grotesk', 'Inter', sans-serif" }}>
          Privacy Policy
        </h1>
        <p className="text-white/50 text-sm">Last updated: June 8, 2026</p>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 pb-24 space-y-5">
        <Section n={1} title="Introduction">
          <p>Lumina AI is an AI-powered study platform. This Privacy Policy explains how we collect, use, and protect your information. By using Lumina, you agree to these practices.</p>
        </Section>

        <Section n={2} title="Information We Collect">
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li><strong className="text-white/90">Account info</strong> — name, email, password.</li>
            <li><strong className="text-white/90">Usage data</strong> — features used, study time, quiz scores, flashcards reviewed.</li>
            <li><strong className="text-white/90">Content you provide</strong> — study notes, uploaded documents, lecture recordings, AI chat messages.</li>
            <li><strong className="text-white/90">Connector data</strong> — Gmail, Calendar, Drive, Notion. Accessed in real-time through your browser. <em>Never stored on our servers.</em></li>
            <li><strong className="text-white/90">Payment info</strong> — processed entirely by Dodo Payments. We never see full card details.</li>
          </ul>
        </Section>

        <Section n={3} title="How We Use Your Information">
          <p>To provide and improve Lumina's AI tools. To personalise your learning (Neural Insight, Weakness Radar, study plans). To communicate about your account. To analyse aggregated, anonymised usage patterns.</p>
          <p className="text-teal-300/90">We do NOT sell your data. We do NOT use your content to train external AI models without consent.</p>
        </Section>

        <Section n={4} title="AI and Machine Learning">
          <p>Lumina uses third-party AI models through OpenRouter. Content submitted to AI chat may be processed by these models. We select providers committed to not retaining user data. Anonymised, aggregated data may be used to fine-tune Lumina's own models.</p>
        </Section>

        <Section n={5} title="Connector Data">
          <p>Gmail, Calendar, Drive, and Notion access your data in real-time through your browser. Lumina acts as a viewer — data is fetched when you request it and discarded after your session. We do <strong>not</strong> store your emails, calendar events, files, or Notion pages. You can disconnect any service at any time.</p>
        </Section>

        <Section n={6} title="Data Storage and Security">
          <p>Account data stored securely with industry-standard encryption. Supabase backend with encryption at rest and in transit. Dodo Payments handles all payment data (PCI-compliant). We apply appropriate security measures against unauthorised access.</p>
        </Section>

        <Section n={7} title="Cookies and Tracking">
          <p>Essential cookies for authentication and session management. localStorage for preferences (theme, connected services, study progress). No third-party tracking or advertising cookies. You can clear localStorage through browser settings.</p>
        </Section>

        <Section n={8} title="Your Rights">
          <p>Access your data, correct inaccuracies, delete your account and data, withdraw service connections. Contact us through Instagram <a href="https://www.instagram.com/luminastudyai/" className="text-teal-300 underline-offset-2 hover:underline">(@luminastudyai)</a> to exercise these rights.</p>
        </Section>

        <Section n={9} title="Children's Privacy">
          <p>Lumina is for users aged 13 and above. We do not knowingly collect data from children under 13. Under-13 accounts will be deleted if discovered.</p>
        </Section>

        <Section n={10} title="Third-Party Services">
          <p>OpenRouter (AI models), Dodo Payments (payments), Supabase (backend), Google APIs (Gmail, Calendar, Drive), Notion API (Notion). Each has its own privacy policy.</p>
        </Section>

        <Section n={11} title="Changes to This Policy">
          <p>We may update this policy. Material changes will be communicated via email or platform notification. Continued use constitutes acceptance.</p>
        </Section>

        <Section n={12} title="Contact">
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
