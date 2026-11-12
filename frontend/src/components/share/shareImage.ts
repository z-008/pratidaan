/**
 * The two share images, drawn on a 1080 × 1920 canvas (spec section 3, "Keepsakes"):
 * the summary postcard that ends a component's Story, and a Badge.
 *
 * The top 220px and bottom 260px hold no key content: the Story viewer's
 * progress bars, title, close button and share buttons sit over them.
 * Neither image ever shows age band, sex, place, outcome, name or blood group.
 */
import type { Badge, Postcard, StoryLast } from '../../api';
import { APP_NAME } from '../../brand';

const W = 1080;
const H = 1920;

// Component colours, as KIND_STYLE in pages/Impact.tsx
const TILE: Record<string, { bg: string; fg: string; short: string }> = {
  PRBC: { bg: '#fde2e5', fg: '#9b0c23', short: 'RBC' },
  PLT: { bg: '#fdf0d5', fg: '#92400e', short: 'PLT' },
  FFP: { bg: '#fef6c7', fg: '#854d0e', short: 'FFP' },
  CRYO: { bg: '#e0ecfd', fg: '#1e40af', short: 'CRY' },
  PLASMA: { bg: '#ede4fd', fg: '#5b21b6', short: 'PLS' },
};

const DROP = 'M12 2.5c-3.6 4.6-6.5 8.4-6.5 12A6.5 6.5 0 0 0 12 21a6.5 6.5 0 0 0 6.5-6.5c0-3.6-2.9-7.4-6.5-12z';
const HEART = 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z';
const SERIF = 'Fraunces, Georgia, serif';
const SANS = 'Inter, system-ui, sans-serif';
const MONO = 'ui-monospace, Menlo, monospace';
const GOLD = ['#8a6418', '#e9cf7a', '#fff3c4', '#b88a2a', '#f2dc8e', '#8a6418', '#e6c76c', '#fff1bf', '#a87c22', '#8a6418'];
const GOLD_AT = [0, 0.12, 0.2, 0.32, 0.45, 0.58, 0.72, 0.82, 0.92, 1];

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/** The file name a share image saves as; it describes the image, never the Donor. */
export function shareFilename(last: StoryLast): string {
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if ('postcard' in last) {
    const [month, year] = last.postcard.month.split(' ');
    return `tracedrop-${slug(last.postcard.component)}-${month.slice(0, 3).toLowerCase()}-${year}.png`;
  }
  return `tracedrop-badge-${slug(last.badge.name)}.png`;
}

/** Draws the share image and resolves to its PNG. */
export async function renderShareImage(last: StoryLast): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (!ctx) throw new Error('Canvas is not available');
  if ('postcard' in last) drawPostcard(ctx, last.postcard);
  else drawBadge(ctx, last.badge, last.held);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/png'));
}

async function loadFonts() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      '600 98px Fraunces', '700 260px Fraunces', 'italic 600 36px Fraunces',
      '500 40px Inter', '600 48px Inter', '800 36px Inter',
    ].map((f) => document.fonts.load(f)));
  } catch {
    // fall back to the serif and sans-serif the browser has
  }
}

/* ------------------------------------------------------------ helpers */

function font(ctx: Ctx, f: string, spacing = '0px') {
  ctx.font = f;
  ctx.letterSpacing = spacing;
}

function wrap(ctx: Ctx, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Writes wrapped lines whose boxes start at y; returns the y below the last one. */
function lines(ctx: Ctx, text: string, x: number, y: number, width: number, lineHeight: number): number {
  ctx.textBaseline = 'middle';
  for (const l of wrap(ctx, text, width)) { ctx.fillText(l, x, y + lineHeight / 2); y += lineHeight; }
  return y;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A 24-unit icon path drawn at (cx, cy) and the given size. */
function icon(ctx: Ctx, d: string, cx: number, cy: number, size: number, fill: string) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = fill;
  ctx.fill(new Path2D(d));
  ctx.restore();
}

/** The product mark (drop and word), centred on cx. */
function mark(ctx: Ctx, cx: number, cy: number, color: string) {
  font(ctx, `800 36px ${SANS}`, '-0.36px');
  const word = ctx.measureText(APP_NAME).width;
  const drop = 41;
  const gap = 13;
  const x = cx - (drop + gap + word) / 2;
  icon(ctx, DROP, x + drop / 2, cy, drop, color);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(APP_NAME, x + drop + gap, cy + 1);
}

/** Gold foil: a conic gradient round (cx, cy), or a linear one where conic gradients aren't supported. */
function foil(ctx: Ctx, cx: number, cy: number, r: number): CanvasGradient {
  const g = ctx.createConicGradient
    ? ctx.createConicGradient((210 - 90) * (Math.PI / 180), cx, cy)
    : ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  GOLD.forEach((c, i) => g.addColorStop(GOLD_AT[i], c));
  return g;
}

/* ------------------------------------------------------------ postcard */

function drawPostcard(ctx: Ctx, p: Postcard) {
  const tile = TILE[p.kind] || TILE.PRBC;

  // Background: the component's tint
  ctx.save();
  ctx.translate(W / 2, H * 0.3);
  ctx.scale(1, 1344 / 1188);
  const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1188);
  bg.addColorStop(0, tile.bg);
  bg.addColorStop(1, '#f3dcae');
  ctx.fillStyle = bg;
  ctx.fillRect(-W, -H, W * 2, H * 2);
  ctx.restore();

  // The card, tilted slightly round its centre
  const cw = 900;
  const ch = 1310;
  ctx.save();
  ctx.translate(90 + cw / 2, 270 + ch / 2);
  ctx.rotate((-2.2 * Math.PI) / 180);
  ctx.translate(-cw / 2, -ch / 2);
  ctx.save();
  ctx.shadowColor = 'rgba(60,30,10,.22)';
  ctx.shadowBlur = 90;
  ctx.shadowOffsetY = 50;
  roundRect(ctx, 0, 0, cw, ch, 16);
  ctx.fillStyle = '#fffdf9';
  ctx.fill();
  ctx.restore();

  const pad = 66;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9a8a7c';
  font(ctx, `700 26px ${MONO}`, '5.2px');
  ctx.textBaseline = 'top';
  ctx.fillText('POSTCARD', pad, 82);

  // Perforated stamp: the component tile
  const sw = 250;
  const sh = 300;
  const sx = cw - pad - sw + 12;
  const sy = 58;
  ctx.fillStyle = tile.bg;
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = 'rgba(0,0,0,.06)';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx - 1, sy - 1, sw + 2, sh + 2);
  ctx.fillStyle = '#fffdf9';
  const perf = (x: number, y: number) => { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); };
  for (let x = sx + 6; x <= sx + sw - 6; x += 22.4) { perf(x, sy + 6); perf(x, sy + sh - 6); }
  for (let y = sy + 6; y <= sy + sh - 6; y += 22.4) { perf(sx + 6, y); perf(sx + sw - 6, y); }
  const scx = sx + sw / 2;
  icon(ctx, DROP, scx, sy + 82, 60, tile.fg);
  ctx.fillStyle = tile.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  font(ctx, `800 92px ${SANS}`, '-1.84px');
  ctx.fillText(tile.short, scx, sy + 170);
  // Long names ("Fresh frozen plasma") shrink to stay inside the perforations
  let size = 28;
  font(ctx, `600 ${size}px ${SANS}`);
  while (size > 18 && ctx.measureText(p.component).width > sw - 36) font(ctx, `600 ${--size}px ${SANS}`);
  ctx.fillText(p.component, scx, sy + 240);

  // Round postmark with the short month
  ctx.save();
  ctx.translate(cw - 250 - 125, 220 + 125);
  ctx.rotate((-14 * Math.PI) / 180);
  ctx.strokeStyle = 'rgba(60,30,20,.55)';
  ctx.lineWidth = 2;
  for (const r of [124, 116]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = 'rgba(60,30,20,.7)';
  font(ctx, `700 40px ${MONO}`);
  const [month, year] = p.month.split(' ');
  ctx.fillText(`${month.slice(0, 3).toUpperCase()} ${year}`, 0, -14);
  font(ctx, `700 22px ${MONO}`, '4px');
  ctx.fillText(APP_NAME.toUpperCase(), 2, 30);
  ctx.restore();

  // Headline, context or role, month
  const tw = cw - pad * 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b0a10';
  font(ctx, `600 98px ${SERIF}`, '-2.45px');
  let y = lines(ctx, p.headline, pad, 478, tw, 100);
  ctx.fillStyle = '#6b5a4e';
  font(ctx, `500 40px ${SANS}`);
  y = lines(ctx, p.context, pad, y + 34, tw, 55);
  ctx.fillStyle = '#9b0c23';
  font(ctx, `italic 600 34px ${SERIF}`);
  lines(ctx, p.month, pad, y + 30, tw, 44);

  // Dashed rule, then lifetime patients
  const base = ch - 70;
  const ruleY = base - 208 - 40;
  ctx.strokeStyle = '#e4d8c8';
  ctx.lineWidth = 3;
  ctx.setLineDash([9, 9]);
  ctx.beginPath();
  ctx.moveTo(pad, ruleY);
  ctx.lineTo(cw - pad, ruleY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#9b0c23';
  font(ctx, `700 260px ${SERIF}`, '-10.4px');
  ctx.textBaseline = 'alphabetic';
  const n = String(p.patientsHelped);
  ctx.fillText(n, pad, base - 6);
  const nw = ctx.measureText(n).width;
  ctx.fillStyle = '#2b0a10';
  font(ctx, `600 48px ${SANS}`);
  ctx.textBaseline = 'middle';
  ctx.fillText(p.patientsHelped === 1 ? 'patient helped' : 'patients helped', pad + nw + 34, base - 104 - 28);
  ctx.fillText('by my blood', pad + nw + 34, base - 104 + 28);
  ctx.restore();

  mark(ctx, W / 2, H - 300 - 21, tile.fg);
}

/* ------------------------------------------------------------ Badge */

/** The glyph in the medal's enamel centre: a number, or an icon for check, five-drop, vial and heart. */
function glyph(ctx: Ctx, ring: string, cx: number, cy: number, size: number, color: string) {
  const s = size * 0.4;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (ring === 'heart') icon(ctx, HEART, cx, cy + s * 0.04, s, color);
  else if (ring === 'check') {
    ctx.lineWidth = s * 0.13;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.36, cy + s * 0.02);
    ctx.lineTo(cx - s * 0.1, cy + s * 0.28);
    ctx.lineTo(cx + s * 0.38, cy - s * 0.24);
    ctx.stroke();
  } else if (ring === 'five-drop') {
    // five drops in a ring, one for each part of the blood
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      icon(ctx, DROP, cx + Math.cos(a) * s * 0.34, cy + Math.sin(a) * s * 0.34, s * 0.38, color);
    }
  } else if (ring === 'vial') {
    const w = s * 0.34;
    const top = cy - s * 0.46;
    const bottom = cy + s * 0.42;
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - s * 0.08, top);
    ctx.lineTo(cx + w / 2 + s * 0.08, top);
    ctx.moveTo(cx - w / 2, top);
    ctx.lineTo(cx - w / 2, bottom - w / 2);
    ctx.arc(cx, bottom - w / 2, w / 2, Math.PI, 0, true);
    ctx.lineTo(cx + w / 2, top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy + s * 0.02);
    ctx.lineTo(cx - w / 2, bottom - w / 2);
    ctx.arc(cx, bottom - w / 2, w / 2, Math.PI, 0, true);
    ctx.lineTo(cx + w / 2, cy + s * 0.02);
    ctx.closePath();
    ctx.fill();
  } else {
    const fs = ring.length > 2 ? size * 0.26 : size * 0.42;
    font(ctx, `700 ${fs}px ${SERIF}`, `${-fs * 0.04}px`);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(ring);
    const h = (m.actualBoundingBoxAscent || fs * 0.7) - (m.actualBoundingBoxDescent || 0);
    ctx.fillText(ring, cx, cy + h / 2);
  }
  ctx.restore();
}

function drawBadge(ctx: Ctx, b: Badge, held: number) {
  // Dark red felt
  ctx.save();
  ctx.translate(W / 2, H * 0.3);
  ctx.scale(1, 1344 / 1080);
  const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1080);
  bg.addColorStop(0, '#6e0f20');
  bg.addColorStop(0.6, '#3a0812');
  bg.addColorStop(1, '#1d0409');
  ctx.fillStyle = bg;
  ctx.fillRect(-W, -H, W * 2, H * 2);
  ctx.restore();

  const cx = W / 2;
  const tw = 880;

  // A longer name or rule lifts the ribbon and medal, so the text never reaches the pins
  font(ctx, `600 104px ${SERIF}`, '-2.6px');
  const nameLines = wrap(ctx, b.name, tw).length;
  font(ctx, `500 40px ${SANS}`);
  const ruleLines = wrap(ctx, b.rule, tw).length;
  const lift = 40 + (nameLines - 1) * 104 + (ruleLines - 1) * 55;
  const tip = 470 - lift;

  // Striped ribbon
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 150, 0);
  ctx.lineTo(cx + 150, 0);
  ctx.lineTo(cx + 150, tip - 104);
  ctx.lineTo(cx, tip);
  ctx.lineTo(cx - 150, tip - 104);
  ctx.closePath();
  ctx.clip();
  const stripes: [number, number, string][] = [[0, 70, '#c8102e'], [70, 100, '#f6efe4'], [100, 200, '#c8102e'], [200, 230, '#f6efe4'], [230, 300, '#c8102e']];
  for (const [a, z, c] of stripes) { ctx.fillStyle = c; ctx.fillRect(cx - 150 + a, 0, z - a, tip); }
  const shade = ctx.createLinearGradient(0, tip - 140, 0, tip);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,.25)');
  ctx.fillStyle = shade;
  ctx.fillRect(cx - 150, tip - 140, 300, 140);
  ctx.restore();

  // Gold loop
  const ly = tip + 5;
  ctx.beginPath();
  ctx.arc(cx, ly, 35, 0, Math.PI * 2);
  ctx.arc(cx, ly, 22.5, 0, Math.PI * 2, true);
  ctx.fillStyle = foil(ctx, cx, ly, 35);
  ctx.fill();

  // The medal: foil ring, red enamel centre, the ring glyph
  const size = 560;
  const my = tip + 20 + size / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.4)';
  ctx.shadowBlur = 67;
  ctx.shadowOffsetY = 34;
  ctx.beginPath();
  ctx.arc(cx, my, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = foil(ctx, cx, my, size / 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, my, size / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();
  const er = size / 2 - size * 0.1;
  const enamel = ctx.createRadialGradient(cx - er * 0.2, my - er * 0.4, 0, cx - er * 0.2, my - er * 0.4, er * 1.6);
  enamel.addColorStop(0, '#e0233f');
  enamel.addColorStop(0.8, '#8a0b1f');
  ctx.beginPath();
  ctx.arc(cx, my, er, 0, Math.PI * 2);
  ctx.fillStyle = enamel;
  ctx.fill();
  const inner = ctx.createLinearGradient(0, my + er * 0.4, 0, my + er);
  inner.addColorStop(0, 'rgba(0,0,0,0)');
  inner.addColorStop(1, 'rgba(0,0,0,.3)');
  ctx.fillStyle = inner;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,241,191,.6)';
  ctx.lineWidth = size * 0.01;
  ctx.beginPath();
  ctx.arc(cx, my, er - size * 0.005, 0, Math.PI * 2);
  ctx.stroke();
  glyph(ctx, b.ring, cx, my, size, '#fff6e6');

  // Name, rule, earned month
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f6efe4';
  font(ctx, `600 104px ${SERIF}`, '-2.6px');
  let y = lines(ctx, b.name, cx, my + size / 2 + 70, tw, 104);
  ctx.fillStyle = 'rgba(246,239,228,.75)';
  font(ctx, `500 40px ${SANS}`);
  y = lines(ctx, b.rule, cx, y + 26, tw, 55);
  ctx.fillStyle = '#f2dc8e';
  font(ctx, `italic 600 36px ${SERIF}`);
  lines(ctx, `Earned ${b.earnedLabel ?? ''}`.trim(), cx, y + 30, tw, 46);

  // Pins, "n of 8 Badges", the mark in gold
  const bottom = H - 290;
  const markY = bottom - 21;
  const ofY = markY - 21 - 44 - 21;
  const pinY = ofY - 21 - 20 - 17;
  const total = 8;
  const pinsW = total * 34 + (total - 1) * 16;
  for (let i = 0; i < total; i++) {
    const px = cx - pinsW / 2 + 17 + i * 50;
    ctx.beginPath();
    if (i < held) {
      ctx.arc(px, pinY, 17, 0, Math.PI * 2);
      ctx.fillStyle = foil(ctx, px, pinY, 17);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, pinY, 9.5, 0, Math.PI * 2);
      ctx.fillStyle = '#c8102e';
      ctx.fill();
    } else {
      ctx.arc(px, pinY, 15.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(246,239,228,.3)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(246,239,228,.8)';
  font(ctx, `600 34px ${SANS}`);
  ctx.textBaseline = 'middle';
  ctx.fillText(`${held} of ${total} Badges`, cx, ofY);
  mark(ctx, cx, markY, '#f2dc8e');
}
