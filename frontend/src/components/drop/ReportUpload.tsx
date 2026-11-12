/**
 * Add a lab report to answer an Hb Check-in: a photo the AI reads, or in demo
 * mode a prepared synthetic sample. The Donor confirms the value before it is saved.
 */
import { useState } from 'react';
import { api } from '../../api';
import { Icon, Thinking } from '../../ui';

const SAMPLE = '/demo/sample-lab-report-meera.png';
// What the sample report says, used only if the AI can't read it (offline)
const SAMPLE_FALLBACK = { value: 12.6, date: '2026-10-08', labName: 'Sample Diagnostics Lab' };

interface Found { value: number; date: string; labName: string; by: 'ai' | 'rules' }

async function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(blob);
  });
}

export default function ReportUpload({ donorId, onSave, onClose }: { donorId: string; onSave: (value: { value: number; date: string; source: string }) => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function read(blob: Blob, isSample: boolean) {
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      const image = await toDataUrl(blob);
      setPreview(image);
      try {
        const x = await api.extractLabs(donorId, { image });
        const hb = x.results.find((r) => r.marker === 'hb' && r.plausible);
        if (!hb) throw new Error('No haemoglobin result found on this report');
        setFound({ value: hb.value, date: x.reportDate, labName: x.labName, by: 'ai' });
      } catch (e) {
        if (!isSample) throw e;
        setFound({ ...SAMPLE_FALLBACK, by: 'rules' });
      }
    } catch (e) {
      setError(`${(e as Error).message}. Reading a photo needs the AI; try the sample report.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Add a lab report" onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="modal">
        <div className="row between"><div className="card-title"><Icon name="doc" size={18} /> Add a lab report</div><button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">×</button></div>
        <p className="muted small mt-8">Drop reads the haemoglobin result and updates your goal. You check it before anything is saved.</p>
        <div className="row wrap mt-16" style={{ gap: 8 }}>
          <label className="btn" style={{ minHeight: 44 }}>
            <Icon name="upload" size={16} /> Choose a photo
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && read(e.target.files[0], false)} />
          </label>
          <button className="btn" style={{ minHeight: 44 }} disabled={busy} onClick={async () => read(await (await fetch(SAMPLE)).blob(), true)}>
            Use a sample report <span className="pill pill-warn">Sample</span>
          </button>
        </div>
        {preview && <img src={preview} alt="The lab report" style={{ width: '100%', marginTop: 14, borderRadius: 10, border: '1px solid var(--border)' }} />}
        {busy && <div className="mt-12"><Thinking label="Reading the report…" /></div>}
        {error && <div className="callout callout-bad small mt-12">{error}</div>}
        {found && (
          <div className="callout callout-ai mt-12" style={{ alignItems: 'center' }}>
            <span style={{ flex: 1 }}>Haemoglobin <b>{found.value} g/dL</b> on {found.date}, {found.labName}.<br /><span className="tiny muted">{found.by === 'ai' ? 'Read by the AI from the photo.' : 'AI is offline, so the sample\'s known value is used.'}</span></span>
            <button className="btn btn-ai" style={{ minHeight: 44 }} onClick={() => onSave({ value: found.value, date: found.date, source: found.labName })}>Save</button>
          </div>
        )}
      </div>
    </div>
  );
}
