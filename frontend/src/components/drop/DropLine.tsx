/** Drop's one line at the top of a screen. Tap to ask Drop about it; × hides it on this screen for the rest of the (demo) day. */
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Icon } from '../../ui';
import './drop.css';
import { openChat } from './chat';

const hiddenKey = (donorId: string, screen: string, date: string) => `tracedrop.line.${donorId}.${screen}.${date}`;

function isHidden(key: string) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

export default function DropLine({ donorId, screen, version }: { donorId: string; screen: string; version: number }) {
  const [line, setLine] = useState<{ text: string; questions: string[]; date: string } | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    api.dropLine(donorId, screen).then((l) => {
      if (!alive) return;
      setLine(l);
      setHidden(isHidden(hiddenKey(donorId, screen, l.date)));
    }).catch(() => alive && setLine(null));
    return () => { alive = false; };
  }, [donorId, screen, version]);

  if (!line || hidden) return null;
  const hide = () => {
    try { localStorage.setItem(hiddenKey(donorId, screen, line.date), '1'); } catch { /* storage unavailable */ }
    setHidden(true);
  };
  return (
    <div className="drop-line" role="note" aria-label="From Drop">
      <button className="txt" onClick={() => openChat({ text: line.text, questions: line.questions })}>
        <Icon name="drop" size={16} className="icon" /><span>{line.text}</span>
      </button>
      <button className="x" aria-label="Hide for today" onClick={hide}>×</button>
    </div>
  );
}
