/**
 * "From your results": every result that needs improving (iron, vitamin D, B12, BP, blood sugar, cholesterol,
 * weight, liver), and one plan that mixes foods and everyday habits, putting first what helps the most of them
 * at once. From rules (improvements.js); the doctor's lines always show; Add to my week puts it in the Week plan.
 */
import { useState } from 'react';
import { api, type WbPlan } from '../../api';
import { ErrorNote, Icon } from '../../ui';
import { bookCheckup } from '../Copilot';
import DoctorBanner from './DoctorBanner';
import FoodProfileSheet from './FoodProfileSheet';
import { BUDGETS, DIETS, HABITS, LEVEL_PILL, REGIONS, STATUS_PILL, openWhy, wellbeingChanged } from './wellbeing';
import './wellbeing.css';

const NEED_PILL = (level: string) => (LEVEL_PILL[level]?.pill || 'pill-info');

export default function HealthPlan({ donorId, plan, compact = false, onOpen }: { donorId: string; plan: WbPlan; compact?: boolean; onOpen?: () => void }) {
  const [profile, setProfile] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const p = plan.profile;

  async function add() {
    setError(null);
    try {
      const r = await api.wbPlanAdd(donorId);
      setAdded(`Added to your Week plan until ${r.summary.weekPlan?.endsText}: ${r.summary.weekPlan?.items.filter((i) => !i.setAside).map((i) => i.text).join('; ')}`);
      wellbeingChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="card wb" id="health-plan">
      <div className="row between wrap">
        <div>
          <div className="card-title"><Icon name="sparkles" size={17} /> {plan.keep ? 'Keep it up' : 'From your results: what to improve'}</div>
          <div className="card-sub">{plan.headline}</div>
        </div>
        {!compact && <span className="small muted">Fits: {DIETS[p.diet]} · {REGIONS[p.region]} · {BUDGETS[p.budget]} · <button className="wb-link" onClick={() => setProfile(true)}>{p.isDefault ? 'Tell Drop how you eat' : 'Change'}</button></span>}
      </div>

      {!plan.keep && (
        <div className="row wrap mt-12" style={{ gap: 6 }}>
          {plan.needs.map((n) => <span key={n.marker} className={`pill ${NEED_PILL(n.level)}`} title={n.rule}>{n.label}: {n.levelWords.toLowerCase()}</span>)}
        </div>
      )}

      <div className="stack mt-12" style={{ gap: 8 }}>
        {plan.doctors.slice(0, compact ? 1 : 3).map((d) => (
          <div key={d.text}>
            <DoctorBanner doctor={{ urgency: d.urgency, text: d.text }} onBook={d.urgency !== 'recommended' ? () => bookCheckup() : undefined} />
            {plan.doctors.length > 1 && <div className="tiny muted" style={{ marginTop: 2 }}>For: {d.labels.join(', ')}</div>}
          </div>
        ))}
      </div>

      <div className={compact ? 'stack mt-12' : 'grid grid-2 mt-12'} style={{ gap: 14 }}>
        {plan.foods.length > 0 && (
          <div>
            <div className="small bold">Foods to add</div>
            <div className="wb-foods mt-8">
              {plan.foods.slice(0, compact ? 3 : 6).map((f) => (
                <div key={f.id} className="wb-food">
                  <span className="n">{f.name}</span>
                  {f.name !== f.nameEn && <span className="en">{f.nameEn}</span>}
                  {!compact && <span className="fit">{f.fitIn}</span>}
                  <span className="meta">
                    {f.helps.map((h) => <span key={h} className="pill pill-good">{h}</span>)}
                    <span className="pill pill-neutral">₹{f.cost.min}–{f.cost.max}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {plan.habits.length > 0 && (
          <div>
            <div className="small bold">Habits that help</div>
            <div className="stack mt-8" style={{ gap: 6 }}>
              {plan.habits.slice(0, compact ? 3 : 5).map((h) => (
                <div key={h.id} className="item">
                  <Icon name={HABITS.find((x) => x.id === h.habit)?.icon || 'flag'} size={16} />
                  <span className="grow">
                    <b>{h.text}</b>
                    <small>Helps: {h.helps.join(', ').toLowerCase().replace(/vitamin (\w+)/g, (_m, x) => `vitamin ${x.toUpperCase()}`)}{h.status ? ` · now ${h.status.text} (${h.status.app})` : ''}</small>
                  </span>
                  {h.status?.state && <span className={`pill ${STATUS_PILL[h.status.state]}`}>{h.status.state === 'on' ? 'On target' : h.status.state === 'drift' ? 'Nearly' : 'Not yet'}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!compact && <div className="tiny faint mt-12">From your donation results and lab reports you added; proposed thresholds, pending clinical review. Amounts and prices are approximate. Food and habits support your health; they don't replace treatment your doctor gives you.</div>}
      {added && <div className="callout callout-info small mt-12"><Icon name="check" size={16} /><span>{added}</span></div>}
      {error && <ErrorNote error={error} />}
      <div className="row wrap mt-12">
        {!added && (plan.foods.length > 0 || plan.habits.length > 0) && <button className="btn btn-primary btn-sm" onClick={add}><Icon name="calendar" size={15} /> Add to my week</button>}
        <button className="btn btn-sm" onClick={() => openWhy('plan')}><Icon name="info" size={15} /> Why this plan?</button>
        {onOpen && <button className="btn btn-sm" onClick={onOpen}>See the full plan</button>}
      </div>
      {profile && <FoodProfileSheet donorId={donorId} profile={p} onClose={() => setProfile(false)} />}
    </section>
  );
}
