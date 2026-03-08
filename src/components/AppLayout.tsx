import { ReactNode, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { Flame, Coins, Sparkles, LogOut, Menu, X, ChevronDown, Clock } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const primaryNav = [
  { title: 'Dashboard', url: '/' },
  { title: 'Pulse', url: '/pulse' },
  { title: 'Study Session', url: '/study-session' },
  { title: 'Tests', url: '/tests' },
  { title: 'AI Chat', url: '/chat' },
];

const moreNav = [
  { title: 'Flashcards', url: '/flashcards' },
  { title: 'Doubt Solver', url: '/doubt-solver' },
  { title: 'Notes Generator', url: '/notes-generator' },
  { title: 'Audio Analysis', url: '/audio-analysis' },
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
  const { seconds } = useStudyTimer();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isMoreActive = moreNav.some(item => location.pathname === item.url);
  const timerMins = Math.floor(seconds / 60);
  const timerSecs = seconds % 60;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-background/80 border-b border-border/20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="h-12 flex items-center justify-between">
            {/* Logo */}
            <NavLink to="/" end className="flex items-center gap-2.5 flex-shrink-0" activeClassName="">
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-display font-semibold text-sm text-foreground tracking-tight hidden sm:inline">
                Lumina
              </span>
            </NavLink>

            {/* Center Nav */}
            <div className="hidden lg:flex items-center gap-0.5">
              {primaryNav.map(item => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === '/'}
                  className="px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg"
                  activeClassName="text-foreground bg-muted/30"
                >
                  {item.title}
                </NavLink>
              ))}

              {/* More Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  onBlur={() => setTimeout(() => setMoreOpen(false), 200)}
                  className={`px-3 py-1.5 text-[13px] font-medium transition-colors rounded-lg flex items-center gap-1 ${
                    isMoreActive ? 'text-foreground bg-muted/30' : 'text-muted-foreground hover:text-foreground'
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
                      className="absolute top-full right-0 mt-1.5 w-56 rounded-2xl bg-card/95 backdrop-blur-2xl border border-border/30 shadow-2xl py-2 overflow-hidden"
                    >
                      {moreNav.map(item => (
                        <NavLink
                          key={item.url}
                          to={item.url}
                          className="block px-4 py-2.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                          activeClassName="text-foreground bg-muted/20"
                        >
                          {item.title}
                        </NavLink>
                      ))}
                      <div className="border-t border-border/30 mt-2 pt-2">
                        <button
                          onClick={signOut}
                          className="w-full text-left px-4 py-2.5 text-[13px] text-destructive hover:bg-destructive/10 transition-colors"
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
              {/* Live Timer Pill */}
              <button
                onClick={() => navigate('/pulse')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <Clock className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary tabular-nums">
                  {timerMins}:{String(timerSecs).padStart(2, '0')}
                </span>
              </button>

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
                  <div className="w-7 h-7 rounded-full bg-muted overflow-hidden border border-border/30">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full gradient-primary" />
                    )}
                  </div>
                </div>
              )}

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
              className="lg:hidden overflow-hidden border-t border-border/20"
            >
              <div className="max-w-[1400px] mx-auto px-6 py-3 space-y-0.5">
                {[...primaryNav, ...moreNav].map(item => (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    end={item.url === '/'}
                    className="block px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg"
                    activeClassName="text-foreground bg-muted/20"
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
