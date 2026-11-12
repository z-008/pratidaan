/**
 * Drop's Intro in Home's chat (CONTEXT.md: Intro): the "Getting started" bar, the thread of
 * Drop's messages with their pictures and reply buttons, and, once finished or skipped, one
 * folded line with the questions asked during it. The steps and their rules come from the
 * server (backend/src/domain/intro.js); this file shows them and sends the answers.
 *
 * The thread is kept for the rest of the visit (other screens and back). A new visit
 * (reload or sign-in) folds what was done into "Done so far" and Drop says "Welcome back".
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api, type ChoicesPicture, type CopilotAction, type DataPicture, type DaysPicture, type IntroButton, type IntroDonate, type IntroStep, type IntroView, type JourneyPicture, type ResultsPicture, type SummaryPicture } from '../../api';
import { Icon, Thinking } from '../../ui';
import type { Screen } from '../../App';
import StoryViewer from '../drop/StoryViewer';
import { ChoicesForm, DataMini, DaysForm, JourneyMini, ResultsMini, SummaryMini, type Choices } from './pictures';
import './intro.css';

type Entry =
  | { kind: 'drop'; n: number; again?: boolean }
  | { kind: 'user'; text: string }
  | { kind: 'answer'; text: string; offline?: boolean; actions?: CopilotAction[] }
  | { kind: 'welcome' }
  | { kind: 'skipAsk' }
  | { kind: 'error'; text: string };

// One thread per donor for this visit
const threads = new Map<string, Entry[]>();
window.addEventListener('demo:reset', () => threads.clear());

// The step Drop is talking about, so Home can light up the matching tile
let focused: { donorId: string; stepId: string | null } = { donorId: '', stepId: null };
export function introFocus(donorId: string) {
  return focused.donorId === donorId ? focused.stepId : null;
}
function setFocus(donorId: string, stepId: string | null) {
  if (focused.donorId === donorId && focused.stepId === stepId) return;
  focused = { donorId, stepId };
  window.dispatchEvent(new CustomEvent('intro:focus', { detail: focused }));
}

/** Ask the Intro to load again (after a replay from the account menu). */
export function introChanged(donorId: string) {
  window.dispatchEvent(new CustomEvent('intro:changed', { detail: donorId }));
}

const isLive = (v: IntroView | null) => Boolean(v && (v.status === 'new' || v.status === 'running'));
const fill = (t: string, values: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''));
const EMPTY_DONATE: IntroDonate = { days: null, time: null, place: null };
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function useIntro(donorId: string, enabled: boolean, { go, onBook }: { go: (s: Screen) => void; onBook: () => void }) {
  const [view, setView] = useState<IntroView | null>(null);
  const [entries, setEntries] = useState<Entry[]>(() => threads.get(donorId) || []);
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<Choices | null>(null);
  const [donate, setDonate] = useState<IntroDonate>(EMPTY_DONATE);
  const [story, setStory] = useState<IntroStep | null>(null);
  const history = useRef<unknown[] | null>(null);
  const live = isLive(view);

  useEffect(() => { threads.set(donorId, entries); }, [donorId, entries]);

  /** Start the thread: carry on in this visit, begin at step 1, or welcome the person back. */
  const begin = useCallback((v: IntroView, fresh = false) => {
    setView(v);
    setChoices(v.prefill.choices);
    setDonate(v.prefill.donate || EMPTY_DONATE);
    if (!isLive(v)) { setEntries([]); return; }
    const kept = fresh ? [] : threads.get(donorId) || [];
    if (kept.length) setEntries(kept);
    else setEntries(v.status === 'new' || v.step === 1 ? [{ kind: 'drop', n: v.step }] : [{ kind: 'welcome' }]);
  }, [donorId]);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    api.intro(donorId).then((v) => alive && begin(v)).catch(() => alive && setView(null));
    const restart = (e: Event) => {
      if ((e as CustomEvent).detail && (e as CustomEvent).detail !== donorId) return;
      threads.delete(donorId);
      api.intro(donorId).then((v) => alive && begin(v, true)).catch(() => {});
    };
    // Home's language switch changed Drop's language: carry on in it
    const relang = () => api.intro(donorId).then((v) => alive && setView(v)).catch(() => {});
    window.addEventListener('intro:changed', restart);
    window.addEventListener('demo:reset', restart);
    window.addEventListener('drop:language', relang);
    return () => {
      alive = false;
      window.removeEventListener('intro:changed', restart);
      window.removeEventListener('demo:reset', restart);
      window.removeEventListener('drop:language', relang);
    };
  }, [donorId, enabled, begin]);

  // Home lights up the tile for the step Drop is talking about
  useEffect(() => {
    setFocus(donorId, live && view ? view.stepId : null);
  }, [donorId, live, view]);
  useEffect(() => () => setFocus(donorId, null), [donorId]);

  const add = (...more: Entry[]) => setEntries((list) => [...list, ...more]);
  const changed = () => window.dispatchEvent(new CustomEvent('drop:changed'));

  async function run(work: () => Promise<IntroView>, after?: (v: IntroView) => void) {
    setBusy(true);
    try {
      const v = await work();
      setView(v);
      after?.(v);
      changed();
    } catch (e) {
      // Out of step (another tab moved on, or the server restarted): show where it really is
      const v = await api.intro(donorId).catch(() => null);
      if (v) { setView(v); if (isLive(v)) add({ kind: 'drop', n: v.step, again: true }); else setEntries([]); }
      else add({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function submit(step: IntroStep, value: unknown, said: string) {
    add({ kind: 'user', text: said });
    return run(() => api.introAnswer(donorId, step.n, value), (v) => { if (isLive(v)) add({ kind: 'drop', n: v.step }); else setEntries([]); });
  }

  function finish(book: boolean, said: string) {
    add({ kind: 'user', text: said });
    return run(() => api.introFinish(donorId), () => { setEntries([]); if (book) onBook(); });
  }

  /** Where "Near me" is, rounded to about 1 km, like booking does. */
  function nearMe(): Promise<{ label: string; lat: number; lng: number } | null> {
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ label: 'Near your current location', lat: Math.round(pos.coords.latitude * 100) / 100, lng: Math.round(pos.coords.longitude * 100) / 100 }),
      () => resolve(null),
    ));
  }

  async function press(step: IntroStep, button: IntroButton) {
    if (busy || !view) return;
    if (button.value === 'story') { setStory(step); return; }
    if (button.value === 'open-data') { go('data'); return; } // the Intro waits on this step; Home picks it up again
    if (step.id === 'choices' && button.value === 'save') return submit(step, choices, button.label);
    if (step.id === 'donate' && button.value === 'save') {
      const picture = step.pictureData as DaysPicture;
      const labels = [picture.days.find((d) => d.id === donate.days), picture.times.find((t) => t.id === donate.time), picture.places.find((p) => p.id === donate.place)].filter(Boolean).map((o) => o!.label);
      let place: unknown = donate.place;
      if (donate.place === 'gps') {
        place = await nearMe();
        if (!place) { add({ kind: 'error', text: 'Location permission was denied. Choose a district instead.' }); return; }
      }
      return submit(step, { ...donate, place }, labels.join(' · ') || button.label);
    }
    if (step.id === 'done') return finish(button.value === 'book', button.label);
    return submit(step, button.value, button.label);
  }

  function storyClosed() {
    const step = story;
    setStory(null);
    if (step && view && view.step === step.n) submit(step, 'next', view.ui.watched);
  }

  const again = (said: string) => { if (view) add({ kind: 'user', text: said }, { kind: 'drop', n: view.step, again: true }); };

  return {
    view, entries, busy, live, choices, donate, story, storyClosed, press,
    toggleChoice: (key: keyof Choices) => setChoices((c) => (c ? { ...c, [key]: !c[key] } : c)),
    pickDay: (key: keyof IntroDonate, id: string) => setDonate((d) => ({ ...d, [key]: d[key] === id ? null : id })),
    askSkip: () => { if (view) add({ kind: 'user', text: view.ui.skip }, { kind: 'skipAsk' }); },
    skip: (said: string) => { add({ kind: 'user', text: said }); return run(() => api.introSkip(donorId), () => setEntries([])); },
    keepGoing: () => view && again(view.ui.keepGoing),
    carryOn: () => view && again(view.ui.carryOn),
    replay: () => run(() => api.introReplay(donorId), (v) => { threads.delete(donorId); begin(v, true); }),
    /** A typed question goes to the AI; the answer appears in the thread, then "Carry on". */
    async ask(text: string) {
      const message = text.trim();
      if (!message || busy) return;
      add({ kind: 'user', text: message });
      setBusy(true);
      try {
        const r = await api.copilot(donorId, message, history.current);
        if (r.history) history.current = r.history;
        add({ kind: 'answer', text: r.reply, offline: r.offline, actions: r.actions });
        const nav = r.actions.find((a) => a.type === 'navigate');
        if (nav?.screen) go(nav.screen as Screen);
        if (r.actions.some((a) => a.type !== 'navigate')) changed();
        // The question is kept with the Intro; after a language switch, wait for the Intro in the new language
        const relang = r.actions.some((a) => a.type === 'receipt' && /^Language:/.test(a.text || ''));
        if (relang) await api.intro(donorId).then(setView).catch(() => {});
        else api.intro(donorId).then(setView).catch(() => {});
      } catch (e) {
        add({ kind: 'error', text: `Sorry, something went wrong: ${(e as Error).message}` });
      } finally {
        setBusy(false);
      }
    },
  };
}
export type IntroModel = ReturnType<typeof useIntro>;

/** "Getting started", progress, "3 of 8" and Skip intro, at the top of the chat. */
export function IntroBar({ intro }: { intro: IntroModel }) {
  const v = intro.view;
  if (!v || !intro.live) return null;
  const asking = intro.entries[intro.entries.length - 1]?.kind === 'skipAsk';
  return (
    <div className="intro-bar">
      <span className="drop-avatar" style={{ width: 28, height: 28 }}><Icon name="drop" size={15} stroke={2.2} /></span>
      <b>{v.ui.bar}</b>
      <span className="intro-track" role="progressbar" aria-valuemin={1} aria-valuemax={v.total} aria-valuenow={v.step} aria-label={fill(v.ui.progress, { n: v.step, total: v.total })}>
        <span style={{ width: `${(v.step / v.total) * 100}%` }} />
      </span>
      <span className="tiny muted">{fill(v.ui.progress, { n: v.step, total: v.total })}</span>
      <button className="intro-skip" onClick={intro.askSkip} disabled={asking || intro.busy}>{v.ui.skip}</button>
    </div>
  );
}

function Chips({ actions, disabled }: { actions: { label: string; primary?: boolean; run: () => void; off?: boolean }[]; disabled?: boolean }) {
  return (
    <div className="dchips intro-chips">
      {actions.map((a) => (
        <button key={a.label} className={`dchip ${a.primary ? 'intro-primary' : ''}`} disabled={disabled || a.off} onClick={a.run}>{a.label}</button>
      ))}
    </div>
  );
}

function Picture({ step, intro, active }: { step: IntroStep; intro: IntroModel; active: boolean }) {
  switch (step.picture) {
    case 'journey': return <JourneyMini data={step.pictureData as JourneyPicture} />;
    case 'results': return <ResultsMini data={step.pictureData as ResultsPicture} />;
    case 'data': return <DataMini data={step.pictureData as DataPicture} />;
    case 'choices': return intro.choices ? <ChoicesForm data={step.pictureData as ChoicesPicture} value={intro.choices} onToggle={intro.toggleChoice} active={active} /> : null;
    case 'days': return <DaysForm data={step.pictureData as DaysPicture} value={intro.donate} onPick={intro.pickDay} active={active} />;
    case 'summary': return <SummaryMini data={step.pictureData as SummaryPicture} />;
    default: return null;
  }
}

/** Drop's words for one step, its picture, and its buttons when it is the latest message. */
function StepEntry({ intro, n, again, last }: { intro: IntroModel; n: number; again?: boolean; last: boolean }) {
  const v = intro.view!;
  const step = v.steps[n - 1];
  if (!step) return null;
  const active = last && intro.live && v.step === n;
  const nothingChosen = step.id === 'donate' && !intro.donate.days && !intro.donate.time && !intro.donate.place;
  return (
    <div className="stack intro-entry" style={{ gap: 8, alignItems: 'flex-start' }}>
      {again && <div className="tiny faint">{fill(v.ui.backTo, { title: step.title })}</div>}
      {step.text.map((t) => <div key={t} className="msg msg-ai">{t}</div>)}
      {step.picture && <div style={{ width: '100%' }}><Picture step={step} intro={intro} active={active && !intro.busy} /></div>}
      {step.after.map((t) => <div key={t} className="msg msg-ai">{t}</div>)}
      {active && v.translation.fallback && <div className="tiny faint">Shown in English: a translation isn't available right now.</div>}
      {active && (
        <Chips disabled={intro.busy} actions={step.buttons.map((b) => ({
          // The language chosen before is the one to keep (English on a first run)
          label: b.label, primary: step.id === 'language' ? b.value === v.prefill.language : b.primary, run: () => intro.press(step, b), off: b.value === 'save' && nothingChosen,
        }))} />
      )}
    </div>
  );
}

/** The Intro's thread, in place of the normal conversation while it runs. */
export function IntroThread({ intro, renderAction, renderText }: { intro: IntroModel; renderAction: (a: CopilotAction, key: number) => ReactNode; renderText: (text: string) => ReactNode }) {
  const v = intro.view;
  if (!v || !intro.live) return null;
  const { entries } = intro;
  const lastIndex = entries.length - 1;
  const cameBack = entries[0]?.kind === 'welcome';
  const current = v.steps[v.step - 1];
  return (
    <div className="stack intro-thread" style={{ gap: 14 }} aria-live="polite">
      {cameBack && v.step > 1 && (
        <div className="intro-sofar"><Icon name="check" size={14} /> {v.ui.doneSoFar}: {v.steps.slice(0, v.step - 1).map((s) => s.title).join(' · ')}</div>
      )}
      {entries.map((e, i) => {
        const last = i === lastIndex;
        if (e.kind === 'drop') return <StepEntry key={i} intro={intro} n={e.n} again={e.again} last={last} />;
        if (e.kind === 'user') return <div key={i} className="msg msg-user">{e.text}</div>;
        if (e.kind === 'error') return <div key={i} className="callout callout-bad small"><Icon name="alert" size={16} /> {e.text}</div>;
        if (e.kind === 'answer') {
          return (
            <div key={i} className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
              <div className="msg msg-ai" style={{ whiteSpace: 'normal' }}>{renderText(e.text)}</div>
              {(e.actions || []).filter((a) => a.type !== 'navigate').slice(0, 2).map(renderAction)}
              {e.offline && <span className="tiny faint">AI offline: answered by rules</span>}
              {last && <Chips disabled={intro.busy} actions={[{ label: fill(v.ui.carryOnStep, { title: current.title }), primary: true, run: intro.carryOn }, { label: v.ui.skip, run: intro.askSkip }]} />}
            </div>
          );
        }
        if (e.kind === 'welcome') {
          return (
            <div key={i} className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
              <div className="msg msg-ai">{fill(v.ui.welcomeBack, { title: current.title, n: v.step, total: v.total })}</div>
              {last && <Chips disabled={intro.busy} actions={[{ label: v.ui.carryOn, primary: true, run: intro.carryOn }, { label: v.ui.skip, run: intro.askSkip }]} />}
            </div>
          );
        }
        return (
          <div key={i} className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
            <div className="msg msg-ai">{v.ui.skipAsk}</div>
            {last && <Chips disabled={intro.busy} actions={[{ label: v.ui.skipYes, run: () => intro.skip(v.ui.skipYes) }, { label: v.ui.keepGoing, primary: true, run: intro.keepGoing }]} />}
          </div>
        );
      })}
      {intro.busy && <Thinking label="Drop is thinking…" />}
      {intro.story && (intro.story.pictureData as JourneyPicture).story && createPortal(
        <StoryViewer title={`${current.title} · ${(intro.story.pictureData as JourneyPicture).label}`} slides={(intro.story.pictureData as JourneyPicture).story} onClose={intro.storyClosed} />,
        document.body,
      )}
    </div>
  );
}

/** After the Intro: one line at the top of the chat, "Intro · finished 10 Oct · Replay", with the questions asked during it. */
export function IntroFold({ intro }: { intro: IntroModel }) {
  const [open, setOpen] = useState(false);
  const v = intro.view;
  if (!v || intro.live || !v.finishedOn) return null;
  const line = fill(v.status === 'skipped' ? v.ui.skipped : v.ui.finished, { date: fmtDay(v.finishedOn) });
  return (
    <div className="intro-fold">
      <div className="intro-fold-line">
        <Icon name="check" size={15} />
        <span>{line}</span>
        {v.questions.length > 0 && (
          <button aria-expanded={open} onClick={() => setOpen(!open)}>{v.ui.questions} · {v.questions.length}</button>
        )}
        {v.canReplay && <button onClick={intro.replay} disabled={intro.busy}>{v.ui.replay}</button>}
      </div>
      {open && (
        <div className="intro-fold-qs">
          {v.questions.map((q, i) => <div key={i}><b>{q.q}</b><span>{q.a}</span></div>)}
        </div>
      )}
    </div>
  );
}
