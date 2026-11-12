import { useEffect } from 'react';
import { api } from '../api';
import { AIBadge, ErrorNote, Icon, Loading, Section, useLoad } from '../ui';

/** Where Pratidaan uses AI, why rules alone can't do it, and live usage. */
const FEATURES = [
  { name: 'Drop copilot', kind: 'Agent', where: 'Chat button on every screen',
    why: 'Donors ask open questions that span impact, health and cover ("why didn\'t my cover go up?"). An agent decides which records to pull, combines them, answers in the donor\'s language and can navigate the app.' },
  { name: 'Goal write-up', kind: 'Rules', where: 'Health → a Goal',
    why: 'Each Goal gets a two-sentence "why this matters" and 2-3 steps, each tagged with a Habit, a doctor or a reading and citing protocol or guidance evidence. Written from rules for now; an AI version waits on the team\'s call on Google Cloud\'s "no clinical purposes" term, and grouping, targets and order always stay rules.' },
  { name: 'Lab-report reader', kind: 'GenAI', where: 'Health → Add an outside lab report',
    why: 'Indian labs print results in endless formats, names and units, often as photos. Only a model can read any layout, map synonyms to LOINC codes and convert units reliably; schema-constrained output plus range checks keep it safe.' },
  { name: 'Impact stories', kind: 'Rules', where: 'Impact → a component → Write my story',
    why: 'Recipient-facing stories currently use a deterministic English template. Model-written stories are disabled because a model cannot reliably certify its own added facts.' },
  { name: 'Insight of the day', kind: 'GenAI', where: 'Home',
    why: 'Several rule-derived signals compete for attention. The model selects a candidate; its title, message and destination come from rules. Invalid selections fall back to rules.' },
];

const DETERMINISTIC = ['Eligibility to donate (NBTC rules)', 'Clinical findings and severity (ICMR / ACC-AHA thresholds)', 'Health score', 'Insurance cover ladder', 'Privacy: k-anonymity and recipient generalisation'];

export default function AIConsole() {
  const status = useLoad(() => api.aiStatus(), []);
  const traces = useLoad(() => api.traces(), []);
  useEffect(() => {
    const t = setInterval(() => { traces.reload(); status.reload(); }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status.loading && !status.data) return <Loading />;
  if (status.error || !status.data) return <ErrorNote error={status.error || 'Could not load'} />;
  const s = status.data;

  return (
    <div className="stack fade-in">
      <div className="page-head">
        <div>
          <div className="page-title">AI console</div>
          <div className="page-sub">Where Pratidaan uses generative and agentic AI, why it's needed there, and live usage.</div>
        </div>
        <span className={`pill ${s.live ? 'pill-good' : 'pill-warn'}`}>{s.live ? `Verified · ${s.model}` : `Not verified · ${s.reason}`}</span>
      </div>

      <div className="grid grid-4">
        <div className="card"><div className="stat-value">{s.callsToday}</div><div className="stat-label">model calls today</div></div>
        <div className="card"><div className="stat-value">{s.tokensUsedToday.toLocaleString()}</div><div className="stat-label">of {s.dailyTokenBudget.toLocaleString()} daily tokens</div><div className="progress mt-8"><span style={{ width: `${Math.min(100, (s.tokensUsedToday / s.dailyTokenBudget) * 100)}%`, background: 'var(--ai)' }} /></div></div>
        <div className="card"><div className="stat-value">{s.cacheReadTokens.toLocaleString()}</div><div className="stat-label">tokens served from prompt cache</div></div>
        <div className="card"><div className="stat-value">{s.rateLimitRps}/s</div><div className="stat-label">request rate limit</div></div>
      </div>

      <Section title="AI features and why they need AI">
        <div className="stack" style={{ gap: 10 }}>
          {FEATURES.map((f) => (
            <div key={f.name} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
              <div className="row wrap"><b>{f.name}</b><AIBadge label={f.kind} /><span className="tiny muted">{f.where}</span></div>
              <p className="small muted mt-8">{f.why}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-2">
        <Section title={<><Icon name="shield" size={17} /> Kept deterministic on purpose</>} sub="Decisions that affect safety or money never depend on a model">
          <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{DETERMINISTIC.map((d) => <li key={d}>{d}</li>)}</ul>
        </Section>
        <Section title={<><Icon name="lock" size={17} /> Guardrails</>}>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            <li>Agents can only call donor-scoped tools; no tool exposes recipient identity or other donors' health.</li>
            <li>Structured outputs (JSON schema) for plans, lab extraction and insights, with local validation on the shared model path.</li>
            <li>Every agent answer shows its tool trace.</li>
            <li>Local request pacing and daily call/token budgets; some features have rule-based fallback, while outside lab extraction requires AI. Cached token use is reported only if Vertex provides it.</li>
            <li>No diagnosis or prescribing; urgent findings route to a doctor.</li>
          </ul>
        </Section>
      </div>

      <Section title="Recent model calls" sub="Live trace log (this server session)">
        {!traces.data?.length && <div className="empty small">No calls yet. Try the copilot, care plan, lab reader or a story.</div>}
        {!!traces.data?.length && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Time</th><th>Feature</th><th>Latency</th><th>In / out tokens</th><th>Cached</th><th>Result</th></tr></thead>
              <tbody>
                {traces.data.map((t) => (
                  <tr key={t.id}>
                    <td className="tiny">{new Date(t.at).toLocaleTimeString()}</td>
                    <td>{t.feature}</td>
                    <td>{(t.ms / 1000).toFixed(1)}s</td>
                    <td>{t.inputTokens ?? '—'} / {t.outputTokens ?? '—'}</td>
                    <td>{t.cacheReadTokens ?? 0}</td>
                    <td>{t.error ? <span className="pill pill-bad">{t.error}</span> : <span className="pill pill-good">{t.stopReason}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
