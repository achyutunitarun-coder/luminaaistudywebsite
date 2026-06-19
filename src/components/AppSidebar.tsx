import {
  LayoutDashboard, MessageSquare, Sparkles, Brain,
  FileText, HelpCircle, Zap, Calendar, FileAudio,
  NotebookPen, Layers, Gamepad2, Trophy, BarChart3,
  Target, BookOpen, Settings, LogOut, Wand2, Crown,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

const navGroups = [
  {
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard },
      { title: 'AI Tools', url: '/ai-tools', icon: Sparkles },
      { title: 'Brain Hub', url: '/hub', icon: Brain },
    ],
  },
  {
    label: 'Study',
    items: [
      { title: 'AI Chat', url: '/chat', icon: MessageSquare },
      { title: 'Lumina Computer', url: '/lumina-computer', icon: Wand2 },
      { title: 'Documents', url: '/documents', icon: FileText },
      { title: 'Doubt Solver', url: '/doubt-solver', icon: HelpCircle },
      { title: 'Notes Generator', url: '/notes-generator', icon: FileText },
      { title: 'Quick Study', url: '/quick-study', icon: Zap },
      { title: 'Lecture AI', url: '/lecture-ai', icon: FileAudio },
      { title: 'Smart Notebook', url: '/smart-notebook', icon: NotebookPen },
    ],
  },
  {
    label: 'Practice',
    items: [
      { title: 'Tests', url: '/tests', icon: FileText },
      { title: 'Flashcards', url: '/flashcards', icon: Layers },
      { title: 'Game Modes', url: '/game-modes', icon: Gamepad2 },
      { title: 'Quest', url: '/quest', icon: Crown },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { title: 'Performance', url: '/performance', icon: BarChart3 },
      { title: 'Pulse', url: '/pulse', icon: Target },
      { title: 'Weakness Radar', url: '/weakness-radar', icon: BarChart3 },
      { title: 'Leaderboard', url: '/leaderboard', icon: Trophy },
    ],
  },
  {
    label: 'More',
    items: [
      { title: 'Study Planner', url: '/study-planner', icon: Calendar },
      { title: 'Study Session', url: '/study-session', icon: Target },
      { title: 'Resources', url: '/resources', icon: BookOpen },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { profile } = useProfile();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--teal), var(--brand))' }}>
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Lumina</span>
        <div className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ background: 'var(--brand)' }} />
      </div>

      {/* XP Bar */}
      {profile && (
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[11px] mb-1.5">
            <span className="font-semibold" style={{ color: 'var(--amber)' }}>Lv.{profile.level}</span>
            <span style={{ color: 'var(--text-muted)' }}>{profile.xp % 100}/100 XP</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.min((profile.xp % 100), 100)}%`, background: 'var(--brand)' }} />
          </div>
        </div>
      )}

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: 'none' }}>
        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && (
              <div className="nav-section-label">{group.label}</div>
            )}
            {group.items.map((item) => {
              const isActive = item.url === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.url);
              return (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end={item.url === '/'}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <item.icon className="nav-icon" />
                  <span>{item.title}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <NavLink to="/upgrade" className="nav-item">
          <Crown className="nav-icon" style={{ color: 'var(--amber)' }} />
          <span>Upgrade</span>
        </NavLink>
        <NavLink to="/settings" className="nav-item">
          <Settings className="nav-icon" />
          <span>Settings</span>
        </NavLink>
        <button onClick={signOut} className="nav-item w-full text-left" style={{ background: 'none', border: 'none' }}>
          <LogOut className="nav-icon" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
