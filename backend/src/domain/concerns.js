/**
 * Donor concerns about what happened to their blood (wasted unit, wrong tracking,
 * privacy, treatment at the centre). This is an in-process walkthrough of a
 * possible response and escalation path; no centre or authority is contacted.
 * Dates follow the demo clock.
 */

const store = require('../data/store');
const impact = require('./impact');

const CATEGORIES = {
  wasted: 'My donation was wasted or expired',
  tracking: 'The tracking of my blood looks wrong',
  privacy: 'I am worried about my privacy',
  conduct: 'How I was treated at the centre',
};

// Example owners and timelines for the demo ladder; not actual assignments
const LADDER = [
  { owner: 'Medical Officer in charge, blood centre', ackDays: 1, dueDays: 7 },
  { owner: 'State Blood Transfusion Council', ackDays: 2, dueDays: 15 },
  { owner: 'State Drugs Control Department (licensing authority)', ackDays: 3, dueDays: 30 },
];

const concerns = new Map(); // donorId -> [concern]
let seq = 1;
store.onReset(() => { concerns.clear(); seq = 1; });

const addDays = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);

function centreAnswer(c) {
  const unit = c.unit;
  if (c.category === 'wasted' && unit?.expiry) {
    return `Illustrative reply (not from a centre): Unit ${unit.id} shows: ${unit.expiry.cause.join(' ')} A centre could review how it times drives for ${unit.kind === 'PLT' ? 'platelets' : 'this blood group'}.`;
  }
  if (c.category === 'tracking' && unit) {
    return `Illustrative reply (not from a centre): The timeline for unit ${unit.id} shows "${unit.statusLabel}". No centre register was checked. A real discrepancy needs a direct enquiry with the centre.`;
  }
  if (c.category === 'privacy') return 'Illustrative reply (not from a centre): This app does not share your health score or results with an insurer. Review the privacy information and contact the relevant organisation directly for a real privacy concern.';
  return 'Illustrative reply (not from a centre): Your feedback is recorded only in this session. No staff were contacted. Please contact the centre directly to report real treatment concerns.';
}

/** Steps that have happened by the demo date, plus who owns it now and by when. */
function view(c) {
  const today = store.today();
  const level = LADDER[c.level];
  const steps = [...c.log];
  const add = (step) => { if (!steps.some((s) => s.text === step.text)) steps.push(step); };
  const ackOn = addDays(c.levelSince, level.ackDays);
  if (today >= ackOn) add({ on: ackOn, text: `Illustrative acknowledgement for ${level.owner}; no acknowledgement was sent or received.` });
  // An example centre reply appears on demo day 3; no real response is received.
  const answerOn = c.level === 0 ? addDays(c.levelSince, 3) : null;
  const answered = Boolean(c.status === 'open' && answerOn && today >= answerOn);
  if (answered) add({ on: answerOn, text: `Illustrative answer (not from ${level.owner}): ${centreAnswer(c)}` });
  const dueOn = addDays(c.levelSince, level.dueDays);
  const overdue = c.status === 'open' && !answered && today > dueOn;
  return {
    id: c.id,
    category: c.category,
    categoryLabel: CATEGORIES[c.category],
    details: c.details,
    unitId: c.unit?.id || null,
    unitName: c.unit ? `${c.unit.name} · donated ${new Date(`${c.unit.donationDate}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : null,
    createdOn: c.createdOn,
    status: c.status,
    owner: level.owner,
    level: c.level + 1,
    levels: LADDER.length,
    dueOn,
    overdue,
    answered,
    canEscalate: c.status === 'open' && c.level < LADDER.length - 1 && (overdue || answered),
    nextOwner: LADDER[c.level + 1]?.owner || null,
    steps: steps.sort((a, b) => a.on.localeCompare(b.on)),
  };
}

function list(donorId) {
  return (concerns.get(donorId) || []).map(view).sort((a, b) => b.createdOn.localeCompare(a.createdOn));
}

function find(donorId, id) {
  const c = (concerns.get(donorId) || []).find((x) => x.id === id);
  if (!c) throw new Error('Concern not found');
  return c;
}

function raise(donorId, { category, details, unitId }) {
  if (!CATEGORIES[category]) throw new Error('Choose what the concern is about');
  const text = String(details || '').trim().slice(0, 1000);
  const unit = unitId ? impact.donorJourneys(donorId).find((j) => j.id === unitId) || null : null;
  if (unitId && !unit) throw new Error('That unit is not in your donations');
  const today = store.today();
  const c = {
    id: `CN-${String(seq++).padStart(4, '0')}`,
    donorId, category, details: text, unit, createdOn: today, level: 0, levelSince: today, status: 'open',
    log: [{ on: today, text: `Concern saved in this session. Owner: ${LADDER[0].owner}. Nothing was sent.` }],
  };
  concerns.set(donorId, [...(concerns.get(donorId) || []), c]);
  return view(c);
}

function escalate(donorId, id) {
  const c = find(donorId, id);
  const v = view(c);
  if (!v.canEscalate) throw new Error(c.level >= LADDER.length - 1 ? 'This concern has reached its last level' : `You can escalate after ${v.dueOn} if there is no reply, or once a reply appears`);
  const today = store.today();
  c.log = v.steps;
  c.level += 1;
  c.levelSince = today;
  c.log.push({ on: today, text: `Escalated to ${LADDER[c.level].owner}${v.overdue ? ' after the deadline' : ' after the illustrative reply'}. No authority was contacted.` });
  return view(c);
}

function resolve(donorId, id) {
  const c = find(donorId, id);
  const v = view(c);
  c.log = [...v.steps, { on: store.today(), text: 'You closed this concern; no external case was resolved.' }];
  c.status = 'resolved';
  return view(c);
}

module.exports = { CATEGORIES, LADDER, list, raise, escalate, resolve };
