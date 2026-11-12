/**
 * Drop's conversation on Home: open Cards first (urgent on top, at most 3 before
 * "N more"), receipts with Undo, and "Earlier this cycle". Rules live on the server.
 */
import { useEffect, useState } from 'react';
import { api, isStaleCard, type DropCard, type DropView } from '../../api';
import { ErrorNote, Icon } from '../../ui';
import DropCardView from './DropCardView';
import StoryViewer, { badgeSeenOnSlide } from './StoryViewer';
import ReportUpload from './ReportUpload';
import MemorySheet from './MemorySheet';
import './drop.css';

/** Ask Drop a question in the side panel (the Copilot listens for this). */
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', hi: 'हिंदी', kn: 'ಕನ್ನಡ', ta: 'தமிழ்', te: 'తెలుగు', ml: 'മലയാളം' };

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Cards the chat below already shows on Home, so the list above doesn't repeat them. */
export const chatCards = new Set<string>();
// After a demo Reset those Cards are gone
window.addEventListener('demo:reset', () => chatCards.clear());

export function askDrop(question: string) {
  window.dispatchEvent(new CustomEvent('drop:ask', { detail: question }));
}

export default function DropFeed({ donorId, version, refresh, calmLine, storiesInChat = false, onDetails, onDonate }: { donorId: string; version: number; refresh: () => void; calmLine: string; storiesInChat?: boolean; onDetails?: () => void; onDonate?: () => void }) {
  const [view, setView] = useState<DropView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [story, setStory] = useState<DropCard | null>(null);
  const [upload, setUpload] = useState<DropCard | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [pastCycles, setPastCycles] = useState<{ id: string; label: string; endedOn: string; dropCount: number }[]>([]);
  const [pastDetail, setPastDetail] = useState<{ label: string; earlier: { id: string; receipt: string; on: string }[] } | null>(null);

  // Opening the app (or switching Persona) brings hidden Cards back
  useEffect(() => {
    let alive = true;
    setView(null);
    api.dropReopen(donorId).then((v) => alive && setView(v)).catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [donorId]);
  // A Card opened or answered in the Drop panel shows up here too
  useEffect(() => {
    const reload = () => api.drop(donorId).then(setView).catch(() => {});
    // After a demo Reset the Cards on screen no longer exist: drop them at once, then load the fresh ones
    const reset = () => { setView(null); setShowAll(false); setEarlierOpen(false); setPastOpen(false); setPastDetail(null); reload(); api.chatCycles(donorId).then((r) => setPastCycles(r.cycles.filter((c) => c.dropCount > 0))).catch(() => {}); };
    window.addEventListener('drop:changed', reload);
    window.addEventListener('demo:reset', reset);
    return () => { window.removeEventListener('drop:changed', reload); window.removeEventListener('demo:reset', reset); };
  }, [donorId]);
  useEffect(() => {
    api.chatCycles(donorId).then((r) => setPastCycles(r.cycles.filter((c) => c.dropCount > 0))).catch(() => setPastCycles([]));
  }, [donorId, version]);
  useEffect(() => {
    if (!version) return;
    let alive = true;
    api.drop(donorId).then((v) => alive && setView(v)).catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [donorId, version]);

  // Tell the demo bar what date the server is on
  useEffect(() => { if (view) window.dispatchEvent(new CustomEvent('demo:clock', { detail: view.clock })); }, [view]);

  async function run(action: Promise<DropView>, refreshAfter = false) {
    setBusy(true);
    setError(null);
    try {
      setView(await action);
      if (refreshAfter) refresh();
    } catch (e) {
      if (isStaleCard(e)) {
        setView(await api.drop(donorId).catch(() => view));
        setError('That card had expired, so I refreshed the list.');
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!view) return <div className="drop-feed">{error ? <ErrorNote error={error} /> : <div className="skeleton" style={{ height: 180 }} />}</div>;

  const shortcuts = [...new Set(['en', view.preferredLanguage, view.language].filter((code) => LANGUAGE_NAMES[code]))];
  // The Intro and Drop's chat follow the new language straight away
  const switchLanguage = (code: string) => run(api.dropLanguage(donorId, code).then((v) => { window.dispatchEvent(new CustomEvent('drop:language')); return v; }));
  const open = storiesInChat ? view.open.filter((c) => !c.main?.story && !chatCards.has(c.id)) : view.open;
  const shown = showAll ? open : open.slice(0, 3);
  const answer = (card: DropCard, value: unknown) => run(api.dropAnswer(donorId, card.id, value), true);

  return (
    <div className="drop-feed">
      <div className="drop-head">
        <button className="drop-who" onClick={() => setMemoryOpen(true)} aria-label="Drop: see what Drop remembers">
          <span className="drop-avatar"><Icon name="drop" size={18} stroke={2.2} /></span>
          <span><b>Drop</b><br /><span className="tiny muted">Your Pratidaan assistant</span></span>
        </button>
        {/* Every donor can change Drop's language: English and their own as buttons (plus the one in use), the rest under More */}
        <div className="drop-lang" role="group" aria-label="Drop's language">
          {shortcuts.map((code) => (
            <button key={code} aria-pressed={view.language === code} disabled={busy} onClick={() => switchLanguage(code)}>{LANGUAGE_NAMES[code]}</button>
          ))}
          <select aria-label="More languages" value="" disabled={busy} onChange={(e) => e.target.value && switchLanguage(e.target.value)}>
            <option value="">More</option>
            {Object.keys(LANGUAGE_NAMES).filter((code) => !shortcuts.includes(code)).map((code) => <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>)}
          </select>
        </div>
        <button className="drop-link" onClick={() => setMemoryOpen(true)}>What do you remember about me?</button>
      </div>

      {view.memReceipt && (
        <div className="drop-memline"><Icon name="info" size={15} /><span>{view.memReceipt}</span><button onClick={() => run(api.dropMemoryUndo(donorId))}>Undo</button></div>
      )}
      {view.receipts.map((r) => (
        <div className="drop-receipt" key={r.id}>
          <Icon name="check" size={16} /><span>{r.receipt}</span>
          {r.undo && <button onClick={() => run(api.dropUndo(donorId), true)}>Undo</button>}
        </div>
      ))}

      {view.open.length === 0 && !storiesInChat && <div className="drop-calm">Nothing needs you right now.<br />{calmLine}</div>}
      {shown.map((card) => (
        <DropCardView
          key={card.id}
          card={card}
          busy={busy}
          onAnswer={(value) => answer(card, value)}
          onSnooze={(option) => run(api.dropSnooze(donorId, card.id, option))}
          onHide={() => run(api.dropHide(donorId, card.id))}
          onStory={() => setStory(card)}
          onUpload={() => setUpload(card)}
          onAsk={askDrop}
        />
      ))}
      {open.length > 3 && !showAll && <button className="drop-more" onClick={() => setShowAll(true)}>{open.length - 3} more</button>}

      {view.bookings.length > 0 && (
        <div className="drop-coming" aria-label="Coming up">
          <div className="drop-coming-title">Coming up</div>
          {view.bookings.map((b) => (
            <div key={b.id} className="drop-booking">
              <Icon name="calendar" size={16} />
              <span>
                <b>{b.kind === 'donate' ? 'Donation booking' : `Check-up${b.doctor ? ` · ${b.doctor}` : ''}`}</b> · {fmtDay(b.date)} · {b.time}<br />
                <span className="tiny muted">{b.kind === 'care' && b.clinic ? `Fictional ${b.clinic}, ${b.address}` : b.place} · no centre or clinic reservation</span>
                {b.kind === 'care' && onDetails && <><br /><button className="drop-link" onClick={onDetails}>See details</button></>}
              </span>
              {b.kind === 'donate' && b.guided ? (
                <button disabled={!onDonate} onClick={onDonate}>Manage in Donate</button>
              ) : <>
                <button disabled={busy} onClick={() => run(api.dropCancelBooking(donorId, b.id, true), true)}>Change booking</button>
                <button disabled={busy} onClick={() => run(api.dropCancelBooking(donorId, b.id, false), true)}>Cancel booking</button>
              </>}
            </div>
          ))}
        </div>
      )}

      {view.earlier.length > 0 && (
        <>
          <button className="drop-earlier-toggle" aria-expanded={earlierOpen} onClick={() => setEarlierOpen(!earlierOpen)}>
            <Icon name="chevron" size={14} /> Earlier this cycle · {view.earlier.length}
          </button>
          {earlierOpen && (
            <div className="drop-earlier">
              {view.earlier.map((e) => <div key={e.id}><span>{e.receipt}</span><span className="on">{e.on}</span></div>)}
            </div>
          )}
        </>
      )}
      {pastCycles.length > 0 && (
        <>
          <button className="drop-earlier-toggle" aria-expanded={pastOpen} onClick={() => setPastOpen(!pastOpen)}>
            <Icon name="history" size={14} /> Past cycles · {pastCycles.length}
          </button>
          {pastOpen && (
            <div className="drop-earlier">
              {pastCycles.map((c) => (
                <button key={c.id} type="button" className="drop-link" style={{ textAlign: 'left', padding: '8px 12px' }} onClick={async () => {
                  const full = await api.chatCycle(donorId, c.id);
                  setPastDetail({ label: full.label, earlier: full.dropEarlier.map((e) => ({ id: e.id, receipt: e.receipt, on: e.on })) });
                }}>
                  {c.label} · ended {c.endedOn} · {c.dropCount} items
                </button>
              ))}
              {pastDetail && (
                <div style={{ marginTop: 8 }}>
                  <div className="tiny muted">{pastDetail.label}</div>
                  {pastDetail.earlier.map((e) => <div key={e.id}><span>{e.receipt}</span><span className="on">{e.on}</span></div>)}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {error && <ErrorNote error={error} />}

      {story && story.story && (
        <StoryViewer title={story.label} slides={story.story} last={story.last} onSlide={badgeSeenOnSlide(donorId, story)} onClose={() => { const c = story; setStory(null); answer(c, c.main?.value ?? 'seen'); }} />
      )}
      {upload && (
        <ReportUpload donorId={donorId} onClose={() => setUpload(null)} onSave={(value) => { const c = upload; setUpload(null); answer(c, value); }} />
      )}
      {memoryOpen && (
        <MemorySheet
          memory={view.memory}
          onForget={(id) => run(api.dropForget(donorId, id))}
          onForgetAll={() => run(api.dropForget(donorId))}
          onClose={() => setMemoryOpen(false)}
        />
      )}
    </div>
  );
}
