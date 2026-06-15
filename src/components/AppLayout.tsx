import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { ChevronLeft, ChevronRight, Flame, Menu, Sparkles, X, Brain } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSidebarContent } from '@/components/AppSidebarContent';

// Routes that need the full main area (no max-width cap, no padding) so the
// in-page workspace (Computer, Chat, etc.) can render edge-to-edge without
// the sidebar appearing to crowd or cover its content.
const FULL_BLEED_ROUTES = ['/computer', '/chat', '/lecture-ai', '/smart-notebook'];
const SIDEBAR_W_EXPANDED = 240;
const SIDEBAR_W_COLLAPSED = 72;

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { profile } = useProfile();
  const { signOut } = useAuth();
  const { seconds } = useStudyTimer();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const timerMins = Math.floor(seconds / 60);
  const timerSecs = seconds % 60;
  const levelProgress = profile ? ((profile.xp % 100) / 100) * 100 : 0;

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((current) => !current), []);
  const toggleCollapsed = useCallback(() => setCollapsed((current) => !current), []);
  const navigateStudySession = useCallback(() => navigate('/study-session'), [navigate]);

  // Expose the live sidebar width as a CSS variable so any descendant page
  // (e.g. fixed/full-bleed workspaces) can offset itself precisely instead of
  // hard-coding 72/240 and ending up underneath the sidebar.
  const sidebarWidth = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED;
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--app-sidebar-w', `${sidebarWidth}px`);
    return () => {
      root.style.removeProperty('--app-sidebar-w');
    };
  }, [sidebarWidth]);

  const isFullBleed = FULL_BLEED_ROUTES.some(
    (r) => location.pathname === r || location.pathname.startsWith(`${r}/`),
  );

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">

      {/* Ambient Background — Living Cosmos */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-[0.03] blur-[120px] bg-primary -top-40 -left-40 animate-pulse-glow" />
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.025] blur-[100px] bg-secondary bottom-0 right-0 animate-pulse-glow" style={{ animationDelay: '1s' }} />
        <div className="absolute w-[300px] h-[300px] rounded-full opacity-[0.02] blur-[80px] bg-xp top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-float" />
      </div>

      {/* Desktop Sidebar — Navigation Spine */}
      <aside
        className={`hidden md:flex flex-col fixed top-0 left-0 h-screen z-40 transition-all duration-500 ease-out ${
          collapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
        style={{
          background: 'linear-gradient(180deg, hsl(230 25% 7% / 0.97) 0%, hsl(230 22% 9% / 0.95) 100%)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          borderRight: '1px solid hsl(0 0% 100% / 0.04)',
          boxShadow: '4px 0 24px hsl(0 0% 0% / 0.3)',
        }}
      >
        <AppSidebarContent
          collapsed={collapsed}
          profile={profile}
          levelProgress={levelProgress}
          timerMins={timerMins}
          timerSecs={timerSecs}
          pathname={location.pathname}
          onCloseMobile={closeMobile}
          onNavigateStudySession={navigateStudySession}
          onSignOut={signOut}
        />
        <button
          onClick={toggleCollapsed}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all z-50 shadow-lg"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 border-b border-border/10"
        style={{
          background: 'hsl(230 25% 7% / 0.9)',
          backdropFilter: 'blur(48px) saturate(2)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-sm text-foreground tracking-tight">Lumina</span>
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
          <button onClick={toggleMobile} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
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
              onClick={closeMobile}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-[280px] z-50 border-r border-border/10"
              style={{
                background: 'linear-gradient(180deg, hsl(230 25% 7% / 0.98) 0%, hsl(230 22% 9% / 0.96) 100%)',
                backdropFilter: 'blur(40px)',
              }}
            >
              <AppSidebarContent
                collapsed={collapsed}
                isMobile
                profile={profile}
                levelProgress={levelProgress}
                timerMins={timerMins}
                timerSecs={timerSecs}
                pathname={location.pathname}
                onCloseMobile={closeMobile}
                onNavigateStudySession={navigateStudySession}
                onSignOut={signOut}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content — Primary Intelligence Zone */}
      <main className={`flex-1 overflow-auto transition-all duration-500 ease-out relative z-10 ${collapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'} mt-14 md:mt-0`}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
