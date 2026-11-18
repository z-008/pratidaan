/**
 * "Eat for your iron" (and BP, sugar, cholesterol, B12): local, affordable foods that fit how the Donor eats,
 * chosen by rules, with the doctor's line always shown. When the doctor comes first, there are no foods at all.
 */
import { useState } from 'react';
import { api, type WbFoodSuggestion } from '../../api';
import { ErrorNote, Icon } from '../../ui';
import { bookCheckup } from '../Copilot';
import DoctorBanner from './DoctorBanner';
import FoodProfileSheet from './FoodProfileSheet';
import { BUDGETS, DIETS, LEVEL_PILL, REGIONS, levelLabel, openWhy, wellbeingChanged } from './wellbeing';

export default function FoodPanel({ donorId, food, onChange, compact = false }: { donorId: string; food: WbFoodSuggestion; onChange?: () => void; compact?: boolean }) {
  const [profile, setProfile] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const level = food.level;
  const p = food.profile;

  async function addToWeek() {
    setError(null);
    try {
      const { cardId } = await api.wbOfferPlan(donorId, 'food');
      const v = await api.dropAnswer(donorId, cardId, 'save');
      setAdded(v.receipts[0]?.receipt || 'Added to your Week plan');
      wellbeingChanged();
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row between wrap">
        <div className="card-title"><Icon name="food" size={17} /> Eat for your {food.label.toLowerCase()}</div>
        {level && <span className={`pill ${LEVEL_PILL[level.level].pill}`}>{levelLabel(food.marker, level.level)}</span>}
      </div>
      <DoctorBanner doctor={food.doctor} onBook={food.doctor && food.doctor.urgency !== 'recommended' ? () => bookCheckup() : undefined} />
      {food.rulesOnly ? (
        <p className="small muted" style={{ margin: 0 }}>{level?.rule} After your visit, Drop can suggest foods that support what your doctor advises.</p>
      ) : food.foods.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>{food.text}</p>
      ) : (
        <>
          <div className="small muted">
            Fits: {DIETS[p.diet]} · {REGIONS[p.region]} · {BUDGETS[p.budget]}{p.isDefault ? ' (not set yet)' : ''}
            {' · '}<button className="wb-link" onClick={() => setProfile(true)}>{p.isDefault ? 'Tell Drop how you eat' : 'Change'}</button>
          </div>
          <div className="wb-foods">
            {food.foods.slice(0, compact ? 3 : 5).map((f) => (
              <div key={f.id} className="wb-food">
                <span className="n">{f.name}</span>
                {f.name !== f.nameEn && <span className="en">{f.nameEn}</span>}
                <span className="fit">{f.fitIn}</span>
                <span className="meta">
                  <span className="pill pill-neutral">₹{f.cost.min}–{f.cost.max} a day</span>
                  {f.amount && <span className="pill pill-good">{f.amount}</span>}
                </span>
                {f.pairWith.length > 0 && <span className="tiny muted">With {f.pairWith.join(' or ')}</span>}
              </div>
            ))}
          </div>
          {!compact && food.tips.length > 0 && (
            <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{food.tips.slice(0, 3).map((t) => <li key={t.id}>{t.text}</li>)}</ul>
          )}
          {!compact && food.limit.length > 0 && <div className="small muted">Go easy on: {food.limit.join(', ')}.</div>}
          {!compact && food.safety && food.safety.length > 0 && <div className="tiny muted">{food.safety.join(' ')}</div>}
          <div className="tiny faint">Amounts and prices are approximate (Indian food composition data, ICMR-NIN; Bengaluru prices). Food supports your health; it doesn't replace treatment your doctor gives you.</div>
        </>
      )}
      {added && <div className="callout callout-info small"><Icon name="check" size={16} /><span>{added}</span></div>}
      {error && <ErrorNote error={error} />}
      <div className="row wrap">
        {!food.rulesOnly && food.foods.length > 0 && !added && <button className="btn btn-primary btn-sm" onClick={addToWeek}><Icon name="calendar" size={15} /> Add to my week</button>}
        <button className="btn btn-sm" onClick={() => openWhy(`food:${food.marker}`)}><Icon name="info" size={15} /> Why these?</button>
      </div>
      {profile && <FoodProfileSheet donorId={donorId} profile={p} onClose={() => setProfile(false)} onSaved={onChange} />}
    </div>
  );
}
