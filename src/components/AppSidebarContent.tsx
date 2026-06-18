import { memo } from "react";
import { motion } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";
import { NavLink } from "@/components/NavLink";
import {
  MessageSquare, FileText, Layers, HelpCircle,
  BarChart3, Trophy, Settings, LogOut, Sparkles, Brain,
} from "lucide-react";

type Profile = Tables<"profiles">;

type Props = {
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

// Consolidated navigation — 3 sections, 8 items total
const navSections = [
  {
    items: [
      { title: "Chat", url: "/chat", icon: MessageSquare, desc: "AI study assistant" },
      { title: "Notes", url: "/notes-generator", icon: FileText, desc: "Generate study notes" },
      { title: "Tests", url: "/tests", icon: Layers, desc: "Practice exams" },
      { title: "Doubts", url: "/doubt-solver", icon: HelpCircle, desc: "Get help" },
    ],
  },
  {
    items: [
      { title: "Performance", url: "/performance", icon: BarChart3, desc: "Track progress" },
      { title: "Leaderboard", url: "/leaderboard", icon: Trophy, desc: "Compete" },
    ],
  },
  {
    items: [
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

const SidebarNav = memo(({ collapsed, isMobile, pathname, onCloseMobile }: {
  collapsed: boolean; isMobile: boolean; pathname: string; onCloseMobile: () => void;
}) => (
  <nav className="flex-1 min-h-0 overflow-y-auto px-3 pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
    {navSections.map((section, si) => (
      <div key={si} className={si > 0 ? "mt-4" : ""}>
        <div className="space-y-0.5">
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url));
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.url === "/"}
                onClick={() => { if (isMobile) onCloseMobile(); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 group ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                } ${collapsed && !isMobile ? "justify-center px-2.5" : ""}`}
                activeClassName=""
              >
                <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${active ? "text-primary" : "group-hover:text-foreground"}`} />
                {(!collapsed || isMobile) && (
                  <span className="flex-1 truncate">{item.title}</span>
                )}
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
SidebarNav.displayName = "SidebarNav";

export const AppSidebarContent = memo(({
  collapsed, isMobile = false, profile, levelProgress, timerMins, timerSecs,
  pathname, onCloseMobile, onNavigateStudySession, onSignOut,
}: Props) => (
  <div className="flex flex-col h-full overflow-hidden">
    {/* Logo */}
    <div className={`flex items-center gap-3 px-4 h-14 flex-shrink-0 ${collapsed && !isMobile ? "justify-center" : ""}`}>
      <motion.div
        whileHover={{ scale: 1.05, rotate: 3 }}
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}
      >
        <Sparkles className="w-4 h-4 text-white" />
      </motion.div>
      {(!collapsed || isMobile) && (
        <span className="font-bold text-base text-foreground tracking-tight">Lumina</span>
      )}
    </div>

    {/* Compact stats bar */}
    {(!collapsed || isMobile) && profile && (
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: "rgba(124,58,237,0.2)", color: "#A78BFA" }}>Lv{profile.level}</div>
          </div>
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${levelProgress}%`, background: "linear-gradient(90deg, #7C3AED, #A78BFA)" }} />
          </div>
          <span className="text-[10px] font-medium tabular-nums" style={{ color: "#8A8AA3" }}>{profile.xp} XP</span>
        </div>
      </div>
    )}

    <SidebarNav collapsed={collapsed} isMobile={isMobile} pathname={pathname} onCloseMobile={onCloseMobile} />

    {/* Footer */}
    <div className="px-3 pb-3 pt-2 border-t border-border/10 flex-shrink-0">
      <button
        onClick={onSignOut}
        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all w-full ${collapsed ? "justify-center px-2.5" : ""}`}
      >
        <LogOut className="w-[18px] h-[18px]" />
        {!collapsed && <span>Sign Out</span>}
      </button>
    </div>
  </div>
));

AppSidebarContent.displayName = "AppSidebarContent";
