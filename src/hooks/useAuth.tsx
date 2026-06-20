import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      // INITIAL_SESSION is already handled by getSession() above — ignore it
      // to prevent a second render that remounts the entire app tree.
      if (event === 'INITIAL_SESSION') return;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);


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
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
    } catch {
      toast.error('Google sign-in failed');
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
