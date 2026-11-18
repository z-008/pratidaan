/**
 * Home's Between donations tile, placed after the Next donation tile: where the Donor is in their Cycle,
 * this Cycle's focus, their connected apps, and a new Cycle report to watch. Opens Progress.
 */
import { useEffect, useState } from 'react';
import { api, type WbReport, type WbSummary } from '../../api';
import { Icon } from '../../ui';
import StoryViewer from '../drop/StoryViewer';
import { STATUS_PILL, dayLabel, wellbeingChanged } from './wellbeing';
import './wellbeing.css';

export default function BetweenDonationsTile({ donorId, version, onOpen }: { donorId: string; version: number; onOpen: () => void }) {
  const [data, setData] = useState<WbSummary | null>(null);
  const [story, setStory] = useState<WbReport | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { api.wellbeing(donorId).then(setData).catch(() => setData(null)); }, [donorId, version, tick]);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener('drop:changed', bump);
    window.addEventListener('wellbeing:changed', bump);
    return () => { window.removeEventListener('drop:changed', bump); window.removeEventListener('wellbeing:changed', bump); };
  }, []);
  if (!data || data.newUser) return null;
  const c = data.cycle;
  const f = data.focus;
  const watch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.unseenReport) api.wbReport(donorId, data.unseenReport.visitId).then(setStory).catch(() => {});
  };

  return (
    <>
      <div className="card" role="button" tabIndex={0} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
        <div className="row between"><span className="stat-label">Between donations</span><Icon name="trend" className="faint" /></div>
        {c && <div className="bold mt-8">{c.text}</div>}
        {c?.nextFrom && <div className="small muted mt-8">Next free health check: {c.eligibleNow ? 'now' : dayLabel(c.nextFrom)}</div>}
        {f && (
          <div className="row wrap mt-8" style={{ gap: 6 }}>
            <span className="pill pill-brand">Focus: {f.label}</span>
            {f.status.state !== 'none' && <span className={`pill ${STATUS_PILL[f.status.state]}`}>{f.status.label}</span>}
          </div>
        )}
        {(() => {
          const m = data.habits.flatMap((h) => h.metrics).filter((x) => ['steps', 'sleep_min', 'iron_mg'].includes(x.signal)).slice(0, 2);
          return m.length ? <div className="small mt-8">This week: {m.map((x) => `${x.label.toLowerCase()} ${x.value.split(' · ')[0]}`).join(' · ')}</div> : null;
        })()}
        {data.readiness?.soon && <div className="small muted mt-8">Ready for your next donation: {data.readiness.done} of {data.readiness.total} looking good</div>}
        <div className="small muted mt-8">
          {data.connections.length ? `${data.connections.length} app${data.connections.length > 1 ? 's' : ''} connected` : 'Connect the apps you already use'}
          {data.weekPlan ? ' · Week plan on' : ''}
        </div>
        {data.unseenReport && <button className="btn btn-primary btn-sm mt-12" onClick={watch}><Icon name="play" size={14} /> Watch my Cycle report</button>}
      </div>
      {story && (
        <StoryViewer title={story.title} slides={story.slides} onClose={() => { const s = story; setStory(null); api.wbReportSeen(donorId, s.visitId).then(() => wellbeingChanged()).catch(() => {}); }} />
      )}
    </>
  );
}
