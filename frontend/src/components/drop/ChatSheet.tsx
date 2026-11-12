/**
 * The Chat over the app (CONTEXT.md: Chat), variant B: a wide side sheet that slides in from
 * the right over the blurred app. Header with the Chat's name and state, a ⋯ menu and ×; chips
 * for General, each Goal, each Habit and Past Cycles; a Goal Chat pins where you are, the target
 * and this week. Replies still go through the copilot (Copilot.tsx), one conversation per Chat.
 * Goal Chats follow ticket 01: Up next stays open both ways, done and stopped are read-only,
 * and a stopped Goal has Start again.
 */
import { useEffect, useRef, useState } from 'react';
import { api, type DropGoal, type DropView } from '../../api';
import type { Screen } from '../../App';
import { Icon } from '../../ui';
import Copilot, { type ChatOpener } from '../Copilot';
import BpReading from './BpReading';
import MemorySheet from './MemorySheet';
import { habitOpener, sheet, type ChatId, type ChatOpenDetail } from './chat';
import './chat-sheet.css';

const HABITS = ['Movement', 'Food', 'Mind'];
const STATE: Record<string, string> = { active: 'active', upnext: 'up next', done: 'done', stopped: 'stopped' };

/** The latest value on a Goal's trend, as "Where you are" shows it. */
function whereYouAre(g: DropGoal) {
  const p = g.trend?.points[g.trend.points.length - 1];
  if (!p) return '—';
  if (g.trend?.marker === 'bp') return `${p.value}/${p.value2}`;
  return g.trend?.marker === 'hba1c' ? `${p.value}%` : `${p.value}`;
}

export default function ChatSheet({ accountKey, donorId, go, clientId, screen }: { accountKey: string; donorId: string; go: (s: Screen) => void; clientId: string; screen: Screen }) {
  const [chat, setChat] = useState<ChatId | null>(null);
  const [opener, setOpener] = useState<ChatOpener | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [view, setView] = useState<DropView | null>(null);
  const [menu, setMenu] = useState(false);
  const [memory, setMemory] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastCycles, setPastCycles] = useState<{ id: string; label: string; endedOn: string; chatCount: number }[]>([]);
  const [thisCycle, setThisCycle] = useState<Awaited<ReturnType<typeof api.chatCurrentCycle>> | null>(null);
  const [pastPick, setPastPick] = useState<string | null>(null);
  const [pastDetail, setPastDetail] = useState<Awaited<ReturnType<typeof api.chatCycle>> | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const open = chat !== null;
  sheet.open = open;

  const reload = () => api.drop(donorId).then(setView).catch(() => {});
  const changed = () => window.dispatchEvent(new CustomEvent('drop:changed'));

  function show(id: ChatId, kind: ChatOpener['kind'], text?: string, questions?: string[], rules: Record<string, string> = {}) {
    seq.current += 1;
    setChat(id);
    setAnswers(rules);
    setOpener({ id: seq.current, kind, text, questions });
    setMenu(false);
    setReading(false);
    setError(null);
  }

  function close() {
    setChat(null);
    setMenu(false);
    setReading(false);
    sheet.open = false;
    window.dispatchEvent(new CustomEvent('drop:sheet-closed'));
  }

  // Anything in the app opens a Chat with openChat() (a Goal card, the results Card, Your Chats, Drop's line).
  // Off Home, the sheet also takes Drop's asks, bookings and check-ups; on Home its General Chat does.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<ChatOpenDetail>).detail;
      reload();
      show(d.chat, 'open', d.text, d.questions, d.answers);
    };
    const offHome = (kind: ChatOpener['kind']) => (e: Event) => {
      if (screenRef.current === 'home' && !sheet.open) return;
      reload();
      show('general', kind, kind === 'ask' ? String((e as CustomEvent).detail) : undefined);
    };
    const onAsk = offHome('ask');
    const onBook = offHome('book');
    const onCheckup = offHome('checkup');
    const onChanged = () => { if (sheet.open) reload(); };
    const reloadPast = () => {
      api.chatCycles(donorId).then((r) => setPastCycles(r.cycles)).catch(() => setPastCycles([]));
      api.chatCurrentCycle(donorId).then(setThisCycle).catch(() => setThisCycle(null));
    };
    const onReset = () => { setPastPick(null); setPastDetail(null); reloadPast(); close(); };
    window.addEventListener('drop:open', onOpen);
    window.addEventListener('drop:ask', onAsk);
    window.addEventListener('drop:book', onBook);
    window.addEventListener('drop:checkup', onCheckup);
    window.addEventListener('drop:changed', onChanged);
    window.addEventListener('demo:reset', onReset);
    return () => {
      window.removeEventListener('drop:open', onOpen);
      window.removeEventListener('drop:ask', onAsk);
      window.removeEventListener('drop:book', onBook);
      window.removeEventListener('drop:checkup', onCheckup);
      window.removeEventListener('drop:changed', onChanged);
      window.removeEventListener('demo:reset', onReset);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donorId]);

  // Escape closes the menu first, then the sheet; the app behind doesn't scroll while it's open
  useEffect(() => {
    if (!open) return undefined;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || memory) return;
      if (menu) setMenu(false); else close();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, menu, memory]);

  useEffect(() => {
    if (chat !== 'past') return undefined;
    const reloadPast = () => {
      api.chatCycles(donorId).then((r) => setPastCycles(r.cycles)).catch(() => setPastCycles([]));
      api.chatCurrentCycle(donorId).then(setThisCycle).catch(() => setThisCycle(null));
    };
    reloadPast();
    window.addEventListener('drop:changed', reloadPast);
    return () => window.removeEventListener('drop:changed', reloadPast);
  }, [donorId, chat]);

  useEffect(() => {
    if (!pastPick) { setPastDetail(null); return; }
    api.chatCycle(donorId, pastPick).then(setPastDetail).catch(() => setPastDetail(null));
  }, [donorId, pastPick]);

  // A Donor switching away closes the sheet
  useEffect(() => { if (open) close(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [donorId]);

  if (!open) {
    return screen === 'home' ? null : (
      <button className="fab" onClick={() => { reload(); show('general', 'open'); }} aria-label="Ask Drop, your assistant">
        <Icon name="drop" size={20} /> Ask Drop
      </button>
    );
  }

  const goals = view?.goals || [];
  const goal = chat.startsWith('goal:') ? goals.find((g) => g.id === chat.slice(5)) || null : null;
  const habit = chat.startsWith('habit:') ? HABITS.find((h) => h.toLowerCase() === chat.slice(6)) || null : null;
  const readOnly = chat === 'past' || goal?.state === 'done' || goal?.state === 'stopped';
  // A dot on a Goal's chip when something is open for it: a Card whose button opens that Goal
  const hasOpen = (g: DropGoal) => (view?.open || []).some((c) => [c.main, c.out, ...c.chips].some((a) => a?.open?.goalId === g.id));

  const name = goal ? goal.name : habit || (chat === 'past' ? 'Past Cycles' : 'General');
  const sub = goal ? `Your Goal · ${STATE[goal.state]}${goal.state === 'upnext' && goal.startsWhen ? `, starts when ${goal.startsWhen} is done` : ''}`
    : habit ? 'Habit · no Week plan yet' : chat === 'past' ? 'Earlier Cycles · read-only' : 'Chat · this Cycle';

  const openGoal = (g: DropGoal) => show(`goal:${g.id}`, g.state === 'done' || g.state === 'stopped' ? 'say' : 'open', g.chat.text, g.chat.questions, g.chat.answers);
  const openHabit = (h: string) => { const o = habitOpener(h); show(`habit:${o.habit}`, 'open', o.text, o.questions); };

  async function goalAction(call: Promise<DropView>, line: (g: DropGoal) => string) {
    if (!goal) return;
    setMenu(false);
    setError(null);
    try {
      const v = await call;
      setView(v);
      changed();
      const now = v.goals.find((g) => g.id === goal.id);
      seq.current += 1;
      // Drop confirms in one line, in the Goal's own Chat
      if (now) { setAnswers(now.chat.answers || {}); setOpener({ id: seq.current, kind: 'say', text: line(now) }); }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const stop = () => goal && goalAction(api.dropStopGoal(donorId, goal.id), (g) => g.chat.text);
  const startAgain = () => goal && goalAction(api.dropStartGoalAgain(donorId, goal.id),
    (g) => (g.state === 'upnext' ? `${g.name} is back, up next: it starts when ${g.startsWhen} is done.` : `${g.name} is back on. What would you like to know?`));

  const live = goal && (goal.state === 'active' || goal.state === 'upnext');
  const urgent = goal?.severity === 'urgent';
  const addReading = () => {
    setMenu(false);
    if (goal?.trend?.marker === 'bp') setReading(true);
    else { close(); go('labs'); }
  };

  return (
    <div className="sheet-wrap">
      <div className="sheet-veil" onClick={close} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`${name} Chat`} ref={panel} tabIndex={-1}>
        <div className="sheet-head">
          <span className="sheet-title"><b>{name}</b><span className="card-sub" style={{ display: 'block' }}>{sub}</span></span>
          <span className="sheet-menu-wrap">
            <button className="icon-btn" aria-label="More" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name="dots" size={20} stroke={3} /></button>
            {menu && (
              <div className="sheet-menu" role="menu">
                <button role="menuitem" disabled>Simplify my plan<small>Comes with Week plans</small></button>
                {live && <button role="menuitem" onClick={addReading}>Add a reading</button>}
                {!readOnly && <button role="menuitem" onClick={() => { setMenu(false); show(chat, 'checkup'); }}>Book a check-up</button>}
                {live && (urgent
                  ? <button role="menuitem" disabled>Stop this Goal<small>An urgent Goal can't be stopped</small></button>
                  : <button role="menuitem" className="danger" onClick={stop}>Stop this Goal</button>)}
                <button role="menuitem" onClick={() => { setMenu(false); setMemory(true); }}>What Drop remembers</button>
              </div>
            )}
          </span>
          <button className="icon-btn" aria-label="Close" onClick={close}><Icon name="x" size={20} stroke={2} /></button>
        </div>
        {menu && <div className="sheet-menu-catch" onClick={() => setMenu(false)} aria-hidden="true" />}

        <div className="sheet-switch" role="tablist" aria-label="Your Chats">
          <button role="tab" aria-selected={chat === 'general'} className={`chip ${chat === 'general' ? 'on' : ''}`} onClick={() => show('general', 'open')}>General</button>
          {goals.map((g) => (
            <button key={g.id} role="tab" aria-selected={chat === `goal:${g.id}`} className={`chip ${chat === `goal:${g.id}` ? 'on' : ''}`} onClick={() => openGoal(g)}>
              {hasOpen(g) && <span className="dot" aria-label="Something open" />}{g.name}{g.state !== 'active' && <span className="chip-state"> · {STATE[g.state]}</span>}
            </button>
          ))}
          {HABITS.map((h) => <button key={h} role="tab" aria-selected={habit === h} className={`chip ${habit === h ? 'on' : ''}`} onClick={() => openHabit(h)}>{h}</button>)}
          <button role="tab" aria-selected={chat === 'past'} className={`chip ${chat === 'past' ? 'on' : ''}`} onClick={() => show('past', 'open')}><Icon name="history" size={16} /> Past Cycles</button>
        </div>

        {goal && goal.state !== 'done' && (
          <div className="sheet-pinned">
            <div><div className="k">Where you are</div><div className="v" style={{ color: 'var(--brand-ink)' }}>{whereYouAre(goal)}</div></div>
            <div><div className="k">Target</div><div className="v">{goal.target}</div></div>
            <div><div className="k">This week</div><div className="v">{goal.state === 'active' ? 'Nothing planned yet' : goal.state === 'upnext' ? `After ${goal.startsWhen}` : 'Stopped'}</div></div>
          </div>
        )}
        {reading && goal && (
          <div className="sheet-reading">
            <BpReading donorId={donorId} onSaved={(v) => { setReading(false); setView(v); changed(); }} />
            <button className="btn btn-ghost btn-sm" onClick={() => setReading(false)}>Cancel</button>
          </div>
        )}
        {error && <div className="callout callout-warn small sheet-error">{error}</div>}

        {chat === 'past' ? (
          (() => {
            const liveChats = thisCycle ? Object.entries(thisCycle.chats) : [];
            const liveTurns = liveChats.reduce((n, [, b]) => n + b.turns.length, 0);
            const renderTurns = (entries: [string, { turns: { at: string; user: string; assistant: string }[] }][]) => entries.map(([key, bucket]) => (
              <div key={key} style={{ marginTop: 12 }}>
                <b className="small">{key === 'general' ? 'General chat' : key}</b>
                {bucket.turns.map((t, i) => (
                  <div key={i} className="drop-earlier" style={{ marginTop: 8 }}>
                    <div><span><b>You:</b> {t.user}</span></div>
                    <div><span><b>Drop:</b> {t.assistant}</span><span className="on">{t.at}</span></div>
                  </div>
                ))}
              </div>
            ));
            if (pastCycles.length === 0 && liveTurns === 0) {
              return (
                <div className="sheet-empty">
                  <Icon name="history" size={28} />
                  <b>No cycles yet</b>
                  <span className="small muted">Chat with Drop in General or a Goal — turns show under <strong>This cycle</strong>. Use <strong>Reset</strong> on the demo bar to archive them here (read-only). Vertex Agent Sessions mirror chat separately for compliance; this view is in-app history.</span>
                </div>
              );
            }
            return (
              <div className="sheet-past" style={{ padding: 16, overflow: 'auto', flex: 1 }}>
                <b className="small">This cycle (live)</b>
                <p className="small muted" style={{ margin: '4px 0 8px' }}>Since demo timeline {thisCycle?.startedOn || '…'}. Still writable in other chats.</p>
                {liveTurns === 0 ? <p className="small muted">No Drop chats recorded this cycle yet.</p> : renderTurns(liveChats)}
                {pastCycles.length > 0 && (
                  <>
                    <b className="small" style={{ display: 'block', marginTop: 20 }}>Earlier cycles (read-only)</b>
                    <select className="input" value={pastPick || ''} onChange={(e) => setPastPick(e.target.value || null)}>
                      <option value="">—</option>
                      {pastCycles.map((c) => <option key={c.id} value={c.id}>{c.label} · ended {c.endedOn}</option>)}
                    </select>
                    {pastDetail && renderTurns(Object.entries(pastDetail.chats))}
                    {pastDetail && pastDetail.dropEarlier.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <b className="small">Drop · earlier that cycle</b>
                        <div className="drop-earlier">{pastDetail.dropEarlier.map((e) => <div key={e.id}><span>{e.receipt}</span><span className="on">{e.on}</span></div>)}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()
        ) : (
          <Copilot key={`${accountKey}|${donorId}|${chat}`} accountKey={accountKey} donorId={donorId} go={(s) => { close(); go(s); }} clientId={clientId}
            chat={chat} opener={opener} answers={answers} readOnly={readOnly}
            placeholder={goal ? `Ask Drop about ${goal.name}` : habit ? `Ask Drop about ${habit.toLowerCase()}` : undefined} />
        )}

        {goal?.state === 'stopped' && (
          <div className="sheet-foot">
            <span className="small muted sheet-title">This Chat is read-only.</span>
            <button className="btn btn-primary" onClick={startAgain}>Start again</button>
          </div>
        )}
        {goal?.state === 'done' && <div className="sheet-foot"><span className="small muted">This Goal is done. Its Chat is read-only.</span></div>}
      </div>
      {memory && view && (
        <MemorySheet memory={view.memory} onForget={async (id) => { setView(await api.dropForget(donorId, id)); changed(); }}
          onForgetAll={async () => { setView(await api.dropForget(donorId)); changed(); }} onClose={() => setMemory(false)} />
      )}
    </div>
  );
}
