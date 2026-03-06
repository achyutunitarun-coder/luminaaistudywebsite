import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useProfile } from '@/hooks/useProfile';
import { Flame, Coins } from 'lucide-react';

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { profile } = useProfile();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/50 px-4 glass">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            {profile && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm">
                  <Flame className="w-4 h-4 text-warning" />
                  <span className="text-warning font-semibold">{profile.streak_days}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Coins className="w-4 h-4 text-xp" />
                  <span className="text-xp font-semibold">{profile.coins}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-muted overflow-hidden border-2 border-primary/50">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full gradient-primary" />
                  )}
                </div>
              </div>
            )}
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
