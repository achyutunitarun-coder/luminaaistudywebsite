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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Check onboarding status for new signups
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(async () => {
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
          if (!onboarded) {
            setNeedsOnboarding(true);
          }
        }, 500);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const { lovable } = await import('@/integrations/lovable');
      await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
    } catch {
      // Fallback if lovable module not available
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
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
