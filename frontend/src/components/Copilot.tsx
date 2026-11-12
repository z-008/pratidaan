/**
 * Drop's chat: Home's General Chat (inline) and each Chat in the side sheet (ChatSheet). Replies are one or
 * two sentences plus at most one Card (a chart, check-up slots or a reminder),
 * memory lines and receipts. Cards it opens also appear on Home.
 */
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, fmtDate, isStaleCard, type Appointment, type ChartPoint, type CopilotAction, type DropBooking, type DropCard, type DropView } from '../api';
import { Icon, Thinking } from '../ui';
import type { Screen } from '../App';
import DropCardView from './drop/DropCardView';
import BookingFlow from './BookingFlow';
import AppointmentPass from './AppointmentPass';
import StoryViewer, { badgeSeenOnSlide } from './drop/StoryViewer';
import Checkup from './drop/Checkup';
import { chatCards } from './drop/DropFeed';
import { IntroBar, IntroFold, IntroThread, useIntro } from './intro/Intro';
import { sheet, type ChatId } from './drop/chat';
import './drop/drop.css';

interface Turn { role: 'user' | 'ai'; text: string; offline?: boolean; actions?: CopilotAction[]; questions?: string[]; booking?: boolean; appointment?: Appointment; checkup?: DropBooking }

/** Ask Drop to start the booking steps (Home's button and the Donate tile use this). */
export function startBooking() {
  window.dispatchEvent(new CustomEvent('drop:book'));
}

/** Ask Drop for free check-up times (My health and Home use this). */
export function bookCheckup() {
  window.dispatchEvent(new CustomEvent('drop:checkup'));
}

const CHECKUP_INTENT = /\b(check-?ups?|doctor|physician|gp)\b/i;
const BOOK_INTENT = /\b(book|schedule|reserve)\b.*\b(donat\w*|slot|appointment|blood)\b|^book\b/i;

// One conversation per donor and Chat; the General one is shared by Home and the side sheet
const conversations = new Map<string, { turns: Turn[]; history: unknown[] | null }>();
const keyOf = (accountKey: string, donorId: string, chat: ChatId) => {
  const base = `${accountKey}|${donorId}`;
  return chat === 'general' ? base : `${base}|${chat}`;
};

/** What the side sheet asks its Chat to do as it opens: show Drop's line, ask, book or offer check-ups. */
export interface ChatOpener { id: number; kind: 'open' | 'say' | 'ask' | 'book' | 'checkup'; text?: string; questions?: string[] }

const PLANNING = /^(the user\b|plan:|draft \d|critique \d|revise \d|final answer:)/i;

/** Hide a reasoning note if one was saved into an earlier reply. */
function spoken(raw: string) {
  let t = raw.trim();
  const at = t.toLowerCase().lastIndexOf('final answer:');
  if (at >= 0) t = t.slice(at + 'final answer:'.length).trim();
  const chunks = t.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const kept = chunks.filter((s) => !PLANNING.test(s));
  return kept.length && kept.length < chunks.length ? kept.join('\n\n') : t;
}

/** Minimal formatter for model replies: **bold**, "- " bullets and paragraphs. No HTML injection. */
function Rich({ text }: { text: string }) {
  const inline = (line: string) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>);
  const blocks: ReactElement[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={`u${blocks.length}`} style={{ margin: '4px 0', paddingLeft: 18 }}>{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
    bullets = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bullet = /^([-*•]|\d+\.)\s+(.*)$/.exec(line);
    if (bullet) { bullets.push(bullet[2]); continue; }
    flush();
    if (line) blocks.push(<p key={`p${blocks.length}`} style={{ margin: '4px 0' }}>{inline(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}

// Someone who hasn't donated yet has no results, readings or patients to ask about
const FIRST_TIME_SUGGESTIONS = [
  'Book my first donation',
  'What happens at a donation?',
  'Book a doctor check-up',
  'What do you remember about me?',
];

const SUGGESTIONS = [
  'Book a donation',
  'Book a doctor check-up',
  'Explain my latest results',
  'How is my BP doing?',
  'Where did my blood go?',
  'When can I donate next?',
  'What do you remember about me?',
];

function StoryChip({ card, onClick }: { card: DropCard; onClick: () => void }) {
  return (
    <button className="suggestion suggestion-story" style={{ minHeight: 36 }} title={card.text} onClick={onClick}>
      <Icon name="play" size={13} /> {card.type === 'impact' ? 'Watch my impact story' : card.main?.label}
    </button>
  );
}

const MARKER_NAMES: Record<string, string> = { bp: 'Blood pressure', hb: 'Haemoglobin', hba1c: 'HbA1c', ldl: 'LDL cholesterol', tg: 'Triglycerides', ferritin: 'Ferritin' };

function ChartCard({ marker, points }: { marker: string; points: ChartPoint[] }) {
  return (
    <div className="dcard" style={{ width: '100%', padding: 12 }}>
      <div className="dcard-head"><span>Chart · {MARKER_NAMES[marker] || marker}</span></div>
      <div style={{ height: 150, marginTop: 8 }}>
        <ResponsiveContainer>
          <LineChart data={points.map((p) => ({ ...p, label: fmtDate(p.date) }))} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
            <Line type="monotone" dataKey="value" name={marker === 'bp' ? 'Top' : MARKER_NAMES[marker]} stroke="#c8102e" strokeWidth={2} dot={{ r: 3 }} />
            {marker === 'bp' && <Line type="monotone" dataKey="value2" name="Bottom" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="tiny faint">Donation visits{points.some((p) => p.source !== 'donation') ? ' and readings you added' : ''}.</div>
    </div>
  );
}

export default function Copilot({ accountKey, donorId, go, clientId, inline = false, top, firstTime = false, chat = 'general', opener, answers = {}, readOnly = false, placeholder }: {
  accountKey: string; donorId: string; go: (s: Screen) => void; clientId: string; inline?: boolean; top?: ReactNode; firstTime?: boolean;
  /** In the side sheet: which Chat, what to do as it opens, fixed rule replies, and read-only for a done or stopped Goal */
  chat?: ChatId; opener?: ChatOpener | null; answers?: Record<string, string>; readOnly?: boolean; placeholder?: string;
}) {
  const key = keyOf(accountKey, donorId, chat);
  const [turns, setTurns] = useState<Turn[]>(() => conversations.get(key)?.turns || []);
  const [history, setHistory] = useState<unknown[] | null>(() => conversations.get(key)?.history || null);
  useEffect(() => { conversations.set(key, { turns, history }); }, [key, turns, history]);
  useEffect(() => {
    let alive = true;
    api.chatActive(donorId, chat).then((active) => {
      if (!alive || conversations.get(key)?.turns.length) return;
      const fromServer = active.turns.flatMap((t) => [
        { role: 'user' as const, text: t.user },
        { role: 'ai' as const, text: t.assistant },
      ]);
      if (fromServer.length) setTurns(fromServer);
      if (active.history?.length) { historyRef.current = active.history; setHistory(active.history); }
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, donorId, chat]);
  const historyRef = useRef<unknown[] | null>(history);
  function recordLocal(userText: string, reply: string) {
    const updated = [...(historyRef.current || []), { role: 'user', content: userText }, { role: 'assistant', content: reply }];
    historyRef.current = updated;
    setHistory(updated);
  }
  useEffect(() => {
    turns.forEach((t) => t.actions?.forEach((a) => a.type === 'card' && a.cardId && chatCards.add(a.cardId)));
  }, [turns]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<DropView | null>(null);
  const [story, setStory] = useState<DropCard | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const sendRef = useRef<(text: string) => void>(() => {});
  const bookRef = useRef<() => void>(() => {});
  const checkupRef = useRef<() => void>(() => {});
  // On Home, a new user's chat runs Drop's Intro first (the Cards above it stay)
  const intro = useIntro(donorId, inline, { go, onBook: () => bookRef.current() });
  const introLive = inline && intro.live;
  const introLiveRef = useRef(false);
  introLiveRef.current = introLive;

  useEffect(() => {
    if (turns.length || busy || intro.entries.length) body.current?.scrollTo({ top: body.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy, intro.entries.length, intro.busy]);

  const reloadView = () => api.drop(donorId).then(setView).catch(() => {});
  const changed = () => window.dispatchEvent(new CustomEvent('drop:changed'));

  function book(said?: string) {
    setInput('');
    if (said) recordLocal(said, "Let's book your donation. It takes about a minute.");
    setTurns((t) => [
      ...t.filter((x) => !x.booking),
      ...(said ? [{ role: 'user' as const, text: said }] : []),
      { role: 'ai', text: `Let's book your ${firstTime ? 'first ' : ''}donation. It takes about a minute.`, booking: true },
    ]);
  }

  async function offerCheckup(said?: string, text = 'Here are the next free check-up times. Tap one to book.') {
    setInput('');
    if (said) setTurns((t) => [...t, { role: 'user', text: said }]);
    try {
      const r = await api.dropOffer(donorId, 'care_slots');
      chatCards.add(r.cardId);
      setView(r.view);
      changed();
      if (said) recordLocal(said, text);
      setTurns((t) => [...t, { role: 'ai', text, actions: [{ type: 'card', cardId: r.cardId }] }]);
    } catch (e) {
      const errorText = `I couldn't load check-up times just now: ${(e as Error).message}`;
      if (said) recordLocal(said, errorText);
      setTurns((t) => [...t, { role: 'ai', text: errorText }]);
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    if (CHECKUP_INTENT.test(message) && /\b(book|schedule|reserve|see|visit|need|want|like)\b/i.test(message)) { offerCheckup(message); return; }
    if (BOOK_INTENT.test(message)) { book(message); return; }
    setInput('');
    // A fixed reply by rules, such as when an Up next Goal starts
    if (answers[message]) {
      recordLocal(message, answers[message]);
      setTurns((t) => [...t, { role: 'user', text: message }, { role: 'ai', text: answers[message] }]);
      return;
    }
    setTurns((t) => [...t, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const r = await api.copilot(donorId, message, historyRef.current, chat);
      if (r.history) { historyRef.current = r.history; setHistory(r.history); }
      else recordLocal(message, r.reply);
      r.actions.forEach((a) => a.type === 'card' && a.cardId && chatCards.add(a.cardId));
      setTurns((t) => [...t, { role: 'ai', text: r.reply, offline: r.offline, actions: r.actions }]);
      const nav = r.actions.find((a) => a.type === 'navigate');
      if (nav?.screen) go(nav.screen as Screen);
      if (r.actions.some((a) => a.type !== 'navigate')) {
        await reloadView();
        changed();
      }
    } catch (e) {
      const errorText = `Sorry, something went wrong: ${(e as Error).message}`;
      recordLocal(message, errorText);
      setTurns((t) => [...t, { role: 'ai', text: errorText }]);
    } finally {
      setBusy(false);
    }
  }
  sendRef.current = send;
  bookRef.current = () => { book(); if (inline) body.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  checkupRef.current = () => { offerCheckup('Book a doctor check-up'); if (inline) body.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  // Other parts of the app ask Drop things: a chip on a Card, or Book on Home. In the side sheet, ChatSheet passes them in as `opener`.
  useEffect(() => {
    const onAsk = (e: Event) => { if (sheet.open) return; reloadView(); sendRef.current(String((e as CustomEvent).detail)); };
    const onChanged = () => reloadView();
    // Mid-Intro the chat is busy with the Intro, so booking opens on the Donate screen instead
    const onBook = () => { if (!sheet.open) (introLiveRef.current ? go('donate') : bookRef.current()); };
    const onCheckup = () => { if (!sheet.open) checkupRef.current(); };
    // The side sheet's General Chat is this one: pick up what was said there
    const onSheetClosed = () => {
      const saved = conversations.get(key);
      if (saved) { setTurns(saved.turns); setHistory(saved.history); historyRef.current = saved.history; }
    };
    // The demo went back to the start: the saved conversation and the Cards it showed no longer exist
    const onReset = () => {
      conversations.clear();
      setTurns([]);
      setHistory(null);
      historyRef.current = null;
      setStory(null);
      reloadView();
    };
    if (inline) {
      window.addEventListener('drop:ask', onAsk);
      window.addEventListener('drop:book', onBook);
      window.addEventListener('drop:checkup', onCheckup);
      window.addEventListener('drop:sheet-closed', onSheetClosed);
    }
    window.addEventListener('drop:changed', onChanged);
    window.addEventListener('demo:reset', onReset);
    return () => {
      window.removeEventListener('drop:ask', onAsk);
      window.removeEventListener('drop:book', onBook);
      window.removeEventListener('drop:checkup', onCheckup);
      window.removeEventListener('drop:sheet-closed', onSheetClosed);
      window.removeEventListener('drop:changed', onChanged);
      window.removeEventListener('demo:reset', onReset);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { reloadView(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);

  // The side sheet opened this Chat, or asked it something
  useEffect(() => {
    if (!opener) return;
    if (opener.kind === 'ask' && opener.text) sendRef.current(opener.text);
    else if (opener.kind === 'book') bookRef.current();
    else if (opener.kind === 'checkup') checkupRef.current();
    else if (opener.text) {
      const text = opener.kind === 'say' ? opener.text : `${opener.text} What would you like to know?`;
      // Opening a Chat again doesn't repeat its opening line
      setTurns((t) => (opener.kind === 'open' && t.some((x) => x.text === text) ? t : [...t, { role: 'ai', text, questions: opener.questions?.length ? opener.questions : undefined }]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opener?.id]);

  async function act(p: Promise<DropView>) {
    try {
      setView(await p);
      changed();
    } catch (e) {
      if (isStaleCard(e)) { await reloadView(); changed(); return; }
      setTurns((t) => [...t, { role: 'ai', text: (e as Error).message }]);
    }
  }

  async function answerCard(card: DropCard, value: unknown) {
    const before = new Set((view?.bookings || []).map((b) => b.id));
    try {
      const v = await api.dropAnswer(donorId, card.id, value);
      setView(v);
      changed();
      const booked = v.bookings.find((b) => b.kind === 'care' && !before.has(b.id));
      if (booked) setTurns((t) => [...t, { role: 'ai', text: `Booked with ${booked.doctor || 'the doctor'}. The details are also in My health.`, checkup: booked }]);
    } catch (e) {
      if (!isStaleCard(e)) { setTurns((t) => [...t, { role: 'ai', text: (e as Error).message }]); return; }
      if (card.type === 'slots' && card.variant === 'care') offerCheckup(undefined, 'Those times had expired, so here are fresh ones. Tap one to book.');
      else { await reloadView(); changed(); setTurns((t) => [...t, { role: 'ai', text: 'That card had expired, so I refreshed it.' }]); }
    }
  }

  const stories = (view?.open || []).filter((c) => c.main?.story && c.story?.length);

  function watch(card: DropCard) {
    setTurns((t) => [...t, { role: 'user', text: card.main?.label || 'Watch the story' }, { role: 'ai', text: card.text }]);
    setStory(card);
  }

  function storyDone() {
    const card = story;
    setStory(null);
    if (card) act(api.dropAnswer(donorId, card.id, card.main?.value ?? 'seen'));
  }

  function renderAction(a: CopilotAction, key: number) {
    if (a.type === 'chart' && a.points) return <ChartCard key={key} marker={a.marker || 'bp'} points={a.points} />;
    if (a.type === 'memory') {
      const live = view?.memReceipt === a.text;
      return <div key={key} className="drop-memline" style={{ width: '100%' }}><Icon name="info" size={15} /><span>{a.text}</span>{live && <button onClick={() => act(api.dropMemoryUndo(donorId))}>Undo</button>}</div>;
    }
    if (a.type === 'receipt') return <div key={key} className="drop-receipt" style={{ width: '100%' }}><Icon name="check" size={16} /><span>{a.text}</span></div>;
    if (a.type === 'card' && a.cardId && view) {
      const card = view.open.find((c) => c.id === a.cardId);
      if (!card) {
        const done = [...view.receipts, ...view.earlier].find((r) => r.id === a.cardId);
        return done ? <div key={key} className="drop-receipt" style={{ width: '100%' }}><Icon name="check" size={16} /><span>{done.receipt}</span></div> : null;
      }
      return (
        <div key={key} style={{ width: '100%' }}>
          <DropCardView card={card} busy={busy} onAnswer={(value) => answerCard(card, value)}
            onSnooze={(o) => act(api.dropSnooze(donorId, card.id, o))} onHide={() => act(api.dropHide(donorId, card.id))}
            onStory={() => setStory(card)} onUpload={() => go('home')} onAsk={send} />
        </div>
      );
    }
    return null;
  }

  return (
    <div className={inline ? 'chat chat-inline' : 'chat chat-sheet'} role="region" aria-label={inline ? 'Drop, your Pratidaan assistant' : 'Chat with Drop'}>
      {introLive && <IntroBar intro={intro} />}
      <div className="chat-body" ref={body}>
        {top}
        {introLive && <IntroThread intro={intro} renderAction={renderAction} renderText={(t) => <Rich text={spoken(t)} />} />}
        {!introLive && inline && <IntroFold intro={intro} />}
        {!introLive && turns.length === 0 && (
          <div className="msg msg-ai">{inline ? `Ask me anything, or book your ${firstTime ? 'first' : 'next'} donation here.` : "Hi, I'm Drop. Ask me about your results, your blood's journey, your Goals or when you can donate. I'll answer in a sentence or two, and show you a card when it helps."}</div>
        )}
        {!introLive && turns.map((t, i) => (
          <div key={i} className="stack" style={{ gap: 6, alignItems: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div className={`msg ${t.role === 'user' ? 'msg-user' : 'msg-ai'}`} style={t.role === 'ai' ? { whiteSpace: 'normal' } : undefined}>
              {t.role === 'ai' ? <Rich text={spoken(t.text)} /> : t.text}
            </div>
            {(t.actions || []).filter((a) => a.type !== 'navigate').slice(0, 2).map(renderAction)}
            {t.actions?.some((a) => a.type === 'navigate') && <span className="pill pill-ai"><Icon name="arrow" size={12} /> Opened {t.actions.find((a) => a.type === 'navigate')?.screen}</span>}
            {t.questions && !readOnly && <div className="suggestions">{t.questions.map((q) => <button key={q} className="suggestion" style={{ minHeight: 36 }} onClick={() => send(q)}>{q}</button>)}</div>}
            {t.offline && <span className="tiny faint">AI offline: answered by rules</span>}
            {t.booking && (
              <div className="chat-flow">
                <BookingFlow donorId={donorId} clientId={clientId}
                  onBooked={(a) => setTurns((all) => all.map((x) => (x === t ? { ...x, booking: false, appointment: a, text: "You're booked. Thank you! Show this at the desk; it is also on the Donate screen." } : x)))} />
              </div>
            )}
            {t.appointment && <div className="chat-flow"><AppointmentPass appointment={t.appointment} compact /></div>}
            {t.checkup && <div className="chat-flow"><Checkup booking={t.checkup} /></div>}
          </div>
        ))}
        {busy && <Thinking label="Drop is checking your records…" />}
      </div>
      {story?.story && <StoryViewer title={story.label} slides={story.story} last={story.last} onSlide={badgeSeenOnSlide(donorId, story)} onClose={storyDone} />}
      {!introLive && chat === 'general' && !readOnly && <div className="suggestions suggestions-stay">
        {stories.map((c) => <StoryChip key={c.id} card={c} onClick={() => watch(c)} />)}
        {(firstTime ? FIRST_TIME_SUGGESTIONS : SUGGESTIONS).map((s, i) => <button key={s} className={`suggestion ${i === 0 ? 'suggestion-main' : ''}`} style={{ minHeight: 36 }} disabled={busy} onClick={() => send(s)}>{s}</button>)}
      </div>}
      {!readOnly && <form className="chat-input" onSubmit={(e) => { e.preventDefault(); if (introLive) { intro.ask(input); setInput(''); } else send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Message"
          placeholder={introLive ? intro.view?.ui.input : inline ? 'Ask Drop, or type "book a donation"' : placeholder || 'Ask Drop anything'} />
        <button className="btn btn-ai" disabled={busy || intro.busy || !input.trim()} aria-label="Send" style={{ minWidth: 44 }}><Icon name="send" size={16} /></button>
      </form>}
    </div>
  );
}
