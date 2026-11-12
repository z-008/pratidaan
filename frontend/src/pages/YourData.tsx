/**
 * "Your data" (account menu): everything Pratidaan keeps about you, where it is, how long
 * it is kept and how to delete it. Choices first, then one card per place, then "Delete my
 * account". A single delete takes the row away at once and is sent to the server when its
 * 6-second Undo closes. Rewritten from the prototype's variant A ("where it lives").
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api, type AccountDeleted, type AuthUser, type BookingPreferences, type DropReading } from '../api';
import type { PageProps } from '../App';
import { requestCalendarAccess } from '../calendarAuth';
import { ErrorNote, Icon, Loading, useLoad } from '../ui';
import { CHOICE_TEXT, ChoiceSwitch, type ChoiceKey } from '../components/Choices';
import './YourData.css';

/** What happens to an item when you don't delete it here. */
type Fate = 'account' | 'expires' | 'google' | 'centre' | 'booking' | 'above' | 'nothing';
const FATE: Record<Fate, { label: string; cls: string; icon: string }> = {
  account: { label: 'Goes when you delete your account', cls: 'pill-neutral', icon: 'lock' },
  expires: { label: 'Deletes itself', cls: 'pill-good', icon: 'clock' },
  google: { label: 'You delete it in Google', cls: 'pill-warn', icon: 'globe' },
  centre: { label: 'Stays with the blood centre', cls: 'pill-neutral', icon: 'hospital' },
  booking: { label: 'Goes with its booking', cls: 'pill-neutral', icon: 'calendar' },
  above: { label: 'Change them above', cls: 'pill-ai', icon: 'arrow' },
  nothing: { label: 'Nothing kept', cls: 'pill-good', icon: 'check' },
};

interface Row {
  id: string; what: string; detail: string; kept?: string;
  remove?: { label: string; toast: string; run: () => Promise<unknown>; before?: () => Promise<() => Promise<unknown>> };
  link?: { label: string; href: string };
  fate?: Fate;
}

const UNDO_MS = 6000;
const BROWSER_PREFIX = 'tracedrop.';
const DAY_NAMES: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtWhen = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function browserKeys() {
  try { return Object.keys(localStorage).filter((k) => k.startsWith(BROWSER_PREFIX)); } catch { return []; }
}
/** Clear what this browser saved for Pratidaan (the viewed donor, Drop lines you hid). */
export function clearBrowserData() {
  try { browserKeys().forEach((k) => localStorage.removeItem(k)); } catch { /* storage unavailable */ }
}

function prefsText(p: BookingPreferences) {
  const days = p.days?.length === 1 && p.days[0] === 'sat' ? 'Saturdays' : p.days?.length === 5 && !p.days.includes('sat') ? 'Weekdays'
    : p.days?.length === 6 ? 'Any open day' : (p.days || []).map((d) => DAY_NAMES[d] || d).join(', ');
  const times = (p.timeWindows || []).length === 3 ? 'any time' : (p.timeWindows || []).map((t) => (t === 'evening' ? 'late afternoon' : t)).join(', ');
  const place = p.location ? `${p.location.source === 'gps' ? 'near your location (rounded to about 1 km)' : `in ${p.location.label}`}` : '';
  return [days, times, place, p.maxDistanceKm ? `within ${p.maxDistanceKm} km` : ''].filter(Boolean).join(' · ') || 'Saved, with nothing chosen yet';
}

function readingText(r: DropReading) {
  return r.marker === 'bp' ? `Blood pressure ${r.s}/${r.d}, ${fmtDay(r.date)}` : `Haemoglobin ${r.value} g/dL, ${fmtDay(r.date)}`;
}

function FatePill({ fate }: { fate: Fate }) {
  return <span className={`pill ${FATE[fate].cls}`}><Icon name={FATE[fate].icon} size={12} /> {FATE[fate].label}</span>;
}

function Group({ icon, title, where, note, empty, rows, onRemove, busy }: {
  icon: string; title: string; where: string; note?: ReactNode; empty?: string; rows: Row[]; onRemove: (row: Row) => void; busy: boolean;
}) {
  return (
    <section className="card yd-group">
      <div className="yd-group-head"><Icon name={icon} size={18} /><span><b>{title}</b><span className="tiny muted">{where}</span></span></div>
      {note && <div className="callout callout-warn small mt-8">{note}</div>}
      <div className="yd-rows">
        {rows.map((r) => (
          <div key={r.id} className="yd-row">
            <span className="yd-row-main">
              <b>{r.what}</b>
              <span className="small muted">{r.detail}</span>
              {r.kept && <span className="tiny faint"><Icon name="clock" size={11} /> {r.kept}</span>}
            </span>
            <span className="yd-row-act">
              {r.remove && <button className="btn btn-sm yd-del" disabled={busy} onClick={() => onRemove(r)}>{r.remove.label}</button>}
              {r.link && <a className="btn btn-sm" href={r.link.href} target="_blank" rel="noopener">{r.link.label} <Icon name="arrow" size={13} /></a>}
              {!r.remove && !r.link && r.fate && <FatePill fate={r.fate} />}
            </span>
          </div>
        ))}
        {empty && <div className="small muted yd-empty">{empty}</div>}
      </div>
    </section>
  );
}

export default function YourData({ donorId, version, clientId, user, donorName, onAccountDeleted }: PageProps & {
  user: AuthUser; donorName: string; onAccountDeleted: (result: AccountDeleted) => void;
}) {
  const [tick, setTick] = useState(0);
  const deps = [donorId, version, tick];
  const account = useLoad(() => api.accountData(), deps);
  const prefs = useLoad(() => api.preferences(), deps);
  const consent = useLoad(() => api.consent(donorId), deps);
  const drop = useLoad(() => api.drop(donorId), deps);
  const labs = useLoad(() => api.uploadedValues(donorId), deps);
  const overview = useLoad(() => api.overview(donorId), [donorId]);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ id: string; run: () => Promise<unknown>; timer: number } | null>(null);
  const reload = () => setTick((n) => n + 1);

  /** Send the delete waiting behind the Undo toast. */
  const commit = useRef(() => {});
  commit.current = () => {
    const p = pending.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pending.current = null;
    setToast(null);
    p.run().then(() => { reload(); window.dispatchEvent(new CustomEvent('drop:changed')); }).catch((e: Error) => {
      setError(`Couldn't delete it: ${e.message}`);
      setGone((g) => { const next = new Set(g); next.delete(p.id); return next; });
    });
  };
  // Leaving the page (or closing it) sends what is waiting
  useEffect(() => {
    const flush = () => commit.current();
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, []);

  async function remove(row: Row) {
    if (!row.remove) return;
    setError('');
    let run = row.remove.run;
    if (row.remove.before) {
      // e.g. a booking with a Calendar event: Google asks for Calendar access now, while you're here
      setBusy(true);
      try { run = await row.remove.before(); } catch (e) { setError((e as Error).message); return; } finally { setBusy(false); }
    }
    commit.current();
    setGone((g) => new Set(g).add(row.id));
    pending.current = { id: row.id, run, timer: window.setTimeout(() => commit.current(), UNDO_MS) };
    setToast(row.remove.toast);
  }

  function undo() {
    const p = pending.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pending.current = null;
    setGone((g) => { const next = new Set(g); next.delete(p.id); return next; });
    setToast(null);
  }

  if (!account.data && account.loading) return <Loading />;
  if (account.error || !account.data) return <ErrorNote error={account.error || 'Could not load'} />;
  const a = account.data;
  const choices = consent.data;
  const view = drop.data;
  const visible = (rows: Row[]) => rows.filter((r) => !gone.has(r.id));

  // ---- With the Google account
  const googleRows: Row[] = [
    { id: 'profile', what: 'Name, email and photo', detail: a.local ? 'Sign-in is off on this computer, so there is no Google profile' : `${a.name} · ${a.email} · from your Google sign-in`, kept: a.local ? undefined : 'Until you delete your account', fate: a.local ? 'nothing' : 'account' },
    a.signIns
      ? { id: 'signins', what: 'Sign-in history', detail: `${a.signIns} sign-in${a.signIns === 1 ? '' : 's'}${a.firstSeen ? ` since ${fmtWhen(a.firstSeen)}` : ''}, each with the time and your browser${a.lastBrowser ? ` (last: ${a.lastBrowser})` : ''}`, kept: 'Until you delete it', remove: { label: 'Delete history', toast: 'Sign-in history deleted', run: () => api.deleteSignIns() } }
      : { id: 'signins', what: 'Sign-in history', detail: a.local ? 'Sign-in is off on this computer, so no sign-ins are recorded' : 'None kept', fate: 'nothing' },
    prefs.data
      ? { id: 'prefs', what: 'When donating suits you', detail: prefsText(prefs.data), kept: 'Until you change or delete them', remove: { label: 'Delete', toast: 'Donation preferences deleted', run: () => api.deletePreferences() } }
      : { id: 'prefs', what: 'When donating suits you', detail: 'None saved. The Intro and booking ask, and save your answers here.', fate: 'nothing' },
    ...a.bookings.map((b): Row => {
      const upcoming = b.status === 'booked';
      return {
        id: `booking-${b.id}`, what: `Donation booking, ${fmtDay(b.date)}`,
        detail: `${b.centre}, ${b.time} · ${upcoming ? 'coming up (deleting cancels it first)' : b.status}${b.calendar && upcoming ? ' · in your Google Calendar' : ''}`,
        kept: 'Until you delete it (cancelling keeps the record)',
        remove: {
          label: 'Delete', toast: `Booking on ${fmtDay(b.date)} deleted`, run: () => api.deleteBooking(b.id),
          before: upcoming && b.calendar ? async () => { const token = await requestCalendarAccess(clientId); return () => api.deleteBooking(b.id, token); } : undefined,
        },
      };
    }),
  ];

  // ---- In your own Google account
  const events = a.bookings.filter((b) => b.calendar && b.status !== 'cancelled').length;
  const inGoogleRows: Row[] = [
    { id: 'calendar', what: 'Calendar events Pratidaan added', detail: events ? `${events} event${events === 1 ? '' : 's'}, for bookings made with Google Calendar connected. Deleting a booking, or your account, removes them (Google asks for Calendar access once more).` : 'None: no booking was made with Google Calendar connected', kept: events ? 'Until removed' : undefined, fate: events ? 'booking' : 'nothing' },
    { id: 'gmail', what: 'Booking confirmation emails', detail: 'Sent from your Gmail to yourself, so they are in Sent and Inbox. Pratidaan can send mail for you, but not read or delete it.', kept: 'Until you delete them', link: { label: 'Open Gmail', href: 'https://mail.google.com' } },
    { id: 'access', what: "Pratidaan's access to your Google account", detail: 'Sign-in, and the Calendar and send-email permissions you allowed', kept: 'Until you remove it', link: { label: 'Google Account settings', href: 'https://myaccount.google.com/connections' } },
  ];

  // ---- The demo donor (shared, in server memory)
  const choiceSummary = choices ? (Object.keys(CHOICE_TEXT) as ChoiceKey[]).map((k) => ({
    shareHealthWithInsurer: `insurer sharing ${choices[k] ? 'on' : 'off'}`, showOnLeaderboard: `${choices[k] ? 'on' : 'off'} leaderboards`, includeInCommunityStats: `${choices[k] ? 'counted' : 'not counted'} in totals`,
  }[k])).join(' · ') : '';
  const donorRows: Row[] = [
    { id: 'choices', what: 'Your choices', detail: choiceSummary.charAt(0).toUpperCase() + choiceSummary.slice(1), kept: 'Until changed or the timeline resets', fate: 'above' },
    ...(view?.memory || []).map((m): Row => ({ id: `mem-${m.id}`, what: `Drop remembers: "${m.text}"`, detail: 'Something you told Drop', kept: 'Until deleted or the timeline resets', remove: { label: 'Delete', toast: 'Memory deleted', run: () => api.dropForget(donorId, m.id) } })),
    ...(view?.readings || []).map((r): Row => ({ id: `reading-${r.id}`, what: readingText(r), detail: r.observationId ? 'A value you added from a lab report' : 'A reading you added', kept: 'Until deleted or the timeline resets', remove: { label: 'Delete', toast: 'Reading deleted', run: () => api.dropDeleteReading(donorId, r.id) } })),
    ...(labs.data || []).map((o): Row => ({ id: `lab-${o.id}`, what: `${o.name} ${o.value} ${o.unit}, ${fmtDay(o.date)}`, detail: `Read from a lab report photo (${o.lab}). The photo itself is not kept.`, kept: 'Until deleted or the timeline resets', remove: { label: 'Delete', toast: 'Lab value deleted', run: () => api.deleteUploadedValue(donorId, o.id) } })),
    ...(overview.data && overview.data.donations.completed + overview.data.donations.deferred > 0
      ? [{ id: 'records', what: 'Donations and test results', detail: 'From the blood centre. In this preview, made-up records.', kept: 'Medical records the blood centre must keep', fate: 'centre' as Fate }]
      : []),
  ];
  const donorVisible = visible(donorRows);

  // ---- Kept elsewhere, deleted on a timer
  const fixedRows = {
    ai: [{ id: 'gemini', what: 'What you type to Drop, and lab report photos', detail: "Used only to answer you. Google doesn't train its AI on it, and it never gets your name or email.", kept: 'Up to 24 hours; up to 90 days only if Google flags it for an abuse check', fate: 'expires' as Fate }],
    logs: [{ id: 'logs', what: 'Pages and actions you used, your IP address and browser', detail: 'Kept to find errors and stop misuse', kept: '30 days, then deleted automatically', fate: 'expires' as Fate }],
  };
  const saved = browserKeys();
  const browserRows: Row[] = [
    saved.length
      ? { id: 'browser', what: 'Which donor you viewed, and Drop lines you hid', detail: 'Saved so the app opens where you left it', kept: 'Until you clear it', remove: { label: 'Clear', toast: "This browser's saved data cleared", run: async () => clearBrowserData() } }
      : { id: 'browser', what: 'Which donor you viewed, and Drop lines you hid', detail: 'Nothing saved in this browser', fate: 'nothing' },
    { id: 'cookie', what: 'Sign-in cookie', detail: a.local ? 'Sign-in is off on this computer, so there is no cookie' : 'Keeps you signed in', kept: a.local ? undefined : '24 hours, or until you sign out', fate: a.local ? 'nothing' : 'expires' },
  ];

  return (
    <div className="fade-in yd">
      <div className="page-head">
        <div>
          <div className="page-title">Your data</div>
          <div className="page-sub">Everything Pratidaan keeps about you, where it is, and how to delete it.</div>
        </div>
      </div>
      <div className="yd-facts">
        <span><Icon name="lock" size={15} /> Kept in Google Cloud</span>
        <span><Icon name="sparkles" size={15} /> The AI doesn't learn from it</span>
        <span><Icon name="x" size={15} /> Delete anything with a button</span>
      </div>
      {error && <ErrorNote error={error} />}

      <section className="card">
        <div className="card-title">Your choices</div>
        <div className="card-sub">The same switches as in the Intro, Health cover and Community.</div>
        {choices && (Object.keys(CHOICE_TEXT) as ChoiceKey[]).map((k) => <ChoiceSwitch key={k} donorId={donorId} choice={k} on={choices[k]} onChanged={consent.reload} />)}
      </section>

      <Group icon="lock" title="With your Google account" where={a.local ? "This computer's server memory (sign-in is off)" : 'Google Cloud database (Firestore)'}
        rows={visible(googleRows)} onRemove={remove} busy={busy} />
      <Group icon="globe" title="In your own Google account" where="Your Google Calendar, Gmail and account settings" rows={visible(inGoogleRows)} onRemove={remove} busy={busy} />
      <Group icon="drop" title={`Donor you're viewing: ${donorName}`} where="Pratidaan's server memory, shared"
        note={overview.data?.donor.newUser
          ? 'Everyone using this preview shares the New donor; it resets when the timeline resets. In the real app this would be yours alone.'
          : `${donorName} is made up. Everyone using this preview shares the same ${donorName}; it resets when the timeline resets. In the real app this would be yours alone.`}
        rows={donorVisible} empty={donorVisible.length <= 1 ? 'Nothing else is kept for this donor yet.' : undefined} onRemove={remove} busy={busy} />
      <Group icon="sparkles" title="Sent to Google's Gemini AI" where="Google Cloud (Vertex AI)" rows={fixedRows.ai} onRemove={remove} busy={busy} />
      <Group icon="doc" title="Server logs" where="Google Cloud Logging" rows={fixedRows.logs} onRemove={remove} busy={busy} />
      <Group icon="cpu" title="This browser" where="Your browser on this device" rows={visible(browserRows)} onRemove={remove} busy={busy} />

      <DeleteAccount user={user} account={a} clientId={clientId} donorName={donorName} onDeleted={(result) => { pending.current = null; clearBrowserData(); onAccountDeleted(result); }} />

      {toast && createPortal(
        <div className="yd-toast" role="status"><Icon name="check" size={15} /> {toast} <button onClick={undo}>Undo</button></div>,
        document.body,
      )}
    </div>
  );
}

/** "Delete my account": what goes now, what deletes itself later, what you delete yourself; confirmed by typing DELETE. */
function DeleteAccount({ user, account, clientId, donorName, onDeleted }: { user: AuthUser; account: { local: boolean; bookings: { calendar: boolean; status: string }[] }; clientId: string; donorName: string; onDeleted: (r: AccountDeleted) => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [calendar, setCalendar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasEvents = account.bookings.some((b) => b.calendar && b.status !== 'cancelled');
  const offerCalendar = !account.local && !user.local;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) { setOpen(false); setTyped(''); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy]);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const accessToken = offerCalendar && calendar && hasEvents ? await requestCalendarAccess(clientId) : undefined;
      onDeleted(await api.deleteAccount({ accessToken, removeCalendar: Boolean(offerCalendar && calendar) }));
    } catch (e) {
      setError(`${(e as Error).message}. Nothing was deleted.${offerCalendar && calendar ? ' You can untick the Calendar box and try again.' : ''}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card yd-danger">
      <div className="card-title" style={{ color: 'var(--bad)' }}>Delete my account</div>
      {!open ? (
        <div className="row between wrap" style={{ gap: 12 }}>
          <span className="small muted">Removes everything Pratidaan keeps with your Google account{user.local ? '' : ' and signs you out'}.</span>
          <button className="btn yd-danger-btn" onClick={() => setOpen(true)}>Delete my account…</button>
        </div>
      ) : (
        <>
          <div className="yd-plan">
            <div>
              <h4><Icon name="x" size={14} /> Deleted straight away</h4>
              <ul>
                <li>Your name, email and photo</li>
                <li>Your sign-in history</li>
                <li>Your donation preferences</li>
                <li>Your bookings (upcoming ones are cancelled first)</li>
                <li>What this browser saved</li>
              </ul>
              {offerCalendar && (
                <label className="yd-check"><input type="checkbox" checked={calendar} onChange={(e) => setCalendar(e.target.checked)} /><span>Also remove my Google Calendar events <span className="tiny muted">(asks for Calendar access once more)</span></span></label>
              )}
            </div>
            <div>
              <h4><Icon name="clock" size={14} /> Deletes itself later</h4>
              <ul>
                <li>Copies at Google's Gemini AI: within 24 hours, or 90 days if flagged for an abuse check</li>
                <li>Server logs: within 30 days</li>
              </ul>
            </div>
            <div>
              <h4><Icon name="globe" size={14} /> You delete it yourself</h4>
              <ul>
                <li>Confirmation emails in your Gmail</li>
                <li>Pratidaan's access, in your Google Account settings</li>
              </ul>
              <p className="tiny muted">The donor {donorName} is shared in this preview, so its records and choices stay.</p>
            </div>
          </div>
          <label className="yd-type"><span>Type <b>DELETE</b> to confirm</span><input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type DELETE to confirm" autoFocus /></label>
          {error && <ErrorNote error={error} />}
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn" disabled={busy} onClick={() => { setOpen(false); setTyped(''); }}>Keep my account</button>
            <button className="btn yd-danger-btn solid" disabled={busy || typed.trim().toUpperCase() !== 'DELETE'} onClick={confirm}>{busy ? 'Deleting…' : 'Delete my account'}</button>
          </div>
        </>
      )}
    </section>
  );
}

/** Shown in place of the app once the account is deleted. */
export function AccountDeletedView({ result, onDone }: { result: AccountDeleted; onDone: () => void }) {
  const bookings = result.bookings ? ` and ${result.bookings} booking${result.bookings === 1 ? '' : 's'}` : '';
  return (
    <div className="login">
      <div className="login-card yd-deleted fade-in">
        <span className="yd-big-icon"><Icon name="check" size={26} /></span>
        <h1>Your account is deleted</h1>
        {result.local ? (
          <p className="muted">Sign-in is off on this computer, so this cleared the server's in-memory copies: your donation preferences{bookings}. This browser's saved data was cleared too.</p>
        ) : (
          <p className="muted">
            Your profile, sign-in history, donation preferences{bookings} are gone
            {result.calendarRemoved ? `, and ${result.calendarRemoved} Calendar event${result.calendarRemoved === 1 ? ' was' : 's were'} removed` : ''}.
            This browser's saved data was cleared and you've been signed out. Signing in again starts a fresh account.
          </p>
        )}
        {result.calendarFailed > 0 && <p className="small" style={{ color: 'var(--warn)' }}>{result.calendarFailed} Calendar event{result.calendarFailed === 1 ? '' : 's'} could not be removed. You can delete {result.calendarFailed === 1 ? 'it' : 'them'} in Google Calendar.</p>}
        <p className="tiny muted">Still to go on their own: copies at Google's Gemini AI within 24 hours (up to 90 days if flagged for an abuse check) and server logs within 30 days. Confirmation emails in your Gmail stay until you delete them.</p>
        <button className="btn btn-primary" onClick={onDone}>{result.local ? 'Back to Pratidaan' : 'Back to sign in'}</button>
      </div>
    </div>
  );
}
