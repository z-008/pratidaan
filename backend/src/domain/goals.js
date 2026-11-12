/**
 * Goals (CONTEXT.md: Goal): which findings make which Goal, its name, its one
 * target, the order, and its state.
 *
 * Fixed rules, settled in docs/wayfinder/results-to-habits/tickets/01-findings-to-goals.md:
 * - Two groups: lifestyle (BP, cholesterol, sugar, weight) and iron (Hb, ferritin).
 *   A group makes a Goal only when it has a moderate-or-worse finding; its watch
 *   findings then join it. A raised ALT makes no Goal.
 * - The name lists what the Goal covers, lead (most severe) finding first, up to three.
 * - One target, from a fixed table, set by the lead finding.
 * - Order: urgent, high, moderate; on a tie the Goal that stops donation, then the older.
 *   At most two are active; the rest wait in Up next.
 * Neither the AI nor the Donor sets grouping, a target or the order.
 *
 * A Goal is its group, so it keeps its id as later results change its findings.
 * What is kept per Goal (when it started, stopped or was done) lives in Drop's
 * state; drop.js passes it in as `records`.
 */

const store = require('../data/store');
const health = require('./health');
const writeup = require('./goalWriteup');

const GROUP_OF = { hypertension: 'lifestyle', heart_disease: 'lifestyle', prediabetes: 'lifestyle', diabetes: 'lifestyle', weight_management: 'lifestyle', anemia: 'iron' };
const GROUPS = ['lifestyle', 'iron'];
const KIND_OF = { hypertension: 'bp', heart_disease: 'cholesterol', prediabetes: 'sugar', diabetes: 'sugar', weight_management: 'weight' };
const WORDS = { bp: 'BP', cholesterol: 'cholesterol', sugar: 'blood sugar', weight: 'weight', hb: 'haemoglobin', iron: 'iron' };
const RANK = { urgent: 0, high: 1, moderate: 2, watch: 3 };
const ACTIVE_MAX = 2;

const BP_TARGET = { s: 130, d: 80 };
const HBA1C_TARGET = 5.7;
const LDL_TARGET = 130;
const TG_TARGET = 150;
const FERRITIN_TARGET = 15;
const DOCTOR_DAYS = 30; // the diabetes range: a doctor's check within 30 days (DM-DIAB)

const MARKERS = {
  bp: { label: 'BP', unit: 'mmHg' },
  hb: { label: 'Haemoglobin', unit: 'g/dL' },
  hba1c: { label: 'HbA1c', unit: '%' },
  ldl: { label: 'LDL', unit: 'mg/dL' },
  tg: { label: 'Triglycerides', unit: 'mg/dL' },
  hdl: { label: 'HDL', unit: 'mg/dL' },
  ferritin: { label: 'Ferritin', unit: 'ng/mL' },
  weight: { label: 'Weight', unit: 'kg' },
};

const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** What one finding covers, as a Goal's name says it. */
const kindOf = (f) => KIND_OF[f.concept] || (f.id === 'IRON_LOW' ? 'iron' : 'hb');

function nameOf(kinds) {
  const words = kinds.slice(0, 3).map((k) => WORDS[k]);
  const text = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const latestValue = (donorId, key) => {
  const list = health.labSeries(donorId)[key];
  return list && list.length ? list[list.length - 1].value : null;
};

/** The one target, set by the lead finding (ticket 01's targets table). `marker` is the one its trend chart shows. */
function targetOf(lead, donorId) {
  if (lead.concept === 'hypertension') {
    return { marker: 'bp', text: `BP under ${BP_TARGET.s}/${BP_TARGET.d}`, s: BP_TARGET.s, d: BP_TARGET.d, line: BP_TARGET.s };
  }
  if (lead.id === 'DIABETES_RANGE') return { marker: 'hba1c', text: `A doctor's check within ${DOCTOR_DAYS} days`, doctor: true, days: DOCTOR_DAYS, line: null };
  if (lead.concept === 'prediabetes') return { marker: 'hba1c', text: `HbA1c under ${HBA1C_TARGET}%`, value: HBA1C_TARGET, line: HBA1C_TARGET };
  if (lead.concept === 'heart_disease') {
    const ldlHigh = (latestValue(donorId, 'ldl') ?? 0) >= LDL_TARGET;
    return { marker: ldlHigh ? 'ldl' : 'tg', text: `LDL under ${LDL_TARGET}, triglycerides under ${TG_TARGET}`, ldl: LDL_TARGET, tg: TG_TARGET, line: ldlHigh ? LDL_TARGET : TG_TARGET };
  }
  if (lead.concept === 'anemia') {
    const hb = health.hbMin(store.getDonor(donorId));
    const iron = lead.id === 'IRON_LOW';
    return { marker: iron ? 'ferritin' : 'hb', text: `Haemoglobin ${hb.toFixed(1)} or more, ferritin ${FERRITIN_TARGET} or more`, hb, ferritin: FERRITIN_TARGET, up: true, line: iron ? FERRITIN_TARGET : hb };
  }
  return null;
}

/** The Goals the Donor's findings make now, before order and state. */
function candidates(donorId) {
  const all = health.findings(donorId); // most severe first
  const out = [];
  for (const group of GROUPS) {
    const fs = all.filter((f) => GROUP_OF[f.concept] === group);
    const lead = fs.find((f) => f.severity !== 'watch');
    if (!lead) continue; // watch findings never make a Goal on their own
    const kinds = [...new Set([kindOf(lead), ...fs.map(kindOf)])];
    out.push({
      id: group, group, name: nameOf(kinds), kinds, lead, findings: fs, severity: lead.severity,
      stopsDonation: fs.some(health.blocksDonation), target: targetOf(lead, donorId),
    });
  }
  return out;
}

/** Findings that make no Goal: watch-only groups and ALT. Rechecked at the next donation. */
function keepAnEye(donorId) {
  const goalGroups = new Set(candidates(donorId).map((g) => g.group));
  return health.findings(donorId).filter((f) => f.severity === 'watch' && !goalGroups.has(GROUP_OF[f.concept]));
}

/** Order the Goals and give each its state: two active, the rest Up next, then stopped and done. */
function arrange(found, records) {
  const rec = (g) => records[g.id];
  const live = found.filter((g) => rec(g).state !== 'stopped').sort((a, b) => RANK[a.severity] - RANK[b.severity]
    || Number(b.stopsDonation) - Number(a.stopsDonation)
    || rec(a).createdOn.localeCompare(rec(b).createdOn));
  const active = live.slice(0, ACTIVE_MAX);
  const keep = (g) => ({ createdOn: rec(g).createdOn, reopenedOn: rec(g).reopenedOn || null, writeup: rec(g).writeup || null });
  return [
    ...active.map((g) => ({ ...g, ...keep(g), state: 'active' })),
    ...live.slice(ACTIVE_MAX).map((g) => ({ ...g, ...keep(g), state: 'upnext', startsWhen: active[active.length - 1].name })),
    ...found.filter((g) => rec(g).state === 'stopped').map((g) => ({ ...g, ...keep(g), state: 'stopped', stoppedOn: rec(g).stoppedOn })),
    ...Object.values(records).filter((r) => r.state === 'done').map((r) => ({ id: r.id, group: r.id, name: r.name, state: 'done', createdOn: r.createdOn, doneOn: r.doneOn })),
  ];
}

/**
 * Bring the kept records in line with the latest results, then list the Goals.
 * A new group gets a record; a group whose findings are back reopens its done Goal;
 * a Goal whose group has nothing worse than watch is done. A Goal's write-up is
 * written when it is made or its findings change, and kept with it.
 */
function sync(records, donorId) {
  const today = store.today();
  const found = candidates(donorId);
  for (const g of found) {
    if (!records[g.id]) records[g.id] = { id: g.id, createdOn: today, state: null };
    const r = records[g.id];
    if (r.state === 'done') Object.assign(r, { state: null, reopenedOn: today, doneOn: null });
    r.name = g.name;
    const sig = writeup.signature(g);
    if (r.writeupFor !== sig) Object.assign(r, { writeup: writeup.rules(g), writeupFor: sig });
  }
  for (const r of Object.values(records)) {
    if (r.state !== 'done' && !found.some((g) => g.id === r.id)) Object.assign(r, { state: 'done', doneOn: today });
  }
  return arrange(found, records);
}

/** "Stop this Goal". An urgent Goal can't be stopped. */
function stop(records, donorId, goalId) {
  const g = sync(records, donorId).find((x) => x.id === goalId);
  if (!g || g.state === 'done') throw new Error('No such Goal to stop');
  if (g.severity === 'urgent') throw new Error("An urgent Goal can't be stopped");
  Object.assign(records[goalId], { state: 'stopped', stoppedOn: store.today() });
  return sync(records, donorId);
}

/** "Start again" on a stopped Goal: it goes back in order, active or Up next. */
function startAgain(records, donorId, goalId) {
  const r = records[goalId];
  if (!r || r.state !== 'stopped') throw new Error('That Goal is not stopped');
  Object.assign(r, { state: null, stoppedOn: null });
  return sync(records, donorId);
}

/** Is a home BP reading under the BP target? ("Reached" is Card wording, not a state.) */
const bpReached = (s, d) => s < BP_TARGET.s && d < BP_TARGET.d;

/* ------------------------------------------------------------------ facts code writes (ticket 01: "Code writes the facts") */

function valueText(marker, p) {
  if (marker === 'bp') return `${p.value}/${p.value2}`;
  if (marker === 'hba1c') return `${p.value}%`;
  return `${p.value}`;
}

const fromDonation = (p) => p.source === 'donation' || p.source === 'donation_sample';

/** The trend in plain words with real numbers: "Up at each of your last 4 donations", "126/78 → 148/94". */
function trendWords(marker, points) {
  const last = points.slice(-4);
  if (!last.length) return { words: 'No result yet', range: '' };
  if (last.length === 1) return { words: `On ${fmt(last[0].date)}`, range: valueText(marker, last[0]) };
  const noun = last.every(fromDonation) ? 'donations' : 'results';
  const steps = last.slice(1).map((p, i) => p.value - last[i].value);
  const words = steps.every((x) => x > 0) ? `Up at each of your last ${last.length} ${noun}`
    : steps.every((x) => x < 0) ? `Down at each of your last ${last.length} ${noun}`
      : `Your last ${last.length} ${noun}`;
  return { words, range: `${valueText(marker, last[0])} → ${valueText(marker, last[last.length - 1])}` };
}

/** Markers outside their range for one kind of finding, at the latest result. */
function markersFor(kind, donorId) {
  if (kind === 'cholesterol') {
    const out = [];
    if ((latestValue(donorId, 'ldl') ?? 0) >= LDL_TARGET) out.push('ldl');
    if ((latestValue(donorId, 'tg') ?? 0) >= TG_TARGET) out.push('tg');
    const hdl = latestValue(donorId, 'hdl');
    if (hdl != null && hdl < 40) out.push('hdl');
    return out;
  }
  return [{ bp: 'bp', sugar: 'hba1c', weight: 'weight', hb: 'hb', iron: 'ferritin' }[kind]];
}

/**
 * What code writes for an open Goal: the trend chart against the target, the
 * Goal's other findings, urgency, the doctor note and the next check.
 * `pointsOf(marker)` gives a marker's points, oldest first (Drop adds the Donor's readings).
 */
function facts(goal, donorId, pointsOf) {
  const marker = goal.target.marker;
  const points = pointsOf(marker);
  const also = goal.kinds.flatMap((k) => markersFor(k, donorId)).filter((m) => m && m !== marker).map((m) => {
    const list = pointsOf(m).slice(-3);
    return list.length ? `${MARKERS[m].label} ${list.map((p) => valueText(m, p)).join(' → ')}` : null;
  }).filter(Boolean);
  const protocol = goal.lead.protocolId ? store.protocols.get(goal.lead.protocolId) : null;
  const days = protocol ? protocol.followUpDays : null;
  return {
    urgency: goal.severity,
    trend: { marker, ...MARKERS[marker], points, line: goal.target.line, up: Boolean(goal.target.up), ...trendWords(marker, points) },
    also,
    doctorNote: goal.findings.map((f) => `${f.title}: ${f.detail}${f.protocolId ? ` (${f.protocolId})` : ''}`).join('; '),
    nextCheck: days == null ? 'At your next donation' : days === 0 ? 'Today' : `By ${fmt(health.addDays(goal.createdOn, days))}`,
  };
}

module.exports = {
  candidates, keepAnEye, arrange, sync, stop, startAgain, facts, trendWords, bpReached, nameOf,
  BP_TARGET, HBA1C_TARGET, LDL_TARGET, TG_TARGET, FERRITIN_TARGET, ACTIVE_MAX, GROUP_OF,
};
