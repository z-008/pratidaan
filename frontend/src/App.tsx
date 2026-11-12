import { useEffect, useState } from 'react';
import { api, type AuthUser } from './api';
import { APP_NAME } from './brand';
import { Icon } from './ui';
import ChatSheet from './components/drop/ChatSheet';
import { introChanged } from './components/intro/Intro';
import DemoBar from './components/DemoBar';
import AccountMenu from './components/AccountMenu';
import Home from './pages/Home';
import Impact from './pages/Impact';
import Health from './pages/Health';
import Cover from './pages/Cover';
import Community from './pages/Community';
import Donate from './pages/Donate';
import Ecosystem from './pages/Ecosystem';
import AIConsole from './pages/AIConsole';
import YourData, { AccountDeletedView } from './pages/YourData';
import type { AccountDeleted } from './api';

export type Screen = 'home' | 'donate' | 'impact' | 'health' | 'cover' | 'community' | 'plan' | 'labs' | 'checkups' | 'ecosystem' | 'ai' | 'data';

const NAV: { id: Screen; label: string; icon: string; mobile?: boolean }[] = [
  { id: 'home', label: 'Home', icon: 'home', mobile: true },
  { id: 'donate', label: 'Donate', icon: 'calendar', mobile: true },
  { id: 'impact', label: 'My impact', icon: 'drop', mobile: true },
  { id: 'health', label: 'My health', icon: 'heart', mobile: true },
  { id: 'cover', label: 'Health cover', icon: 'shield', mobile: true },
  { id: 'community', label: 'Community', icon: 'users' },
  { id: 'ecosystem', label: 'Ecosystem view', icon: 'globe' },
];

function readStored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

/** "Arjun Rao · B+", or "You (new donor)": the New donor stands for the signed-in person, a new user with no records yet. */
function personaLabel(p: { name: string; bloodGroup: string | null; newUser?: boolean }) {
  if (p.newUser) return 'You (new donor)';
  return p.bloodGroup ? `${p.name} · ${p.bloodGroup}` : p.name;
}

function initialScreen(): Screen {
  const hash = window.location.hash.replace('#', '') as Screen;
  return NAV.some((n) => n.id === hash) || ['plan', 'labs', 'checkups', 'ai', 'data'].includes(hash) ? hash : 'home';
}

export default function App({ user, clientId, onSignOut }: { user: AuthUser; clientId: string; onSignOut: () => void }) {
  // A first visit opens on the New donor, where a new user starts
  const [donorId, setDonorId] = useState(() => readStored('tracedrop.donor', 'D-NEW'));
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [personas, setPersonas] = useState<{ id: string; name: string; bloodGroup: string | null; newUser?: boolean }[]>([]);
  const [version, setVersion] = useState(0); // bump to refresh data after a donation or upload
  const [deleted, setDeleted] = useState<AccountDeleted | null>(null);

  useEffect(() => { api.personas().then(setPersonas).catch(() => setPersonas([])); }, []);
  useEffect(() => {
    try { localStorage.setItem('tracedrop.donor', donorId); } catch { /* storage unavailable */ }
  }, [donorId]);
  useEffect(() => {
    const onHash = () => setScreen(initialScreen());
    // A Choice changed in one place: every screen shows the new state
    const onChoices = () => setVersion((v) => v + 1);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('choices:changed', onChoices);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('choices:changed', onChoices); };
  }, []);

  const go = (next: Screen) => {
    window.location.hash = next;
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const refresh = () => setVersion((v) => v + 1);
  const accountKey = user.sub || (user.local ? 'local' : 'anonymous');
  const page = { donorId, go, version, refresh, clientId, accountKey };

  // Choosing who to view is part of the demo, so it sits at the top of every screen
  const viewingAs = (
    <label className="viewing-as">
      <span className="viewing-as-label"><Icon name="users" size={15} /> Viewing as</span>
      <select className="persona-select" value={donorId} onChange={(e) => { setDonorId(e.target.value); go('home'); }} aria-label="Viewing as (demo donor)">
        {personas.map((p) => <option key={p.id} value={p.id}>{personaLabel(p)}</option>)}
      </select>
      <span className="viewing-as-hint">Demo: pick yourself, or step into a demo donor's shoes</span>
    </label>
  );

  const donor = personas.find((p) => p.id === donorId);
  const donorLabel = donor ? personaLabel(donor) : '';
  // Replay Drop's Intro: only the New donor has one to replay
  const replayIntro = donor?.newUser
    ? () => api.introReplay(donorId).then(() => { go('home'); introChanged(donorId); }).catch(() => go('home'))
    : undefined;

  // After "Delete my account" the session is gone: say what happened, then back to sign in
  if (deleted) return <AccountDeletedView result={deleted} onDone={() => (deleted.local ? window.location.assign('/') : onSignOut())} />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Icon name="drop" size={18} stroke={2.4} /></span>{APP_NAME}</div>
        {NAV.map((n) => (
          <button key={n.id} className={`nav-item ${screen === n.id || (n.id === 'health' && (screen === 'plan' || screen === 'labs' || screen === 'checkups')) ? 'active' : ''}`} onClick={() => go(n.id)}>
            <Icon name={n.icon} /> {n.label}
          </button>
        ))}
        <div className="sidebar-foot">
          <AccountMenu user={user} donorLabel={donorLabel} onSignOut={onSignOut} onReplayIntro={replayIntro} onYourData={() => go('data')} />
        </div>
      </aside>

      <main className="main">
        <div className="mobile-top">
          <div className="brand" style={{ padding: 0 }}><span className="brand-mark"><Icon name="drop" size={18} stroke={2.4} /></span>{APP_NAME}</div>
          <AccountMenu user={user} donorLabel={donorLabel} onSignOut={onSignOut} onReplayIntro={replayIntro} onYourData={() => go('data')} compact />
        </div>
        <div className="topbar">
          {viewingAs}
          {screen === 'home' && <DemoBar donorId={donorId} onChange={refresh} />}
        </div>
        {screen === 'home' && <Home key={donorId} {...page} user={user} />}
        {screen === 'impact' && <Impact {...page} />}
        {(screen === 'health' || screen === 'plan' || screen === 'labs' || screen === 'checkups') && <Health {...page} focus={screen} />}
        {screen === 'cover' && <Cover {...page} />}
        {screen === 'community' && <Community {...page} />}
        {screen === 'donate' && <Donate {...page} />}
        {screen === 'ecosystem' && <Ecosystem {...page} />}
        {screen === 'ai' && <AIConsole />}
        {screen === 'data' && <YourData {...page} user={user} donorName={donor?.name || 'this donor'} onAccountDeleted={setDeleted} />}
      </main>

      <nav className="bottom-nav">
        {NAV.filter((n) => n.mobile).map((n) => (
          <button key={n.id} className={screen === n.id ? 'active' : ''} onClick={() => go(n.id)}>
            <Icon name={n.icon} size={20} /> {{ impact: 'Impact', health: 'Health', cover: 'Cover' }[n.id as string] || n.label}
          </button>
        ))}
      </nav>

      <ChatSheet key={`${accountKey}|${donorId}`} accountKey={accountKey} donorId={donorId} go={go} clientId={clientId} screen={screen} />
    </div>
  );
}

export interface PageProps {
  donorId: string;
  go: (screen: Screen) => void;
  version: number;
  refresh: () => void;
  clientId: string;
  accountKey: string;
}
