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

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
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

    return () => {
      isMounted = false;
      subscription.unsubscribe();
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
