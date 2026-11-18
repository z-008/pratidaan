/**
 * Bands and the age-group comparison for the Progress screen: where each
 * marker from the donation results sits (Donation minimum / healthy / optimal,
 * data/ontology/bands.json) and how it compares with donors of the same sex and
 * age. Only a percentile leaves here, never another donor's values; groups
 * smaller than 20 widen first. From results only: habits never change a band.
 */

const store = require('../data/store');
const health = require('./health');
const ref = require('../data/reference');

const latestOf = (list) => (list && list.length ? list[list.length - 1] : null);

/** Each marker's latest value; Hb from the visit or a later report, as health.findings reads it. */
function latest(donorId) {
  const labs = health.labSeries(donorId);
  const visits = health.vitalsSeries(donorId);
  const last = latestOf(visits);
  const out = {};
  if (last) out.bp = { s: last.systolic, d: last.diastolic, date: last.date };
  const labHb = latestOf(labs.hb);
  if (last || labHb) {
    out.hb = labHb && (!last || labHb.date > last.date || (labHb.date === last.date && labHb.source === 'uploaded_report'))
      ? { value: labHb.value, date: labHb.date } : { value: last.haemoglobin, date: last.date };
  }
  for (const k of ['ferritin', 'hba1c', 'ldl', 'tg', 'hdl', 'mcv', 'b12', 'vitd', 'creat']) {
    const o = latestOf(labs[k]);
    if (o) out[k] = { value: o.value, date: o.date };
  }
  return out;
}

/** Values recorded at one visit (vitals and that visit's lab panel). */
function atVisit(donorId, visitId) {
  const v = store.getDonations(donorId).find((x) => x.id === visitId);
  if (!v) return {};
  const out = {};
  if (v.vitals) {
    out.bp = { s: v.vitals.systolic, d: v.vitals.diastolic, date: v.date };
    out.hb = { value: v.vitals.haemoglobin, date: v.date };
  }
  for (const o of store.getObservations(donorId).filter((x) => x.visitId === visitId)) {
    if (o.key === 'hb') out.hb = { value: o.value, date: o.date };
    else out[o.key] = { value: o.value, date: o.date };
  }
  return out;
}

const hbMinOf = (donor) => health.hbMin(donor);

/** Which band a value falls in: { index (0 = best), id, label, source }. */
function bandOf(marker, value, donor) {
  const def = ref.bands().markers[marker];
  if (!def || value === null || value === undefined) return null;
  const idx = def.bands.findIndex((b) => {
    if (marker === 'bp') return b.below ? value.s < b.below[0] && value.d < b.below[1] : true;
    if (b.below !== undefined) return value < b.below;
    if (b.atLeast !== undefined) return value >= b.atLeast;
    if (b.atLeastMargin !== undefined) return value >= hbMinOf(donor) + b.atLeastMargin;
    return true;
  });
  const b = def.bands[idx];
  return { index: idx, id: b.id, label: b.label, source: b.source };
}

const text = (marker, v) => (marker === 'bp' ? `${v.s}/${v.d}` : String(v.value));
const raw = (marker, v) => (marker === 'bp' ? v : v.value);

/** A comparable number where higher is better, so donors can be ranked. */
function score(marker, v, donor) {
  const def = ref.bands().markers[marker];
  if (marker === 'bp') return -v.s;
  if (marker === 'hb') return Math.min(v.value - hbMinOf(donor), def.cap || 2.5);
  let x = v.value;
  if (def.capValue) x = Math.min(x, def.capValue);
  return def.better === 'higher' ? x : -x;
}

const sexWord = (sex) => (sex === 'F' ? 'women' : sex === 'M' ? 'men' : 'donors');

/** "Better than 72% of women donors aged 30–39": shown only from 50%, so no one is told they rank low. */
function percentile(marker, donorId) {
  const cfg = ref.bands();
  const donor = store.getDonor(donorId);
  const mine = latest(donorId)[marker];
  if (!mine || !donor || donor.newUser) return null;
  const myScore = score(marker, mine, donor);
  const band = cfg.ageBands.find(([lo, hi]) => donor.age >= lo && donor.age <= hi);
  const others = store.allDonors().filter((d) => d.id !== donorId && !d.newUser && d.sex);
  const groups = [
    { list: others.filter((d) => d.sex === donor.sex && band && d.age >= band[0] && d.age <= band[1]), words: `${sexWord(donor.sex)} donors aged ${band ? `${band[0]}–${band[1]}` : ''}` },
    { list: others.filter((d) => d.sex === donor.sex), words: `${sexWord(donor.sex)} donors` },
    { list: others, words: 'donors' },
  ];
  for (const g of groups) {
    const scores = g.list.map((d) => { const v = latest(d.id)[marker]; return v ? score(marker, v, d) : null; }).filter((x) => x !== null);
    if (scores.length < cfg.minGroup) continue;
    const worse = scores.filter((s) => s < myScore).length + scores.filter((s) => s === myScore).length / 2;
    const pct = Math.round((worse / scores.length) * 100);
    return { pct, group: g.words, size: scores.length, text: pct >= cfg.showPercentileFrom ? `Better than ${pct}% of ${g.words}` : null };
  }
  return null;
}

/** One row per marker with a value: band, the previous donation's value, and the comparison line. */
function rows(donorId) {
  const donor = store.getDonor(donorId);
  const now = latest(donorId);
  const visits = store.getDonations(donorId).filter((v) => v.vitals);
  const prevVisit = visits.length > 1 ? visits[visits.length - 2] : null;
  const prev = prevVisit ? atVisit(donorId, prevVisit.id) : {};
  const defs = ref.bands().markers;
  return Object.keys(defs).filter((m) => now[m]).map((m) => {
    const band = bandOf(m, raw(m, now[m]), donor);
    const before = prev[m] ? { text: text(m, prev[m]), date: prev[m].date, band: bandOf(m, raw(m, prev[m]), donor) } : null;
    const p = percentile(m, donorId);
    return {
      marker: m, label: defs[m].label, unit: defs[m].unit, value: text(m, now[m]), date: now[m].date,
      band, bands: defs[m].bands.map((b) => b.label), previous: before,
      moved: before && before.band ? before.band.index - band.index : 0, // > 0 means a better band than last time
      percentile: p && p.text ? p.text : null,
    };
  });
}

module.exports = { latest, atVisit, bandOf, percentile, rows, text, raw, sexWord };
