/**
 * Share buttons for a Story's last slide (spec section 4): Download image, Copy image,
 * and Share… where the browser can share files. Every button shares the image only;
 * there is no caption. The PNG is drawn as soon as the buttons mount, so the clicks
 * (which clipboard and share need) don't wait. Sharing never reaches Drop.
 */
import { useEffect, useState } from 'react';
import type { StoryLast } from '../../api';
import { renderShareImage, shareFilename } from './shareImage';

const SAVED = 'Image saved. Post it from your phone.';
const COPIED = 'Copied. Paste it into a WhatsApp Web chat.';

export default function ShareButtons({ last, onImage }: { last: StoryLast; onImage?: (url: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState('');
  const filename = shareFilename(last);

  useEffect(() => {
    let url = '';
    let live = true;
    renderShareImage(last)
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setFile(new File([blob], filename, { type: 'image/png' }));
        onImage?.(url);
      })
      .catch(() => live && setFailed(true));
    return () => { live = false; if (url) { onImage?.(''); URL.revokeObjectURL(url); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  const canShare = Boolean(file && navigator.canShare?.({ files: [file] }));

  function download() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote(SAVED);
  }

  async function copy() {
    if (!file) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]);
      setNote(COPIED);
    } catch {
      download();
    }
  }

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') download(); // cancelling says nothing
    }
  }

  return (
    <div className="share-buttons">
      <div className="share-row">
        <button className="share-btn primary" disabled={!file} onClick={download}>Download image</button>
        <button className="share-btn" disabled={!file} onClick={copy}>Copy image</button>
        {canShare && <button className="share-btn" onClick={share}>Share…</button>}
      </div>
      <div className="share-help">Save it, then post it as your WhatsApp Status or Instagram Story from your phone.</div>
      <div className="share-note" aria-live="polite">{failed ? 'The image could not be made in this browser.' : note}</div>
    </div>
  );
}
