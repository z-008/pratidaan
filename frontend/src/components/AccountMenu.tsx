/** Signed-in account: avatar chip that opens a menu with the profile, the donor being viewed and sign out. */
import { useEffect, useRef, useState } from 'react';
import type { AuthUser } from '../api';
import { Icon } from '../ui';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

export function Avatar({ user, size = 34 }: { user: AuthUser; size?: number }) {
  const [broken, setBroken] = useState(false);
  const label = user.local ? 'Local' : user.guest ? 'Guest' : user.name || user.email;
  if (user.picture && !broken) {
    return <img className="avatar" src={user.picture} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className="avatar avatar-initials" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">{initials(label)}</span>;
}

interface Props {
  user: AuthUser;
  donorLabel: string;
  onSignOut: () => void;
  /** Only while viewing the New donor: play Drop's Intro again */
  onReplayIntro?: () => void;
  /** Open "Your data": what is kept, where, and how to delete it */
  onYourData: () => void;
  compact?: boolean;
}

export default function AccountMenu({ user, donorLabel, onSignOut, onReplayIntro, onYourData, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const name = user.local ? 'Local development' : user.guest ? 'Guest' : user.name || user.email;
  const email = user.local ? 'Sign-in skipped' : user.guest ? 'Browsing without Google sign-in' : user.email;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={box} className={`account${compact ? ' account-compact' : ''}`}>
      <button className="account-chip" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={`Account: ${name}`}>
        <Avatar user={user} size={compact ? 32 : 34} />
        {!compact && (
          <span className="account-who">
            <b>{name}</b>
            <span>{donorLabel ? `Viewing ${donorLabel}` : email}</span>
          </span>
        )}
        {!compact && <Icon name="chevron" size={14} className="account-caret" />}
      </button>

      {open && (
        <div className="account-menu" role="menu">
          <div className="account-head">
            <Avatar user={user} size={40} />
            <span className="account-who"><b>{name}</b><span>{email}</span></span>
          </div>
          <button className="account-item" role="menuitem" onClick={() => { setOpen(false); onYourData(); }}>
            <Icon name="lock" size={15} /> Your data
          </button>
          {onReplayIntro && (
            <button className="account-item" role="menuitem" onClick={() => { setOpen(false); onReplayIntro(); }}>
              <Icon name="refresh" size={15} /> Replay intro
            </button>
          )}
          <div className="account-links">
            <a href="/privacy" target="_blank" rel="noopener">Privacy</a>
            <a href="/terms" target="_blank" rel="noopener">Terms</a>
          </div>
          {!user.local && (
            <button className="account-item" role="menuitem" onClick={() => { setOpen(false); onSignOut(); }}>
              <Icon name="arrow" size={15} /> Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
