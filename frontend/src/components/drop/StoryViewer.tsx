/**
 * Tap-through Story: click or tap the left/right half, arrow keys, Esc to close.
 * When `last` is given (a postcard or a Badge), the Story ends on that share image
 * with its share buttons. Without it there is no share at all (Weekly report, Intro).
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type DropCard, type StoryLast } from '../../api';
import ShareButtons from '../share/ShareButtons';

/** For a Card's Story: reaching the slide that shows new Badges clears their "New" mark (watching part of it doesn't). */
export const badgeSeenOnSlide = (donorId: string, card: DropCard) => (i: number) => {
  if (card.badgeSlide && i === card.badgeSlide.at) api.dropBadgesSeen(donorId, card.badgeSlide.ids).catch(() => { /* stays New; harmless */ });
};

export default function StoryViewer({ title, slides, last, onSlide, onClose }: { title: string; slides: string[]; last?: StoryLast | null; onSlide?: (i: number) => void; onClose: () => void }) {
  const count = slides.length + (last ? 1 : 0);
  const [i, setI] = useState(0);
  const [image, setImage] = useState('');
  const onShare = Boolean(last) && i === count - 1;
  const alt = !last ? '' : 'postcard' in last ? last.postcard.headline : `Badge: ${last.badge.name}`;
  const go = (step: number) => setI((n) => Math.max(0, Math.min(count - 1, n + step)));

  useEffect(() => { onSlide?.(i); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A portal, so an animated (transformed) parent can't pull the fixed overlay off-screen
  return createPortal(
    <div className="story-back" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`story${onShare ? ' story-image' : ''}`}>
        {onShare && (image
          ? <img className="story-img" src={image} alt={alt} />
          : <div className="story-img" />)}
        <div className="story-prog">{Array.from({ length: count }, (_, n) => <i key={n} className={n <= i ? 'on' : ''} />)}</div>
        <div className="story-top"><span>{title}</span><button className="story-close" aria-label="Close" onClick={onClose}>×</button></div>
        <div className="story-body" aria-live="polite">{onShare ? null : slides[i]}</div>
        <div className="story-zones">
          <button aria-label="Previous" onClick={() => go(-1)} />
          <button aria-label="Next" onClick={() => go(1)} />
        </div>
        {onShare
          ? <ShareButtons last={last!} onImage={setImage} />
          : <div className="story-hint">{i < count - 1 && 'Tap the right side or press → for the next part'}</div>}
      </div>
    </div>,
    document.body,
  );
}
