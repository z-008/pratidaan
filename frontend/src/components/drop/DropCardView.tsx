/**
 * One Drop Card: label, Drop's sentence, an optional form, one main button and one way out, plus the snooze menu.
 * Numbers are typed into plain boxes on desktop; scroll wheels appear only on touch screens.
 */
import { useRef, useState } from 'react';
import type { DropAction, DropCard, SnoozeOption } from '../../api';
import ScrollWheel from './ScrollWheel';
import { openChat } from './chat';

interface Props {
  card: DropCard;
  busy: boolean;
  onAnswer: (value: unknown) => void;
  onSnooze: (option: SnoozeOption) => void;
  onHide: () => void;
  onStory: () => void;
  onUpload: () => void;
  onAsk: (question: string) => void;
}

const SNOOZES: { option: SnoozeOption; label: string }[] = [
  { option: 'hour', label: 'In 1 hour' },
  { option: 'tonight', label: 'Tonight (7 pm)' },
  { option: 'tomorrow', label: 'Tomorrow morning' },
  { option: 'week', label: 'Next week' },
];

/** True on touch screens (phones, tablets); false with a mouse or trackpad. */
const touchScreen = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

export default function DropCardView({ card, busy, onAnswer, onSnooze, onHide, onStory, onUpload, onAsk }: Props) {
  const [menu, setMenu] = useState(false);
  const [bp, setBp] = useState(card.wheel ? { s: card.wheel.s, d: card.wheel.d } : { s: 0, d: 0 });
  const [touch] = useState(touchScreen);
  const bpValid = bp.s >= 80 && bp.s <= 220 && bp.d >= 40 && bp.d <= 140 && bp.s > bp.d;
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const el = useRef<HTMLDivElement>(null);

  const act = (a: DropAction) => {
    if (a.story) return onStory();
    if (a.ask) return onAsk(a.ask);
    if (a.open) {
      openChat(a.open);
      return onAnswer(a.value);
    }
    if (a.value === 'upload') return onUpload();
    if (a.value === 'wheel') return bpValid ? onAnswer(bp) : undefined;
    return onAnswer(a.value);
  };
  const showNotNow = !card.out && !card.urgent && card.type !== 'reminder';

  return (
    <div
      ref={el}
      className={`dcard${card.urgent ? ' urgent' : ''}`}
      // Swipe left (touch only) opens the same menu as ⋯
      onPointerDown={(e) => { if (e.pointerType === 'touch' && !(e.target as HTMLElement).closest('button,.wheel')) swipe.current = { x: e.clientX, y: e.clientY }; }}
      onPointerMove={(e) => {
        if (!swipe.current || !el.current) return;
        const dx = e.clientX - swipe.current.x;
        if (Math.abs(dx) > Math.abs(e.clientY - swipe.current.y)) el.current.style.transform = `translateX(${Math.min(0, dx)}px)`;
      }}
      onPointerUp={(e) => {
        if (!swipe.current || !el.current) return;
        const dx = e.clientX - swipe.current.x;
        swipe.current = null;
        el.current.style.transform = '';
        if (dx < -70) setMenu(true);
      }}
      onPointerCancel={() => { swipe.current = null; if (el.current) el.current.style.transform = ''; }}
    >
      <div className="dcard-head">
        <span>{card.label}</span>
        <button className="dcard-more" aria-label="Snooze or hide" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>⋯</button>
      </div>
      <p className="dcard-text">{card.text}</p>

      {card.wheel && !touch && (
        <form className="numbers" onSubmit={(e) => { e.preventDefault(); if (bpValid) onAnswer(bp); }}>
          <label>Top number<input type="number" inputMode="numeric" min={80} max={220} value={bp.s || ''} onChange={(e) => setBp((v) => ({ ...v, s: Number(e.target.value) }))} /></label>
          <span className="slash">/</span>
          <label>Bottom number<input type="number" inputMode="numeric" min={40} max={140} value={bp.d || ''} onChange={(e) => setBp((v) => ({ ...v, d: Number(e.target.value) }))} /></label>
          <span className="unit">mmHg</span>
          {!bpValid && <span className="numbers-error">Check the numbers: top 80–220, bottom 40–140.</span>}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      )}
      {card.wheel && touch && (
        <div className="wheels">
          <ScrollWheel label="Top number (systolic)" value={card.wheel.s} min={80} max={220} onChange={(s) => setBp((v) => ({ ...v, s }))} />
          <span className="slash">/</span>
          <ScrollWheel label="Bottom number (diastolic)" value={card.wheel.d} min={40} max={140} onChange={(d) => setBp((v) => ({ ...v, d }))} />
          <span className="unit">mmHg</span>
        </div>
      )}

      {card.chips.length > 0 && (
        <div className="dchips">
          {card.chips.map((c) => <button key={c.label} className={`dchip${c.ask ? ' ask' : ''}`} disabled={busy} onClick={() => act(c)}>{c.label}</button>)}
        </div>
      )}
      {card.main && <button className="dcard-main" disabled={busy || (card.main.value === 'wheel' && !bpValid)} onClick={() => act(card.main!)}>{card.main.label}</button>}
      {card.out && <button className="dcard-out" disabled={busy} onClick={() => act(card.out!)}>{card.out.label}</button>}
      {showNotNow && <button className="dcard-out" onClick={() => setMenu(true)}>Not now</button>}

      {menu && (
        <>
          <div className="dmenu-back" onClick={() => setMenu(false)} />
          <div className="dmenu" role="menu" onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}>
            {card.urgent && <div className="note">Urgent cards can only wait an hour.</div>}
            {SNOOZES.map((s) => (
              <button key={s.option} role="menuitem" autoFocus={s.option === 'hour'} disabled={card.urgent && s.option !== 'hour'}
                onClick={() => { setMenu(false); onSnooze(s.option); }}>{s.label}</button>
            ))}
            <hr />
            <button role="menuitem" disabled={card.urgent} onClick={() => { setMenu(false); onHide(); }}>Hide for now</button>
          </div>
        </>
      )}
    </div>
  );
}
