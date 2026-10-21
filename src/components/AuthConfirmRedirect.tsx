import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * DEF-06: email-confirmation links land on "/" with a signup hash and no
 * feedback. Detect that hash, tell the user what happened, and send them to
 * sign in. OAuth callbacks return to /auth, so "/" never carries an OAuth
 * session hash — safe to intercept here.
 */
const AuthConfirmRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/') return;
    const hash = window.location.hash;
    if (!hash.includes('type=signup') && !hash.includes('access_token=')) return;

    // Confirm-and-sign-in flows let supabase-js hydrate the session first;
    // AuthRoute will bounce signed-in users to /dashboard either way.
    toast.success('Email confirmed! Please sign in to continue.');
    window.history.replaceState(null, '', window.location.pathname);
    navigate('/auth', { replace: true });
  }, [location.pathname, navigate]);

  return null;
};

export default AuthConfirmRedirect;
