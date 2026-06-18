import { Sparkles, MessageSquare, FileText, Layers, HelpCircle, BarChart3, Trophy, Settings, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar } from "@/components/ui/sidebar";

const mainItems = [
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Notes", url: "/notes-generator", icon: FileText },
  { title: "Tests", url: "/tests", icon: Layers },
  { title: "Doubts", url: "/doubt-solver", icon: HelpCircle },
  { title: "Performance", url: "/performance", icon: BarChart3 },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const { profile } = useProfile();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent className="bg-sidebar">
        <div className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)", boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}>
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-lg text-foreground">Lumina</span>}
        </div>

        {!collapsed && profile && (
          <div className="px-4 pb-3">
            <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-bold" style={{ color: "#A78BFA" }}>Lv.{profile.level}</span>
                <span className="tabular-nums" style={{ color: "#8A8AA3" }}>{profile.xp} XP</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((profile.xp % 100), 100)}%`, background: "linear-gradient(90deg, #7C3AED, #A78BFA)" }} />
              </div>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"} className="hover:bg-white/[0.04] transition-colors" activeClassName="bg-primary/10 text-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar p-3">
        <SidebarMenuButton onClick={signOut} className="hover:bg-destructive/10 hover:text-destructive transition-colors w-full">
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && <span>Sign Out</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
