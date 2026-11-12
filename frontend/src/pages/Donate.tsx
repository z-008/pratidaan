import { useState } from 'react';
import { api, fmtDate, type Appointment } from '../api';
import type { PageProps } from '../App';
import { requestCalendarAccess } from '../calendarAuth';
import { ErrorNote, Icon, Loading, Section, useLoad } from '../ui';
import DropLine from '../components/drop/DropLine';
import BookingFlow from '../components/BookingFlow';
import AppointmentPass from '../components/AppointmentPass';

export default function Donate({ donorId, go, version, refresh, clientId }: PageProps) {
  const { data, error, loading, reload } = useLoad(() => api.slots(donorId), [donorId, version]);
  const appts = useLoad(() => api.appointments(donorId), [donorId, version]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; reasons: string[]; components: string[]; demoSimulation?: boolean; assumedVitals?: string[] } | null>(null);
  const [vitals, setVitals] = useState({ systolic: '', diastolic: '', haemoglobin: '' });
  const [showAll, setShowAll] = useState(false);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorNote error={error || 'Could not load'} />;
  const booked = (appts.data || []).filter((a) => a.status === 'booked');
  const pendingCalendarRemoval = (appts.data || []).filter((a) => a.status === 'cancelled' && a.eventId);
  const el = data.eligibility;

  async function cancel(a: Appointment) {
    setBusy(a.id);
    setErr(null);
    try {
      let accessToken: string | undefined;
      if (a.eventId) {
        try {
          accessToken = await requestCalendarAccess(clientId);
        } catch {
          accessToken = undefined;
        }
      }
      const cancelled = await api.cancelAppointment(donorId, a.id, accessToken);
      appts.reload();
      if (cancelled.calendarError) setErr(`Slot cancelled, but its Google Calendar event could not be confirmed removed: ${cancelled.calendarError}. Check Google Calendar and remove it there if present.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function checkIn(a: Appointment) {
    setBusy(a.id);
    setErr(null);
    try {
      const v: Record<string, number> = {};
      for (const [k, val] of Object.entries(vitals)) if (val) v[k] = Number(val);
      setResult(await api.checkIn(donorId, a.id, v));
      appts.reload();
      reload();
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack fade-in">
      <div className="page-head">
        <div>
          <div className="page-title">Donate</div>
          <div className="page-sub">Try a simulated donation booking and check-in. Slots and centres are examples; no centre is reserved. Real Google Calendar access, if you choose to connect it, is a separate account integration.</div>
        </div>
      </div>
      <DropLine donorId={donorId} screen="donate" version={version} />

      {result && (
        <div className={`callout ${result.status === 'completed' ? '' : 'callout-warn'}`} style={result.status === 'completed' ? { background: 'var(--good-soft)' } : undefined}>
          <Icon name={result.status === 'completed' ? 'check' : 'info'} />
          <div>
            {result.status === 'completed' ? (
              <><b>Donation recorded.</b> {result.components.length} components ({result.components.join(', ')}) — follow their journey on Impact. These are simulated results, not clinical tests.</>
            ) : (
              <><b>Donation deferred.</b> {result.reasons.join('; ')}. Simulated screening values were recorded; this is not a clinical assessment.</>
            )}
            {result.assumedVitals?.length ? <div className="small muted mt-8">Values supplied for: {result.assumedVitals.join(', ')}. No measurement was taken.</div> : null}
            <div className="row mt-8">
              <button className="btn btn-sm btn-primary" onClick={() => go(result.status === 'completed' ? 'impact' : 'plan')}>{result.status === 'completed' ? 'Track my components' : 'Open care plan'}</button>
              <button className="btn btn-sm" onClick={() => go('health')}>See my results</button>
            </div>
          </div>
        </div>
      )}
      {err && <ErrorNote error={err} />}
      {pendingCalendarRemoval.map((a) => <div key={a.id} className="callout callout-warn small">The slot on {fmtDate(a.date)} was cancelled, but its Google Calendar event could not be confirmed removed. Check Google Calendar and remove it there if present.</div>)}

      {booked.map((a) => (
        <Section key={a.id} title={<><Icon name="calendar" size={18} /> Donation booking on {fmtDate(a.date)}</>} sub={`${a.centre}, ${a.district} · not a centre reservation`}>
          <AppointmentPass appointment={a} />
          <details className="mt-16">
            <summary className="small bold" style={{ cursor: 'pointer' }}>Simulate check-in</summary>
          <p className="small muted mt-8">Simulated check-in only: no staff scan the QR code or screen you. Leave blanks to use persona values, or enter values to try a simulated deferral (e.g. haemoglobin 11.9).</p>
          <div className="grid grid-3 mt-12" style={{ gap: 10 }}>
            <label className="small">Systolic BP<input className="input" inputMode="numeric" value={vitals.systolic} onChange={(e) => setVitals({ ...vitals, systolic: e.target.value })} placeholder="e.g. 128" /></label>
            <label className="small">Diastolic BP<input className="input" inputMode="numeric" value={vitals.diastolic} onChange={(e) => setVitals({ ...vitals, diastolic: e.target.value })} placeholder="e.g. 82" /></label>
            <label className="small">Haemoglobin (g/dL)<input className="input" inputMode="decimal" value={vitals.haemoglobin} onChange={(e) => setVitals({ ...vitals, haemoglobin: e.target.value })} placeholder="e.g. 14.2" /></label>
          </div>
          <div className="row mt-12 wrap">
            <button className="btn btn-primary" onClick={() => checkIn(a)} disabled={busy === a.id}><Icon name="drop" size={16} /> Simulate check-in and donation</button>
          </div>
          </details>
          <div className="row mt-12"><button className="btn btn-sm" disabled={busy === a.id} onClick={() => cancel(a)}>Cancel booking</button></div>
        </Section>
      ))}

      <Section title={el.lastDonationDate ? 'Try a donation booking' : 'Try booking your first donation'} sub={el.eligibleNow ? 'Choose a centre and time. No real slot is reserved.' : el.nextEligibleDate ? `Eligibility starts ${fmtDate(el.nextEligibleDate)}.` : 'Donation is paused for now.'}>
        {el.blockers.length > 0 && (
          <div className="callout callout-warn small">
            <Icon name="info" size={16} />
            <span>Paused because: {el.blockers.join('; ')}. <button className="btn btn-sm" onClick={() => go('plan')}>Care plan</button></span>
          </div>
        )}
        {!el.blockers.length && (booked.length
          ? <p className="small muted">A donation booking is already saved. Cancel it above to choose another time.</p>
          : <BookingFlow donorId={donorId} clientId={clientId} onBooked={() => appts.reload()} />)}
        <button className="btn btn-ghost btn-sm mt-12" onClick={() => setShowAll((open) => !open)}>{showAll ? 'Hide all slots' : 'Browse all slots'}</button>
        {showAll && (
          <div className="grid grid-3 mt-12" style={{ gap: 10 }}>
            {data.slots.map((s) => (
              <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
                <div className="bold">{fmtDate(s.date)} · {s.time}</div>
                <div className="small muted">{s.centre}</div>
                <div className="tiny faint">{s.district}</div>
              </div>
            ))}
            {!data.slots.length && <p className="small muted">No open slots.</p>}
          </div>
        )}
      </Section>
    </div>
  );
}
