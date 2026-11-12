import { useState } from 'react';
import { api, type DropView } from '../../api';

/** A BP reading from a pharmacy machine or home monitor, added to the Goal's trend. */
export default function BpReading({ donorId, onSaved }: { donorId: string; onSaved: (v: DropView) => void }) {
  const [bp, setBp] = useState({ s: 0, d: 0 });
  const [err, setErr] = useState<string | null>(null);
  const valid = bp.s >= 70 && bp.s <= 250 && bp.d >= 40 && bp.d <= 150 && bp.s > bp.d;
  async function save() {
    setErr(null);
    try { onSaved(await api.dropAddReading(donorId, bp)); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <form className="numbers mt-12" onSubmit={(e) => { e.preventDefault(); if (valid) save(); }}>
      <label>Top number<input type="number" inputMode="numeric" min={70} max={250} value={bp.s || ''} onChange={(e) => setBp((v) => ({ ...v, s: Number(e.target.value) }))} /></label>
      <span className="slash">/</span>
      <label>Bottom number<input type="number" inputMode="numeric" min={40} max={150} value={bp.d || ''} onChange={(e) => setBp((v) => ({ ...v, d: Number(e.target.value) }))} /></label>
      <span className="unit">mmHg</span>
      <button type="submit" className="btn btn-primary" disabled={!valid}>Save reading</button>
      {err && <span className="numbers-error">{err}</span>}
    </form>
  );
}
