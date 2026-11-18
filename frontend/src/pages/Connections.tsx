/**
 * Connected apps: the habit apps, watches and food apps a Donor already uses. Pratidaan reads what they
 * record, with a switch per data type, and can write a Week plan back; it doesn't track habits itself.
 * Demo apps replay the Persona's storyline (labelled demo); the Junction sandbox is a real API with generated
 * data; "your account" connections use your own key or Microsoft sign-in, kept in this tab only.
 */
import { useState } from 'react';
import { api, type WbConnection, type WbProvider } from '../api';
import type { PageProps } from '../App';
import { ErrorNote, Icon, Loading, useLoad } from '../ui';
import { microsoftTodoToken } from '../microsoftAuth';
import { SIGNAL_NAMES, wellbeingChanged } from '../components/wellbeing/wellbeing';
import '../components/wellbeing/wellbeing.css';

const MODE: Record<string, { label: string; pill: string }> = {
  demo: { label: 'Demo data', pill: 'pill-neutral' }, sandbox: { label: 'Live sandbox API', pill: 'pill-ai' }, live: { label: 'Your account', pill: 'pill-brand' },
};
const KEY = 'pratidaan.habitify.key';
const readKey = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };

function Toggle({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <button className={`toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />;
}

export default function Connections({ donorId, clientId }: PageProps) {
  const [tick, setTick] = useState(0);
  const { data, error, loading } = useLoad(() => api.wbApps(donorId), [donorId, tick]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reload = () => { setTick((n) => n + 1); wellbeingChanged(); };
  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id); setErr(null);
    try { await fn(); reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorNote error={error || 'Could not load'} />;
  const conn = (p: WbProvider) => data.connections.find((c) => c.provider === p.id);

  return (
    <div className="stack fade-in wb">
      <div className="page-head">
        <div>
          <div className="page-title">Connected apps</div>
          <div className="page-sub">Pratidaan reads what the apps you already use record. It doesn't ask you to track anything twice.</div>
        </div>
      </div>
      <div className="yd-facts">
        <span><Icon name="lock" size={15} /> A switch for every kind of data</span>
        <span><Icon name="x" size={15} /> Disconnect deletes what was read</span>
        <span><Icon name="shield" size={15} /> Never used for your cover or shared with Circles</span>
      </div>
      {err && <ErrorNote error={err} />}

      {data.groups.map((g) => (
        <section key={g.id} className="stack" style={{ gap: 10 }}>
          <div className="card-title">{g.label}</div>
          <div className="wb-apps">
            {data.providers.filter((p) => p.kind === g.id).map((p) => (
              p.mode === 'live'
                ? <LiveApp key={p.id} provider={p} donorId={donorId} clientId={clientId} />
                : <AppTile key={p.id} provider={p} connection={conn(p)} busy={busy === p.id}
                    onConnect={() => run(p.id, () => api.wbConnect(donorId, p.id, { writeBack: p.canWrite }))}
                    onTypes={(types) => run(p.id, () => api.wbUpdateApp(donorId, conn(p)!.id, { consentedTypes: types }))}
                    onWrite={(v) => run(p.id, () => api.wbUpdateApp(donorId, conn(p)!.id, { writeBack: v }))}
                    onSync={() => run(p.id, () => api.wbSyncApp(donorId, conn(p)!.id))}
                    onDisconnect={() => run(p.id, () => api.wbDisconnect(donorId, conn(p)!.id))} />
            ))}
          </div>
        </section>
      ))}

      <div className="card small muted">
        <b>How this would work for real.</b> Watches and phone health apps (Fitbit, Garmin, Oura, Withings, Apple Health, Health Connect) connect through one wearable aggregator,
        self-hosted on Azure in India so data stays here. Habit apps connect through their own APIs (Habitify, Microsoft To Do). In this preview, demo apps replay made-up data for the demo donors.
      </div>
    </div>
  );
}

function AppTile({ provider: p, connection: c, busy, onConnect, onTypes, onWrite, onSync, onDisconnect }: {
  provider: WbProvider; connection?: WbConnection; busy: boolean; onConnect: () => void; onTypes: (t: string[]) => void; onWrite: (v: boolean) => void; onSync: () => void; onDisconnect: () => void;
}) {
  return (
    <div className="card wb-app">
      <div className="row between wrap">
        <b>{p.label}</b>
        <span className={`pill ${MODE[p.mode].pill}`}>{MODE[p.mode].label}</span>
      </div>
      <div className="small muted">{p.blurb}</div>
      {c ? (
        <>
          <div className="types">
            {p.dataTypes.map((t) => (
              <label key={t} className="type"><span>{SIGNAL_NAMES[t] || t}</span>
                <Toggle on={c.consentedTypes.includes(t)} label={`Share ${SIGNAL_NAMES[t] || t}`} disabled={busy}
                  onChange={(v) => onTypes(v ? [...c.consentedTypes, t] : c.consentedTypes.filter((x) => x !== t))} />
              </label>
            ))}
            {p.canWrite && <label className="type"><span>Drop can add your Week plan here</span><Toggle on={c.writeBack} label="Write back" disabled={busy} onChange={onWrite} /></label>}
          </div>
          <div className="tiny faint">Connected {c.connectedOn} · last synced {c.lastSync}</div>
          <div className="row wrap">
            {p.mode === 'sandbox' && <button className="btn btn-sm" disabled={busy} onClick={onSync}><Icon name="refresh" size={14} /> Sync now</button>}
            <button className="btn btn-sm yd-del" disabled={busy} onClick={onDisconnect}>Disconnect & delete</button>
          </div>
        </>
      ) : (
        <>
          {!p.available && <div className="tiny muted">Not set up on this server (needs a Junction sandbox key).</div>}
          <div><button className="btn btn-primary btn-sm" disabled={busy || !p.available} onClick={onConnect}>{p.mode === 'demo' ? 'Connect (demo)' : 'Connect'}</button></div>
        </>
      )}
    </div>
  );
}

/** Your own Habitify or Microsoft To Do: the key or token stays in this tab; what's read is shown here only. */
function LiveApp({ provider: p, donorId, clientId }: { provider: WbProvider; donorId: string; clientId: string }) {
  const [key, setKey] = useState(readKey);
  const [habits, setHabits] = useState<{ id: string; name: string; daysThisWeek: number }[] | null>(null);
  const [todo, setTodo] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (fn: () => Promise<void>) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };

  return (
    <div className="card wb-app">
      <div className="row between wrap"><b>{p.label}</b><span className={`pill ${MODE.live.pill}`}>{MODE.live.label}</span></div>
      <div className="small muted">{p.blurb}</div>
      {p.id === 'habitify_live' ? (
        <>
          <div className="wb-key">
            <input type="password" value={key} placeholder="Habitify API key" aria-label="Habitify API key" onChange={(e) => setKey(e.target.value)} />
            <button className="btn btn-sm" disabled={busy || !key} onClick={() => go(async () => { try { sessionStorage.setItem(KEY, key); } catch { /* tab only */ } setHabits(await api.liveHabitify(donorId, key)); })}>Show my habits</button>
          </div>
          {habits && (
            <div className="stack" style={{ gap: 6 }}>
              {habits.length === 0 && <div className="small muted">No habits in this Habitify account yet.</div>}
              {habits.map((h) => <div key={h.id} className="item"><span className="grow"><b>{h.name}</b><small>Done on {h.daysThisWeek} of the last 7 days</small></span></div>)}
              <button className="btn btn-sm" onClick={() => { try { sessionStorage.removeItem(KEY); } catch { /* */ } setKey(''); setHabits(null); }}>Forget my key</button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="row wrap">
            <button className="btn btn-sm" disabled={busy || !clientId} onClick={() => go(async () => { setTodo(await microsoftTodoToken(clientId)); setMsg('Microsoft To Do connected for this tab.'); })}>{todo ? 'Connected' : 'Connect Microsoft To Do'}</button>
            {todo && <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => go(async () => { const r = await api.liveTodoPlan(donorId, todo); setMsg(`Added ${r.created.length} recurring task${r.created.length === 1 ? '' : 's'} to your "${r.list}" list.`); })}>Add my Week plan as tasks</button>}
          </div>
          {!clientId && <div className="tiny muted">Needs Microsoft sign-in configured on this server.</div>}
        </>
      )}
      {msg && <div className="callout callout-info small"><Icon name="check" size={16} /><span>{msg}</span></div>}
      {err && <ErrorNote error={err} />}
    </div>
  );
}
