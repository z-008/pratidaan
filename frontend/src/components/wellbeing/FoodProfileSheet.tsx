/**
 * The Food profile (CONTEXT.md): how the Donor eats, chosen by them from fixed lists, never inferred.
 * Drop uses it only to pick foods; it is never shared.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type WbFoodProfile } from '../../api';
import { ErrorNote, Icon } from '../../ui';
import { ALLERGIES, BUDGETS, DIETS, EATS_AT, REGIONS, STAPLES, wellbeingChanged } from './wellbeing';
import './wellbeing.css';

function Choice({ label, options, value, onPick }: { label: string; options: Record<string, string>; value: string; onPick: (v: string) => void }) {
  return (
    <div>
      <div className="small bold">{label}</div>
      <div className="chip-row" style={{ marginTop: 8 }}>
        {Object.entries(options).map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={value === k} onClick={() => onPick(k)}>{l}</button>)}
      </div>
    </div>
  );
}

export default function FoodProfileSheet({ donorId, profile, onClose, onSaved }: { donorId: string; profile: WbFoodProfile; onClose: () => void; onSaved?: () => void }) {
  const [p, setP] = useState<WbFoodProfile>(profile);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof WbFoodProfile) => (v: string) => setP((x) => ({ ...x, [k]: v }));
  const toggleAllergy = (a: string) => setP((x) => ({ ...x, allergies: x.allergies.includes(a) ? x.allergies.filter((y) => y !== a) : [...x.allergies, a] }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.wbSaveFoodProfile(donorId, { diet: p.diet, region: p.region, staple: p.staple, eatsAt: p.eatsAt, budget: p.budget, allergies: p.allergies, fasting: p.fasting });
      wellbeingChanged();
      onSaved?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="sheet-wrap wb-profile">
      <div className="sheet-veil" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="How you eat">
        <div className="sheet-head">
          <span className="sheet-title"><b>How you eat</b><span className="card-sub" style={{ display: 'block' }}>So Drop only suggests food you'd actually eat and can afford</span></span>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" size={20} stroke={2} /></button>
        </div>
        <div className="sheet-body">
          <Choice label="Your diet" options={DIETS} value={p.diet} onPick={set('diet')} />
          <Choice label="Home food" options={REGIONS} value={p.region} onPick={set('region')} />
          <Choice label="Your main staple" options={STAPLES} value={p.staple} onPick={set('staple')} />
          <Choice label="Where you eat most days" options={EATS_AT} value={p.eatsAt} onPick={set('eatsAt')} />
          <Choice label="Extra you'd spend on food" options={BUDGETS} value={p.budget} onPick={set('budget')} />
          <div>
            <div className="small bold">Allergies or foods you avoid</div>
            <div className="chip-row" style={{ marginTop: 8 }}>
              {Object.entries(ALLERGIES).map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={p.allergies.includes(k)} onClick={() => toggleAllergy(k)}>{l}</button>)}
            </div>
          </div>
          <div className="callout callout-info small"><Icon name="lock" size={16} /><span>Only you see this. It isn't shared with Circles or your insurer, and it never changes your score or when you can donate. Delete it any time from Your data.</span></div>
          {error && <ErrorNote error={error} />}
        </div>
        <div className="sheet-foot">
          <button className="btn btn-primary" disabled={busy} onClick={save}>Save</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
