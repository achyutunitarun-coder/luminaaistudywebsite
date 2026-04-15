import { memo } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { NavLink } from '@/components/NavLink';
import {
  ArrowUpCircle,
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  ClipboardList,
  Clock,
  Coins,
  FileText,
  Flame,
  Gamepad2,
  HelpCircle,
  Layers,
  LogOut,
  MessageSquare,
  Mic,
  PenTool,
  Settings,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';

type Profile = Tables<'profiles'>;

type SidebarContentProps = {
  collapsed: boolean;
  isMobile?: boolean;
  profile: Profile | null;
  levelProgress: number;
  timerMins: number;
  timerSecs: number;
  pathname: string;
  onCloseMobile: () => void;
  onNavigateStudySession: () => void;
  onSignOut: () => void | Promise<void>;
};

const sidebarSections = [
  {
    label: 'Main',
    items: [
      { title: 'Dashboard', url: '/', icon: BarChart3 },
      { title: 'AI Tools', url: '/ai-tools', icon: Sparkles },
      { title: 'Brain Hub', url: '/hub', icon: Brain },
    ],
  },
  {
    label: 'Study',
    items: [
      { title: 'AI Chat', url: '/chat', icon: MessageSquare },
      { title: 'Doubt Solver', url: '/doubt-solver', icon: HelpCircle },
      { title: 'Notes Generator', url: '/notes-generator', icon: FileText },
      { title: 'Quick Study', url: '/quick-study', icon: Zap },
      { title: 'Guided Lesson', url: '/guided-lesson', icon: GraduationCap },
      { title: 'Lecture AI', url: '/lecture-ai', icon: Mic },
      { title: 'Smart Notebook', url: '/smart-notebook', icon: PenTool },
      { title: 'Note to Quiz', url: '/note-to-quiz', icon: ClipboardList },
    ],
  },
  {
    label: 'Practice',
    items: [
      { title: 'Tests', url: '/tests', icon: Target },
      { title: 'Flashcards', url: '/flashcards', icon: Layers },
      { title: 'Game Modes', url: '/game-modes', icon: Swords },
      { title: 'Quest', url: '/quest', icon: Gamepad2 },
      { title: 'Study Squads', url: '/squad', icon: Trophy },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { title: 'Performance', url: '/performance', icon: BarChart3 },
      { title: 'Pulse', url: '/pulse', icon: BarChart3 },
      { title: 'Weakness Radar', url: '/weakness-radar', icon: Brain },
      { title: 'Leaderboard', url: '/leaderboard', icon: Trophy },
    ],
  },
  {
    label: 'More',
    items: [
      { title: 'Study Planner', url: '/study-planner', icon: Calendar },
      { title: 'Study Session', url: '/study-session', icon: Clock },
      { title: 'Resources', url: '/resources', icon: BookOpen },
      { title: 'Upgrade', url: '/upgrade', icon: ArrowUpCircle },
      { title: 'Settings', url: '/settings', icon: Settings },
    ],
  },
] as const;

type SidebarNavProps = {
  collapsed: boolean;
  isMobile: boolean;
  pathname: string;
  onCloseMobile: () => void;
};

const SidebarNav = memo(({ collapsed, isMobile, pathname, onCloseMobile }: SidebarNavProps) => (
  <nav
    className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 space-y-4 pb-2"
    style={{ WebkitOverflowScrolling: 'touch' }}
  >
    {sidebarSections.map((section) => (
      <div key={section.label}>
        {(!collapsed || isMobile) && (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold px-3 mb-1.5">
            {section.label}
          </p>
        )}
        <div className="space-y-0.5">
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.url;

            return (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.url === '/'}
                onClick={() => {
                  if (isMobile) onCloseMobile();
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 group ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/15'
                } ${collapsed && !isMobile ? 'justify-center px-2.5' : ''}`}
                activeClassName=""
              >
                <Icon
                  className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
                    active ? 'text-primary' : 'group-hover:text-foreground'
                  }`}
                />
                {(!collapsed || isMobile) && <span>{item.title}</span>}
                {active && (!collapsed || isMobile) && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    ))}
  </nav>
));

SidebarNav.displayName = 'SidebarNav';

export const AppSidebarContent = memo(
  ({
    collapsed,
    isMobile = false,
    profile,
    levelProgress,
    timerMins,
    timerSecs,
    pathname,
    onCloseMobile,
    onNavigateStudySession,
    onSignOut,
  }: SidebarContentProps) => (
    <div className="flex flex-col h-full overflow-hidden">
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

      {(!collapsed || isMobile) && profile && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="liquid-glass-subtle rounded-xl p-3">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-primary font-bold">Lv.{profile.level}</span>
              <span className="text-muted-foreground tabular-nums">{profile.xp} XP</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full gradient-primary transition-[width] duration-700 ease-out"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <SidebarNav
        collapsed={collapsed}
        isMobile={isMobile}
        pathname={pathname}
        onCloseMobile={onCloseMobile}
      />

      {(!collapsed || isMobile) && profile && (
        <div className="px-4 pb-3 space-y-2 flex-shrink-0">
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
          <button
            onClick={onNavigateStudySession}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl liquid-glass-subtle text-xs hover:border-primary/20 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <Clock className="w-3 h-3 text-primary" />
            <span className="text-primary font-medium tabular-nums">
              {timerMins}:{String(timerSecs).padStart(2, '0')}
            </span>
          </button>
        </div>
      )}

      <div className="px-3 pb-4 pt-2 border-t border-border/10 mt-2 flex-shrink-0">
        <button
          onClick={onSignOut}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all w-full ${
            collapsed ? 'justify-center px-2.5' : ''
          }`}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  ),
);

AppSidebarContent.displayName = 'AppSidebarContent';
