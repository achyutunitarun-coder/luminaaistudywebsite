import { ReactNode, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Flame, Coins, Sparkles, LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const primaryNav = [
  { title: 'Dashboard', url: '/' },
  { title: 'Study Session', url: '/study-session' },
  { title: 'Tests', url: '/tests' },
  { title: 'AI Chat', url: '/chat' },
  { title: 'Flashcards', url: '/flashcards' },
];

const moreNav = [
  { title: 'Doubt Solver', url: '/doubt-solver' },
  { title: 'Note to Quiz', url: '/note-to-quiz' },
  { title: 'Quick Study', url: '/quick-study' },
  { title: 'Study Planner', url: '/study-planner' },
  { title: 'Focus Mode', url: '/focus-mode' },
  { title: 'Lumina Quest', url: '/quest' },
  { title: 'Weakness Radar', url: '/weakness-radar' },
  { title: 'Settings', url: '/settings' },
];

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { profile } = useProfile();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  const isMoreActive = moreNav.some(item => location.pathname === item.url);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="h-12 flex items-center justify-between">
            {/* Logo */}
            <NavLink to="/" end className="flex items-center gap-2 flex-shrink-0" activeClassName="">
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-sm text-foreground tracking-wide hidden sm:inline">
                LUMINA
              </span>
            </NavLink>

            {/* Center Nav - Desktop */}
            <div className="hidden lg:flex items-center gap-0.5">
              {primaryNav.map(item => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === '/'}
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md"
                  activeClassName="text-foreground"
                >
                  {item.title}
                </NavLink>
              ))}

              {/* More Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  onBlur={() => setTimeout(() => setMoreOpen(false), 200)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-md flex items-center gap-1 ${
                    isMoreActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  More <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {moreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-1.5 w-52 rounded-xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl py-1.5 overflow-hidden"
                    >
                      {moreNav.map(item => (
                        <NavLink
                          key={item.url}
                          to={item.url}
                          className="block px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          activeClassName="text-foreground bg-muted/30"
                        >
                          {item.title}
                        </NavLink>
                      ))}
                      <div className="border-t border-border/50 mt-1.5 pt-1.5">
                        <button
                          onClick={signOut}
                          className="w-full text-left px-4 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {profile && (
                <div className="hidden sm:flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs">
                    <Flame className="w-3.5 h-3.5 text-warning" />
                    <span className="text-warning font-medium">{profile.streak_days}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Coins className="w-3.5 h-3.5 text-xp" />
                    <span className="text-xp font-medium">{profile.coins}</span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-muted overflow-hidden border border-border/50">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full gradient-primary" />
                    )}
                  </div>
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden overflow-hidden border-t border-border/30"
            >
              <div className="max-w-[1400px] mx-auto px-6 py-3 space-y-0.5">
                {[...primaryNav, ...moreNav].map(item => (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    end={item.url === '/'}
                    className="block px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg"
                    activeClassName="text-foreground bg-muted/30"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.title}
                  </NavLink>
                ))}
                {profile && (
                  <div className="flex items-center gap-4 px-3 py-2.5 sm:hidden">
                    <div className="flex items-center gap-1 text-xs">
                      <Flame className="w-3.5 h-3.5 text-warning" />
                      <span className="text-warning font-medium">{profile.streak_days}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Coins className="w-3.5 h-3.5 text-xp" />
                      <span className="text-xp font-medium">{profile.coins}</span>
                    </div>
                  </div>
                )}
                <button
                  onClick={signOut}
                  className="w-full text-left px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors rounded-lg"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
