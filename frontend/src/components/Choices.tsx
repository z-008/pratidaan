/**
 * The Donor's Choices (CONTEXT.md): three sharing switches. Cover, Community, the Intro and
 * "Your data" all show them, and every one reads and writes the same saved Choices, so they
 * always agree. A change tells the rest of the app to refresh what it shows.
 */
import { useState, type ReactNode } from 'react';
import { api, type Donor } from '../api';

export type ChoiceKey = keyof Donor['consent'];

export const CHOICE_TEXT: Record<ChoiceKey, { label: string; sub: string }> = {
  shareHealthWithInsurer: { label: 'Share my health score with my insurer', sub: 'Can raise your cover at the same premium. Only the score, never your results.' },
  showOnLeaderboard: { label: "Show me on my Circles' leaderboards", sub: 'Your first name, donations and patients helped' },
  includeInCommunityStats: { label: "Count my donations in my Circles' totals", sub: 'Anonymous numbers only. Off: you are left out of every total and the leaderboard' },
};

/** Tell every screen that a Choice changed. */
export function choicesChanged() {
  window.dispatchEvent(new CustomEvent('choices:changed'));
}

export function ChoiceSwitch({ donorId, choice, on, sub, onChanged }: { donorId: string; choice: ChoiceKey; on: boolean; sub?: ReactNode; onChanged?: (consent: Donor['consent']) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const text = CHOICE_TEXT[choice];

  async function flip() {
    setBusy(true);
    setError('');
    try {
      const consent = await api.setConsent(donorId, { [choice]: !on });
      onChanged?.(consent);
      choicesChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="choice-row">
      <span>
        <b>{text.label}</b>
        <span className="tiny muted">{sub ?? text.sub}</span>
        {error && <span className="tiny" style={{ color: 'var(--bad)' }}>{error}</span>}
      </span>
      <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={text.label} disabled={busy} onClick={flip} />
    </div>
  );
}
