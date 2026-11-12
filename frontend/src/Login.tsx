/** Sign in with Microsoft, or continue as a guest. */
import { useState } from 'react';
import { api, type AuthUser } from './api';
import { microsoftSignIn } from './microsoftAuth';
import { Icon } from './ui';
import { LegalLinks } from './Legal';
import { APP_NAME, APP_NAME_DEVANAGARI, APP_TAGLINE } from './brand';

function sessionLength(minutes: number) {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? '1 day' : `${days} days`;
  }
  return `${minutes} minutes`;
}

export default function Login({ clientId, authority, sessionMinutes, onSignedIn }: {
  clientId: string;
  authority: string;
  sessionMinutes: number;
  onSignedIn: (user: AuthUser) => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = (task: () => Promise<AuthUser>) => {
    setBusy(true);
    setError('');
    task().then(onSignedIn).catch((e: Error) => setError(e.message)).finally(() => setBusy(false));
  };
  return (
    <div className="login">
      <div className="login-card">
        <div className="brand"><span className="brand-mark"><Icon name="drop" size={18} stroke={2.4} /></span>{APP_NAME}</div>
        <p className="login-script" lang="hi">{APP_NAME_DEVANAGARI}</p>
        <p className="login-tagline">{APP_TAGLINE}</p>
        <h1>Welcome to {APP_NAME}</h1>
        <p className="muted">Sign in with Microsoft to save preferences and bookings securely in Azure, or continue as a guest. Sessions last {sessionLength(sessionMinutes)}.</p>
        {clientId ? <button type="button" className="btn login-guest" disabled={busy} onClick={() => run(async () => {
          const credential = await microsoftSignIn(clientId, authority);
          return api.microsoftSignIn(credential);
        })}>Continue with Microsoft</button> : <p className="login-error">Microsoft sign-in is not configured.</p>}
        <div className="login-or"><span>or</span></div>
        <button type="button" className="btn login-guest" disabled={busy} onClick={() => run(api.guestSignIn)}>Continue as guest</button>
        <p className="tiny faint login-guest-note">Guest mode uses shared preview data. Nothing is saved to Azure when you leave.</p>
        {busy && <p className="tiny muted">One moment…</p>}
        {error && <p className="login-error">{error}</p>}
        <LegalLinks />
      </div>
    </div>
  );
}
