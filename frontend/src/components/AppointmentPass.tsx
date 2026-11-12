/** A booked donation as a pass: check-in QR, the details to send on WhatsApp or email, and a 1-day-before reminder. */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { fmtDate, type Appointment } from '../api';
import { Icon } from '../ui';

const PREP = 'Eat a meal 3–4 hours before, sleep at least 6 hours, drink water and skip alcohol for 24 hours. Bring a photo ID.';

function details(a: Appointment) {
  return [
    'Pratidaan donation slot — not a centre reservation',
    `${fmtDate(a.date)} at ${a.time}`,
    `${a.centre}, ${a.district}`,
    a.checkInCode ? `Check-in code (not valid at a centre): ${a.checkInCode}` : null,
    PREP,
  ].filter(Boolean).join('\n');
}

const icsTime = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** A calendar file with an alarm 1 day before, for people who did not connect Google Calendar. */
function icsFile(a: Appointment) {
  const start = Date.parse(`${a.date}T${a.time}:00+05:30`);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pratidaan//Booking//EN', 'BEGIN:VEVENT',
    `UID:${a.id}@pratidaan`, `DTSTAMP:${icsTime(Date.now())}`, `DTSTART:${icsTime(start)}`, `DTEND:${icsTime(start + 45 * 60000)}`,
    `SUMMARY:Pratidaan donation at ${a.centre}`, `LOCATION:${a.centre}\\, ${a.district}`,
    `DESCRIPTION:${details(a).replace(/\n/g, '\\n').replace(/,/g, '\\,')}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Blood donation tomorrow', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return new Blob([lines.join('\r\n')], { type: 'text/calendar' });
}

export default function AppointmentPass({ appointment: a, compact }: { appointment: Appointment; compact?: boolean }) {
  const [qr, setQr] = useState('');
  const payload = `TRACEDROP:CHECKIN:${a.id}:${a.checkInCode || ''}`;

  useEffect(() => {
    QRCode.toDataURL(payload, { margin: 1, width: 220, color: { dark: '#2a0f2e', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [payload]);

  const text = details(a);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const mail = `mailto:?subject=${encodeURIComponent('My Pratidaan donation appointment')}&body=${encodeURIComponent(text)}`;

  function download() {
    const url = URL.createObjectURL(icsFile(a));
    const link = document.createElement('a');
    link.href = url;
    link.download = `tracedrop-donation-${a.date}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={`pass ${compact ? 'pass-compact' : ''}`}>
      <div className="pass-qr">
        {qr ? <img src={qr} alt={`QR code for ${fmtDate(a.date)} at ${a.time}; not valid at a blood centre`} /> : <div className="skeleton" style={{ width: 150, height: 150 }} />}
        {a.checkInCode && <span className="pass-code">{a.checkInCode}</span>}
      </div>
      <div className="pass-body">
        <span className="pill pill-good"><Icon name="check" size={13} /> Slot saved</span>
        <div className="pass-when">{fmtDate(a.date)} · {a.time}</div>
        <div className="small"><Icon name="pin" size={14} /> {a.centre}, {a.district}</div>
        <div className="tiny muted mt-8">This QR code cannot check you in at a blood centre.</div>
        <div className="pass-actions">
          <a className="btn btn-sm" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp details</a>
          {a.emailSent ? <span className="pill pill-info"><Icon name="mail" size={13} /> Emailed to you</span> : <a className="btn btn-sm" href={mail}><Icon name="mail" size={14} /> Email details</a>}
          {!a.eventId && <button className="btn btn-sm" onClick={download}><Icon name="calendar" size={14} /> Add to calendar</button>}
        </div>
        <div className="tiny muted mt-8">
          <Icon name="info" size={12} /> {a.calendarError ? 'Google Calendar may not have saved this event; check your calendar before relying on reminders.' : a.eventId ? 'Added to your Google Calendar; any reminder depends on its settings.' : 'Add the optional calendar file to set a reminder on your device.'}
        </div>
        {a.calendarError && <div className="tiny muted mt-8">Google Calendar could not be confirmed: {a.calendarError}. Your slot remains saved.</div>}
        {a.emailError && <div className="tiny muted mt-8">No confirmation email was sent: {a.emailError}.</div>}
        {!compact && <div className="tiny faint mt-8">{PREP}</div>}
      </div>
    </div>
  );
}
