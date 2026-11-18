/** Shared bits for the between-donation screens (Progress, Connected apps, food coaching). */

/** Open the "Why this?" sheet (WhyThis listens) for a recommendation id: "food:iron", "card:<id>". */
export function openWhy(recId: string) {
  window.dispatchEvent(new CustomEvent('wellbeing:why', { detail: { recId } }));
}

/** Tell every between-donation view to reload (a Card was answered, an app connected). */
export function wellbeingChanged() {
  window.dispatchEvent(new CustomEvent('wellbeing:changed'));
  window.dispatchEvent(new CustomEvent('drop:changed'));
}

const FOCUS_KEY = 'pratidaan.progress.focus';
/** A Card's "See foods" opens Progress on that marker ("progress:iron"). */
export function goTo(target: string) {
  const [screen, marker] = target.split(':');
  try { if (marker) sessionStorage.setItem(FOCUS_KEY, marker); } catch { /* storage unavailable: Progress opens at the top */ }
  window.location.hash = screen;
}
export function takeFocus(): string | null {
  try { const v = sessionStorage.getItem(FOCUS_KEY); sessionStorage.removeItem(FOCUS_KEY); return v; } catch { return null; }
}

export const HABITS = [
  { id: 'movement', name: 'Movement', icon: 'walk', signals: 'Steps and active minutes' },
  { id: 'food', name: 'Food', icon: 'food', signals: 'Iron-rich food and water' },
  { id: 'mind', name: 'Mind', icon: 'mind', signals: 'Sleep and rest' },
] as const;

/** The marker row a focus opens on Progress. */
export const FOCUS_MARKER: Record<string, string> = { iron: 'ferritin', bp: 'bp', sugar: 'hba1c', lipids: 'ldl', b12: 'b12', vitd: 'vitd' };
export const MARKER_FOCUS: Record<string, string> = { bp: 'bp', hb: 'iron', ferritin: 'iron', hba1c: 'sugar', ldl: 'lipids', tg: 'lipids', hdl: 'lipids' };

export const LEVEL_PILL: Record<string, { pill: string; label: string }> = {
  optimal: { pill: 'pill-good', label: 'Healthy' }, low_normal: { pill: 'pill-info', label: 'On the low side' }, below: { pill: 'pill-warn', label: 'Below the donation level' },
  doctor_first: { pill: 'pill-bad', label: 'Doctor first' }, urgent: { pill: 'pill-bad', label: 'See a doctor today' }, not_needed: { pill: 'pill-neutral', label: 'Nothing extra needed' },
};
/** A care level in words that fit the marker: "below" means low for iron, but high for BP, sugar or cholesterol. */
export function levelLabel(marker: string, level: string) {
  const high = ['bp', 'sugar', 'lipids'].includes(marker);
  if (high && level === 'below') return 'Above the healthy range';
  if (high && level === 'low_normal') return 'Close to the line';
  if (!['iron'].includes(marker) && level === 'below') return 'Low';
  return LEVEL_PILL[level]?.label || level;
}
export const STATUS_PILL: Record<string, string> = { on: 'pill-good', drift: 'pill-info', off: 'pill-warn', none: 'pill-neutral' };

export const DIETS: Record<string, string> = { veg: 'Vegetarian', egg: 'Eggetarian', nonveg: 'Non-vegetarian', vegan: 'Vegan', jain: 'Jain' };
export const BUDGETS: Record<string, string> = { tight: '₹10–20 a day', moderate: '₹20–50 a day', flexible: 'Flexible' };
export const REGIONS: Record<string, string> = { south: 'South Indian', north: 'North Indian', east: 'East Indian', west: 'West Indian', northeast: 'North-east Indian' };
export const STAPLES: Record<string, string> = { rice: 'Rice', roti: 'Roti', millet: 'Millets' };
export const EATS_AT: Record<string, string> = { home: 'Home', canteen: 'Canteen', hostel: 'Hostel or PG', tiffin: 'Tiffin' };
export const ALLERGIES: Record<string, string> = { peanut: 'Peanut', gluten: 'Gluten', dairy: 'Dairy', egg: 'Egg', fish: 'Fish', sesame: 'Sesame' };
export const SIGNAL_NAMES: Record<string, string> = { steps: 'Steps', active_min: 'Active minutes', sleep_min: 'Sleep', rhr_bpm: 'Resting heart rate', iron_mg: 'Iron from food', water_ml: 'Water', habit_done: 'Habit ticks' };

export const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
