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
  { title: 'Notes', url: '/notes-generator' },
  { title: 'Quest', url: '/quest' },
  { title: 'Doubt Solver', url: '/doubt-solver' },
  { title: 'Audio Analysis', url: '/audio-analysis' },
  { title: 'YouTube Summary', url: '/youtube-summary' },
  { title: 'Note to Quiz', url: '/note-to-quiz' },
  { title: 'Quick Study', url: '/quick-study' },
  { title: 'Study Planner', url: '/study-planner' },
  { title: 'Focus Mode', url: '/focus-mode' },
  { title: 'Weakness Radar', url: '/weakness-radar' },
  { title: 'Flowcharts', url: '/flowcharts' },
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
      {/* Top Nav — Apple vibrancy style */}
      <nav className="sticky top-0 z-50 vibrancy border-b border-border/10">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="h-12 flex items-center justify-between">
            {/* Logo */}
            <NavLink to="/" end className="flex items-center gap-2.5 flex-shrink-0 group" activeClassName="">
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-display font-semibold text-sm text-foreground tracking-tight hidden sm:inline">
                Lumina
              </span>
            </NavLink>

            {/* Center Nav */}
            <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center px-4 min-w-0">
              {primaryNav.map(item => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === '/'}
                  className="px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg whitespace-nowrap"
                  activeClassName="text-foreground bg-muted/40"
                >
                  {item.title}
                </NavLink>
              ))}

              {/* More Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  onBlur={() => setTimeout(() => setMoreOpen(false), 200)}
                  className={`px-3 py-1.5 text-[13px] font-medium transition-all duration-200 rounded-lg flex items-center gap-1 whitespace-nowrap ${
                    isMoreActive ? 'text-foreground bg-muted/40' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  More <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${moreOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {moreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                      className="absolute top-full right-0 mt-2 w-56 rounded-2xl vibrancy border border-border/15 shadow-2xl py-1.5 overflow-hidden"
                    >
                      {moreNav.map(item => (
                        <NavLink
                          key={item.url}
                          to={item.url}
                          className="block px-4 py-2.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all duration-150"
                          activeClassName="text-foreground bg-muted/15"
                        >
                          {item.title}
                        </NavLink>
                      ))}
                      <div className="border-t border-border/15 mt-1.5 pt-1.5">
                        <button
                          onClick={signOut}
                          className="w-full text-left px-4 py-2.5 text-[13px] text-destructive hover:bg-destructive/8 transition-all duration-150"
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
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/6 border border-primary/12 hover:bg-primary/10 transition-all duration-250"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <Clock className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary tabular-nums tracking-tight">
                  {timerMins}:{String(timerSecs).padStart(2, '0')}
                </span>
              </button>

              {profile && (
                <div className="hidden sm:flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs">
                    <Flame className="w-3.5 h-3.5 text-warning" />
                    <span className="text-warning font-semibold tabular-nums">{profile.streak_days}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Coins className="w-3.5 h-3.5 text-xp" />
                    <span className="text-xp font-semibold tabular-nums">{profile.coins}</span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-muted overflow-hidden border border-border/20 transition-transform duration-300 hover:scale-110">
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
                className="md:hidden p-1.5 text-muted-foreground hover:text-foreground transition-all duration-200"
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
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="md:hidden overflow-hidden border-t border-border/10"
            >
              <div className="max-w-[1400px] mx-auto px-6 py-3 space-y-0.5">
                {[...primaryNav, ...moreNav].map(item => (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    end={item.url === '/'}
                    className="block px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-all duration-150 rounded-xl"
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
                      <span className="text-warning font-semibold">{profile.streak_days}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Coins className="w-3.5 h-3.5 text-xp" />
                      <span className="text-xp font-semibold">{profile.coins}</span>
                    </div>
                  </div>
                )}
                <button
                  onClick={signOut}
                  className="w-full text-left px-3 py-2.5 text-sm text-destructive hover:bg-destructive/8 transition-all duration-150 rounded-xl"
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
