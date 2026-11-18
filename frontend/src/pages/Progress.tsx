/**
 * Progress: health between donations. Every donation is a free health check; the Donor's own apps show their
 * days in between, and this screen puts the two together: where they are in the Cycle, each result's band and
 * how it compares with donors their age, what moved alongside it, food that fits them, and their Cycle reports.
 * From results only: nothing here changes the score, eligibility or cover.
 */
import { useEffect, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { api, fmtDate, type WbBand, type WbMarker, type WbReport, type WbSummary } from '../api';
import type { PageProps } from '../App';
import { ErrorNote, Icon, Loading, useLoad } from '../ui';
import { habitOpener, openChat } from '../components/drop/chat';
import StoryViewer from '../components/drop/StoryViewer';
import BandBar from '../components/wellbeing/BandBar';
import FoodPanel from '../components/wellbeing/FoodPanel';
import FoodProfileSheet from '../components/wellbeing/FoodProfileSheet';
import { BUDGETS, DIETS, FOCUS_MARKER, HABITS, MARKER_FOCUS, REGIONS, SIGNAL_NAMES, STATUS_PILL, dayLabel, openWhy, takeFocus, wellbeingChanged } from '../components/wellbeing/wellbeing';
import '../components/wellbeing/wellbeing.css';

const PHASES = ['Recover', 'Build', 'Get ready', 'Ready to donate'];
const download = (name: string, data: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function Progress({ donorId, go, version }: PageProps) {
  const [tick, setTick] = useState(0);
  const { data, error, loading } = useLoad(() => api.wellbeing(donorId), [donorId, version, tick]);
  const [open, setOpen] = useState<string | null>(null);
  const [story, setStory] = useState<WbReport | null>(null);
  const [profile, setProfile] = useState(false);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener('wellbeing:changed', bump);
    window.addEventListener('drop:changed', bump);
    return () => { window.removeEventListener('wellbeing:changed', bump); window.removeEventListener('drop:changed', bump); };
  }, []);
  // A Card's "See foods" opens the marker it was about
  useEffect(() => { const f = takeFocus(); if (f) setOpen(FOCUS_MARKER[f] || f); }, []);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorNote error={error || 'Could not load'} />;

  const head = (
    <div className="page-head">
      <div>
        <div className="page-title">Between donations</div>
        <div className="page-sub">Every donation is a free health check. Your apps show your days in between; your results show what they did.</div>
      </div>
      <button className="btn" onClick={() => go('apps')}><Icon name="layers" size={16} /> Connected apps</button>
    </div>
  );
  if (data.newUser || !data.bands.length) {
    return (
      <div className="stack fade-in wb">
        {head}
        <div className="card empty">Your first donation's free health check will start your Progress. You can connect the apps you already use now.</div>
      </div>
    );
  }

  const watch = (visitId: string) => api.wbReport(donorId, visitId).then(setStory).catch(() => {});
  const focusMarker = data.focus ? FOCUS_MARKER[data.focus.key] : null;
  const foodFor = data.careLevels.find((l) => ['low_normal', 'below', 'doctor_first', 'urgent'].includes(l.level) && ['iron', 'b12', 'vitd'].includes(l.marker))
    || data.careLevels.find((l) => l.marker === data.focus?.key);

  return (
    <div className="stack fade-in wb">
      {head}
      <CycleCard data={data} />
      {data.readiness && data.readiness.items.length > 0 && <ReadyCard data={data} />}
      {foodFor && <FoodCard donorId={donorId} marker={foodFor.marker} version={tick} />}

      <section className="card">
        <div className="row between wrap" style={{ marginBottom: 8 }}>
          <div>
            <div className="card-title"><Icon name="flask" size={17} /> Your free health check</div>
            <div className="card-sub">From your last donation's lab panel. Tap a result to see what moved alongside it.</div>
          </div>
          {data.cycle && <span className="tiny muted">Results from {fmtDate(data.bands[0].date)}</span>}
        </div>
        <div className="stack" style={{ gap: 2 }}>
          {data.bands.map((b) => (
            <div key={b.marker}>
              <BandRow row={b} focus={b.marker === focusMarker} open={open === b.marker} onToggle={() => setOpen(open === b.marker ? null : b.marker)} />
              {open === b.marker && <MarkerDetail donorId={donorId} marker={b.marker} version={tick} hideFood={Boolean(foodFor && MARKER_FOCUS[b.marker] === foodFor.marker)} />}
            </div>
          ))}
        </div>
        <div className="tiny faint mt-12">Bands follow published guidance (ACC/AHA, NCEP, WHO, NBTC); proposed for this prototype, pending clinical review. The comparison uses Pratidaan donors of your sex and age band and shows only from 50%.</div>
      </section>

      <div className="grid grid-2">
        <AppsWeek data={data} onConnect={() => go('apps')} />
        <section className="card">
          <div className="card-title"><Icon name="history" size={17} /> Cycle reports</div>
          <div className="card-sub">What each Cycle did, told by your next donation's results</div>
          <div className="stack mt-12" style={{ gap: 8 }}>
            {data.reports.length === 0 && <div className="small muted">Your first Cycle report comes with your next donation's results.</div>}
            {data.reports.slice(0, 4).map((r) => (
              <div key={r.visitId} className="item">
                <span className="grow"><b>{r.title}</b><small>{r.status === 'completed' ? 'Donated' : 'Visit, no donation'}{r.seen ? '' : ' · new'}</small></span>
                <button className="btn btn-sm" onClick={() => watch(r.visitId)}><Icon name="play" size={14} /> Watch</button>
                <button className="btn btn-sm" title="Download this donation's results as FHIR (JSON)" onClick={() => api.wbFhir(donorId, r.visitId).then((b) => download(`pratidaan-results-${r.date}.fhir.json`, b))}>FHIR</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="row between wrap">
          <div>
            <div className="card-title"><Icon name="food" size={17} /> How you eat</div>
            <div className="card-sub">{data.foodProfile ? `${DIETS[data.foodProfile.diet]} · ${REGIONS[data.foodProfile.region]} · ${BUDGETS[data.foodProfile.budget]}` : 'Not set yet: Drop suggests vegetarian food until you tell it'}</div>
          </div>
          <button className="btn btn-sm" onClick={() => setProfile(true)}>{data.foodProfile ? 'Change' : 'Tell Drop how you eat'}</button>
        </div>
      </section>

      {story && <StoryViewer title={story.title} slides={story.slides} onClose={() => { const s = story; setStory(null); api.wbReportSeen(donorId, s.visitId).then(() => wellbeingChanged()).catch(() => {}); }} />}
      {profile && <ProfileLoader donorId={donorId} onClose={() => setProfile(false)} />}
    </div>
  );
}

function ProfileLoader({ donorId, onClose }: { donorId: string; onClose: () => void }) {
  const { data } = useLoad(() => api.wbFoodProfile(donorId), [donorId]);
  return data ? <FoodProfileSheet donorId={donorId} profile={data.profile} onClose={onClose} /> : null;
}

function CycleCard({ data }: { data: WbSummary }) {
  const c = data.cycle;
  const f = data.focus;
  const phaseIndex = c ? { recover: 0, build: 1, prep: 2, due: 3, waiting: 2 }[c.phase as 'recover'] ?? 1 : 0;
  const pct = c ? Math.min(100, Math.round((Math.min(c.day, c.length) / c.length) * 100)) : 0;
  return (
    <section className="card">
      <div className="wb-cycle">
        <div>
          <div className="stat-label">Your Cycle</div>
          {c && (
            <>
              <div className="bold mt-8" style={{ fontSize: 17 }}>{c.text}</div>
              <div className="wb-track" aria-label={`Day ${c.day} of ${c.length}`}><span style={{ width: `${Math.max(4, pct)}%` }} /></div>
              <div className="wb-phases">{PHASES.map((p, i) => <span key={p} className={i === phaseIndex ? 'on' : ''}>{p}</span>)}</div>
              <div className="small muted mt-12">
                <Icon name="calendar" size={14} /> {c.eligibleNow ? 'You can donate now: your next free health check is ready when you are.' : c.nextFrom ? `Next free health check (your next donation): from ${dayLabel(c.nextFrom)}` : 'Your next donation waits on your Goal.'}
              </div>
            </>
          )}
        </div>
        {f && (
          <div>
            <div className="row between wrap">
              <span className="stat-label">This Cycle's focus</span>
              {f.status.state !== 'none' && <span className={`pill ${STATUS_PILL[f.status.state]}`}>{f.status.label}</span>}
            </div>
            <div className="bold mt-8" style={{ fontSize: 17 }}>{f.label}</div>
            <div className="small muted">{f.reason}</div>
            <div className="stack mt-12" style={{ gap: 6 }}>
              {f.targets.filter((t) => !(f.urgent && t.habit === 'movement')).map((t) => {
                const h = HABITS.find((x) => x.id === t.habit);
                return (
                  <div key={t.text} className="item">
                    <Icon name={h?.icon || 'flag'} size={16} />
                    <span className="grow"><b>{t.text}</b><small>{t.status.text}</small></span>
                    <span className={`pill ${STATUS_PILL[t.status.state]}`}>{t.status.state === 'on' ? 'On track' : t.status.state === 'drift' ? 'Nearly' : t.status.state === 'off' ? 'Behind' : 'No data'}</span>
                  </div>
                );
              })}
            </div>
            <div className="row wrap mt-12">
              {f.targets.filter((t) => !(f.urgent && t.habit === 'movement')).slice(0, 1).map((t) => (
                <button key={t.habit} className="btn btn-sm btn-primary" onClick={() => openChat(habitOpener(HABITS.find((h) => h.id === t.habit)?.name || 'Movement'))}>Plan this week with Drop</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function BandRow({ row, focus, open, onToggle }: { row: WbBand; focus: boolean; open: boolean; onToggle: () => void }) {
  return (
    <button className="wb-band-row" aria-expanded={open} onClick={onToggle}>
      <span>
        <b className="small">{row.label}</b>
        {focus && <span className="pill pill-brand" style={{ marginLeft: 6 }}>Focus</span>}
        <span className="v" style={{ display: 'block' }}>{row.value} <span className="tiny muted">{row.unit}</span></span>
      </span>
      <BandBar row={row} />
      <span className="small hide-sm">
        <b style={{ display: 'block' }}>{row.band.label}{row.moved > 0 ? ' ▲' : row.moved < 0 ? ' ▼' : ''}</b>
        <span className="muted">{row.previous ? `Was ${row.previous.text}` : 'First result'}{row.percentile ? ` · ${row.percentile}` : ''}</span>
      </span>
      <Icon name="chevron" size={16} className={open ? 'rot90' : undefined} />
    </button>
  );
}

/** A result over the donor's donations, with the signal their apps recorded in each Cycle before it. */
function MarkerDetail({ donorId, marker, version, hideFood }: { donorId: string; marker: string; version: number; hideFood?: boolean }) {
  const { data, error } = useLoad(() => api.wbMarker(donorId, marker), [donorId, marker, version]);
  if (error) return <div className="wb-detail"><ErrorNote error={error} /></div>;
  if (!data) return <div className="wb-detail"><Loading lines={2} /></div>;
  return (
    <div className="wb-detail stack" style={{ gap: 14 }}>
      <HistoryChart data={data} />
      {data.history.sentence
        ? <div className="callout callout-info small"><Icon name="activity" size={16} /><span>{data.history.sentence}</span></div>
        : <div className="small muted">{data.history.linked.length ? `Connect an app that records ${data.history.linked.map((s) => (SIGNAL_NAMES[s] || s).toLowerCase()).join(' or ')} to see what moved alongside this result between donations.` : 'Your next donation will show how this changes.'}</div>}
      {data.row?.band && <div className="tiny faint">{data.row.band.label}: {data.row.band.source}</div>}
      {data.food && !hideFood && <FoodPanel donorId={donorId} food={data.food} compact />}
    </div>
  );
}

function HistoryChart({ data }: { data: WbMarker }) {
  const signal = data.history.linked.find((s) => data.history.points.some((p) => p.signals[s] !== undefined));
  const points = data.history.points.map((p) => ({ ...p, label: fmtDate(p.date), sig: signal ? p.signals[signal] ?? null : null }));
  if (points.length < 2) return <div className="small muted">One result so far: your next donation starts the trend.</div>;
  return (
    <div>
      <div className="small bold">{data.label} at each donation{signal ? ` · ${SIGNAL_NAMES[signal] || signal} in the Cycle before (bars)` : ''}</div>
      <div style={{ height: 210 }} role="img" aria-label={`${data.label}: ${points.map((p) => p.text).join(', ')}`}>
        <ResponsiveContainer>
          <ComposedChart data={points} margin={{ top: 22, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
            <YAxis yAxisId="m" tick={{ fontSize: 11, fill: 'var(--muted)' }} domain={['auto', 'auto']} />
            {signal && <YAxis yAxisId="s" orientation="right" hide />}
            {signal && <Bar yAxisId="s" dataKey="sig" fill="var(--info-soft)" stroke="var(--info)" radius={[4, 4, 0, 0]} isAnimationActive={false}><LabelList dataKey="sig" position="insideTop" style={{ fontSize: 10, fill: 'var(--info)' }} formatter={(v: number) => (v == null ? '' : signal === 'steps' ? Math.round(v).toLocaleString('en-IN') : v)} /></Bar>}
            <Line yAxisId="m" type="monotone" dataKey="value" stroke="var(--brand)" strokeWidth={2.5} isAnimationActive={false} dot={{ r: 4.5, fill: 'var(--brand)' }}>
              <LabelList dataKey="text" position="top" style={{ fontSize: 11, fill: 'var(--text)' }} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FoodCard({ donorId, marker, version }: { donorId: string; marker: string; version: number }) {
  const { data } = useLoad(() => api.wbFoods(donorId, marker), [donorId, marker, version]);
  if (!data) return null;
  return <section className="card"><FoodPanel donorId={donorId} food={data} /></section>;
}

/** Before the next donation: what the results and the apps say about feeling well on the day (never a rule). */
function ReadyCard({ data }: { data: WbSummary }) {
  const r = data.readiness!;
  return (
    <section className="card">
      <div className="row between wrap">
        <div>
          <div className="card-title"><Icon name="check" size={17} /> {r.soon ? 'Ready for your next donation?' : 'Getting ready for your next donation'}</div>
          <div className="card-sub">{r.eligibleNow ? 'You can donate now.' : r.from ? `You can donate from ${dayLabel(r.from)}.` : 'Your donation waits on your Goal.'} From your last results and your apps.</div>
        </div>
        <span className={`pill ${r.done === r.total ? 'pill-good' : 'pill-info'}`}>{r.done} of {r.total} looking good</span>
      </div>
      <div className="stack mt-12" style={{ gap: 6 }}>
        {r.items.map((i) => (
          <div key={i.id} className="item">
            <Icon name={i.state === 'on' ? 'check' : 'info'} size={16} />
            <span className="grow"><b>{i.text}</b><small>{i.note || `From ${i.source}`}</small></span>
            {i.state && <span className={`pill ${STATUS_PILL[i.state]}`}>{i.state === 'on' ? 'Good' : i.state === 'drift' ? 'Nearly' : 'Not yet'}</span>}
          </div>
        ))}
      </div>
      <div className="tiny faint mt-8">{r.note}</div>
    </section>
  );
}

function AppsWeek({ data, onConnect }: { data: WbSummary; onConnect: () => void }) {
  const metrics = data.habits.flatMap((h) => h.metrics);
  const stats = metrics.map((m) => ({ k: m.label, v: m.value, t: m.target, s: m.state, app: m.app }));
  return (
    <section className="card">
      <div className="row between wrap">
        <div>
          <div className="card-title"><Icon name="activity" size={17} /> From your apps, last 7 days</div>
          <div className="card-sub">{data.connections.length ? data.connections.map((c) => `${c.label}${c.mode === 'demo' ? ' (demo)' : c.mode === 'sandbox' ? ' (sandbox)' : ''}`).join(' · ') : 'Nothing connected yet'}</div>
        </div>
        <button className="btn btn-sm" onClick={onConnect}>{data.connections.length ? 'Manage' : 'Connect'}</button>
      </div>
      {stats.length ? (
        <div className="wb-stats mt-12">{stats.map((s) => (
          <div key={s.k} className="wb-stat">
            <div className="k">{s.k}</div>
            <div className="v" style={{ fontSize: 16 }}>{s.v}</div>
            {s.s && <span className={`pill ${STATUS_PILL[s.s]}`} style={{ marginTop: 6 }}>{s.s === 'on' ? 'On target' : s.s === 'drift' ? 'Nearly' : 'Below target'}</span>}
            {s.t && <div className="wb-src mt-8">Healthy: {s.t}</div>}
            <div className="wb-src">{s.app}</div>
          </div>
        ))}</div>
      ) : (
        <p className="small muted mt-12">Connect the watch, habit or food app you already use. Pratidaan reads what they record; it doesn't ask you to track anything twice.</p>
      )}
      {data.focus && <button className="wb-link small mt-12" onClick={() => openWhy(`food:${data.focus!.key === 'iron' ? 'iron' : data.focus!.key}`)}>How Drop decides what to suggest</button>}
    </section>
  );
}
