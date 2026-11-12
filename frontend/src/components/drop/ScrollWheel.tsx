/** A scroll-wheel number picker: scroll, mouse wheel, drag with a mouse, or arrow keys. */
import { useEffect, useRef } from 'react';

const ITEM = 44;

export default function ScrollWheel({ value, min, max, label, onChange }: { value: number; min: number; max: number; label: string; onChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; top: number } | null>(null);
  const current = useRef(value);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = (value - min) * ITEM;
    // Only position on first render; afterwards the wheel owns its scroll position
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const read = () => {
    const el = ref.current;
    if (!el) return;
    const n = Math.max(min, Math.min(max, min + Math.round(el.scrollTop / ITEM)));
    if (n !== current.current) {
      current.current = n;
      onChange(n);
    }
    el.querySelectorAll<HTMLDivElement>('[data-n]').forEach((d) => d.classList.toggle('sel', Number(d.dataset.n) === n));
  };

  const numbers = [];
  for (let n = min; n <= max; n += 1) numbers.push(n);

  return (
    <div
      ref={ref}
      className="wheel"
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onScroll={read}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        ref.current?.scrollBy({ top: e.key === 'ArrowDown' ? ITEM : -ITEM });
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse' || !ref.current) return;
        drag.current = { y: e.clientY, top: ref.current.scrollTop };
        ref.current.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current && ref.current) ref.current.scrollTop = drag.current.top - (e.clientY - drag.current.y);
      }}
      onPointerUp={() => {
        if (!drag.current || !ref.current) return;
        drag.current = null;
        ref.current.scrollTo({ top: Math.round(ref.current.scrollTop / ITEM) * ITEM, behavior: 'smooth' });
      }}
    >
      <div />
      {numbers.map((n) => <div key={n} data-n={n} className={n === value ? 'sel' : ''}>{n}</div>)}
      <div />
    </div>
  );
}
