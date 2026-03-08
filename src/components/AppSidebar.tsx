import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Layers,
  HelpCircle,
  Gamepad2,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  Calendar,
  Zap,
  Timer,
  Target,
  ClipboardList,
  FileAudio,
  Youtube,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

const mainItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'AI Chat', url: '/chat', icon: MessageSquare },
  { title: 'Study Session', url: '/study-session', icon: Target },
  { title: 'Tests', url: '/tests', icon: FileText },
  { title: 'Flashcards', url: '/flashcards', icon: Layers },
  { title: 'Doubt Solver', url: '/doubt-solver', icon: HelpCircle },
  { title: 'Note to Quiz', url: '/note-to-quiz', icon: ClipboardList },
  { title: 'Quick Study', url: '/quick-study', icon: Zap },
  { title: 'Study Planner', url: '/study-planner', icon: Calendar },
  { title: 'Audio Analysis', url: '/audio-analysis', icon: FileAudio },
  { title: 'Focus Mode', url: '/focus-mode', icon: Timer },
  { title: 'Lumina Quest', url: '/quest', icon: Gamepad2 },
  { title: 'Weakness Radar', url: '/weakness-radar', icon: BarChart3 },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut } = useAuth();
  const { profile } = useProfile();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent className="bg-sidebar">
        {/* Logo */}
        <div className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 glow-primary">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-lg text-foreground text-glow-primary">
              LUMINA
            </span>
          )}
        </div>

        {/* XP Bar */}
        {!collapsed && profile && (
          <div className="px-4 pb-4">
            <div className="glass rounded-lg p-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-xp font-semibold">Level {profile.level}</span>
                <span className="text-muted-foreground">{profile.xp} XP</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full gradient-xp transition-all duration-500"
                  style={{ width: `${Math.min((profile.xp % 100), 100)}%` }}
                />
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
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-sidebar-accent/50 transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-medium glow-primary"
                    >
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
        <SidebarMenuButton
          onClick={signOut}
          className="hover:bg-destructive/10 hover:text-destructive transition-colors w-full"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && <span>Sign Out</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
