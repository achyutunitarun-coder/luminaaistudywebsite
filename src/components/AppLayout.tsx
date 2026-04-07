import { type ReactNode, useCallback, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { ChevronLeft, ChevronRight, Flame, Menu, Sparkles, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSidebarContent } from '@/components/AppSidebarContent';

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

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed top-0 left-0 h-screen z-40 border-r border-border/10 transition-all duration-300 ${
          collapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
        style={{ background: 'hsl(230 22% 8% / 0.95)', backdropFilter: 'blur(24px)' }}
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
          <button onClick={toggleMobile} className="p-1.5 text-muted-foreground">
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
              style={{ background: 'hsl(230 22% 8% / 0.98)' }}
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

      {/* Main Content */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${collapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'} mt-14 md:mt-0`}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
