import {
  LayoutDashboard, MessageSquare, Sparkles, Brain,
  FileText, HelpCircle, Zap, Calendar, FileAudio,
  NotebookPen, Layers, Gamepad2, Trophy, BarChart3,
  Target, BookOpen, Settings, LogOut, Wand2, Crown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

const navGroups = [
  {
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "AI Tools", url: "/ai-tools", icon: Sparkles },
      { title: "Brain Hub", url: "/hub", icon: Brain },
    ],
  },
  {
    label: "Study",
    items: [
      { title: "AI Chat", url: "/chat", icon: MessageSquare },
      { title: "Lumina Computer", url: "/lumina-computer", icon: Wand2 },
      { title: "Documents", url: "/documents", icon: FileText },
      { title: "Doubt Solver", url: "/doubt-solver", icon: HelpCircle },
      { title: "Notes Generator", url: "/notes-generator", icon: FileText },
      { title: "Quick Study", url: "/quick-study", icon: Zap },
      { title: "Lecture AI", url: "/lecture-ai", icon: FileAudio },
      { title: "Smart Notebook", url: "/smart-notebook", icon: NotebookPen },
    ],
  },
  {
    label: "Practice",
    items: [
      { title: "Tests", url: "/tests", icon: FileText },
      { title: "Flashcards", url: "/flashcards", icon: Layers },
      { title: "Game Modes", url: "/game-modes", icon: Gamepad2 },
      { title: "Quest", url: "/quest", icon: Crown },
    ],
  },
  {
    label: "Analytics",
    items: [
      { title: "Performance", url: "/performance", icon: BarChart3 },
      { title: "Pulse", url: "/pulse", icon: Target },
      { title: "Weakness Radar", url: "/weakness-radar", icon: BarChart3 },
      { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
    ],
  },
  {
    label: "More",
    items: [
      { title: "Study Planner", url: "/study-planner", icon: Calendar },
      { title: "Study Session", url: "/study-session", icon: Target },
      { title: "Resources", url: "/resources", icon: BookOpen },
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
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="sidebar-logo-text">Lumina</span>
        <div className="sidebar-logo-dot" />
      </div>

      {/* XP Bar */}
      {profile && (
        <div className="sidebar-xp">
          <div className="sidebar-xp-row">
            <span className="sidebar-xp-level">Lv.{profile.level}</span>
            <span className="sidebar-xp-val">{profile.xp % 100}/100 XP</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.min((profile.xp % 100), 100)}%` }} />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar-nav">
        {navGroups.map((group, gi) => (
          <div key={gi} className="sidebar-group">
            {group.label && <div className="sidebar-group-label">{group.label}</div>}
            {group.items.map((item) => {
              const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
              return (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end
                  className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                  title={item.title}
                >
                  <item.icon className="sidebar-nav-icon" />
                  <span className="sidebar-nav-text">{item.title}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <NavLink to="/upgrade" className="sidebar-nav-item" title="Upgrade">
          <Crown className="sidebar-nav-icon" />
          <span className="sidebar-nav-text">Upgrade</span>
        </NavLink>
        <NavLink to="/settings" className="sidebar-nav-item" title="Settings">
          <Settings className="sidebar-nav-icon" />
          <span className="sidebar-nav-text">Settings</span>
        </NavLink>
        <button onClick={signOut} className="sidebar-nav-item sidebar-nav-button" title="Sign Out">
          <LogOut className="sidebar-nav-icon" />
          <span className="sidebar-nav-text">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
