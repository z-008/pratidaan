/**
 * The Health screen's view of what Drop keeps: the readings the Donor added
 * (deletable) and the blood centre's results (hideable from the app; hiding
 * never changes eligibility, which the blood centre decides).
 */
import { useState } from 'react';
import { api, fmtDate, type DropView, type HealthData } from '../../api';
import { Icon, Section } from '../../ui';

export function ReadingsSection({ donorId, view, data, onChange }: { donorId: string; view: DropView | null; data: HealthData; onChange: (v: DropView) => void }) {
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const added = view?.readings || [];
  const hidden = new Set(view?.hiddenResults || []);
  // Latest blood-centre result per marker
  const centre = Object.values(data.labs).map((list) => [...list].reverse().find((o) => o.source !== 'uploaded_report')).filter((o): o is NonNullable<typeof o> => Boolean(o));
  const shown = centre.filter((o) => !hidden.has(o.id));
  const hiddenList = centre.filter((o) => hidden.has(o.id));

  const run = async (p: Promise<DropView>) => {
    setError(null);
    try { onChange(await p); } catch (e) { setError((e as Error).message); }
  };

  return (
    <Section title={<><Icon name="doc" size={18} /> Readings and results</>} sub={`${added.length} you added · ${shown.length} from the blood centre`} collapsible defaultOpen={false}>
      <div className="bold small">Readings you added</div>
      {!added.length && <p className="muted small mt-8">None yet. Tell Drop a BP reading or add a lab report.</p>}
      <div className="stack mt-8" style={{ gap: 0 }}>
        {added.map((r) => (
          <div key={r.id} className="row" style={{ minHeight: 48, borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 1 }}>{r.marker === 'bp' ? `BP ${r.s}/${r.d}` : `Hb ${r.value} g/dL`} <span className="tiny muted">· {fmtDate(r.date)}</span></span>
            <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => run(api.dropDeleteReading(donorId, r.id))}>Delete</button>
          </div>
        ))}
      </div>

      <div className="bold small mt-16">From the blood centre</div>
      <div className="stack mt-8" style={{ gap: 0 }}>
        {shown.map((o) => (
          <div key={o.id} className="row" style={{ minHeight: 48, borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 1 }}>{o.name} <b>{o.value}</b> <span className="tiny muted">{o.unit} · {fmtDate(o.date)}</span></span>
            <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => run(api.dropHideResult(donorId, o.id))}>Hide from my app</button>
          </div>
        ))}
      </div>
      {hiddenList.length > 0 && (
        <>
          <button className="btn btn-ghost btn-sm mt-8" style={{ minHeight: 44 }} onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'Hide' : 'Show'} {hiddenList.length} hidden result{hiddenList.length === 1 ? '' : 's'}</button>
          {showHidden && hiddenList.map((o) => <div key={o.id} className="small muted" style={{ padding: '6px 0' }}>{o.name} {o.value} {o.unit} · {fmtDate(o.date)}</div>)}
        </>
      )}
      <p className="tiny faint mt-12">The blood centre keeps its own copy of its results, and still uses them to decide when you can donate. Hiding only removes them from this list.</p>
      {error && <div className="callout callout-bad small mt-8">{error}</div>}
    </Section>
  );
}
