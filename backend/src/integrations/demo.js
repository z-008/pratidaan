/**
 * Demo connector: wearable, habit-app and food-app data for the demo Personas,
 * generated on demand from their storylines (data/demo/wellbeing-seed.json).
 * Deterministic: the same Persona and date always give the same value, so the
 * demo, its tests and its screenshots are reproducible. Every value it gives is
 * labelled "demo" in the app; no real account or device is involved.
 */

const store = require('../data/store');

let seed = null;
const seedData = () => { if (!seed) seed = store.readDemo('wellbeing-seed.json') || { storylines: {}, preset: {} }; return seed; };
store.onReset(() => { seed = null; });

const storyline = (donorId) => seedData().storylines[donorId] || seedData().storylines.default;
const preset = (donorId) => seedData().preset[donorId] || null;

/** A stable number in [0, 1) for this donor, date and signal. */
function noise(donorId, date, key) {
  let h = 7;
  for (const ch of `${donorId}|${date}|${key}`) h = (h * 31 + ch.charCodeAt(0)) % 1000003;
  return (h % 10007) / 10007;
}

const dow = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** Rough-week overlays the demo bar adds: { from, to, steps, sleep, habits, barrier } */
function overlayOn(overlays, date) {
  return (overlays || []).find((o) => date >= o.from && date <= o.to) || null;
}

/**
 * One day's value of a signal, or null when the storyline has no data for it.
 * `activityMinutes` is the Weekly report's existing simulated figure: from the demo start the
 * connector reports exactly that, so connecting a watch doesn't change the report's numbers.
 */
function value(donorId, signal, date, { overlays, activityMinutes, ref } = {}) {
  const s = storyline(donorId);
  if (date < s.history || date > store.today()) return null;
  const n = noise(donorId, date, signal + (ref || ''));
  const missDay = (s.missDays || []).includes(dow(date));
  const o = overlayOn(overlays, date);
  switch (signal) {
    case 'steps': {
      const mean = (s.steps.find(([until]) => date <= until) || s.steps[s.steps.length - 1])[1];
      return Math.round(mean * (0.85 + n * 0.3) * (missDay ? 0.7 : 1) * (o ? o.steps : 1));
    }
    case 'active_min': {
      if (date >= store.clock().start && activityMinutes && !o) return activityMinutes(donorId, date);
      const steps = value(donorId, 'steps', date, { overlays });
      return Math.max(0, Math.round(steps / 220 - 4 + n * 6));
    }
    case 'sleep_min': return Math.round((s.sleep_min || 420) - 30 + n * 60 - (missDay ? 25 : 0) + (o ? o.sleep : 0));
    case 'rhr_bpm': return Math.round((s.rhr_bpm || 72) - 3 + n * 6);
    case 'iron_mg': return s.iron_mg ? Math.round(((s.iron_mg - 3) + n * 6) * (o ? 0.6 : 1) * 10) / 10 : null;
    case 'water_ml': return Math.round(1500 + n * 900);
    case 'habit_done': {
      const rate = (s.habit_rate || 0.75) * (missDay ? 0.4 : 1) * (o ? o.habits / (s.habit_rate || 0.75) : 1);
      return n < Math.min(1, rate) ? 1 : 0;
    }
    default: return null;
  }
}

module.exports = { value, storyline, preset, overlayOn, noise };
