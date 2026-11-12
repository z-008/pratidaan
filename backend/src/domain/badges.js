/**
 * Badges: lasting records of real milestones in a Donor's impact (CONTEXT.md).
 *
 * Worked out fresh from the Donor's journeys and donations on the demo clock,
 * so the same history always gives the same Badges. Nothing here is stored:
 * whether a Badge is "New" lives in Drop's state. Recipient facts come only
 * from impact.js's released journeys, so a Badge never says more than the app
 * already releases (and "Helped a child" goes if its age band is withdrawn).
 *
 * Earned dates are returned as a month only: transfusion dates are rounded to
 * the month before they leave the server.
 */

const store = require('../data/store');
const impact = require('./impact');

const KINDS = ['PRBC', 'PLT', 'FFP', 'CRYO', 'PLASMA'];
const YOUNG = ['Newborn', 'Child', 'Teenager'];

const monthOf = (iso) => iso.slice(0, 7);
const monthLabel = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The date a released journey helped someone: its transfusion, or its plasma's medicines being released. */
function helpedOn(journey, raw) {
  if (journey.withheld || !journey.helped) return null;
  const today = store.today();
  const e = raw.events.find((x) => ['transfused', 'products_released'].includes(x.type) && x.date <= today);
  return e ? e.date : null;
}

function badge(def, completed, progress, progressRatio) {
  return {
    id: def.id,
    name: def.name,
    ring: def.ring,
    rule: def.rule,
    goal: def.goal,
    earned: Boolean(completed),
    earnedMonth: completed ? monthOf(completed.date) : null,
    earnedLabel: completed ? monthLabel(completed.date) : null,
    completedBy: completed ? completed.by : null,
    earnedOn: completed ? completed.date : null, // exact date, server-only: badges() strips it
    // Shown after the goal on a greyed slot ("Reach 10 patients · 8 so far"); only where there is a real count
    progress: completed ? null : progress,
    // 0–1 for the ring on unearned Badges; null when earned
    progressRatio: completed ? null : progressRatio,
  };
}

/** The 8 Badges in shelf order, as sent to the app (earned month only). */
function badges(donorId) {
  return compute(donorId).map(({ earnedOn, ...b }) => b);
}

/** Exact earned dates by Badge id, for Drop's "New" rules only; never sent to the app. */
function earnedDates(donorId) {
  return Object.fromEntries(compute(donorId).filter((b) => b.earned).map((b) => [b.id, b.earnedOn]));
}

function compute(donorId) {
  const today = store.today();
  const journeys = impact.donorJourneys(donorId);
  const raw = new Map(store.getComponents(donorId).map((c) => [c.id, c]));
  const helped = journeys
    .map((j) => ({ j, date: helpedOn(j, raw.get(j.id)) }))
    .filter((h) => h.date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.j.id.localeCompare(b.j.id));
  const transfused = helped.filter((h) => h.j.events.some((e) => e.type === 'transfused'));
  const nth = (list, n) => (list.length >= n ? { date: list[n - 1].date, by: { componentId: list[n - 1].j.id } } : null);

  // Regular donor: completed donations up to today
  const donations = store.getDonations(donorId).filter((d) => d.status === 'completed' && d.date <= today);
  const third = donations[2] ? { date: donations[2].date, by: { donationId: donations[2].id } } : null;

  // Nothing wasted: every part of one donation helped; earned when its last part did
  let wasteless = null;
  let best = null;
  for (const d of donations) {
    const parts = store.getComponents(donorId).filter((c) => c.donationId === d.id);
    if (!parts.length) continue;
    const dates = parts.map((c) => helped.find((h) => h.j.id === c.id)?.date || null);
    const h = dates.filter(Boolean).length;
    if (!best || h / parts.length > best.h / best.p || (h / parts.length === best.h / best.p && h > best.h)) best = { h, p: parts.length };
    if (h === parts.length) {
      const last = dates.sort().pop();
      if (!wasteless || last < wasteless.date) wasteless = { date: last, by: { donationId: d.id } };
    }
  }

  // All five parts: the date each kind first helped
  const firstByKind = new Map();
  for (const h of helped) if (!firstByKind.has(h.j.kind)) firstByKind.set(h.j.kind, h);
  const allFive = KINDS.every((k) => firstByKind.has(k))
    ? (() => { const last = KINDS.map((k) => firstByKind.get(k)).sort((a, b) => a.date.localeCompare(b.date)).pop(); return { date: last.date, by: { componentId: last.j.id } }; })()
    : null;

  const medicines = helped.find((h) => h.j.status === 'products_released');
  const child = transfused.find((h) => h.j.recipient && YOUNG.some((b) => h.j.recipient.patient.startsWith(b)));

  const clamp = (n, d) => (d ? Math.min(1, Math.max(0, n / d)) : 0);

  return [
    badge({ id: 'first_patient', name: 'First patient', ring: '1', rule: 'My blood reached its first patient', goal: 'Your blood reaches its first patient' },
      nth(transfused, 1), null, clamp(transfused.length, 1)),
    badge({ id: 'patients_5', name: '5 patients', ring: '5', rule: 'My blood has reached five patients', goal: 'Reach 5 patients' },
      nth(transfused, 5), `${transfused.length} so far`, clamp(transfused.length, 5)),
    badge({ id: 'patients_10', name: '10 patients', ring: '10', rule: 'My blood has reached ten patients', goal: 'Reach 10 patients' },
      nth(transfused, 10), `${transfused.length} so far`, clamp(transfused.length, 10)),
    badge({ id: 'regular_donor', name: 'Regular donor', ring: '3', rule: "I've given blood three times", goal: 'Give blood three times' },
      third, `${donations.length} so far`, clamp(donations.length, 3)),
    badge({ id: 'nothing_wasted', name: 'Nothing wasted', ring: 'check', rule: 'Every part of one of my donations helped someone', goal: 'Every part of one donation helps someone' },
      wasteless, best ? `best so far ${best.h} of ${best.p}` : null, wasteless ? 1 : (best ? clamp(best.h, best.p) : 0)),
    badge({ id: 'all_five_parts', name: 'All five parts', ring: 'five-drop', rule: 'All five parts of my blood have helped someone', goal: 'All five parts of your blood help someone' },
      allFive, `${firstByKind.size} of 5 so far`, clamp(firstByKind.size, 5)),
    badge({ id: 'plasma_to_medicine', name: 'Plasma to medicine', ring: 'vial', rule: 'My plasma was made into medicines', goal: 'Your plasma is made into medicines' },
      medicines ? { date: medicines.date, by: { componentId: medicines.j.id } } : null, null, medicines ? 1 : 0),
    badge({ id: 'helped_child', name: 'Helped a child', ring: 'heart', rule: 'My blood helped a child', goal: 'Your blood helps a patient under 18' },
      child ? { date: child.date, by: { componentId: child.j.id } } : null, null, child ? 1 : 0),
  ];
}

module.exports = { badges, earnedDates };
