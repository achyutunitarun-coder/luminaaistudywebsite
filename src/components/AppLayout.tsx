import { ReactNode, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useSubscription } from '@/hooks/useSubscription';
import {
  LayoutDashboard, FileText, BarChart3, Brain, Target, Settings,
  LogOut, Menu, X, Clock, Flame, Coins, Sparkles, Crown,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const sidebarItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Tests', url: '/tests', icon: FileText },
  { title: 'Analytics', url: '/pulse', icon: BarChart3 },
  { title: 'Brain Hub', url: '/hub', icon: Brain },
  { title: 'Focus Mode', url: '/study-session', icon: Target },
  { title: 'Settings', url: '/settings', icon: Settings },
];

const routeGroups: Record<string, string[]> = {
  '/': ['/'],
  '/tests': ['/tests', '/flashcards', '/note-to-quiz'],
  '/pulse': ['/pulse', '/weakness-radar', '/leaderboard'],
  '/hub': ['/hub', '/ai-tools', '/chat', '/doubt-solver', '/notes-generator', '/quick-study', '/lecture-ai', '/smart-notebook', '/resources', '/flowcharts'],
  '/study-session': ['/study-session', '/study-planner', '/game-modes', '/quest'],
  '/settings': ['/settings', '/upgrade'],
};

function isActive(url: string, pathname: string) {
  const group = routeGroups[url];
  if (group) return group.includes(pathname);
  return pathname === url;
}

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { profile } = useProfile();
  const { signOut } = useAuth();
  const { seconds } = useStudyTimer();
  const { isPro } = useSubscription();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const timerMins = Math.floor(seconds / 60);
  const timerSecs = seconds % 60;
  const levelProgress = profile ? ((profile.xp % 100) / 100) * 100 : 0;

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 h-16 flex-shrink-0 ${collapsed && !isMobile ? 'justify-center' : ''}`}>
        <motion.div
          whileHover={{ scale: 1.08, rotate: 5 }}
          className="w-10 h-10 rounded-2xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20"
        >
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </motion.div>
        {(!collapsed || isMobile) && (
          <span className="font-display font-bold text-lg text-foreground tracking-tight">
            Lumina
          </span>
        )}
      </div>

      {/* XP Bar */}
      {(!collapsed || isMobile) && profile && (
        <div className="px-4 pb-4">
          <div className="liquid-glass-subtle rounded-xl p-3">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-primary font-bold">Lv.{profile.level}</span>
              <span className="text-muted-foreground tabular-nums">{profile.xp} XP</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <motion.div
                className="h-full rounded-full gradient-primary"
                initial={{ width: 0 }}
                animate={{ width: `${levelProgress}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.url, location.pathname);
          return (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === '/'}
              onClick={() => isMobile && setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/15'
              } ${collapsed && !isMobile ? 'justify-center px-2.5' : ''}`}
              activeClassName=""
            >
              <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${active ? 'text-primary' : 'group-hover:text-foreground'}`} />
              {(!collapsed || isMobile) && <span>{item.title}</span>}
              {active && (!collapsed || isMobile) && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Stats */}
      {(!collapsed || isMobile) && profile && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-1.5 text-xs">
              <Flame className="w-3.5 h-3.5 text-warning" />
              <span className="text-warning font-semibold tabular-nums">{profile.streak_days}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Coins className="w-3.5 h-3.5 text-xp" />
              <span className="text-xp font-semibold tabular-nums">{profile.coins}</span>
            </div>
          </div>

          {/* Timer */}
          <button
            onClick={() => navigate('/study-session')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl liquid-glass-subtle text-xs hover:border-primary/20 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <Clock className="w-3 h-3 text-primary" />
            <span className="text-primary font-medium tabular-nums">{timerMins}:{String(timerSecs).padStart(2, '0')}</span>
          </button>
        </div>
      )}

      {/* Sign Out */}
      <div className="px-3 pb-4 pt-2 border-t border-border/10 mt-2">
        <button
          onClick={signOut}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all w-full ${
            collapsed ? 'justify-center px-2.5' : ''
          }`}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed top-0 left-0 h-screen z-40 border-r border-border/10 transition-all duration-300 ${
          collapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
        style={{ background: 'hsl(230 22% 8% / 0.95)', backdropFilter: 'blur(24px)' }}
      >
        <SidebarContent />
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-muted border border-border/20 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-50"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 vibrancy border-b border-border/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-sm text-foreground">Lumina</span>
        </div>
        <div className="flex items-center gap-3">
          {profile && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-primary">Lv.{profile.level}</span>
              <div className="flex items-center gap-1 text-xs">
                <Flame className="w-3 h-3 text-warning" />
                <span className="text-warning font-semibold">{profile.streak_days}</span>
              </div>
            </div>
          )}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 text-muted-foreground">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-[280px] z-50 border-r border-border/10"
              style={{ background: 'hsl(230 22% 8% / 0.98)' }}
            >
              <SidebarContent isMobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${collapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'} mt-14 md:mt-0`}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
