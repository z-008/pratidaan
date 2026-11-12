/** Shared UI pieces: icons, AI badge, agent trace, loaders. */
import { useEffect, useState, type ReactNode } from 'react';
import type { AgentStep } from './api';

const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  drop: 'M12 2.5c-3.6 4.6-6.5 8.4-6.5 12A6.5 6.5 0 0 0 12 21a6.5 6.5 0 0 0 6.5-6.5c0-3.6-2.9-7.4-6.5-12z',
  heart: 'M12 20s-7.5-4.6-9.3-9.3C1.4 7.2 3.6 4 7 4c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.4 0 5.6 3.2 4.3 6.7C19.5 15.4 12 20 12 20z',
  shield: 'M12 3 4.5 6v5.5c0 4.6 3.2 8.6 7.5 9.5 4.3-.9 7.5-4.9 7.5-9.5V6z',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.4M15.5 3.6a3.5 3.5 0 0 1 0 6.8',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4',
  play: 'M7 4.5v15l12-7.5z',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9zM5 15l.6 1.4 1.4.6-1.4.6L5 19l-.6-1.4L3 17l1.4-.6z',
  flask: 'M9.5 3h5M10 3v6.2L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3M7.5 14h9',
  hospital: 'M4 21V7l8-4 8 4v14M9 21v-5h6v5M12 8v5M9.5 10.5h5',
  landmark: 'M3 21h18M5 21V10M19 21V10M9.5 21V10M14.5 21V10M2.5 10 12 3.5l9.5 6.5z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c2.3 2.5 3.5 5.5 3.5 9s-1.2 6.5-3.5 9c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3z',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5 10 17 19 7',
  x: 'M6 6l12 12M18 6 6 18',
  send: 'M4 12 20 4l-5 16-3.5-6.5z',
  share: 'M8.5 13.5l7-4M8.5 10.5l7 4M18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  lock: 'M6.5 11h11a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4.5M12 8h.01',
  refresh: 'M20 11a8 8 0 0 0-14.9-3.5M4 4.5v3.5h3.5M4 13a8 8 0 0 0 14.9 3.5M20 19.5V16h-3.5',
  cpu: 'M7 7h10v10H7zM9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4',
  chevron: 'M9 6l6 6-6 6',
  doc: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  walk: 'M13 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM7 21l3-4M16 21l-2-4-3-3 1-6M6 12l2-3 4-1 3 3 3 1',
  food: 'M4 11h16a8 8 0 0 1-16 0zM12 3c-1 1.5-1 3 0 4.5M8 4.5c-.7 1-.7 2 0 3M16 4.5c-.7 1-.7 2 0 3',
  mind: 'M5 20c0-8 5-13 15-15-1 9-6 14-13 14M5 20l7-7',
  layers: 'M12 3 2.5 8 12 13l9.5-5zM2.5 12.5 12 17.5l9.5-5M2.5 16.5 12 21.5l9.5-5',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01',
  mail: 'M3.5 6h17v12h-17zM3.5 6.5 12 13l8.5-6.5',
  doctor: 'M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-2M20 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  phone: 'M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  history: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
};

export function Icon({ name, size = 18, className, stroke = 1.9 }: { name: string; size?: number; className?: string; stroke?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] || PATHS.info} />
    </svg>
  );
}

export function AIBadge({ label = 'AI', title }: { label?: string; title?: string }) {
  return <span className="ai-badge" title={title}><Icon name="sparkles" size={12} stroke={2.2} />{label}</span>;
}

const TOOL_LABELS: Record<string, string> = {
  get_profile: 'Read donor profile', get_health_findings: 'Checked rule-based findings', get_trend: 'Pulled marker trend',
  get_health_score: 'Read health score', get_protocol: 'Looked up clinical protocol', get_lifestyle_guidance: 'Retrieved evidence-based guidance',
  get_insurance_cover: 'Checked insurance cover', simulate_cover: 'Simulated cover', get_donation_impact: 'Traced blood components',
  get_stakeholder_impact: 'Read institutional impact', get_communities: 'Read communities', find_care_slots: 'Searched care slots', navigate: 'Opened a screen',
  show_chart: 'Showed a chart', offer_care_slots: 'Offered check-up slots', offer_reminder: 'Offered a reminder', remember: 'Remembered something', log_reading: 'Saved a reading', set_language: 'Switched language',
};

/** "How the agent decided" panel: each tool call, its input and result. */
export function AgentTrace({ steps, title = 'How the agent worked this out' }: { steps: AgentStep[]; title?: string }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  return (
    <div className="trace">
      <button className="btn btn-ghost btn-sm" style={{ padding: 0 }} onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="cpu" size={15} /> <span className="small bold" style={{ color: 'var(--ai)' }}>{title}</span>
        <span className="tiny muted">· {steps.length} tool call{steps.length === 1 ? '' : 's'}</span>
        <Icon name="chevron" size={14} className="faint" />
      </button>
      {open && (
        <div className="mt-8">
          {steps.map((s, i) => (
            <div className="trace-step" key={i}>
              <span className="faint tiny">{i + 1}</span>
              <div>
                <div><b>{TOOL_LABELS[s.tool] || s.tool}</b> <code>{s.tool}({Object.keys(s.input).length ? JSON.stringify(s.input) : ''})</code></div>
                <div className="muted">{s.summary}</div>
              </div>
              <span className="faint tiny">{s.ms}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Loading({ lines = 3 }: { lines?: number }) {
  return (
    <div className="stack">
      {Array.from({ length: lines }).map((_, i) => <div key={i} className="skeleton" style={{ height: i ? 90 : 160 }} />)}
    </div>
  );
}

export function Thinking({ label }: { label: string }) {
  return (
    <div className="row small" style={{ color: 'var(--ai)' }}>
      <Icon name="refresh" size={16} className="spin" /> {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: string }) {
  return <div className="callout callout-bad small"><Icon name="alert" size={16} /> {error}</div>;
}

export function OfflineNote({ reason }: { reason?: string }) {
  if (!reason) return null;
  return (
    <div className="callout callout-info tiny">
      <Icon name="info" size={15} />
      <span>AI is offline ({reason}), so this was produced by the rule engine. Add an API key to see the AI version.</span>
    </div>
  );
}

/** Fetch helper with loading / error state and a reload function. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loader()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}

export function Section({ title, sub, right, children, collapsible, defaultOpen = true }: {
  title: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (collapsible) {
    return (
      <section className="card">
        <div className="row between wrap" style={{ marginBottom: open ? 14 : 0 }}>
          <button className="section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name="chevron" size={16} className={open ? 'rot90' : undefined} />
            <span>
              <span className="card-title">{title}</span>
              {sub && <span className="card-sub">{sub}</span>}
            </span>
          </button>
          {open && right}
        </div>
        {open && children}
      </section>
    );
  }
  return (
    <section className="card">
      <div className="row between wrap" style={{ marginBottom: 14 }}>
        <div>
          <div className="card-title">{title}</div>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export const severityPill: Record<string, string> = { urgent: 'pill-bad', high: 'pill-bad', moderate: 'pill-warn', watch: 'pill-info' };
