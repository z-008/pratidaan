/**
 * The small pictures Drop shows under its words in the Intro: an example journey and an
 * example results card (both clearly labelled "Example"), what is kept and where, the three
 * Choices, when donating suits you, and a summary. Built from what the server sends.
 */
import type { ChoicesPicture, DataPicture, DaysPicture, Donor, IntroDonate, JourneyPicture, ResultsPicture, SummaryPicture } from '../../api';
import { Icon } from '../../ui';

export type Choices = Donor['consent'];

function ExampleTag() {
  return <span className="pill pill-warn intro-example">Example</span>;
}

export function JourneyMini({ data }: { data: JourneyPicture }) {
  return (
    <div className="intro-mini">
      <div className="intro-mini-head"><ExampleTag /> One donation and where its parts went</div>
      <div className="intro-journey-root"><Icon name="drop" size={15} /> <b>{data.date}</b> · {data.volumeMl} ml given{data.tested ? ` · tested ${data.tested}` : ''}</div>
      <div className="intro-journey-parts">
        {data.parts.map((p) => (
          <div key={p.name} className={`intro-part ${p.good ? 'good' : ''}`}>
            <div className="row between" style={{ gap: 6 }}><b>{p.name}</b><span className={`pill ${p.good ? 'pill-good' : 'pill-neutral'}`}>{p.tag}</span></div>
            <div className="small muted">{p.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultsMini({ data }: { data: ResultsPicture }) {
  return (
    <div className="intro-mini">
      <div className="intro-mini-head"><ExampleTag /> <Icon name="flask" size={14} /> {data.title}</div>
      {data.rows.map((r) => (
        <div key={r.name} className="intro-mini-row"><span>{r.name}</span><b>{r.value}</b><span className={`pill ${r.good ? 'pill-good' : 'pill-warn'}`}>{r.status}</span></div>
      ))}
      <div className="tiny faint">{data.note}</div>
    </div>
  );
}

export function DataMini({ data }: { data: DataPicture }) {
  return (
    <div className="intro-mini">
      {data.rows.map((r) => (
        <div key={r.what} className="intro-data-row"><Icon name={r.icon} size={16} /><span><b>{r.what}</b><span className="tiny muted">{r.where}</span></span></div>
      ))}
      <div className="intro-ai-note"><Icon name="sparkles" size={14} /> {data.note}</div>
    </div>
  );
}

export function ChoicesForm({ data, value, onToggle, active }: { data: ChoicesPicture; value: Choices; onToggle: (key: keyof Choices) => void; active: boolean }) {
  return (
    <div className="intro-mini">
      {data.rows.map((r) => (
        <div key={r.key} className="intro-switch">
          <span><b>{r.label}</b><span className="tiny muted">{r.sub}</span></span>
          <button className={`toggle ${value[r.key] ? 'on' : ''}`} role="switch" aria-checked={value[r.key]} aria-label={r.label} disabled={!active}
            onClick={() => onToggle(r.key)} />
        </div>
      ))}
    </div>
  );
}

export function DaysForm({ data, value, onPick, active }: { data: DaysPicture; value: IntroDonate; onPick: (key: keyof IntroDonate, id: string) => void; active: boolean }) {
  const groups: [keyof IntroDonate, string, { id: string; label: string }[]][] = [['days', 'Days', data.days], ['time', 'Time of day', data.times], ['place', 'Where', data.places]];
  return (
    <div className="intro-mini">
      {groups.map(([key, label, options]) => (
        <div key={key} className="intro-prefs" role="group" aria-label={label}>
          <span className="tiny muted">{label}</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {options.map((o) => (
              <button key={o.id} className="dchip" aria-pressed={value[key] === o.id} disabled={!active} onClick={() => onPick(key, o.id)}>
                {o.id === 'gps' && <Icon name="pin" size={13} />} {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SummaryMini({ data }: { data: SummaryPicture }) {
  return (
    <div className="intro-mini">
      {data.rows.map((r) => <div key={r.what} className="intro-mini-row"><span>{r.what}</span><b>{r.value}</b></div>)}
    </div>
  );
}
