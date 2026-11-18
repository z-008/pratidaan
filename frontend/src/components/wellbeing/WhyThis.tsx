/**
 * "Why this?" (CONTEXT.md): what Drop used, the rule, the guidance and the Donor's own choices behind a
 * recommendation, and what was not used. Built by the rules (never the AI); opens from any Card, food or target.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type WbExplanation } from '../../api';
import { ErrorNote, Icon, Loading } from '../../ui';
import './wellbeing.css';

export default function WhyThis({ donorId }: { donorId: string }) {
  const [recId, setRecId] = useState<string | null>(null);
  const [data, setData] = useState<WbExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const open = (e: Event) => { setRecId((e as CustomEvent<{ recId: string }>).detail.recId); setData(null); setError(null); };
    window.addEventListener('wellbeing:why', open);
    return () => window.removeEventListener('wellbeing:why', open);
  }, []);
  useEffect(() => {
    if (!recId) return;
    api.wbExplain(donorId, recId).then(setData).catch((e: Error) => setError(e.message));
  }, [recId, donorId]);
  useEffect(() => {
    if (!recId) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setRecId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recId]);
  if (!recId) return null;

  return createPortal(
    <div className="sheet-wrap wb-why">
      <div className="sheet-veil" onClick={() => setRecId(null)} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Why this?">
        <div className="sheet-head">
          <span className="sheet-title"><b>Why this?</b><span className="card-sub" style={{ display: 'block' }}>{data?.title || 'From Pratidaan\'s rules, not the AI'}</span></span>
          <button className="icon-btn" aria-label="Close" onClick={() => setRecId(null)}><Icon name="x" size={20} stroke={2} /></button>
        </div>
        <div className="sheet-body">
          {error && <ErrorNote error={error} />}
          {!data && !error && <Loading />}
          {data && (
            <>
              <div>
                <h4><Icon name="activity" size={15} /> What Drop used</h4>
                <ul>{data.dataUsed.map((d) => <li key={d.text}>{d.text} <span className="src">· {d.source}</span></li>)}</ul>
              </div>
              <div>
                <h4><Icon name="flag" size={15} /> The rule</h4>
                <p className="small" style={{ margin: 0 }}><span className="pill pill-neutral" style={{ marginRight: 6 }}>{data.rule.id}</span>{data.rule.text}</p>
              </div>
              {data.guidance.length > 0 && (
                <div>
                  <h4><Icon name="doc" size={15} /> Guidance it follows</h4>
                  <ul>{data.guidance.map((g) => <li key={g.text}>{g.text} <span className="src">· {g.source}</span></li>)}</ul>
                </div>
              )}
              {data.preferences.length > 0 && (
                <div>
                  <h4><Icon name="users" size={15} /> Your choices</h4>
                  <ul>{data.preferences.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              )}
              {data.effect && <div className="callout callout-info small"><Icon name="drop" size={16} /><span>{data.effect}</span></div>}
              {data.wouldChange && (
                <div>
                  <h4><Icon name="refresh" size={15} /> What would change it</h4>
                  <p className="small" style={{ margin: 0 }}>{data.wouldChange}</p>
                </div>
              )}
              <div>
                <h4><Icon name="lock" size={15} /> Not used</h4>
                <ul className="muted">{data.notUsed.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
