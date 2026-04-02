import { ReactNode, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useSubscription } from '@/hooks/useSubscription';
import { Flame, Coins, Sparkles, LogOut, Menu, X, Clock, Crown, Home, BookOpen, Gamepad2, FolderOpen, UserCircle } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const navCategories = [
  { title: 'Dashboard', url: '/', icon: Home },
  { title: 'Study', url: '/study-session', icon: BookOpen },
  { title: 'Games', url: '/game-modes', icon: Gamepad2 },
  { title: 'Resources', url: '/resources', icon: FolderOpen },
  { title: 'Profile', url: '/settings', icon: UserCircle },
];

// Study sub-routes that should highlight "Study" in nav
const studyRoutes = ['/study-session', '/chat', '/doubt-solver', '/tests', '/flashcards', '/notes-generator', '/note-to-quiz', '/quick-study', '/weakness-radar', '/study-planner', '/lecture-ai', '/smart-notebook', '/pulse'];
// Game sub-routes
const gameRoutes = ['/game-modes', '/quest', '/leaderboard'];
// Resource sub-routes
const resourceRoutes = ['/resources'];
// Profile sub-routes
const profileRoutes = ['/settings', '/upgrade'];

function isRouteActive(url: string, pathname: string) {
  if (url === '/') return pathname === '/';
  if (url === '/study-session') return studyRoutes.includes(pathname);
  if (url === '/game-modes') return gameRoutes.includes(pathname);
  if (url === '/resources') return resourceRoutes.includes(pathname);
  if (url === '/settings') return profileRoutes.includes(pathname);
  return pathname === url;
}

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { profile } = useProfile();
  const { signOut } = useAuth();
  const { seconds } = useStudyTimer();
  const { isPro } = useSubscription();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const timerMins = Math.floor(seconds / 60);
  const timerSecs = seconds % 60;

  const levelProgress = profile ? ((profile.xp % 100) / 100) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 vibrancy border-b border-border/10">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="h-14 flex items-center justify-between">
            {/* Logo */}
            <NavLink to="/" end className="flex items-center gap-2.5 flex-shrink-0 group" activeClassName="">
              <motion.div
                whileHover={{ scale: 1.08, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20"
              >
                <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
              </motion.div>
              <span className="font-display font-bold text-sm text-gradient tracking-tight hidden sm:inline">
                Lumina
              </span>
            </NavLink>

            {/* Center Nav — 5 categories only */}
            <div className="hidden md:flex items-center gap-1 flex-1 justify-center px-4">
              {navCategories.map(item => {
                const Icon = item.icon;
                const active = isRouteActive(item.url, location.pathname);
                return (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    end={item.url === '/'}
                    className={`px-4 py-2 text-[13px] font-medium transition-all duration-200 rounded-xl whitespace-nowrap flex items-center gap-2 ${
                      active ? 'text-foreground bg-muted/40 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
                    }`}
                    activeClassName=""
                  >
                    <Icon className="w-4 h-4" />
                    {item.title}
                  </NavLink>
                );
              })}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-2.5">
              {/* Level badge */}
              {profile && (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass-subtle cursor-pointer"
                  onClick={() => navigate('/settings')}
                >
                  <span className="text-[11px] font-bold text-primary">Lv.{profile.level}</span>
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${levelProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </motion.div>
              )}

              {/* Timer Pill */}
              <motion.button
                onClick={() => navigate('/study-session')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-subtle hover:border-primary/20 transition-all duration-250"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <Clock className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary tabular-nums tracking-tight">
                  {timerMins}:{String(timerSecs).padStart(2, '0')}
                </span>
              </motion.button>

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
                  <div className="w-8 h-8 rounded-full bg-muted overflow-hidden border border-border/20 transition-transform duration-300 hover:scale-110 cursor-pointer" onClick={() => navigate('/settings')}>
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
                {navCategories.map(item => {
                  const Icon = item.icon;
                  const active = isRouteActive(item.url, location.pathname);
                  return (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      end={item.url === '/'}
                      className={`flex items-center gap-3 px-3 py-3 text-sm transition-all duration-150 rounded-xl ${
                        active ? 'text-foreground bg-muted/20' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      activeClassName=""
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon className="w-4.5 h-4.5" />
                      {item.title}
                    </NavLink>
                  );
                })}
                {profile && (
                  <div className="flex items-center gap-4 px-3 py-2.5 sm:hidden">
                    <span className="text-xs font-bold text-primary">Lv.{profile.level}</span>
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
                {!isPro && (
                  <button
                    onClick={() => { navigate('/upgrade'); setMobileOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm font-semibold bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-400 rounded-xl flex items-center gap-2 transition-all duration-200"
                  >
                    <Crown className="w-4 h-4" />
                    <span style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui, sans-serif" }}>Upgrade to Lumina Ultimate</span>
                    <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                  </button>
                )}
                <button
                  onClick={signOut}
                  className="w-full text-left px-3 py-2.5 text-sm text-destructive hover:bg-destructive/8 transition-all duration-150 rounded-xl flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
