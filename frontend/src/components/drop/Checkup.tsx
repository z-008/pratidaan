/** A doctor check-up booking: when, who, and where, with change/cancel. */
import type { DropBooking } from '../../api';
import { Icon } from '../../ui';

export const fmtVisitDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export default function Checkup({ booking: b, busy, onChange, onCancel }: { booking: DropBooking; busy?: boolean; onChange?: () => void; onCancel?: () => void }) {
  return (
    <div className={`checkup ${b.urgent ? 'urgent' : ''}`}>
      <div className="checkup-when">
        <span className="checkup-day">{new Date(`${b.date}T00:00:00Z`).getUTCDate()}</span>
        <span className="tiny">{new Date(`${b.date}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</span>
      </div>
      <div className="checkup-body">
        <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
          <b>{b.reason || 'Doctor check-up'}</b>
          <span className={`pill ${b.urgent ? 'pill-bad' : 'pill-good'}`}>{b.urgent ? 'Seek real care today' : 'Free visit'}</span>
        </div>
        <div className="tiny muted mt-8">Saved in your session only; no clinic was contacted or reserved. Do not travel to this address unless you have a real appointment.</div>
        <div className="checkup-facts">
          <span><Icon name="clock" size={15} /> {fmtVisitDay(b.date)} · {b.time}{b.durationMinutes ? ` · about ${b.durationMinutes} min` : ''}</span>
          {b.doctor && <span><Icon name="doctor" size={15} /> {b.doctor}{b.speciality ? `, ${b.speciality}` : ''}</span>}
          <span><Icon name="pin" size={15} /> {b.clinic || b.place}{b.address ? `, ${b.address}` : ''}</span>
        </div>
        {b.bring && b.bring.length > 0 && <div className="tiny muted">For a real check-up, you might bring: {b.bring.join(' · ')}</div>}
        <div className="checkup-actions">
          <span className="tiny muted">No calendar or directions for this placeholder visit.</span>
          {onChange && <button className="btn btn-sm" disabled={busy} onClick={onChange}>Change time</button>}
          {onCancel && <button className="btn btn-sm btn-ghost" disabled={busy} onClick={onCancel}>Cancel visit</button>}
        </div>
      </div>
    </div>
  );
}
