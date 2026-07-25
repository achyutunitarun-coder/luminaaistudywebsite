import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const footerLinks = {
  Product: ['Features', 'Agents', 'Pricing', 'Integrations', 'Changelog'],
  Solutions: ['Research', 'Analysis', 'Strategy', 'Academic', 'Enterprise'],
  Resources: ['Documentation', 'API Reference', 'Blog', 'Community', 'Tutorials'],
  Company: ['About', 'Careers', 'Blog', 'Press', 'Contact'],
  Legal: ['Privacy', 'Terms', 'Security', 'Cookies', 'GDPR'],
};

const socialLinks = [
  { name: 'X', href: '#' },
  { name: 'LinkedIn', href: '#' },
  { name: 'GitHub', href: '#' },
  { name: 'Discord', href: '#' },
];

export const FooterSection = () => {
  const navigate = useNavigate();

  return (
    <footer className="relative border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-12">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <span className="text-white font-semibold text-lg">Lumina</span>
            </div>
            <p className="text-sm text-white/30 leading-relaxed mb-6 max-w-[200px]">
              The agentic operating system for human potential.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all text-xs font-medium"
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-white/40 hover:text-white/70 transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/20">
            &copy; {new Date().getFullYear()} Lumina. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="text-xs text-white/20 hover:text-white/40 h-auto p-0"
              onClick={() => navigate('/auth')}
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate('/auth')}
              className="text-xs rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white border-0 h-9 px-4 font-semibold"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
};
