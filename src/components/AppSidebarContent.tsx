import { memo } from "react";
import { NavLink } from "@/components/NavLink";
import {
  BarChart3, Sparkles, Brain, MessageSquare, Cpu, FileText,
  HelpCircle, Zap, Mic, PenTool, Target, Layers, Swords,
  Gamepad2, Calendar, Clock, BookOpen, ArrowUpCircle, Settings,
  LogOut, Flame, Trophy, Crown,
} from "lucide-react";

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
};

const navGroups = [
  {
    label: "Main",
    items: [
      { title: "Dashboard", url: "/", icon: BarChart3 },
      { title: "AI Tools", url: "/ai-tools", icon: Sparkles },
      { title: "Brain Hub", url: "/hub", icon: Brain },
    ],
  },
  {
    label: "Study",
    items: [
      { title: "AI Chat", url: "/chat", icon: MessageSquare },
      { title: "Lumina Computer", url: "/computer", icon: Cpu },
      { title: "Documents", url: "/documents", icon: FileText },
      { title: "Doubt Solver", url: "/doubt-solver", icon: HelpCircle },
      { title: "Notes Generator", url: "/notes-generator", icon: FileText },
      { title: "Quick Study", url: "/quick-study", icon: Zap },
      { title: "Lecture AI", url: "/lecture-ai", icon: Mic },
      { title: "Smart Notebook", url: "/smart-notebook", icon: PenTool },
    ],
  },
  {
    label: "Practice",
    items: [
      { title: "Tests", url: "/tests", icon: Target },
      { title: "Flashcards", url: "/flashcards", icon: Layers },
      { title: "Game Modes", url: "/game-modes", icon: Swords },
      { title: "Quest", url: "/quest", icon: Gamepad2 },
    ],
  },
  {
    label: "Analytics",
    items: [
      { title: "Performance", url: "/performance", icon: BarChart3 },
      { title: "Pulse", url: "/pulse", icon: BarChart3 },
      { title: "Weakness Radar", url: "/weakness-radar", icon: Brain },
      { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
    ],
  },
  {
    label: "More",
    items: [
      { title: "Study Planner", url: "/study-planner", icon: Calendar },
      { title: "Study Session", url: "/study-session", icon: Clock },
      { title: "Resources", url: "/resources", icon: BookOpen },
      { title: "Upgrade", url: "/upgrade", icon: ArrowUpCircle },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export const AppSidebarContent = memo(
  ({ profile, pathname, onCloseMobile, onSignOut, collapsed, isMobile }: SidebarContentProps) => {
    const levelProgress = profile ? Math.min((profile.xp || 0) % 100, 100) : 0;
    const isCollapsed = collapsed && !isMobile;

    return (
      <div className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          {!isCollapsed && (
            <>
              <span className="sidebar-logo-text">Lumina</span>
              <div className="sidebar-logo-dot" />
            </>
          )}
        </div>

        {/* XP Bar — hidden when collapsed */}
        {profile && !isCollapsed && (
          <div className="sidebar-xp">
            <div className="sidebar-xp-row">
              <span className="sidebar-xp-level">Lv.{profile.level || 1}</span>
              <span className="sidebar-xp-val">{profile.xp || 0} XP</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${levelProgress}%` }} />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav">
          {navGroups.map((group, gi) => (
            <div key={gi} className="sidebar-group">
              {group.label && !isCollapsed && (
                <div className="sidebar-group-label">{group.label}</div>
              )}
              {group.items.map((item) => {
                const active = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
                return (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    end={item.url === "/"}
                    onClick={onCloseMobile}
                    className={`sidebar-nav-item ${active ? "active" : ""}`}
                    title={item.title}
                  >
                    <item.icon className="sidebar-nav-icon" />
                    {!isCollapsed && <span className="sidebar-nav-text">{item.title}</span>}
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
            {!isCollapsed && <span className="sidebar-nav-text">Upgrade</span>}
          </NavLink>
          <NavLink to="/settings" className="sidebar-nav-item" title="Settings">
            <Settings className="sidebar-nav-icon" />
            {!isCollapsed && <span className="sidebar-nav-text">Settings</span>}
          </NavLink>
          <button onClick={onSignOut} className="sidebar-nav-item sidebar-nav-button" title="Sign Out">
            <LogOut className="sidebar-nav-icon" />
            {!isCollapsed && <span className="sidebar-nav-text">Sign Out</span>}
          </button>
        </div>
      </div>
    );
  },
);

AppSidebarContent.displayName = "AppSidebarContent";
