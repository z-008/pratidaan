import { useEffect, useRef, useState } from 'react';
import { CartesianGrid, LabelList, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, fmtDate, type DropGoal, type Extraction, type HealthData } from '../api';
import type { PageProps, Screen } from '../App';
import { AIBadge, ErrorNote, Icon, Loading, Section, Thinking, useLoad } from '../ui';
import DropLine from '../components/drop/DropLine';
import { ReadingsSection } from '../components/drop/HealthDrop';
import type { DropReading, DropView } from '../api';
import Checkup from '../components/drop/Checkup';
import { bookCheckup } from '../components/Copilot';
import { habitOpener, openChat } from '../components/drop/chat';
import BpReading from '../components/drop/BpReading';
import './health.css';

const MARKERS: { key: string; label: string; unit: string; good?: [number, number] }[] = [
  { key: 'bp', label: 'Blood pressure', unit: 'mmHg', good: [90, 120] },
  { key: 'hb', label: 'Haemoglobin', unit: 'g/dL' },
  { key: 'hba1c', label: 'HbA1c (sugar)', unit: '%', good: [4, 5.7] },
  { key: 'ldl', label: 'LDL cholesterol', unit: 'mg/dL', good: [0, 130] },
  { key: 'tg', label: 'Triglycerides', unit: 'mg/dL', good: [0, 150] },
  { key: 'ferritin', label: 'Ferritin (iron)', unit: 'ng/mL' },
  { key: 'weight', label: 'Weight', unit: 'kg' },
];

/** The three Habits (CONTEXT.md). Week plans come in build plan step 6; until then each shows "Plan this week". */
const HABITS = [
  { id: 'movement', name: 'Movement', icon: 'walk' },
  { id: 'food', name: 'Food', icon: 'food' },
  { id: 'mind', name: 'Mind', icon: 'mind' },
];

const TAGS: Record<string, { label: string; pill: string }> = {
  movement: { label: 'Movement', pill: 'pill-brand' },
  food: { label: 'Food', pill: 'pill-good' },
  mind: { label: 'Mind', pill: 'pill-ai' },
  doctor: { label: 'See a doctor', pill: 'pill-warn' },
  reading: { label: 'Add a reading', pill: 'pill-info' },
};

const day = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** "Mon 12 – Sun 18 Oct": the week ends on Sunday, with the Weekly report. */
function weekLabel(today: string) {
  const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const sunday = addDays(monday, 6);
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  return `${day(monday, sameMonth ? { weekday: 'short', day: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' })} – ${day(sunday, { weekday: 'short', day: 'numeric', month: 'short' })}`;
}

const planHabit = (name: string) => openChat(habitOpener(name));

export default function Health({ donorId, go, version, refresh, focus }: PageProps & { focus: Screen }) {
  const { data, error, loading } = useLoad(() => api.health(donorId), [donorId, version]);
  const [dropView, setDropView] = useState<DropView | null>(null);
  useEffect(() => { api.drop(donorId).then(setDropView).catch(() => setDropView(null)); }, [donorId, version]);
  useEffect(() => {
    const reload = () => api.drop(donorId).then(setDropView).catch(() => {});
    window.addEventListener('drop:changed', reload);
    return () => window.removeEventListener('drop:changed', reload);
  }, [donorId]);
  const planRef = useRef<HTMLDivElement>(null);
  const labsRef = useRef<HTMLDivElement>(null);
  const checkupsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = focus === 'plan' ? planRef.current : focus === 'labs' ? labsRef.current : focus === 'checkups' ? checkupsRef.current : null;
    if (target && data) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }, [focus, data]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorNote error={error || 'Could not load'} />;
  const changed = (v: DropView) => { setDropView(v); window.dispatchEvent(new CustomEvent('drop:changed')); };
  const checkups = <CheckupsSection donorId={donorId} view={dropView} onChange={changed} />;

  // No donations yet: no results, score or trends to show
  if (!data.vitals.length) {
    return (
      <div className="stack fade-in health-page">
        <div className="page-head">
          <div>
            <div className="page-title">Your health</div>
            <div className="page-sub">From the free lab panel on every donation sample, plus any reports you add.</div>
          </div>
        </div>
        <div className="card empty">No results yet. Every donation includes a free health check, and your results will show here after your first one.</div>
        <div ref={checkupsRef}>{checkups}</div>
      </div>
    );
  }

  const goals = dropView?.goals || [];
  const active = goals.filter((g) => g.state === 'active');
  const upNext = goals.filter((g) => g.state === 'upnext');

  return (
    <div className="stack fade-in health-page">
      <div className="page-head">
        <div>
          <div className="page-title">Your health</div>
          <div className="page-sub">From the free lab panel on every donation sample, plus any reports you add.</div>
        </div>
        <button className="btn" onClick={() => go('labs')}><Icon name="upload" size={16} /> Add a lab report</button>
      </div>
      <DropLine donorId={donorId} screen="health" version={version} />

      <div ref={planRef} className="stack">
        <HabitShelf />
        {dropView && <ThisWeek view={dropView} />}
        {active.map((g) => <GoalCard key={g.id} goal={g} donorId={donorId} go={go} onChange={(v) => { changed(v); refresh(); }} />)}
        {upNext.map((g) => <UpNextCard key={g.id} goal={g} />)}
      </div>

      <div className="grid split">
        <ScoreCard donorId={donorId} data={data} version={version} />
        <ChatsCard goals={goals} since={data.eligibility.lastDonationDate} today={dropView?.clock.date || null} />
      </div>

      <div className="grid grid-3">
        <KeepAnEye view={dropView} />
        <section className="card">
          <div className="card-title">From your doctor</div>
          <div className="card-sub">Diagnoses and advice you've confirmed from a prescription</div>
          <p className="small muted mt-12">Nothing added yet.</p>
        </section>
        <div ref={checkupsRef}>{checkups}</div>
      </div>

      <div ref={labsRef}><LabReader key={focus === 'labs' ? 'labs' : 'reader'} donorId={donorId} onSaved={refresh} focusLabs={focus === 'labs'} /></div>
      <Trends data={data} added={dropView?.readings || []} />
      <ReadingsSection donorId={donorId} view={dropView} data={data} onChange={(v) => { setDropView(v); refresh(); }} />
    </div>
  );
}

/** Movement, Food and Mind, each with this week's line. Empty until Week plans are built (step 6). */
function HabitShelf() {
  return (
    <section className="card">
      <div className="row wrap" style={{ alignItems: 'baseline', gap: 8, marginBottom: 12 }}><span className="card-title">Habits</span><span className="muted small">· no Week plan yet</span></div>
      <div className="habit-row">
        {HABITS.map((h) => (
          <button key={h.id} className="hb idle" onClick={() => planHabit(h.name)}>
            <span className="disc"><Icon name={h.icon} size={22} /></span>
            <span><b>{h.name}</b><span className="s">Plan this week</span></span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** One row per Habit for the week, ending on Sunday. Week plans fill it in at step 6. */
function ThisWeek({ view }: { view: DropView }) {
  return (
    <section className="card">
      <div className="row between wrap">
        <div className="card-title">This week</div>
        <span className="tiny muted">{weekLabel(view.clock.date)}{view.budget.report === 'week' ? ' · ends with your Weekly report' : ''}</span>
      </div>
      <div className="stack mt-12" style={{ gap: 8 }}>
        {HABITS.map((h) => (
          <div key={h.id} className="item">
            <span className="disc sm"><Icon name={h.icon} size={18} /></span>
            <span className="grow"><b>{h.name}</b><small>No Week plan</small></span>
            <button className="btn btn-sm" onClick={() => planHabit(h.name)}>Plan this week</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function GoalCard({ goal: g, donorId, go, onChange }: { goal: DropGoal; donorId: string; go: (s: Screen) => void; onChange: (v: DropView) => void }) {
  const [adding, setAdding] = useState(false);
  const steps = g.writeup?.steps || [];
  const addReading = () => (g.trend?.marker === 'bp' ? setAdding(!adding) : go('labs'));
  return (
    <section className="card goal-card">
      <div className="row between wrap" style={{ marginBottom: 14 }}>
        <div className="card-title">Your Goal <span className="card-sub" style={{ margin: 0, fontWeight: 500 }}>· from your results, up to two at a time</span></div>
        <div className="row wrap" style={{ gap: 6 }}>
          {g.severity === 'urgent' && <span className="pill pill-bad">Urgent</span>}
          {g.stopsDonation && <span className="pill pill-warn">Your next donation waits on this</span>}
        </div>
      </div>
      <div className="goal-grid">
        <div>
          <div className="goal-name">{g.name}</div>
          <div className="row small bold mt-8"><Icon name="flag" size={16} />Target: {g.target}</div>
          {g.writeup && <p className="small mt-12" style={{ lineHeight: 1.55 }}><span className="pill pill-neutral" style={{ marginRight: 6 }}>Why it matters</span>{g.writeup.why}</p>}
          <div className="tiny muted bold mt-16">This week</div>
          <div className="item muted mt-8">Nothing planned yet. Open {g.name} to plan this week.</div>
          {steps.length > 0 && <div className="tiny muted bold mt-16">Steps that help</div>}
          <div className="stack mt-8" style={{ gap: 8 }}>
            {steps.map((s) => (
              <div key={s.text} className="item"><span className={`pill ${TAGS[s.tag].pill}`}>{TAGS[s.tag].label}</span><span className="grow">{s.text}</span></div>
            ))}
          </div>
          <div className="row wrap mt-16">
            <button className="btn btn-primary" onClick={() => openChat(g.chat)}>Open {g.name}</button>
            <button className="btn" aria-expanded={g.trend?.marker === 'bp' ? adding : undefined} onClick={addReading}>Add a reading</button>
          </div>
          {adding && <BpReading donorId={donorId} onSaved={(v) => { setAdding(false); onChange(v); }} />}
          <details className="goal-more mt-12">
            <summary className="small bold"><Icon name="chevron" size={16} />Where these steps come from</summary>
            <ul className="small muted">{steps.map((s) => <li key={s.text}><b>{s.text}:</b> {s.evidence.join('; ')}</li>)}</ul>
            <p className="small muted"><b>Note for your doctor:</b> {g.doctorNote}</p>
            <p className="tiny faint">From fixed rules, not AI. Not a diagnosis: a doctor confirms every finding and decides on any treatment.</p>
          </details>
        </div>
        {g.trend && (
          <div className="trend-box">
            <div className="small muted">{g.trend.words}</div>
            <div className="trend-range">{g.trend.range}</div>
            <GoalChart trend={g.trend} />
            {(g.also || []).map((a) => <div key={a} className="row wrap small muted mt-8"><span className="pill pill-info">Also in this Goal</span>{a}</div>)}
            <div className="small muted mt-8"><Icon name="calendar" size={14} /> Next check: {g.nextCheck}</div>
          </div>
        )}
      </div>
    </section>
  );
}

/** The lead marker over time against the target line. Values are printed on the points, so nothing needs hover. */
function GoalChart({ trend }: { trend: NonNullable<DropGoal['trend']> }) {
  const points = trend.points.map((p) => ({ ...p, label: fmtDate(p.date), text: trend.marker === 'bp' ? `${p.value}/${p.value2}` : String(p.value) }));
  const values = points.map((p) => p.value).concat(trend.line != null ? [trend.line] : []);
  const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.25, Math.max(...values) * 0.04);
  const home = (p: { source?: string }) => p.source === 'yours' || p.source === 'report' || p.source === 'uploaded_report';
  return (
    <>
    <div style={{ height: 190 }} role="img" aria-label={`${trend.label} ${points.map((p) => p.text).join(', ')}${trend.line != null ? ` against a target of ${trend.line}` : ''}`}>
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 22, right: 28, left: -16, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} domain={[Math.floor(Math.min(...values) - pad), Math.ceil(Math.max(...values) + pad)]} />
          {trend.line != null && <ReferenceLine y={trend.line} stroke="var(--good)" strokeDasharray="5 4" label={{ value: `Target ${trend.line}`, position: 'insideTopRight', fill: 'var(--good)', fontSize: 11 }} />}
          <Line type="monotone" dataKey="value" stroke="var(--brand)" strokeWidth={2.5} isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const p = points[props.index ?? 0];
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={4.5} fill={home(p) ? 'var(--surface)' : 'var(--brand)'} stroke="var(--brand)" strokeWidth={2} />;
            }}>
            <LabelList dataKey="text" position="top" style={{ fontSize: 11, fill: 'var(--text)' }} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
    {points.some(home) && <div className="tiny faint">Hollow points: readings and reports you added.</div>}
    </>
  );
}

function UpNextCard({ goal: g }: { goal: DropGoal }) {
  return (
    <section className="card">
      <div className="row between wrap">
        <div>
          <div className="tiny muted bold">Up next</div>
          <div className="card-title mt-8">{g.name}</div>
          <div className="small muted">{g.trend ? `${g.trend.words}: ${g.trend.range}` : ''} · Starts when {g.startsWhen} is done</div>
        </div>
        <button className="btn" onClick={() => openChat(g.chat)}>Open</button>
      </div>
    </section>
  );
}

/** The Health score, from results only (self-reported habits never change it), with the cover line under it. */
function ScoreCard({ donorId, data, version }: { donorId: string; data: HealthData; version: number }) {
  const latest = data.currentScore;
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => { api.dropLine(donorId, 'cover').then((l) => setCover(l.text)).catch(() => setCover(null)); }, [donorId, version]);
  return (
    <section className="card">
      <div className="row between"><div className="card-title">Health score</div><span className="tiny faint">From results only</span></div>
      <div className="row mt-8" style={{ alignItems: 'baseline' }}><span className="stat-value" style={{ fontSize: 40 }}>{latest?.score ?? '—'}</span><span className="muted">/100</span></div>
      <div className="stack mt-12" style={{ gap: 8 }}>
        {latest?.parts.map((p) => (
          <div key={p.name}>
            <div className="row between small"><span>{p.name} <span className="faint tiny">· {p.value}</span></span><span className="bold">{p.points}</span></div>
            <div className="progress" style={{ height: 6 }}><span style={{ width: `${p.points}%`, background: p.points >= 80 ? 'var(--good)' : p.points >= 55 ? 'var(--warn)' : 'var(--bad)' }} /></div>
          </div>
        ))}
      </div>
      {cover && <div className="callout callout-info small mt-12"><Icon name="shield" size={16} /><span>{cover}</span></div>}
      <div className="tiny faint mt-12">Score from fixed rules (not AI), including uploaded results. Feeds the cover model; earlier donation scores stay unchanged.</div>
    </section>
  );
}

const STATE_LINE: Record<string, string> = { upnext: 'Up next', done: 'Done', stopped: 'Stopped' };

/** The Chats with Drop: each opens in the side sheet. Past Cycles waits for stored Chats (build plan step 3). */
function ChatsCard({ goals, since, today }: { goals: DropGoal[]; since: string | null; today: string | null }) {
  // A Cycle runs from one donation to the next, or 120 days for a Donor who isn't donating
  const inCycle = since && today && Date.parse(today) - Date.parse(since) < 120 * 864e5;
  return (
    <section className="card">
      <div className="card-title">Your Chats with Drop</div>
      <button className="row-btn mt-8" onClick={() => openChat()}><span className="grow"><b className="small">General</b><small>{inCycle ? `This Cycle, since your ${day(since, { day: 'numeric', month: 'short' })} donation` : 'This Cycle'}</small></span></button>
      {goals.length > 0 && <div className="group-h">{goals.length > 1 ? 'Goals' : 'Goal'}</div>}
      {goals.map((g) => (
        <button key={g.id} className="row-btn" onClick={() => openChat(g.chat)}>
          <span className="grow"><b className="small">{g.name}</b><small>{g.state === 'active' ? `Target: ${g.target}` : STATE_LINE[g.state]}</small></span>
        </button>
      ))}
      <div className="group-h">Habits</div>
      {HABITS.map((h) => <button key={h.id} className="row-btn" onClick={() => planHabit(h.name)}><span className="grow"><b className="small">{h.name}</b><small>Not started</small></span></button>)}
    </section>
  );
}

function KeepAnEye({ view }: { view: DropView | null }) {
  const list = view?.keepAnEye || [];
  return (
    <section className="card">
      <div className="card-title">Keep an eye on</div>
      <div className="card-sub">Rechecked at your next donation, no Goal of their own</div>
      {!list.length && <div className="callout mt-12" style={{ background: 'var(--good-soft)' }}><span style={{ color: 'var(--good)' }}><Icon name="check" /></span><span className="small">Nothing else. Your other results are in the healthy range.</span></div>}
      <div className="stack mt-12" style={{ gap: 8 }}>
        {list.map((f) => <div key={f.id} className="item"><span className="grow"><b>{f.title}</b><small>{f.detail}</small></span></div>)}
      </div>
    </section>
  );
}

function CheckupsSection({ donorId, view, onChange }: { donorId: string; view: DropView | null; onChange: (v: DropView) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!view) return null;
  const checkups = view.bookings.filter((b) => b.kind === 'care');

  async function cancel(bookingId: string, reschedule: boolean) {
    setBusy(true);
    setError(null);
    try {
      onChange(await api.dropCancelBooking(donorId, bookingId, reschedule));
      if (reschedule) bookCheckup();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-title">Check-ups</div>
      <div className="card-sub">{checkups.length ? `${checkups.length} visit${checkups.length === 1 ? '' : 's'} coming up` : 'Clinic times shown are not confirmed availability'}</div>
      {checkups.length === 0 && <p className="small muted mt-12">No check-up booked. These times don't reserve a visit; contact a care provider to arrange one.</p>}
      <div className="stack mt-12" style={{ gap: 10 }}>
        {checkups.map((b) => <Checkup key={b.id} booking={b} busy={busy} onChange={() => cancel(b.id, true)} onCancel={() => cancel(b.id, false)} />)}
      </div>
      <button className="btn btn-sm mt-12" onClick={() => bookCheckup()}><Icon name="calendar" size={14} /> Book a check-up</button>
      {error && <ErrorNote error={error} />}
    </section>
  );
}

function Trends({ data, added }: { data: HealthData; added: DropReading[] }) {
  const [marker, setMarker] = useState('bp');
  const def = MARKERS.find((m) => m.key === marker)!;
  let points: { date: string; value: number; value2?: number; source?: string }[] = [];
  if (marker === 'bp') {
    points = [
      ...data.vitals.map((v) => ({ date: v.date, value: v.systolic, value2: v.diastolic, source: 'donation' })),
      ...added.filter((r) => r.marker === 'bp').map((r) => ({ date: r.date, value: r.s!, value2: r.d!, source: 'yours' })),
    ].sort((a, b) => a.date.localeCompare(b.date));
  }
  else if (marker === 'weight') points = data.vitals.map((v) => ({ date: v.date, value: v.weightKg }));
  else points = (data.labs[marker] || []).map((o) => ({ date: o.date, value: o.value, source: o.source }));
  const available = MARKERS.filter((m) => m.key === 'bp' || m.key === 'weight' || (data.labs[m.key] || []).length);
  // The axis always reaches the healthy limit (5.7% HbA1c, 120 systolic…), so the shaded band shows and a small change isn't stretched to fill the chart
  const values = points.flatMap((p) => (p.value2 != null ? [p.value, p.value2] : [p.value])).concat(def.good ? [def.good[1]] : []);
  const lo0 = values.length ? Math.min(...values) : 0;
  const hi0 = values.length ? Math.max(...values) : 1;
  const span = Math.max(hi0 - lo0, hi0 * 0.05, 0.1);
  const step = span <= 2 ? 0.1 : span <= 20 ? 1 : span <= 100 ? 5 : 10;
  const domain: [number, number] = [Math.max(0, Math.floor((lo0 - span * 0.1) / step) * step), Math.ceil((hi0 + span * 0.1) / step) * step];
  const round = (n: number) => Number(n.toFixed(step < 1 ? 1 : 0));

  return (
    <Section title={<><Icon name="trend" size={18} /> Trends across your donations</>} sub="Each point is one donation visit, an uploaded report or a reading you added" collapsible defaultOpen={false}
      right={<div className="tabs">{available.map((m) => <button key={m.key} className={`tab ${marker === m.key ? 'active' : ''}`} onClick={() => setMarker(m.key)}>{m.label}</button>)}</div>}>
      <div style={{ height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={points.map((p) => ({ ...p, label: fmtDate(p.date), text: p.value2 != null ? `${p.value}/${p.value2}` : String(p.value) }))} margin={{ top: 22, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} domain={domain.map(round)} allowDataOverflow tickFormatter={(v: number) => String(round(v))} unit={marker === 'hba1c' ? '%' : ''} />
            {def.good && <ReferenceArea y1={def.good[0]} y2={def.good[1]} ifOverflow="hidden" fill="var(--good)" fillOpacity={0.12} />}
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} formatter={(v, n) => [`${v} ${def.unit}`, n === 'value2' ? 'Diastolic' : marker === 'bp' ? 'Systolic' : def.label]} />
            <Line type="monotone" dataKey="value" stroke="#c8102e" strokeWidth={2.5} dot={{ r: 5 }}>
              {/* Each value is printed on its point, so reading the chart never needs hover */}
              <LabelList dataKey={marker === 'bp' ? 'text' : 'value'} position="top" style={{ fontSize: 11, fill: 'var(--text)' }} />
            </Line>
            {marker === 'bp' && <Line type="monotone" dataKey="value2" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 4 }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {def.good && <div className="tiny faint">Shaded band: healthy range ({marker === 'bp' ? `top number ${def.good[0]}–${def.good[1]}` : `under ${def.good[1]}${marker === 'hba1c' ? '%' : ''}`}).</div>}
    </Section>
  );
}

const SAMPLE_REPORT = `SRI SAI DIAGNOSTICS, JAYANAGAR · NABL Accredited
Patient: (name withheld)   Age/Sex: 34/M   Collected: 02-Oct-2026
-------------------------------------------------------------
LIPID PROFILE
Cholesterol, Total            5.4    mmol/L   (<5.2)
Triglycerides                 2.31   mmol/L   (<1.7)
HDL Cholesterol               1.04   mmol/L   (>1.0)
LDL Cholesterol (calc)        3.58   mmol/L   (<3.4)
GLYCATED HAEMOGLOBIN
HbA1c                         38     mmol/mol
LIVER FUNCTION
SGPT (ALT)                    41     U/L      (<45)
THYROID
Thyroid Stimulating Hormone   2.9    µIU/mL   (0.4-4.5)
Vitamin D (25-OH)             17.2   ng/mL    (30-100)
Urine routine: NAD`;

function LabReader({ donorId, onSaved, focusLabs }: { donorId: string; onSaved: () => void; focusLabs: boolean }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<(Extraction & { aiUnavailable?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setErr('Please use an image under 5 MB');
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function extract() {
    setBusy(true);
    setErr(null);
    setSaved(null);
    try {
      setResult(await api.extractLabs(donorId, image ? { image, text: text || undefined } : { text }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.saveLabs(donorId, result);
      setSaved(`${r.saved} results added (${fmtDate(r.date)}). The current score and cover model now use them; earlier donation scores remain unchanged.`);
      setResult(null);
      setText('');
      setImage(null);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={<><Icon name="doc" size={18} /> Add an outside lab report <AIBadge label="GenAI" /></>}
      sub="AI can read text or photos and map recognised tests to your timeline. Review every extracted value before saving; do not upload a real person's medical records to a shared preview account."
      collapsible defaultOpen={focusLabs}>
      <div className="grid grid-2">
        <div className="stack" style={{ gap: 10 }}>
          <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the text of a lab report…" aria-label="Lab report text" />
          <div className="row wrap">
            <button className="btn btn-sm" onClick={() => setText(SAMPLE_REPORT)}>Use a sample report</button>
            <label className="btn btn-sm"><Icon name="upload" size={14} /> Photo<input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} /></label>
            {image && <span className="pill pill-info">Image attached <button className="btn-ghost" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => setImage(null)} aria-label="Remove image">×</button></span>}
          </div>
          <button className="btn btn-ai" onClick={extract} disabled={busy || (!text.trim() && !image)}><Icon name="sparkles" size={16} /> Read report</button>
          {busy && <Thinking label="Reading the report, matching tests, converting units…" />}
          {err && <ErrorNote error={err} />}
          {saved && <div className="callout small" style={{ background: 'var(--good-soft)' }}><Icon name="check" size={16} /> {saved}</div>}
        </div>
        <div>
          {!result && <div className="empty small">Extracted results appear here for you to check before they are saved.</div>}
          {result && (
            <div className="stack fade-in" style={{ gap: 10 }}>
              <div className="small"><b>{result.labName || 'Lab'}</b> · {result.reportDate ? fmtDate(result.reportDate) : 'date not printed'}</div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Printed as</th><th>Mapped to</th><th>Value</th><th>Before</th></tr></thead>
                  <tbody>
                    {result.results.map((r) => (
                      <tr key={r.marker + r.printedName} style={{ opacity: r.plausible ? 1 : 0.5 }}>
                        <td>{r.printedName}<br /><span className="tiny faint">{r.printedValue} {r.printedUnit}</span></td>
                        <td>{r.name}<br /><span className="tiny faint">LOINC {r.loinc}</span></td>
                        <td className="bold">{r.value} <span className="tiny muted">{r.unit}</span>{!r.plausible && <div className="tiny" style={{ color: 'var(--bad)' }}>implausible — skipped</div>}{r.confidence !== 'high' && <div className="tiny" style={{ color: 'var(--warn)' }}>{r.confidence} confidence</div>}</td>
                        <td className="small muted">{r.previous ? `${r.previous.value} (${fmtDate(r.previous.date)})` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.notes && <div className="tiny muted"><b>Conversions:</b> {result.notes}</div>}
              {result.unmapped.length > 0 && <div className="tiny faint">Not tracked: {result.unmapped.join(', ')}</div>}
              <div className="row"><button className="btn btn-primary" disabled={busy} onClick={save}>Save results</button><button className="btn" onClick={() => setResult(null)}>Discard</button></div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
