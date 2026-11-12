/**
 * Shows the login page until a Google session exists. The API enforces the same rule.
 * When donating suits someone is asked in Drop's Intro, so there is no setup screen here.
 */
import { useCallback, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler, type AuthUser } from './api';
import App from './App';
import Login from './Login';
import { APP_NAME } from './brand';

type Phase = 'loading' | 'in' | 'out';

export default function AuthGate() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [clientId, setClientId] = useState('');
  const [sessionMinutes, setSessionMinutes] = useState(24 * 60);

  const signOut = useCallback((remote = true) => {
    if (remote) api.logout().catch(() => undefined);
    setUser(null);
    setPhase('out');
  }, []);
  const signedIn = useCallback((next: AuthUser) => { setUser(next); setPhase('in'); }, []);

  useEffect(() => {
    let live = true;
    setUnauthorizedHandler(() => { if (live) signOut(false); });
    api.authConfig().then(async (config) => {
      if (!live) return;
      setClientId(config.clientId);
      setSessionMinutes(config.sessionMinutes);
      if (config.authDisabled) {
        setUser({ email: 'local-dev', name: 'Local development', picture: '', expiresAt: null, local: true });
        setPhase('in');
        return;
      }
      try {
        const me = await api.me();
        if (!live) return;
        setUser(me);
        setPhase('in');
      } catch {
        if (live) setPhase('out');
      }
    }).catch(() => { if (live) setPhase('out'); });
    return () => { live = false; };
  }, [signOut]);

  useEffect(() => {
    if (!user?.expiresAt) return;
    const wait = user.expiresAt - Date.now();
    const timer = window.setTimeout(() => signOut(false), Math.max(wait, 0));
    return () => window.clearTimeout(timer);
  }, [user, signOut]);

  if (phase === 'loading') {
    return <div className="login"><p className="muted">{APP_NAME}</p></div>;
  }
  if (phase === 'out' || !user) {
    return <Login clientId={clientId} sessionMinutes={sessionMinutes} onSignedIn={signedIn} />;
  }
  return <App user={user} clientId={clientId} onSignOut={() => signOut(true)} />;
}
