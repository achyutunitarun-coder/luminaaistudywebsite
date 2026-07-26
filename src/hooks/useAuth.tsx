import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  needsOnboarding: boolean;
  setNeedsOnboarding: (v: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let retries = 0;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    console.log('[Auth] mount session restore');

    function restoreSession() {
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (!isMounted) return;
          if (!session && window.location.hash.includes('access_token=') && retries < 5) {
            retries++;
            setTimeout(restoreSession, 300);
            return;
          }
          setSession(session);
          setUser(session?.user ?? null);
          if (session && window.location.hash.includes('access_token=')) {
            window.location.hash = '';
          }
        })
        .catch((error) => {
          console.error('Auth session restore failed:', error);
          if (!isMounted) return;
          setSession(null);
          setUser(null);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'INITIAL_SESSION') return;

      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(async () => {
          if (!isMounted) return;
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('extra_preferences')
              .eq('user_id', session.user.id)
              .maybeSingle();
            
            const prefs = profile?.extra_preferences;
            let onboarded = false;
            if (prefs) {
              try {
                const parsed = typeof prefs === 'string' ? JSON.parse(prefs) : prefs;
                onboarded = !!parsed?.onboarded;
              } catch {}
            }
            if (!onboarded) setNeedsOnboarding(true);
          } catch {}
        }, 500);
      }
    });

    // Proactive session keepalive every 25 min (well before the 60 min expiry)
    refreshInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn('[Auth] refresh failed, will retry:', error.message);
        } else if (data.session) {
          console.log('[Auth] session refreshed proactively');
        }
      } catch (e) {
        console.warn('[Auth] refresh exception:', e);
      }
    }, 25 * 60 * 1000);

    // Also refresh on page visibility change (user returning to tab)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.refreshSession().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (refreshInterval) clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast.error(e?.message || 'Google sign-in failed');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setNeedsOnboarding(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, needsOnboarding, setNeedsOnboarding, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
