import { memo } from 'react';
import { NavLink } from '@/components/NavLink';
import {
  BarChart3, Sparkles, Brain, MessageSquare, Cpu, FileText,
  HelpCircle, Zap, Mic, PenTool, Target, Layers, Swords,
  Gamepad2, Calendar, Clock, BookOpen, ArrowUpCircle, Settings,
  LogOut, Flame, Trophy, Crown,
} from 'lucide-react';

type Profile = {
  level?: number;
  xp?: number;
  streak_days?: number;
  coins?: number;
};

type SidebarContentProps = {
  profile: Profile | null;
  pathname: string;
  onCloseMobile: () => void;
  onSignOut: () => void | Promise<void>;
  collapsed?: boolean;
  isMobile?: boolean;
  levelProgress?: number;
  timerMins?: number;
  timerSecs?: number;
  onNavigateStudySession?: () => void;
};

const navGroups = [
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
      { title: 'Lumina Computer', url: '/computer', icon: Cpu },
      { title: 'Documents', url: '/documents', icon: FileText },
      { title: 'Doubt Solver', url: '/doubt-solver', icon: HelpCircle },
      { title: 'Notes Generator', url: '/notes-generator', icon: FileText },
      { title: 'Quick Study', url: '/quick-study', icon: Zap },
      { title: 'Lecture AI', url: '/lecture-ai', icon: Mic },
      { title: 'Smart Notebook', url: '/smart-notebook', icon: PenTool },
    ],
  },
  {
    label: 'Practice',
    items: [
      { title: 'Tests', url: '/tests', icon: Target },
      { title: 'Flashcards', url: '/flashcards', icon: Layers },
      { title: 'Game Modes', url: '/game-modes', icon: Swords },
      { title: 'Quest', url: '/quest', icon: Gamepad2 },
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
];

export const AppSidebarContent = memo(
  ({ profile, pathname, onCloseMobile, onSignOut }: SidebarContentProps) => {
    const levelProgress = profile ? Math.min((profile.xp || 0) % 100, 100) : 0;

    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 flex-shrink-0 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--teal), var(--brand))' }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Lumina</span>
          <div className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ background: 'var(--brand)' }} />
        </div>

        {/* XP Bar */}
        {profile && (
          <div className="px-4 py-3 flex-shrink-0 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="font-semibold" style={{ color: 'var(--amber)' }}>Lv.{profile.level || 1}</span>
              <span style={{ color: 'var(--text-muted)' }}>{profile.xp || 0} XP</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${levelProgress}%`, background: 'var(--brand)' }} />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px]">
              <div className="flex items-center gap-1">
                <Flame className="w-3 h-3" style={{ color: '#fb923c' }} />
                <span className="font-semibold tabular-nums" style={{ color: '#fb923c' }}>{profile.streak_days || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Crown className="w-3 h-3" style={{ color: 'var(--amber)' }} />
                <span className="font-semibold tabular-nums" style={{ color: 'var(--amber)' }}>{profile.coins || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="nav-section-label">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.url === '/' ? pathname === '/' : pathname.startsWith(item.url);
                  return (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      end={item.url === '/'}
                      onClick={onCloseMobile}
                      className={`nav-item ${active ? 'active' : ''}`}
                    >
                      <item.icon className="nav-icon" />
                      <span>{item.title}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            onClick={onSignOut}
            className="nav-item w-full text-left"
            style={{ background: 'none', border: 'none' }}
          >
            <LogOut className="nav-icon" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  },
);

AppSidebarContent.displayName = 'AppSidebarContent';
