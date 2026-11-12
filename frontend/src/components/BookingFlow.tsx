/**
 * Book a donation one step at a time: the minimum checks, where, when, a slot,
 * confirm, then the check-in pass. Used inside Drop's chat and on the Donate screen.
 */
import { useEffect, useState } from 'react';
import { api, fmtDate, type Appointment, type BookingLocation, type BookingPreferences, type Eligibility, type RankedSlot } from '../api';
import { requestCalendarAccess } from '../calendarAuth';
import { ErrorNote, Icon } from '../ui';
import AppointmentPass from './AppointmentPass';

type Step = 'check' | 'place' | 'when' | 'slots' | 'confirm' | 'done';
const STEPS: { id: Step; label: string }[] = [
  { id: 'check', label: 'Checks' }, { id: 'place', label: 'Place' }, { id: 'when', label: 'Date' }, { id: 'slots', label: 'Slot' }, { id: 'done', label: 'Booked' },
];

// Minimum requirements a donor confirms before booking (the centre re-checks Hb, BP and pulse on the day)
const CHECKS: { id: string; text: string; ifNo: string }[] = [
  { id: 'age', text: 'I am between 18 and 65 years old', ifNo: 'Donors must be 18 to 65.' },
  { id: 'weight', text: 'I weigh at least 45 kg', ifNo: 'Below 45 kg, donating can make you faint. Your health still counts: keep using Drop.' },
  { id: 'well', text: 'I feel well, with no fever, cold or infection in the last 2 weeks', ifNo: 'Wait until you have been well for 2 weeks, then book.' },
  { id: 'tattoo', text: 'No tattoo, piercing or acupuncture in the last 12 months', ifNo: 'Wait 12 months after a tattoo or piercing, because of infection risk.' },
  { id: 'meds', text: 'No surgery in the last 6 months and no antibiotics in the last 7 days', ifNo: 'Wait 6 months after surgery or 7 days after your last antibiotic dose.' },
  { id: 'pregnancy', text: 'Not pregnant or breastfeeding, and no baby in the last 12 months (if this applies)', ifNo: 'Wait until 12 months after delivery and after breastfeeding ends.' },
];

const TIMES = [
  { id: 'morning', label: 'Morning' }, { id: 'afternoon', label: 'Afternoon' }, { id: 'evening', label: 'Late afternoon' }, { id: 'any', label: 'Any time' },
];
const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export default function BookingFlow({ donorId, clientId, onBooked, onClose }: {
  donorId: string;
  clientId: string;
  onBooked?: (appointment: Appointment) => void;
  onClose?: () => void;
}) {
  const [step, setStep] = useState<Step>('check');
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [places, setPlaces] = useState<{ id: string; label: string }[]>([]);
  const [prefs, setPrefs] = useState<BookingPreferences | null>(null);
  const [range, setRange] = useState<{ id: string; from: string; to: string } | null>(null);
  const [time, setTime] = useState('any');
  const [slots, setSlots] = useState<RankedSlot[]>([]);
  const [chosen, setChosen] = useState<RankedSlot | null>(null);
  const [token, setToken] = useState('');
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([api.slots(donorId), api.preferences().catch(() => null), api.bookingTurn({})]).then(([s, saved, t]) => {
      if (!live) return;
      setEligibility(s.eligibility);
      setPlaces(t.places);
      setPrefs({
        days: saved?.days?.length ? saved.days : ALL_DAYS,
        timeWindows: saved?.timeWindows || [],
        maxDistanceKm: saved?.maxDistanceKm || 15,
        avoidHolidays: saved?.avoidHolidays ?? true,
        reminderMinutes: [1440],
        location: saved?.location || null,
        onboardingComplete: true,
        onboardingSkipped: false,
      });
      if (saved?.timeWindows?.length === 1) setTime(saved.timeWindows[0]);
    }).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [donorId]);

  if (error && !prefs) return <ErrorNote error={error} />;
  if (!eligibility || !prefs) return <div className="skeleton" style={{ height: 120 }} />;

  if (eligibility.blockers.length) {
    return (
      <div className="bflow">
        <div className="callout callout-warn small"><Icon name="info" size={16} /><span>Donation is paused because: {eligibility.blockers.join('; ')}. Your Goal in My health shows how to get back.</span></div>
      </div>
    );
  }

  const earliest = eligibility.nextEligibleDate || '';
  const failed = CHECKS.filter((c) => answers[c.id] === false);
  const allAnswered = CHECKS.every((c) => answers[c.id] !== undefined);
  const ranges = [
    { id: 'soon', label: `Earliest (from ${fmtDate(earliest)})`, from: earliest, to: addDays(earliest, 6) },
    { id: 'later', label: 'The week after', from: addDays(earliest, 7), to: addDays(earliest, 13) },
  ];
  const fullPrefs = (): BookingPreferences => ({
    ...prefs,
    timeWindows: time === 'any' ? ['morning', 'afternoon', 'evening'] : [time],
    dateFrom: range?.from || null,
    dateTo: range?.to || null,
  });

  async function run<T>(work: () => Promise<T>) {
    setBusy(true);
    setError('');
    try { return await work(); } catch (e) { setError((e as Error).message); return undefined; } finally { setBusy(false); }
  }

  function setLocation(location: BookingLocation) {
    setPrefs((p) => (p ? { ...p, location } : p));
  }

  function useGps() {
    if (!navigator.geolocation) { setError('This browser has no location service. Choose a district instead.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      setBusy(false);
      setLocation({ label: 'Near your current location', lat: Math.round(pos.coords.latitude * 100) / 100, lng: Math.round(pos.coords.longitude * 100) / 100, source: 'gps' });
    }, () => { setBusy(false); setError('Location permission was denied. Choose a district instead.'); });
  }

  async function chooseDistrict(id: string) {
    const t = await run(() => api.bookingTurn({ days: ALL_DAYS, timeWindows: ['morning'], maxDistanceKm: 15, avoidHolidays: true }, { step: 'place', value: id }));
    if (t?.preferences.location) setLocation(t.preferences.location);
  }

  async function findSlots(accessToken?: string) {
    const result = await run(() => api.recommend(donorId, fullPrefs(), accessToken));
    if (result) { setSlots(result.slots); setStep('slots'); }
  }

  async function connectCalendar() {
    const accessToken = await run(() => requestCalendarAccess(clientId));
    if (accessToken) { setToken(accessToken); await findSlots(accessToken); }
  }

  async function confirm() {
    if (!chosen) return;
    const p = fullPrefs();
    const appointment = await run(() => api.book(donorId, { slotId: chosen.id, preferences: p, accessToken: token || undefined }));
    if (!appointment) return;
    api.savePreferences({ ...p, onboardingComplete: true }).catch(() => {});
    setBooked(appointment);
    setStep('done');
    window.dispatchEvent(new CustomEvent('drop:changed'));
    onBooked?.(appointment);
  }

  const at = step === 'done' ? STEPS.length : STEPS.findIndex((s) => s.id === (step === 'confirm' ? 'slots' : step));

  return (
    <div className="bflow">
      <ol className="bflow-steps" aria-label="Booking steps">
        {STEPS.map((s, i) => <li key={s.id} className={i < at ? 'done' : i === at ? 'now' : ''}><span>{i < at ? <Icon name="check" size={12} stroke={3} /> : i + 1}</span>{s.label}</li>)}
      </ol>

      {step === 'check' && (
        <div className="stack" style={{ gap: 10 }}>
          <p className="bold">First, a few quick checks. Answer honestly: it keeps you and the patient safe.</p>
          <div className="bflow-check sys"><Icon name="check" size={16} /><span>{eligibility.lastDonationDate ? `Last donation ${fmtDate(eligibility.lastDonationDate)}. With the ${eligibility.gapDays}-day gap, you can donate from ${fmtDate(earliest)}.` : 'No earlier donation on record.'}</span></div>
          {CHECKS.map((c) => (
            <div key={c.id} className="bflow-check">
              <span>{c.text}</span>
              <div className="seg" role="group" aria-label={c.text}>
                <button aria-pressed={answers[c.id] === true} onClick={() => setAnswers({ ...answers, [c.id]: true })}>Yes</button>
                <button aria-pressed={answers[c.id] === false} onClick={() => setAnswers({ ...answers, [c.id]: false })}>No</button>
              </div>
            </div>
          ))}
          <div className="tiny muted">On the day, the centre also checks your haemoglobin (12.5 g/dL or more), blood pressure and pulse.</div>
          {failed.length > 0 && (
            <div className="callout callout-warn small"><Icon name="info" size={16} /><span><b>Not just yet.</b> {failed.map((f) => f.ifNo).join(' ')}</span></div>
          )}
          <div className="row">
            <button className="btn btn-primary" disabled={!allAnswered || failed.length > 0} onClick={() => setStep('place')}>Next: choose a place <Icon name="arrow" size={15} /></button>
            {!allAnswered && <button className="btn btn-ghost btn-sm" onClick={() => setAnswers(Object.fromEntries(CHECKS.map((c) => [c.id, true])))}>All of these are true for me</button>}
          </div>
        </div>
      )}

      {step === 'place' && (
        <div className="stack" style={{ gap: 12 }}>
          <p className="bold">Where should we look for a blood centre?</p>
          <div className="chip-row">
            <button className="chip" disabled={busy} onClick={useGps}><Icon name="pin" size={14} /> Use my location</button>
            {places.map((p) => <button key={p.id} className="chip" aria-pressed={prefs.location?.label === p.label} disabled={busy} onClick={() => chooseDistrict(p.id)}>{p.label}</button>)}
          </div>
          {prefs.location && <div className="small"><Icon name="pin" size={14} /> Searching near <b>{prefs.location.label}</b></div>}
          <div className="small bold">How far can you travel?</div>
          <div className="chip-row">
            {[5, 15, 30].map((km) => <button key={km} className="chip" aria-pressed={prefs.maxDistanceKm === km} onClick={() => setPrefs({ ...prefs, maxDistanceKm: km })}>Up to {km} km</button>)}
          </div>
          <div className="row">
            <button className="btn" onClick={() => setStep('check')}>Back</button>
            <button className="btn btn-primary" disabled={!prefs.location} onClick={() => setStep('when')}>Next: pick a date <Icon name="arrow" size={15} /></button>
          </div>
        </div>
      )}

      {step === 'when' && (
        <div className="stack" style={{ gap: 12 }}>
          <p className="bold">When would you like to come?</p>
          <div className="chip-row">
            {ranges.map((r) => <button key={r.id} className="chip" aria-pressed={range?.id === r.id} onClick={() => setRange(r)}>{r.label}</button>)}
            <label className="chip" aria-pressed={range?.id === 'pick'}>
              <Icon name="calendar" size={14} /> A specific day
              <input type="date" className="bflow-date" min={earliest} max={addDays(earliest, 20)} value={range?.id === 'pick' ? range.from : ''}
                onChange={(e) => e.target.value && setRange({ id: 'pick', from: e.target.value, to: e.target.value })} />
            </label>
          </div>
          <div className="small bold">Time of day</div>
          <div className="chip-row">
            {TIMES.map((t) => <button key={t.id} className="chip" aria-pressed={time === t.id} onClick={() => setTime(t.id)}>{t.label}</button>)}
          </div>
          <label className="row small" style={{ gap: 8 }}>
            <input type="checkbox" checked={Boolean(prefs.avoidHolidays)} onChange={(e) => setPrefs({ ...prefs, avoidHolidays: e.target.checked })} /> Skip public holidays
          </label>
          <div className="row">
            <button className="btn" onClick={() => setStep('place')}>Back</button>
            <button className="btn btn-primary" disabled={!range || busy} onClick={() => findSlots()}>Show open slots <Icon name="arrow" size={15} /></button>
          </div>
        </div>
      )}

      {step === 'slots' && (
        <div className="stack" style={{ gap: 10 }}>
          <p className="bold">{slots.length ? 'Best matches for you' : 'No slot fits those choices.'}</p>
          {slots.map((s) => (
            <button key={s.id} className={`slot-choice ${chosen?.id === s.id ? 'selected' : ''}`} onClick={() => { setChosen(s); setStep('confirm'); }}>
              <div style={{ textAlign: 'left' }}>
                <div className="bold">{fmtDate(s.date)} · {s.time}</div>
                <div className="small">{s.centre}</div>
                <div className="tiny muted">{s.reasons.join(' · ')}</div>
              </div>
              <Icon name="arrow" size={16} />
            </button>
          ))}
          {clientId && !token && slots.length > 0 && (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={connectCalendar}><Icon name="calendar" size={14} /> Hide times I am busy (connect Google Calendar)</button>
          )}
          {token && <div className="tiny muted">Your Google Calendar was checked. Busy times are hidden.</div>}
          <div className="row"><button className="btn" onClick={() => setStep('when')}>Change date or time</button></div>
        </div>
      )}

      {step === 'confirm' && chosen && (
        <div className="stack" style={{ gap: 12 }}>
          <p className="bold">Save this slot</p>
          <div className="bflow-summary">
            <div><Icon name="calendar" size={15} /> {fmtDate(chosen.date)} at {chosen.time} (about 45 minutes)</div>
            <div><Icon name="pin" size={15} /> {chosen.centre}, {chosen.district}{chosen.distanceKm != null ? ` · ${chosen.distanceKm} km` : ''}</div>
            <div><Icon name="info" size={15} /> This is not a reservation with the centre. {token ? 'With your consent, we also try to add a real Google Calendar event and send an email.' : 'You can add an optional calendar reminder on the next screen.'}</div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => setStep('slots')}>Back</button>
            <button className="btn btn-primary" disabled={busy} onClick={confirm}><Icon name="check" size={15} /> Save slot</button>
          </div>
        </div>
      )}

      {step === 'done' && booked && (
        <div className="stack" style={{ gap: 10 }}>
          <p className="bold">Your slot is saved.</p>
          <AppointmentPass appointment={booked} />
          {onClose && <button className="btn btn-ghost btn-sm" onClick={onClose}>Done</button>}
        </div>
      )}

      {error && <ErrorNote error={error} />}
    </div>
  );
}
