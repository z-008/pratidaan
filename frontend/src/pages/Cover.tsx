import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, fmtDate, rupees, type CoverData } from '../api';
import type { PageProps } from '../App';
import { ErrorNote, Icon, Loading, Section, useLoad } from '../ui';
import DropLine from '../components/drop/DropLine';
import { ChoiceSwitch } from '../components/Choices';

const LADDER = [500000, 600000, 700000, 800000];

const INSURER_NOTE = 'No insurer receives anything in this illustration.';

/** What the insurer switch does right now, e.g. "On: your cover is ₹6 lakh. Off: it stays at ₹5 lakh." */
function insurerEffect(e: CoverData['insurerEffect']) {
  const on = e.on > e.off ? `On: your cover is ${rupees(e.on)}.`
    : e.needsVisit ? `On: your cover rises to ${rupees(e.qualifies)} after one more monitored visit this year.`
      : e.next && e.scoreForNext != null ? `On: your cover can rise with your score (next step ${rupees(e.next)} at ${e.scoreForNext}).`
        : 'On: your cover can rise with your score.';
  return `${on} Off: it stays at ${rupees(e.off)}.`;
}

export default function Cover({ donorId, go, version }: PageProps) {
  const { data, error, loading, reload } = useLoad(() => api.cover(donorId), [donorId, version]);
  const [what, setWhat] = useState<number | null>(null);
  const [sim, setSim] = useState<{ cover: number; relativeRisk: number } | null>(null);

  useEffect(() => { setWhat(null); setSim(null); }, [donorId]);
  useEffect(() => {
    if (what == null) return;
    const t = setTimeout(() => api.simulateCover(donorId, what).then(setSim).catch(() => setSim(null)), 150);
    return () => clearTimeout(t);
  }, [what, donorId]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorNote error={error || 'Could not load'} />;
  if (!data.linked) {
    return (
      <div className="stack fade-in">
        <div className="page-head">
          <div>
            <div className="page-title">Illustrative health cover</div>
            <div className="page-sub">Explore a simulated cover ladder and premiums. These are not active policies, insurer quotes or guaranteed benefits; no insurer receives your data from this app.</div>
          </div>
        </div>
        <div className="card empty">No health cover linked yet. When your insurer is linked, your cover and how your health score can raise it will show here.</div>
        <Section title={<><Icon name="lock" size={17} /> Your data, your choice</>}>
          <ChoiceSwitch donorId={donorId} choice="shareHealthWithInsurer" on={data.conditions.consentToShare.met} onChanged={reload}
            sub={<>Once an insurer is linked: on, your cover can rise with your health score at the same premium; off, it stays at the base. Only the score is shared, never your results.{data.demo ? ` ${INSURER_NOTE}` : ''}</>} />
        </Section>
      </div>
    );
  }

  const score = what ?? data.healthScore;
  const simCover = what != null && sim ? sim.cover : data.currentCover;
  const consent = data.conditions.consentToShare.met;

  return (
    <div className="stack fade-in">
      <div className="page-head">
        <div>
          <div className="page-title">Illustrative health cover</div>
          <div className="page-sub">Explore a simulated cover ladder and premiums. These are not active policies, insurer quotes or guaranteed benefits; no insurer receives your data from this app.</div>
        </div>
      </div>
      <DropLine donorId={donorId} screen="cover" version={version} />

      <div className="grid grid-4">
        <div className="card">
          <div className="stat-label">Illustrative policy stack</div>
          <div className="stat-value mt-8">{rupees(data.stack.total)}</div>
          <div className="tiny muted">{data.stack.layers.length} example polic{data.stack.layers.length === 1 ? 'y' : 'ies'}</div>
        </div>
        <div className="card">
          <div className="stat-label">Illustrative health-linked cover</div>
          <div className="row mt-8" style={{ alignItems: 'baseline' }}>
            <span className="stat-value">{rupees(data.currentCover)}</span>
            {data.currentCover > data.baseCover && <span className="pill pill-good">+{rupees(data.currentCover - data.baseCover)}</span>}
          </div>
          <div className="tiny muted">Example base {rupees(data.baseCover)} · modelled premium unchanged</div>
        </div>
        <div className="card">
          <div className="stat-label">Example premium discount</div>
          <div className="stat-value mt-8">{data.discounts.percentOff}%</div>
          <div className="tiny muted">{data.discounts.fullPremium ? `Would save ${rupees(data.discounts.saving)} a year in this example` : `Example employer-paid premium`}</div>
        </div>
        <div className="card">
          <div className="stat-label">Next step</div>
          <div className="stat-value mt-8" style={{ fontSize: 22 }}>{data.nextStep ? rupees(data.nextStep) : 'Top step'}</div>
          <div className="tiny muted">
            {data.blockedBy === 'monitoring' ? 'One more monitored visit' : data.blockedBy === 'consent' ? 'Sharing switch is off' : data.pointsToNextStep != null ? `${data.pointsToNextStep} more score points` : data.nextStep ? 'Keep monitoring' : 'Top step'}
          </div>
        </div>
      </div>

      <Section title={<><Icon name="layers" size={18} /> {data.stack.multiple ? 'How example policies stack up' : 'Example cover'}</>}
        sub={data.stack.multiple ? 'Example order in which hypothetical policies could pay a hospital bill; not actual claims coverage.' : 'One example policy is shown. A personal policy or super top-up would add another hypothetical layer.'}>
        <div className="stack-bar" aria-hidden="true">
          {data.stack.layers.map((l) => <span key={l.name} className={`stack-${l.kind}`} style={{ flex: l.cover }}>{rupees(l.cover).replace(' lakh', 'L')}</span>)}
        </div>
        <div className="stack mt-12" style={{ gap: 8 }}>
          {data.stack.layers.map((l) => (
            <div key={l.name} className="stack-layer">
              <span className={`stack-dot stack-${l.kind}`}>{l.order}</span>
              <div style={{ flex: 1 }}>
                <div className="bold small">{l.name} <span className="muted" style={{ fontWeight: 400 }}>· example: {l.insurer}</span></div>
                <div className="tiny muted">{l.note}</div>
              </div>
              <div className="bold">{rupees(l.cover)}</div>
            </div>
          ))}
        </div>
        {data.stack.layers.some((l) => l.kind === 'topup') && (
          <div className="tiny muted mt-12">A super top-up counts all bills in the year toward its threshold, so a few smaller stays can add up to it.</div>
        )}
      </Section>

      <div className="grid grid-2">
        <div className="card">
          <div className="stat-label">Example {data.policy.kind} · modelled sponsor {data.policy.sponsor}</div>
          <div className="row mt-8" style={{ alignItems: 'baseline', gap: 12 }}>
            <span className="stat-value" style={{ fontSize: 42 }}>{rupees(data.currentCover)}</span>
            {data.currentCover > data.baseCover && <span className="pill pill-good">+{rupees(data.currentCover - data.baseCover)}</span>}
          </div>
          <div className="small muted">Example premium {rupees(data.policy.premium)}/year, modelled as paid by {data.policy.paidBy === 'You' ? 'you' : data.policy.paidBy} · example base cover {rupees(data.baseCover)}. No premium is charged.</div>

          <div className="ladder mt-16" style={{ height: 150 }}>
            {LADDER.map((step, i) => {
              const cls = step <= data.currentCover ? (step === data.currentCover ? 'current' : 'reached') : step <= data.eligibleCover ? 'qualified' : '';
              return (
                <div key={step} className={`ladder-step ${cls}`} style={{ height: `${45 + i * 18}%` }}>
                  {step === simCover && what != null && <span className="tiny" style={{ marginBottom: 'auto' }}>◆ what-if</span>}
                  {rupees(step).replace(' lakh', 'L')}
                </div>
              );
            })}
          </div>
          <div className="small mt-12">
            {data.blockedBy === 'monitoring' && <span>In this model, your score reaches <b>{rupees(data.eligibleCover)}</b>. One more monitored visit would unlock the next step. <button className="btn btn-sm btn-primary" onClick={() => go('donate')}>Try donation booking</button></span>}
            {data.blockedBy === 'consent' && <span>Your score maps to <b>{rupees(data.eligibleCover)}</b>, but sharing is off. Nothing is shared with an insurer.</span>}
            {!data.blockedBy && data.nextStep && data.pointsToNextStep != null && <span><b>{data.pointsToNextStep} more points</b> on your health score would move the illustration to <b>{rupees(data.nextStep)}</b>.</span>}
            {!data.blockedBy && !data.nextStep && <span>This illustration is at its top step; it is not a renewal promise.</span>}
          </div>
        </div>

        <div className="card">
          <div className="card-title">What if my health score changed?</div>
          <div className="card-sub">Drag to explore modelled cover, not an insurer offer. The calculation is deterministic.</div>
          <div className="row between mt-16"><span className="muted">Health score</span><span className="stat-value" style={{ fontSize: 28 }}>{score}</span></div>
          <input type="range" min={30} max={100} value={score} onChange={(e) => setWhat(Number(e.target.value))} aria-label="Health score" />
          <div className="grid grid-2 mt-16">
            <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12 }}>
              <div className="tiny muted">Hypothetical cover</div>
              <div className="bold" style={{ fontSize: 22 }}>{rupees(simCover)}</div>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12 }}>
              <div className="tiny muted">Modelled claims risk vs average</div>
              <div className="bold" style={{ fontSize: 22 }}>{Math.round(((what != null && sim ? sim.relativeRisk : data.relativeRisk)) * 100)}%</div>
            </div>
          </div>
          {what != null && <button className="btn btn-sm mt-12" onClick={() => { setWhat(null); setSim(null); }}>Reset to my score ({data.healthScore})</button>}
          <button className="btn btn-sm btn-ai mt-12" style={{ marginLeft: 8 }} onClick={() => go('plan')}><Icon name="sparkles" size={14} /> How do I get there?</button>
        </div>
      </div>

      <div className="grid grid-2">
        <Section title={<><Icon name="tag" size={18} /> Example premium discounts</>} sub={`Modelled up to ${data.discounts.cap}% off a hypothetical self-paid premium; no real discount applies.`}>
          <div className="stack" style={{ gap: 8 }}>
            {data.discounts.rows.map((d) => (
              <div key={d.id} className="row" style={{ alignItems: 'flex-start' }}>
                <span className={`pill ${d.met ? 'pill-good' : 'pill-neutral'}`} style={{ minWidth: 52, justifyContent: 'center' }}>{d.percent}%</span>
                <div style={{ flex: 1 }}>
                  <div className="small bold">{d.label} {d.met ? <span className="tiny" style={{ color: 'var(--good)' }}>· met</span> : <span className="tiny muted">· not yet</span>}</div>
                  <div className="tiny muted">{d.rule}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="small mt-12">
            {data.discounts.premiumsYouPay.length
              ? <>For example {data.discounts.premiumsYouPay.map((p) => `${p.name} (${rupees(p.premium)})`).join(' and ')}: <b>{data.discounts.percentOff}% off, a modelled {rupees(data.discounts.saving)} a year</b>.</>
              : <>The example group premium is modelled as employer-paid; this does not predict a discount on any real policy.</>}
          </div>
        </Section>

        <Section title={<><Icon name="shield" size={18} /> Example policy terms</>} sub={`Illustrative ${data.policy.kind} · ${rupees(data.baseCover)} modelled base`} collapsible defaultOpen={false}>
          <div className="terms">
            {data.baseTerms.map((t) => <div key={t.label}><span className="tiny muted">{t.label}</span><span className="small">{t.value}</span></div>)}
          </div>
          <div className="tiny faint mt-12">Illustrative terms only. No policy is issued here; an actual insurer's policy document would govern any real coverage.</div>
        </Section>
      </div>

      <Section title="Modelled cover over time" sub="Illustrative cover from each visit's score · no policy was changed" collapsible defaultOpen={false}>
        <div style={{ height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={data.history.map((h) => ({ ...h, label: fmtDate(h.date), coverL: h.cover / 100000 }))} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
              <YAxis domain={[4, 8.5]} tick={{ fontSize: 12, fill: 'var(--muted)' }} unit="L" />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} formatter={(v, _n, p) => [`₹${v} lakh (score ${(p.payload as { score: number }).score})`, 'Modelled cover']} />
              <Area type="stepAfter" dataKey="coverL" stroke="#15803d" fill="#15803d" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid grid-2">
        <Section title={<><Icon name="info" size={17} /> How it's calculated</>} collapsible defaultOpen={false}>
          <ol className="small" style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 6 }}>
            <li>Your <b>health score</b> comes from fixed clinical rules on your screening results (BP, haemoglobin, HbA1c, cholesterol, BMI, smoking).</li>
            <li>The score maps to a <b>relative risk</b> — expected claims compared with an average member ({Math.round(data.relativeRisk * 100)}% for you).</li>
            <li>Claims grow slower than cover (most claims are well below the limit), so lower risk creates <b>headroom</b>: more cover for the same expected cost.</li>
            <li>Modelled cover steps up (₹5L → 6L → 7L → 8L) after <b>2+ monitored visits in 12 months</b> and with <b>sharing</b> switched on. No insurer is contacted.</li>
          </ol>
          <p className="tiny faint mt-12">{data.method} Illustrative parameters only; no insurer participates in or receives data from this app.</p>
        </Section>
        <Section title={<><Icon name="lock" size={17} /> Your data, your choice</>}>
          <ChoiceSwitch donorId={donorId} choice="shareHealthWithInsurer" on={consent} onChanged={reload}
            sub={<>{insurerEffect(data.insurerEffect)} Only the score is shared, never your results.{data.demo ? ` ${INSURER_NOTE}` : ''}</>} />
          <div className="stack mt-16" style={{ gap: 8 }}>
            {Object.entries(data.conditions).map(([k, c]) => (
              <div key={k} className="row small"><span className={`pill ${c.met ? 'pill-good' : 'pill-warn'}`}>{c.met ? 'Met' : 'Not yet'}</span>{k === 'consentToShare' ? (c.met ? 'Sharing is on; nothing sent to an insurer' : 'Sharing is off') : c.detail}</div>
            ))}
          </div>
          <div className="tiny faint mt-12">In this model, the cover value does not fall mid-year. This is not a guarantee about actual insurance.</div>
        </Section>
      </div>
    </div>
  );
}
