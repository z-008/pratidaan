/**
 * Drop engine: turns Events about a Donor into Cards, under the Message budget.
 *
 * Terms are defined in CONTEXT.md. The rules here are the ones agreed in the
 * redesign (cards, budget, quiet hours, snooze, memory, demo clock): they are
 * code, so the same history always gives the same Cards. The AI layer only
 * rewrites the wording of open Cards; it never decides what is sent or when.
 *
 * State lives in memory per Donor, starts from data/demo/drop-seed.json and
 * resets with the demo clock. Pending after the demo: move it to Firestore.
 */

const store = require('../data/store');
const health = require('./health');
const impact = require('./impact');
const donation = require('./donation');
const { componentStory } = require('./story');
const badgeRules = require('./badges');
const goalRules = require('./goals');

const PRIORITY = { urgent: 1, results: 2, donate: 3, checkin: 4, goal: 5, impact: 6, fold: 7 };
const BUDGETS = {
  goal: { perDay: 1, perWeek: 2, report: 'week' },
  healthy: { perDay: 1, perWeek: 1, report: 'month' },
};
const PARTS = 4; // morning 8 am, afternoon 2 pm, evening 7 pm, night 9 pm (quiet hours)
const NIGHT = 3;
const EXPIRY_DAYS = 7;
const MAX_SNOOZES = 3;
const CHECKIN_DAYS = 14;
const CHECKIN_MARKERS = ['bp', 'hb']; // the markers a Check-in Card can ask about

const states = new Map();
let seed = null;
// Ids never repeat, across demo Resets and server restarts, so a browser still holding an old Card id can't act on a new Card
const BOOT = Date.now().toString(36).slice(-4);
let seq = 1;

/* ------------------------------------------------------------------ dates */

const DAY = 864e5;
const dayNum = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const dow = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const weekStart = (iso) => addDays(iso, -((dow(iso) + 6) % 7));
const tickOf = (iso, part = 0) => dayNum(iso) * PARTS + part;
const nowTick = () => tickOf(store.clock().date, store.clock().part);
const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const clone = (x) => JSON.parse(JSON.stringify(x));
const id = (prefix) => `${prefix}${BOOT}-${seq++}`;
const partOfTime = (hhmm) => { const h = Number(String(hhmm).slice(0, 2)); return h < 12 ? 0 : h < 17 ? 1 : h < 21 ? 2 : 3; };
// Lower-cases a sentence start, never an acronym ("BP under 130/80")
const lcFirst = (t) => (/^[A-Z]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
const time12 = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); const hr = ((h + 11) % 12) + 1; return `${hr}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`; };

/* ------------------------------------------------------------------ state */

function seedFor(donorId) {
  if (!seed) seed = store.readDemo('drop-seed.json') || {};
  return seed[donorId] || null;
}

function log(st, text) {
  st.log.unshift({ at: `${store.clock().date} ${store.clock().partName}`, text });
  st.log.length = Math.min(st.log.length, 40);
}

function create(donorId) {
  const s = seedFor(donorId) || {};
  // Seeded Personas start at the demo start date, however late they are first opened
  const today = seedFor(donorId) ? store.clock().start : store.today();
  const findings = health.findings(donorId);
  const st = {
    donorId, createdOn: today, lastDate: today,
    language: s.language || 'en',
    budgetKind: s.budget || (findings.some((f) => f.severity !== 'watch') ? 'goal' : 'healthy'),
    cards: [], events: [], keys: {}, sentByDay: {}, sentByWeek: {}, reports: {},
    memory: (s.memory || []).map((text) => ({ id: id('m'), text, createdOn: today })),
    plan: s.plan ? clone(s.plan) : null,
    reminders: clone(s.reminders || []),
    reminderLog: [], readings: [], bookings: [], hiddenResults: [],
    undo: null, memReceipt: null, created: 0, log: [],
    // Badges are worked out from data; only what the Donor has seen lives here. Ones earned before Drop started are never "New".
    badgesSeen: [], badgesShown: [],
    // Goals are worked out from results (goals.js); only what is kept per Goal lives here
    goals: {},
  };
  const earned = badgeRules.earnedDates(donorId);
  st.badgesSeen = Object.keys(earned).filter((b) => earned[b] <= today);
  st.badgesShown = [...st.badgesSeen];
  const checkinMarker = firstCheckinMarker(st);
  if (st.plan && !st.plan.nextCheckin && checkinMarker) st.plan.nextCheckin = { date: addDays(today, CHECKIN_DAYS), marker: checkinMarker };
  for (const e of s.earlier || []) {
    st.cards.push({ id: id('c'), type: e.type, variant: e.type, status: 'answered', fresh: false, receipt: e.type === 'slots' ? `${e.receipt}. No real centre reservation was made.` : e.receipt, answeredOn: e.date, created: tickOf(e.date), createdOn: e.date, data: {} });
  }
  for (const o of s.open || []) openFromSeed(st, o);
  st.cards.filter((c) => c.status === 'open').forEach((c) => { c.created = tickOf(today); c.createdOn = today; });
  // Seeded open Cards were sent today
  const counted = st.cards.filter((c) => c.status === 'open' && c.counted).length;
  if (counted) { st.sentByDay[today] = counted; st.sentByWeek[weekStart(today)] = counted; }
  log(st, `Demo starts ${fmt(today)}.`);
  deliver(st);
  return st;
}

function openFromSeed(st, o) {
  const donorId = st.donorId;
  if (o.type === 'impact') {
    const component = store.getComponents(donorId).find((c) => c.id === o.componentId);
    st.keys[`impact:${component.donationId}`] = true;
    st.keys[`impact_more:${o.componentId}`] = true; // its Card tells this unit's story, so the report doesn't repeat it
    pushCard(st, 'impact', 'impact', { componentId: o.componentId, badgeId: storyBadge(st, o.componentId) }, { counted: true });
  } else if (o.type === 'checkin') {
    pushCard(st, 'checkin', o.marker, { marker: o.marker, mode: o.mode || null }, { counted: true });
  } else if (o.type === 'slots') {
    const el = health.eligibility(donorId);
    st.keys[`donate:${el.nextEligibleDate}`] = true;
    pushCard(st, 'slots', 'donate', { purpose: 'donate', reason: o.reason }, { counted: true });
  } else if (o.type === 'urgent') {
    const f = health.findings(donorId).find((x) => x.id === o.finding) || health.findings(donorId).find((x) => x.severity === 'urgent');
    st.keys[`urgent:${f.id}:${f.date}`] = true;
    pushCard(st, 'urgent', 'urgent', { findingId: f.id, date: f.date }, { urgent: true });
  }
}

function get(donorId) {
  if (!states.has(donorId)) states.set(donorId, create(donorId));
  return states.get(donorId);
}

/** The Donor's Goals now, in order, with the kept records brought up to date. */
function goalsOf(st) {
  return goalRules.sync(st.goals, st.donorId);
}

const activeGoals = (st) => goalsOf(st).filter((g) => g.state === 'active');

/** The first active Goal's marker when a Check-in Card can ask about it (BP or Hb). */
function firstCheckinMarker(st) {
  const g = activeGoals(st)[0];
  return g && CHECKIN_MARKERS.includes(g.target.marker) ? g.target.marker : null;
}

/** The haemoglobin a Donor needs, from their iron Goal's target, else the donation minimum. */
function hbTarget(st) {
  const g = goalsOf(st).find((x) => x.target && x.target.hb);
  return g ? g.target.hb : health.hbMin(store.getDonor(st.donorId));
}

function pushCard(st, type, variant, data, opts = {}) {
  const card = {
    id: id('c'), type, variant, data, status: 'open', fresh: false,
    created: nowTick(), createdOn: store.today(), counted: Boolean(opts.counted), urgent: Boolean(opts.urgent),
    snoozes: 0, eventKey: opts.eventKey || null, aiText: null,
  };
  st.cards.push(card);
  st.created += 1;
  return card;
}

/* ------------------------------------------------------------------ events */

function addEvent(st, ev) {
  if (st.keys[ev.key]) return;
  st.keys[ev.key] = true;
  st.events.push({ status: 'pending', priority: PRIORITY[ev.kind] || 6, ...ev });
}

/** Facts about the Donor that are new since their Drop state started. */
function detect(st) {
  const { donorId, createdOn } = st;
  const today = store.today();

  // Results arrive (a visit's lab panel becomes visible)
  for (const v of store.getDonations(donorId)) {
    const obs = store.getObservations(donorId).filter((o) => o.visitId === v.id);
    if (!obs.length) continue;
    const arrived = obs.reduce((max, o) => ((o.availableOn || o.date) > max ? (o.availableOn || o.date) : max), '');
    if (arrived >= createdOn) addEvent(st, { key: `results:${v.id}`, kind: 'results', at: arrived, data: { visitId: v.id } });
  }

  // Urgent findings
  for (const f of health.findings(donorId).filter((x) => x.severity === 'urgent')) {
    if (f.date >= createdOn) addEvent(st, { key: `urgent:${f.id}:${f.date}`, kind: 'urgent', at: f.date, data: { findingId: f.id, date: f.date } });
  }

  // Blood reaching patients: first unit per donation gets a Card, the rest go in the report
  const byDonation = {};
  for (const c of store.getComponents(donorId)) {
    const t = c.events.find((e) => e.type === 'transfused');
    if (!t || t.date > today || t.date < createdOn) continue;
    (byDonation[c.donationId] = byDonation[c.donationId] || []).push({ c, date: t.date });
  }
  for (const [donationId, list] of Object.entries(byDonation)) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    list.forEach(({ c, date }, i) => {
      if (i === 0 && !st.keys[`impact:${donationId}`]) {
        addEvent(st, { key: `impact:${donationId}`, kind: 'impact', at: date, data: { componentId: c.id } });
        // Its Card tells this unit's story, so the report doesn't repeat it. Marked by unit, not by place in the list:
        // a seeded Card's unit can be transfused before Drop started, and then the first unit listed here is a later one.
        st.keys[`impact_more:${c.id}`] = true;
      } else if (st.keys[`impact:${donationId}`]) {
        addEvent(st, { key: `impact_more:${c.id}`, kind: 'fold', foldOnly: true, at: date, data: { componentId: c.id } });
      }
    });
  }

  // Getting ready to donate again: three weeks before they can (someone who has never donated books their first from the Intro or Home)
  const ready = health.eligibility(donorId).lastDonationDate ? readiness(st) : null;
  if (ready) {
    const at = addDays(ready, -21) > createdOn ? addDays(ready, -21) : createdOn;
    if (at <= today) addEvent(st, { key: `donate:${ready}`, kind: 'donate', at, data: { from: ready } });
  }

  // Check-ins on the Plan's goal
  const next = st.plan && st.plan.nextCheckin;
  if (next && next.date <= today) addEvent(st, { key: `checkin:${next.marker}:${next.date}`, kind: 'checkin', at: next.date, data: { marker: next.marker } });
}

/** The date the Donor can next donate, as Drop sees it (a goal met at home counts until the next visit decides). */
function readiness(st) {
  const el = health.eligibility(st.donorId);
  if (el.nextEligibleDate) return el.nextEligibleDate;
  const blockers = health.findings(st.donorId).filter(health.blocksDonation);
  const onlyBp = blockers.length && blockers.every((f) => f.id === 'BP_GRADE1');
  const bp = latestReading(st, 'bp');
  if (onlyBp && bp && goalRules.bpReached(bp.s, bp.d) && el.lastDonationDate) {
    const date = addDays(el.lastDonationDate, el.gapDays);
    return date > store.today() ? date : store.today();
  }
  return null;
}

function latestReading(st, marker) {
  const list = st.readings.filter((r) => r.marker === marker);
  return list[list.length - 1] || null;
}

/* ------------------------------------------------------------------ delivery */

function budgetOf(st) {
  const b = BUDGETS[st.budgetKind];
  const today = store.today();
  return { ...b, kind: st.budgetKind, today: st.sentByDay[today] || 0, week: st.sentByWeek[weekStart(today)] || 0, weekOf: weekStart(today) };
}

function isReportDay(st, iso) {
  if (dow(iso) !== 0) return false;
  return BUDGETS[st.budgetKind].report === 'week' || Number(iso.slice(8, 10)) <= 7;
}

/** Run at every point of the demo clock. */
function deliver(st) {
  const { date: today, part } = store.clock();
  const now = nowTick();
  goalsOf(st); // a Goal is made, done or reopened as results arrive

  if (st.lastDate !== today) {
    // Yesterday's unanswered Reminders become "no answer"; hidden Cards come back on a new day
    st.cards.filter((c) => c.type === 'reminder' && c.variant === 'due' && c.status === 'open' && c.data.day < today).forEach((c) => {
      c.status = 'gone';
      st.reminderLog.push({ day: c.data.day, reminderId: c.data.reminderId, answer: 'no answer' });
      log(st, `${fmt(c.data.day)}: "${c.data.label}" got no answer.`);
    });
    st.cards.filter((c) => c.status === 'hidden').forEach((c) => { c.status = 'open'; });
    st.lastDate = today;
  }

  st.cards.filter((c) => c.status === 'snoozed' && c.until <= now).forEach((c) => {
    c.status = 'open';
    log(st, `${label(c)} came back from snooze (not counted again).`);
  });

  detect(st);
  const due = st.events.filter((e) => e.status === 'pending' && e.at <= today);

  // Urgent findings go straight through, any time of day
  due.filter((e) => e.kind === 'urgent').forEach((e) => send(st, e, { counted: false }));

  // The Donor's own Reminders, at the part of the day they chose (allowed in quiet hours)
  for (const r of st.reminders) {
    if (partOfTime(r.time) !== part) continue;
    if (st.cards.some((c) => c.type === 'reminder' && c.variant === 'due' && c.data.reminderId === r.id && c.data.day === today)) continue;
    pushCard(st, 'reminder', 'due', { reminderId: r.id, label: r.label, time: r.time, day: today });
  }

  if (part === NIGHT) {
    const waiting = due.filter((e) => e.status === 'pending' && !e.foldOnly);
    if (waiting.length) log(st, `Quiet hours: ${waiting.length} waiting until morning.`);
    return;
  }

  // Cards left unanswered for a week fold into the next report
  st.cards.filter((c) => c.status === 'open' && !c.urgent && c.type !== 'reminder' && c.type !== 'report' && dayNum(today) - dayNum(c.createdOn) >= EXPIRY_DAYS).forEach((c) => {
    c.status = 'folded';
    c.foldReason = 'unanswered for a week';
    log(st, `${label(c)} was unanswered for a week: it moves into the next report.`);
  });

  // Someone who has never donated has nothing to report yet
  if (part === 1 && isReportDay(st, today) && !st.reports[today] && store.getDonations(st.donorId).length) buildReport(st);

  // Cards that follow up on something the Donor did skip the budget
  due.filter((e) => e.status === 'pending' && e.prompted).forEach((e) => send(st, e, { counted: false }));

  const sendable = due.filter((e) => e.status === 'pending' && !e.foldOnly && e.kind !== 'urgent').sort((a, b) => a.priority - b.priority);
  if (!sendable.length) return;
  const b = budgetOf(st);
  if (b.today < b.perDay && b.week < b.perWeek) {
    send(st, sendable[0], { counted: true });
    if (sendable.length > 1) log(st, `${sendable.length - 1} more waiting: 1 new card a day.`);
  } else if (!sendable[0].loggedWait) {
    sendable[0].loggedWait = true;
    log(st, `"${eventName(sendable[0])}" is waiting: ${b.today >= b.perDay ? 'already 1 new card today' : `already ${b.perWeek} this week`}.`);
  }
}

function send(st, e, { counted }) {
  e.status = 'delivered';
  const map = {
    results: ['results', 'results'], goal: ['results', 'goal'], urgent: ['urgent', 'urgent'],
    impact: ['impact', 'impact'], donate: ['slots', 'donate'], checkin: ['checkin', e.data?.marker], postvisit: ['checkin', 'visit'],
  };
  const [type, variant] = map[e.kind];
  const extra = e.kind === 'impact' ? { badgeId: storyBadge(st, e.data.componentId) } : {};
  pushCard(st, type, variant, { ...(e.data || {}), ...extra, purpose: e.kind === 'donate' ? 'donate' : e.data?.purpose }, { counted, urgent: e.kind === 'urgent', eventKey: e.key });
  if (counted) {
    const today = store.today();
    st.sentByDay[today] = (st.sentByDay[today] || 0) + 1;
    st.sentByWeek[weekStart(today)] = (st.sentByWeek[weekStart(today)] || 0) + 1;
  }
  // Goals appear with the results, and so does the Plan they belong to: there is no "Save my Plan" step
  if (e.kind === 'results' && !st.plan && activeGoals(st).length) {
    st.plan = draftPlan();
    const first = firstCheckinMarker(st);
    if (first) st.plan.nextCheckin = { date: addDays(store.today(), CHECKIN_DAYS), marker: first };
  }
  log(st, `Sent "${eventName(e)}"${counted ? '' : ' (outside the budget)'}.`);
}

/* ------------------------------------------------------------------ Badges (spec section 5: earning one never sends a Card) */

/** The first Badge, in shelf order, that this unit completed and no Story or report has shown yet; marks it shown. */
function storyBadge(st, componentId) {
  const b = badgeRules.badges(st.donorId).find((x) => x.earned && x.completedBy?.componentId === componentId && !st.badgesShown.includes(x.id));
  if (!b) return null;
  st.badgesShown.push(b.id);
  return b.id;
}

/** Earned Badges the Donor hasn't opened or reached a slide for yet, in shelf order. */
function newBadges(donorId) {
  const st = get(donorId);
  return badgeRules.badges(donorId).filter((b) => b.earned && !st.badgesSeen.includes(b.id));
}

/** The Donor opened these Badges on the shelf, or reached the Story or report slide that shows them. */
function seeBadges(donorId, ids) {
  const st = get(donorId);
  for (const b of [].concat(ids || [])) if (!st.badgesSeen.includes(b)) st.badgesSeen.push(b);
  return { newBadges: newBadges(donorId).map((b) => b.id) };
}

function buildReport(st) {
  const today = store.today();
  st.reports[today] = true;
  const period = BUDGETS[st.budgetKind].report;
  const from = addDays(today, period === 'week' ? -6 : -27);
  const inPeriod = (d) => d >= from && d <= today;
  st.cards.filter((c) => c.type === 'report' && c.status === 'open').forEach((c) => { c.status = 'answered'; c.receipt = 'Report (replaced by a newer one)'; });

  const folded = st.events.filter((e) => e.status === 'pending' && e.at <= today && e.kind !== 'urgent');
  folded.forEach((e) => { e.status = 'folded'; });
  const foldedCards = st.cards.filter((c) => c.status === 'folded' && !c.reported);
  foldedCards.forEach((c) => { c.reported = true; });

  const slides = [];
  if (st.reminders.length) {
    const answers = st.reminderLog.filter((r) => inPeriod(r.day));
    const taken = answers.filter((r) => r.answer === 'taken').length;
    if (answers.length) slides.push(`Reminders: "taken" on ${taken} of ${answers.length} days.`);
  }
  if (st.plan && st.plan.activity) {
    let minutes = 0;
    for (let i = 0; i <= dayNum(today) - dayNum(from); i += 1) minutes += activityMinutes(st.donorId, addDays(from, i));
    const target = st.plan.activity.minutesPerWeek * (period === 'week' ? 1 : 4);
    slides.push(`Active minutes: ${minutes} of my ${target} goal (from my phone's step data, simulated).`);
  }
  const bp = st.readings.filter((r) => r.marker === 'bp' && inPeriod(r.date)).pop();
  if (bp) slides.push(`My latest BP: ${bp.s}/${bp.d}. Target: under ${goalRules.BP_TARGET.s}/${goalRules.BP_TARGET.d}.`);
  for (const e of folded.filter((x) => x.foldOnly)) slides.push(impactLine(st.donorId, e.data.componentId));
  for (const c of foldedCards) slides.push(`I put this off: ${words(st, c).text}`);
  const totals = impact.summarise(impact.donorJourneys(st.donorId));
  slides.push(`I have helped ${totals.patientsHelped} patients so far.`);
  // New Badges no Story has shown: one slide, no share buttons
  const fresh = badgeRules.badges(st.donorId).filter((b) => b.earned && !st.badgesSeen.includes(b.id) && !st.badgesShown.includes(b.id));
  let badgeSlide = null;
  if (fresh.length) {
    badgeSlide = { at: slides.length, ids: fresh.map((b) => b.id) };
    slides.push(`New Badge${fresh.length > 1 ? 's' : ''}: ${fresh.map((b) => b.name).join(', ')}. Share ${fresh.length > 1 ? 'them' : 'it'} from your Badges on My Impact.`);
    st.badgesShown.push(...badgeSlide.ids);
  }
  const ready = readiness(st);
  if (ready) slides.push(ready <= today ? 'I can donate now.' : `${dayNum(ready) - dayNum(today)} days until I can donate again.`);

  const waiting = folded.filter((e) => !e.foldOnly).map((e) => ({ key: e.key, name: eventName(e) }));
  pushCard(st, 'report', period, { slides, waiting, period, badgeSlide });
  log(st, `${period === 'week' ? 'Weekly' : 'Monthly'} report sent: ${slides.length} slides, ${folded.length + foldedCards.length} item(s) folded in.`);
}

function activityMinutes(donorId, iso) {
  let h = 0;
  for (const ch of `${donorId}${iso}`) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return 8 + (h % 28);
}

function impactLine(donorId, componentId) {
  const j = impact.donorJourneys(donorId).find((x) => x.id === componentId);
  if (!j || !j.recipient) return 'Another part of my donation reached a patient.';
  return `My ${j.name.toLowerCase()} from ${fmt(j.donationDate)} helped a patient: ${j.recipient.context.toLowerCase()} (${j.recipient.place}).`;
}

function eventName(e) {
  return {
    results: 'Results are in', goal: 'Goal reached', urgent: 'Urgent finding', impact: 'Your blood reached a patient',
    donate: 'Get ready to donate', checkin: 'Check-in', postvisit: 'How did the check-up go?', fold: 'More of your blood was used',
  }[e.kind] || e.kind;
}

/* ------------------------------------------------------------------ wording (rule-based; the AI may rewrite the text) */

// Free government primary-care clinic used for check-ups (synthetic). Day and evening doctors.
const CLINIC = {
  place: 'Ayushman Arogya Mandir',
  address: '8th Cross Road, Malleshwaram',
  day: { doctor: 'Dr. Kavya Rao', speciality: 'General physician' },
  evening: { doctor: 'Dr. Arvind Shetty', speciality: 'Family medicine' },
};
const BRING = ['Pratidaan on your phone, or your donor ID', 'Any recent lab reports', 'A list of medicines you take'];

/** Who to see, where, and why, for a check-up slot. */
function careDetails(st, time) {
  const district = store.getDonor(st.donorId).district;
  const who = time >= '17:00' ? CLINIC.evening : CLINIC.day;
  const reasons = health.findings(st.donorId).filter((f) => f.severity !== 'watch').slice(0, 2).map((f) => lcFirst(f.title));
  return {
    place: CLINIC.place, clinic: CLINIC.place, address: `${CLINIC.address}, ${district}`,
    doctor: who.doctor, speciality: who.speciality, cost: 'Free visit',
    reason: reasons.length ? `Review of ${reasons.join(' and ')}` : 'General health check-up',
    bring: BRING, durationMinutes: 20,
  };
}

function careSlots(st, { urgent } = {}) {
  const today = store.today();
  const evenings = st.memory.some((m) => /evening/i.test(m.text));
  const slot = (d, t) => ({ id: `care-${d}-${t.replace(':', '')}`, date: d, time: t, ...careDetails(st, t) });
  if (urgent) return [slot(today, '18:30'), slot(addDays(today, 1), '10:00')];
  const out = [];
  for (let i = 1; out.length < 3 && i < 21; i += 1) {
    const d = addDays(today, i);
    if (evenings ? [2, 4].includes(dow(d)) : dow(d) === 6) {
      (evenings ? ['18:30'] : ['10:00', '11:30']).forEach((t) => out.length < 3 && out.push(slot(d, t)));
    }
  }
  return out;
}

function donateSlots(st) {
  const prefersSaturday = st.memory.some((m) => /saturday/i.test(m.text));
  const list = donation.slots(st.donorId).slots;
  const pick = prefersSaturday ? list.filter((s) => dow(s.date) === 6) : list;
  return (pick.length ? pick : list).slice(0, 3);
}

const slotLabel = (s) => `${fmt(s.date)} · ${s.time}`;

function donateChipLabel(s) {
  const place = s.centre.replace(' Blood Centre', '').replace(' Community Blood Bank', '');
  return `${slotLabel(s)} · ${place}`;
}

function label(c) {
  return {
    'results:results': 'Results', 'results:goal': 'Goal reached', 'urgent:urgent': 'Urgent',
    'impact:impact': 'Impact', 'slots:donate': 'Donation slots', 'slots:care': 'Check-up', 'checkin:bp': 'Check-in · BP goal',
    'checkin:hb': 'Check-in · Hb goal', 'checkin:visit': 'Check-in', 'reminder:setup': 'Reminder', 'reminder:due': `Reminder · ${time12(c.data?.time || '21:00')}`,
    'report:week': 'Weekly report', 'report:month': 'Monthly report',
  }[`${c.type}:${c.variant}`] || c.type;
}

/** What a Card says and offers, from its data. */
function words(st, c) {
  const donorId = st.donorId;
  const donor = store.getDonor(donorId);
  const d = c.data || {};
  const hi = st.language === 'hi';
  switch (`${c.type}:${c.variant}`) {
    case 'impact:impact': {
      const j = impact.donorJourneys(donorId).find((x) => x.id === d.componentId);
      const r = j.recipient;
      const s = componentStory(donorId, j.id);
      // The Story ends on the Badge this unit completed, if any (and still true), else on the summary postcard
      const all = badgeRules.badges(donorId);
      const badge = d.badgeId && all.find((b) => b.id === d.badgeId && b.earned);
      return {
        text: `My ${j.name.toLowerCase()} from ${fmt(j.donationDate)} helped a patient: ${r.context.toLowerCase()} (${r.patient.toLowerCase()}, ${r.place}).`,
        main: { label: 'Watch the story', value: 'seen', story: true },
        story: s.slides,
        last: badge ? { badge, held: all.filter((b) => b.earned).length } : { postcard: s.postcard },
        badgeSlide: badge ? { at: s.slides.length, ids: [badge.id] } : null,
      };
    }
    case 'results:results': {
      const visit = store.getDonations(donorId).find((v) => v.id === d.visitId);
      const series = health.vitalsSeries(donorId).filter((v) => v.date <= visit.date).slice(-3).map((v) => v.systolic);
      const rising = series.length === 3 && series[0] < series[1] && series[1] < series[2];
      const acts = health.findings(donorId).filter((f) => f.severity !== 'watch');
      const others = health.findings(donorId).filter((f) => f.severity === 'watch' && f.concept !== 'hypertension').map((f) => lcFirst(f.title));
      if (!acts.length) return { text: `Your results from ${fmt(visit.date)} are in. All in the healthy range${others.length ? `, apart from ${others.join(' and ')} to watch` : ''}. Nothing to do.`, main: { label: 'Got it', value: 'ok' } };
      const results = `Your results from ${fmt(visit.date)} are in. BP ${visit.vitals.systolic}/${visit.vitals.diastolic}${rising ? `, up for the third donation in a row (${series.join(', ')})` : ''}. ${acts.length > 1 ? `Also: ${acts.filter((f) => f.concept !== 'hypertension').map((f) => lcFirst(f.title)).join(', ')}. ` : ''}`;
      const live = activeGoals(st);
      const book = { label: 'Try check-up slots', value: 'book' };
      const explain = { label: 'Explain my results', value: 'explain', ask: 'Can you explain my latest results?' };
      // The button opens the Goal's Chat in the side sheet
      if (live.length) {
        return {
          text: `${results}${live.length > 1 ? 'Your Goals' : 'Your Goal'}: ${live.map((g) => g.name).join(' and ')}, on My health. Worth discussing with a real clinician; check-up slots contact no clinic.`,
          main: { label: `Open ${live[0].name}`, value: 'goal', open: goalChat(st, live[0]) },
          chips: [book, explain],
        };
      }
      return { text: `${results}Worth discussing with a real clinician. Want to try check-up slots? No clinic will be contacted.`, main: book, chips: [explain] };
    }
    case 'results:goal': {
      if (d.marker === 'hb') return { text: `Hb ${d.value}. You did it: that's above ${d.target}, so you can donate again.`, main: { label: 'Try donation slots', value: 'book' }, out: { label: 'Later', value: 'ok' } };
      return { text: `BP ${d.s}/${d.d}. You reached your target of under ${goalRules.BP_TARGET.s}/${goalRules.BP_TARGET.d}. Your next donation will confirm it.`, main: { label: 'Nice', value: 'ok' } };
    }
    case 'urgent:urgent': {
      const f = health.findings(donorId).find((x) => x.id === d.findingId) || { detail: '' };
      return {
        text: `${f.title}: ${f.detail}${d.date ? ` on ${fmt(d.date)}` : ''}. Please seek real medical care today; these times are not clinic appointments.`,
        chips: [...careSlots(st, { urgent: true }).map((s) => ({ label: slotLabel(s), value: { slotId: s.id } })), { label: 'I will seek real care', value: 'call' }],
      };
    }
    case 'slots:care': {
      const evenings = st.memory.some((m) => /evening/i.test(m.text));
      const saturdays = st.memory.some((m) => /saturday/i.test(m.text));
      const who = evenings ? CLINIC.evening : CLINIC.day;
      return {
        text: `Check-up options with ${who.doctor} (${who.speciality}) at ${CLINIC.place}, ${CLINIC.address}. No real clinic is reserved. ${evenings ? 'Weekday evenings:' : saturdays ? 'These suit your Saturdays:' : 'Available times:'}`,
        chips: [...careSlots(st).map((s) => ({ label: slotLabel(s), value: { slotId: s.id } })), ...(evenings ? [] : [{ label: 'Weekday evenings instead', value: 'evenings' }])],
      };
    }
    case 'slots:donate': {
      const slots = donateSlots(st);
      const shortage = d.reason === 'shortage';
      const from = d.from && d.from > store.today() ? d.from : null;
      if (hi) {
        return {
          text: `${shortage ? `${donor.bloodGroup} की कमी ${slots[0]?.centre || 'रक्त केंद्र'} पर है। ` : ''}${from ? `आप ${fmt(from)} से रक्तदान कर सकते हैं।` : 'आप अभी रक्तदान कर सकते हैं।'} कौन-सा समय ठीक रहेगा? यह किसी वास्तविक केंद्र में स्थान आरक्षित नहीं करता।`,
          chips: slots.map((s) => ({ label: donateChipLabel(s), value: { slotId: s.id } })),
          label: 'रक्तदान',
        };
      }
      return {
        text: `${shortage ? `${donor.bloodGroup} is in short supply at ${slots[0]?.centre || 'the blood centre'}. ` : ''}${from ? `You can donate from ${fmt(from)}.` : 'You can donate now.'} Pick a time below. This does not reserve a place at a real centre.`,
        chips: slots.map((s) => ({ label: donateChipLabel(s), value: { slotId: s.id } })),
      };
    }
    case 'checkin:visit':
      return { text: 'How did the check-up go? If you saw a clinician, did they start you on anything?', chips: [{ label: 'Started a tablet', value: 'tablet' }, { label: 'No tablet, just walking', value: 'walking' }, { label: "Didn't go", value: 'missed' }] };
    case 'checkin:bp': {
      const last = latestReading(st, 'bp') || lastVisitBp(donorId);
      return { text: `Got a BP reading this week? A pharmacy machine is fine. Last: ${last.s}/${last.d}.`, wheel: { kind: 'bp', s: last.s, d: last.d }, main: { label: 'Save reading', value: 'wheel' }, out: { label: 'No reading this week', value: 'none' } };
    }
    case 'checkin:hb': {
      const visits = health.vitalsSeries(donorId);
      const lastHb = latestReading(st, 'hb')?.value || visits[visits.length - 1]?.haemoglobin;
      return { text: `Had a blood test lately? Add the report and I'll update your Goal (Hb ${hbTarget(st).toFixed(1)} or more). Last: ${lastHb}.`, upload: true, main: { label: 'Add a report', value: 'upload' }, out: { label: 'Not yet', value: 'none' } };
    }
    case 'reminder:setup':
      return { text: `Want a daily reminder${d.label ? ` for "${d.label}"` : ' for your tablet'}?`, chips: [{ label: '9 pm', value: { time: '21:00' } }, { label: '10 pm', value: { time: '22:00' } }], out: { label: 'No thanks', value: 'none' } };
    case 'reminder:due':
      return { text: d.label, chips: [{ label: 'Taken', value: 'taken' }, { label: 'Skipped', value: 'skipped' }] };
    case 'report:week':
    case 'report:month':
      return {
        text: `My ${d.period}, in ${d.slides.length} tap${d.slides.length === 1 ? '' : 's'}.`,
        main: { label: `Watch my ${d.period}`, value: 'seen', story: true },
        story: d.slides,
        badgeSlide: d.badgeSlide || null,
        chips: (d.waiting || []).map((w) => ({ label: `Still waiting: ${w.name}`, value: { pull: w.key } })),
      };
    default:
      return { text: c.receipt || '' };
  }
}

function lastVisitBp(donorId) {
  const v = health.vitalsSeries(donorId).pop();
  return { s: v.systolic, d: v.diastolic };
}

/** The Plan's other parts; its Goals come from the results (goals.js). */
function draftPlan() {
  return { activity: { label: '150 minutes of brisk walking a week', minutesPerWeek: 150 }, notes: [], createdOn: store.today() };
}

/* ------------------------------------------------------------------ answers */

function findCard(st, cardId) {
  const c = st.cards.find((x) => x.id === cardId);
  if (!c) throw new Error('Card not found');
  return c;
}

function answer(donorId, cardId, value) {
  const st = get(donorId);
  const c = findCard(st, cardId);
  if (c.status !== 'open') throw new Error('That card is no longer open');
  const snapshot = clone({ ...st, undo: null });
  const effects = [];
  const done = (receipt) => { c.status = 'answered'; c.fresh = true; c.receipt = receipt; c.answeredOn = store.today(); };
  // When the answer opens a follow-up Card, that Card is the response: no receipt on Home, just a line in Earlier
  const handOff = (receipt) => { done(receipt); c.fresh = false; };
  const today = store.today();

  switch (`${c.type}:${c.variant}`) {
    case 'impact:impact': done('Story watched · kept in Impact'); break;
    case 'report:week':
    case 'report:month':
      if (value && value.pull) {
        const e = st.events.find((x) => x.key === value.pull);
        if (e) { e.status = 'pending'; e.prompted = true; send(st, e, { counted: false }); }
        c.data.waiting = (c.data.waiting || []).filter((w) => w.key !== value.pull);
        return finish(st, null, null);
      }
      done(`${c.variant === 'week' ? 'Weekly' : 'Monthly'} report seen`);
      break;
    case 'results:results':
      if (value === 'book') { handOff('Results seen · chose check-up options'); pushCard(st, 'slots', 'care', { purpose: 'care' }); } else if (value === 'goal') done(`Results seen · opened ${activeGoals(st)[0]?.name || 'your Goal'}`); else done('Results seen · in Health');
      break;
    case 'results:goal':
      // Goal reached: Drop keeps an eye on it monthly instead of every two weeks
      if (st.plan?.nextCheckin) st.plan.nextCheckin = { date: addDays(today, 28), marker: st.plan.nextCheckin.marker };
      if (value === 'book') { handOff('Goal reached · chose a donation slot'); pushCard(st, 'slots', 'donate', { purpose: 'donate' }); } else done('Goal reached · in your Plan');
      break;
    case 'slots:care':
      if (value === 'evenings') {
        remember(st, 'Weekday evenings suit you', /saturday|evening|weekend/i);
        return finish(st, null, null);
      }
      {
        const slot = careSlots(st).find((s) => s.id === value?.slotId);
        if (!slot) throw new Error('That slot is not available');
        const booking = { ...slot, id: id('b'), kind: 'care', slotId: slot.id, bookedOn: today };
        st.bookings.push(booking);
        addEvent(st, { key: `postvisit:${booking.id}`, kind: 'postvisit', at: addDays(slot.date, 1), prompted: true, data: { bookingId: booking.id } });
        done(`Booked ${slotLabel(slot)} with ${slot.doctor} · ${slot.clinic}. No clinic reservation was made.`);
      }
      break;
    case 'slots:donate': {
      const appointment = donation.book(donorId, { slotId: value?.slotId });
      effects.push({ appointment: appointment.id });
      st.bookings.push({ id: appointment.id, kind: 'donate', guided: false, date: appointment.date, time: appointment.time, place: appointment.centre });
      done(`Booked to donate: ${slotLabel(appointment)} · ${appointment.centre}. Saved in this session; no centre reservation was made.`);
      break;
    }
    case 'urgent:urgent':
      if (value === 'call') done('Acknowledged. No clinic was called; please seek real medical care today.');
      else {
        const slot = careSlots(st, { urgent: true }).find((s) => s.id === value?.slotId);
        if (!slot) throw new Error('That slot is not available');
        st.bookings.push({ ...slot, id: id('b'), kind: 'care', slotId: slot.id, bookedOn: today, urgent: true });
        done(`Booked ${slotLabel(slot)} with ${slot.doctor}. No clinic reservation was made; please seek real care today.`);
      }
      break;
    case 'checkin:visit':
      if (value === 'tablet') {
        st.plan = st.plan || draftPlan();
        st.plan.notes = [...(st.plan.notes || []), 'Started a BP tablet from your doctor'];
        pushCard(st, 'reminder', 'setup', {});
        done('Saved to your Plan: started a BP tablet');
      } else if (value === 'missed') {
        pushCard(st, 'slots', 'care', { purpose: 'care' });
        handOff('Check-up marked missed · choosing another time');
      } else {
        if (st.plan) st.plan.nextCheckin = { date: addDays(today, CHECKIN_DAYS), marker: 'bp' };
        done('Saved to your Plan: walking, no tablet');
      }
      break;
    case 'reminder:setup':
      if (value && value.time) {
        const reminderLabel = c.data.label || 'BP tablet';
        st.reminders.push({ id: id('r'), label: reminderLabel, time: value.time });
        done(`Reminder set: ${reminderLabel} at ${time12(value.time)} daily · in your Plan`);
      } else done('No reminder. You can set one any time.');
      if (st.plan) st.plan.nextCheckin = { date: addDays(today, CHECKIN_DAYS), marker: 'bp' };
      break;
    case 'reminder:due':
      st.reminderLog.push({ day: c.data.day, reminderId: c.data.reminderId, answer: value });
      done(`${value === 'taken' ? 'Taken' : 'Skipped'} · logged in your Plan`);
      break;
    case 'checkin:bp':
      if (value === 'none') {
        if (st.plan) st.plan.nextCheckin = { date: addDays(today, CHECKIN_DAYS), marker: 'bp' };
        done("Okay. I'll ask again in 2 weeks.");
      } else {
        const s = Math.round(Number(value.s));
        const d = Math.round(Number(value.d));
        if (!(s >= 70 && s <= 250 && d >= 40 && d <= 150)) throw new Error('That reading looks out of range');
        st.readings.push({ id: id('rd'), marker: 'bp', s, d, date: today });
        if (goalRules.bpReached(s, d)) addEvent(st, { key: `goal:bp:${today}`, kind: 'goal', at: addDays(today, 1), prompted: true, data: { marker: 'bp', s, d } });
        else if (st.plan) st.plan.nextCheckin = { date: addDays(today, CHECKIN_DAYS), marker: 'bp' };
        done(`${s}/${d} saved to Health`);
      }
      break;
    case 'checkin:hb':
      if (value === 'none') {
        if (st.plan) st.plan.nextCheckin = { date: addDays(today, CHECKIN_DAYS), marker: 'hb' };
        done("Okay. I'll ask again in 2 weeks.");
      } else {
        const v = Number(value.value);
        if (!(v >= 3 && v <= 25)) throw new Error('That Hb value looks out of range');
        const obsId = `OBS-${donorId}-DROP-${BOOT}-${seq++}`;
        store.addObservations(donorId, [{ id: obsId, donorId, visitId: null, code: '718-7', key: 'hb', name: 'Haemoglobin', value: v, unit: 'g/dL', low: 12, high: 15.5, date: value.date || today, source: 'uploaded_report', labId: null }]);
        effects.push({ observation: obsId });
        st.readings.push({ id: id('rd'), marker: 'hb', value: v, date: value.date || today, observationId: obsId });
        const target = hbTarget(st);
        if (v >= target) addEvent(st, { key: `goal:hb:${today}`, kind: 'goal', at: today, prompted: true, data: { marker: 'hb', value: v, target } });
        done(`Hb ${v} saved to Health${value.source ? ` (from ${value.source})` : ''}`);
      }
      break;
    default:
      done('Done');
  }
  return finish(st, { cardId: c.id, snapshot, effects }, c);
}

function finish(st, undo, card) {
  st.undo = undo;
  if (card) log(st, `${label(card)} answered: ${card.receipt}`);
  deliver(st); // follow-ups the answer made due (e.g. Meera's goal card) appear straight away
  return view(st.donorId);
}

function undo(donorId) {
  const st = get(donorId);
  if (!st.undo) throw new Error('Nothing to undo');
  for (const e of st.undo.effects) {
    if (e.observation) store.removeObservation(donorId, e.observation);
    if (e.appointment) {
      const list = store.session.appointments.get(donorId) || [];
      store.session.appointments.set(donorId, list.filter((a) => a.id !== e.appointment));
    }
  }
  const restored = st.undo.snapshot;
  restored.undo = null;
  // Undo can't unsee or unshow a Badge
  restored.badgesSeen = [...new Set([...restored.badgesSeen, ...st.badgesSeen])];
  restored.badgesShown = [...new Set([...restored.badgesShown, ...st.badgesShown])];
  states.set(donorId, restored);
  log(restored, 'Undone.');
  return view(donorId);
}

/* ------------------------------------------------------------------ bookings */

/** Cancel a booked check-up or donation, optionally offering new slots straight away (Change). */
function cancelBooking(donorId, bookingId, { reschedule = false } = {}) {
  const st = get(donorId);
  const b = st.bookings.find((x) => x.id === bookingId);
  if (!b) throw new Error('Booking not found');
  if (b.kind === 'donate' && b.guided) throw new Error('To change or cancel this guided donation booking, use Donate. Any connected Google Calendar event must be handled there.');
  st.bookings = st.bookings.filter((x) => x.id !== bookingId);
  // The "How did it go?" check-in for a cancelled visit never comes
  st.events.filter((e) => e.key === `postvisit:${bookingId}` && e.status === 'pending').forEach((e) => { e.status = 'cancelled'; });
  if (b.kind === 'donate') {
    const list = store.session.appointments.get(donorId) || [];
    store.session.appointments.set(donorId, list.filter((a) => a.id !== bookingId));
  }
  st.undo = null;
  if (reschedule) {
    const existing = st.cards.find((c) => c.status === 'open' && c.type === 'slots' && c.variant === (b.kind === 'donate' ? 'donate' : 'care'));
    if (!existing) pushCard(st, 'slots', b.kind === 'donate' ? 'donate' : 'care', { purpose: b.kind === 'donate' ? 'donate' : 'care' });
  }
  log(st, `${reschedule ? 'Changing' : 'Cancelled'} ${b.kind === 'donate' ? 'donation booking' : 'check-up'} on ${fmt(b.date)} ${b.time}; no external reservation changed.`);
  return view(donorId);
}

/** A donation booked through the guided booking chat also shows under "Coming up". */
function recordBooking(donorId, appointment) {
  const st = get(donorId);
  if (st.bookings.some((x) => x.id === appointment.id)) return;
  st.bookings.push({ id: appointment.id, kind: 'donate', guided: true, date: appointment.date, time: appointment.time, place: appointment.centre });
  log(st, `Guided donation booking recorded: ${slotLabel(appointment)} · ${appointment.centre}. Use Donate to change or cancel it.`);
}

function forgetBooking(donorId, bookingId) {
  const st = get(donorId);
  st.bookings = st.bookings.filter((x) => x.id !== bookingId);
}

/* ------------------------------------------------------------------ snooze, hide, memory, readings */

function snooze(donorId, cardId, option) {
  const st = get(donorId);
  const c = findCard(st, cardId);
  const { date: today, part } = store.clock();
  if (c.urgent && option !== 'hour') throw new Error('Urgent cards can only wait an hour');
  const now = nowTick();
  const until = { hour: now + 1, tonight: part < 2 ? tickOf(today, 2) : now + 1, tomorrow: tickOf(addDays(today, 1), 0), week: tickOf(addDays(today, 7), 0) }[option];
  if (until == null) throw new Error('Unknown snooze option');
  c.snoozes += 1;
  st.undo = null;
  if (c.snoozes >= MAX_SNOOZES && !c.urgent) {
    c.status = 'folded';
    c.foldReason = 'snoozed three times';
    log(st, `${label(c)} snoozed three times: it moves into the next report.`);
  } else {
    c.status = 'snoozed';
    c.until = until;
    log(st, `${label(c)} snoozed (${option}).`);
  }
  return view(donorId);
}

function hide(donorId, cardId) {
  const st = get(donorId);
  const c = findCard(st, cardId);
  if (c.urgent) throw new Error("Urgent cards can't be hidden");
  c.status = 'hidden';
  st.undo = null;
  log(st, `${label(c)} hidden for now.`);
  return view(donorId);
}

/** Closing and reopening the app brings hidden Cards back. */
function reopen(donorId) {
  const st = get(donorId);
  st.cards.filter((c) => c.status === 'hidden').forEach((c) => { c.status = 'open'; });
  return view(donorId);
}

function remember(st, text, replaces) {
  const old = replaces ? st.memory.filter((m) => replaces.test(m.text)) : [];
  st.memory = st.memory.filter((m) => !old.includes(m));
  st.memory.push({ id: id('m'), text, createdOn: store.today() });
  st.memory = st.memory.slice(-20);
  st.memReceipt = { text: `Remembered: ${text.charAt(0).toLowerCase()}${text.slice(1)}${old.length ? ` (replaces "${old.map((m) => m.text).join('", "')}")` : ''}`, previous: old };
  log(st, st.memReceipt.text);
}

function forget(donorId, memoryId) {
  const st = get(donorId);
  st.memory = memoryId ? st.memory.filter((m) => m.id !== memoryId) : [];
  st.memReceipt = null;
  log(st, memoryId ? 'A memory was deleted.' : 'All memories deleted.');
  return view(donorId);
}

/** Undo for the "Remembered: …" line. */
function undoMemory(donorId) {
  const st = get(donorId);
  if (!st.memReceipt) throw new Error('Nothing to undo');
  const added = st.memory[st.memory.length - 1];
  st.memory = [...st.memory.slice(0, -1), ...st.memReceipt.previous];
  st.memReceipt = null;
  log(st, `Forgot: ${added.text}`);
  return view(donorId);
}

function deleteReading(donorId, readingId) {
  const st = get(donorId);
  const r = st.readings.find((x) => x.id === readingId);
  if (!r) throw new Error('Reading not found');
  if (r.observationId) store.removeObservation(donorId, r.observationId);
  st.readings = st.readings.filter((x) => x.id !== readingId);
  log(st, 'A reading you added was deleted.');
  return view(donorId);
}

function hideResult(donorId, observationId) {
  const st = get(donorId);
  if (!st.hiddenResults.includes(observationId)) st.hiddenResults.push(observationId);
  return view(donorId);
}

/* ------------------------------------------------------------------ views */

function cardView(st, c) {
  const w = words(st, c);
  // AI wording is used only while it was written for exactly what the rules say now
  const ai = Boolean(c.aiText) && c.aiFor === signature(w);
  // Keep simulation warnings and action labels intact even when the AI rewrites other cards.
  const demoBookingCard = c.type === 'slots' || c.type === 'urgent';
  const l = (!demoBookingCard && ai && c.aiLabels) || {};
  const relabel = (a, name) => (a && name ? { ...a, label: name } : a || null);
  return {
    id: c.id, type: c.type, variant: c.variant, label: w.label || label(c), urgent: c.urgent, counted: c.counted, createdOn: c.createdOn,
    text: demoBookingCard ? w.text : ai ? c.aiText : w.text, ruleText: w.text, byAi: ai && !demoBookingCard,
    main: relabel(w.main, l.main), out: relabel(w.out, l.out),
    chips: (w.chips || []).map((chip, i) => relabel(chip, l.chips?.[i])), wheel: w.wheel || null,
    upload: Boolean(w.upload), story: w.story || null, last: w.last || null, badgeSlide: w.badgeSlide || null, snoozes: c.snoozes,
  };
}

function view(donorId) {
  const st = get(donorId);
  const b = budgetOf(st);
  const ready = readiness(st);
  const today = store.today();
  const open = st.cards.filter((c) => c.status === 'open').sort((a, z) => (z.urgent - a.urgent) || (z.created - a.created));
  return {
    clock: store.clock(),
    intro: require('./intro').status(donorId), // required here: intro.js uses this module
    language: st.language,
    preferredLanguage: store.getDonor(donorId).language,
    open: open.map((c) => cardView(st, c)),
    receipts: st.cards.filter((c) => c.status === 'answered' && c.fresh).map((c) => ({ id: c.id, receipt: c.receipt, undo: st.undo?.cardId === c.id })),
    earlier: st.cards.filter((c) => c.status === 'answered' && !c.fresh).sort((a, z) => z.created - a.created).slice(0, 30).map((c) => ({ id: c.id, label: label(c), receipt: c.receipt, on: c.answeredOn })),
    memory: st.memory.map(({ id: mid, text }) => ({ id: mid, text })),
    memReceipt: st.memReceipt ? st.memReceipt.text : null,
    plan: st.plan ? { ...st.plan, reminders: st.reminders } : (st.reminders.length ? { activity: null, notes: [], reminders: st.reminders } : null),
    goals: goalsOf(st).map((g) => goalView(st, g)),
    keepAnEye: goalRules.keepAnEye(donorId).map(({ id: fid, title, detail }) => ({ id: fid, title, detail })),
    readings: st.readings,
    hiddenResults: st.hiddenResults,
    bookings: st.bookings.filter((x) => x.date >= today).sort((a, z) => `${a.date}${a.time}`.localeCompare(`${z.date}${z.time}`)),
    donate: { from: ready, daysTo: ready ? Math.max(0, dayNum(ready) - dayNum(today)) : null },
    budget: { kind: b.kind, today: b.today, perDay: b.perDay, week: b.week, perWeek: b.perWeek, weekOf: b.weekOf, report: b.report, quiet: store.clock().part === NIGHT },
    waiting: st.events.filter((e) => e.status === 'pending' && e.at <= today).map((e) => ({ name: eventName(e), foldOnly: Boolean(e.foldOnly) })),
    later: st.cards.filter((c) => ['snoozed', 'hidden', 'folded'].includes(c.status)).map((c) => ({ label: label(c), status: c.status, snoozes: c.snoozes, reason: c.foldReason || null })),
    upcoming: st.events.filter((e) => e.status === 'pending' && e.at > today).sort((a, z) => a.at.localeCompare(z.at)).slice(0, 4).map((e) => ({ name: eventName(e), on: e.at })),
    log: st.log.slice(0, 10),
  };
}

/** The facts code writes for a Goal; its trend includes the readings the Donor added. */
const goalFacts = (st, g) => goalRules.facts(g, st.donorId, (marker) => chartPoints(st.donorId, marker));

/**
 * What opens a Goal's Chat in the side sheet: Drop's opening line and questions, by the Goal's state (ticket 01).
 * Up next stays open both ways but offers no Week plans; done and stopped are read-only.
 * `answers` are fixed replies to a question, given by rules rather than the copilot.
 */
function goalChat(st, g, facts) {
  if (g.state === 'done') return { goalId: g.id, text: `${g.name} is done: your results on ${fmt(g.doneOn)} left it at "watch" or better. This Chat is read-only now.`, questions: [] };
  if (g.state === 'stopped') return { goalId: g.id, text: `You stopped ${g.name} on ${fmt(g.stoppedOn)}. This Chat is read-only; Start again picks it back up.`, questions: [] };
  const { trend } = facts || goalFacts(st, g);
  const why = `Why does my ${g.name} Goal matter?`;
  const chart = `Show my ${trend.label} trend`;
  if (g.state === 'upnext') {
    const start = 'Can I start it now?';
    return {
      goalId: g.id,
      text: `${g.name} is up next: it starts when ${g.startsWhen} is done. Target: ${lcFirst(g.target.text)}. ${trend.words}: ${trend.range}.`,
      questions: [start, why, chart],
      answers: { [start]: `It starts when ${g.startsWhen} is done. What you do for Movement helps it too.` },
    };
  }
  return {
    goalId: g.id,
    text: `${g.name}. Target: ${lcFirst(g.target.text)}. ${trend.words}: ${trend.range}.`,
    questions: ['What could I do this week?', why, chart],
  };
}

/** A Goal as the app shows it: name, state, target, the write-up and the facts code writes. */
function goalView(st, g) {
  if (g.state === 'done') return { id: g.id, name: g.name, state: g.state, createdOn: g.createdOn, doneOn: g.doneOn, chat: goalChat(st, g) };
  const facts = goalFacts(st, g);
  return {
    id: g.id, name: g.name, state: g.state, severity: g.severity, stopsDonation: g.stopsDonation, target: g.target.text,
    createdOn: g.createdOn, startsWhen: g.startsWhen || null, stoppedOn: g.stoppedOn || null, findings: g.findings.map((f) => f.id), writeup: g.writeup,
    ...facts, chat: goalChat(st, g, facts),
  };
}

/** "Stop this Goal", from its Chat. An urgent Goal can't be stopped (goals.js throws). */
function stopGoal(donorId, goalId) {
  const st = get(donorId);
  goalRules.stop(st.goals, donorId, goalId);
  log(st, `Goal stopped: ${st.goals[goalId].name}.`);
  return view(donorId);
}

/** "Start again" on a stopped Goal: back to active if there's room, otherwise Up next. */
function startGoalAgain(donorId, goalId) {
  const st = get(donorId);
  goalRules.startAgain(st.goals, donorId, goalId);
  log(st, `Goal started again: ${st.goals[goalId].name}.`);
  return view(donorId);
}

/** Facts for the AI writer and the copilot: the open Cards with their data and rule wording. */
/** What the rules currently say on a Card; AI wording only applies while it matches. */
function signature(w) {
  return JSON.stringify([w.text, w.main?.label, w.out?.label, (w.chips || []).map((c) => c.label)]);
}

/** Open Cards whose current wording the AI hasn't written (or tried) yet; marks them as tried. */
function openForWriting(donorId) {
  const st = get(donorId);
  const out = [];
  for (const c of st.cards.filter((x) => x.status === 'open')) {
    const w = words(st, c);
    const sig = signature(w);
    if (c.aiFor === sig || c.aiTriedFor === sig) continue;
    c.aiTriedFor = sig;
    out.push({ card: c, words: w, sig });
  }
  return out;
}

function setAi(donorId, cardId, { text, labels, sig }) {
  const c = get(donorId).cards.find((x) => x.id === cardId);
  if (!c || !text) return;
  c.aiText = text;
  c.aiLabels = labels || null;
  c.aiFor = sig;
}

/* ------------------------------------------------------------------ chat helpers */

const LANGUAGES = ['en', 'hi', 'kn', 'ta', 'te', 'ml'];

/** Which language Drop writes in for this Donor (English or their own). Open Cards are rewritten. */
function setLanguage(donorId, language) {
  if (!LANGUAGES.includes(language)) throw new Error('Unsupported language');
  const st = get(donorId);
  st.language = language;
  st.cards.filter((c) => c.status === 'open').forEach((c) => { c.aiText = null; c.aiLabels = null; c.aiFor = null; c.aiTriedFor = null; });
  return view(donorId);
}

/** A Card the Donor asked for in chat (slots or a reminder offer): outside the budget, also shown on Home. */
function offerCard(donorId, kind, data = {}) {
  const st = get(donorId);
  const spec = { care_slots: ['slots', 'care', { purpose: 'care' }], reminder: ['reminder', 'setup', { label: data.label || null }] }[kind];
  if (!spec) throw new Error(`Unknown card kind ${kind}`);
  const existing = st.cards.find((c) => c.status === 'open' && c.type === spec[0] && c.variant === spec[1]);
  const card = existing || pushCard(st, spec[0], spec[1], spec[2]);
  log(st, `Opened ${label(card)} from the chat (outside the budget).`);
  return cardView(st, card);
}

/** A reading the Donor typed in chat ("my BP was 141/90 today"). */
function logReading(donorId, { s, d }) {
  const st = get(donorId);
  const sys = Math.round(Number(s));
  const dia = Math.round(Number(d));
  if (!(sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150 && sys > dia)) throw new Error('That reading looks out of range');
  const today = store.today();
  st.readings.push({ id: id('rd'), marker: 'bp', s: sys, d: dia, date: today });
  if (goalRules.bpReached(sys, dia)) addEvent(st, { key: `goal:bp:${today}`, kind: 'goal', at: addDays(today, 1), prompted: true, data: { marker: 'bp', s: sys, d: dia } });
  log(st, `BP ${sys}/${dia} saved from the chat.`);
  return `${sys}/${dia} saved to Health`;
}

/** Facts Drop reads on every chat turn: what it remembers and the Plan. */
function chatContext(donorId) {
  const st = get(donorId);
  const goalLines = goalsOf(st).filter((g) => g.state !== 'done').map((g) => `Goal${g.state === 'active' ? '' : ` (${g.state === 'upnext' ? 'Up next' : g.state})`}: ${g.name}, target ${lcFirst(g.target.text)}`);
  const plan = [...goalLines, ...(st.plan ? [st.plan.activity?.label, ...(st.plan.notes || [])] : [])].filter(Boolean);
  const last = latestReading(st, 'bp');
  return {
    language: st.language,
    memory: st.memory.map((m) => m.text),
    plan,
    reminders: st.reminders.map((r) => `${r.label} at ${time12(r.time)}`),
    latestReading: last ? `BP ${last.s}/${last.d} on ${last.date}` : null,
    openCards: st.cards.filter((c) => c.status === 'open').map((c) => label(c)),
    // Each live Goal's write-up, so Drop's advice follows its steps (an urgent Goal has no Movement step)
    goals: goalsOf(st).filter((g) => g.state !== 'done' && g.writeup).map((g) => ({
      id: g.id, name: g.name, state: g.state, urgent: g.severity === 'urgent', target: g.target.text,
      why: g.writeup.why, steps: g.writeup.steps.map((x) => `${x.tag}: ${x.text}`),
    })),
  };
}

/** Points for a Chart Card: donation-day readings plus the ones the Donor added. */
function chartPoints(donorId, marker) {
  const st = get(donorId);
  if (marker === 'bp') {
    return [
      ...health.vitalsSeries(donorId).map((v) => ({ date: v.date, value: v.systolic, value2: v.diastolic, source: 'donation' })),
      ...st.readings.filter((r) => r.marker === 'bp').map((r) => ({ date: r.date, value: r.s, value2: r.d, source: 'yours' })),
    ].sort((a, z) => a.date.localeCompare(z.date));
  }
  if (marker === 'weight') return health.vitalsSeries(donorId).map((v) => ({ date: v.date, value: v.weightKg, source: 'donation' }));
  if (marker === 'hb') {
    const fromVisits = health.vitalsSeries(donorId).map((v) => ({ date: v.date, value: v.haemoglobin, source: 'donation' }));
    const fromReports = store.getObservations(donorId).filter((o) => o.key === 'hb' && o.source === 'uploaded_report').map((o) => ({ date: o.date, value: o.value, source: 'report' }));
    return [...fromVisits, ...fromReports].sort((a, z) => a.date.localeCompare(z.date));
  }
  return (health.labSeries(donorId)[marker] || []).map((o) => ({ date: o.date, value: o.value, source: o.source }));
}

/* ------------------------------------------------------------------ demo clock */

store.onStep(() => {
  for (const st of states.values()) {
    // Time moved on: fresh receipts fold into "Earlier this cycle", the memory line and Undo go away
    st.cards.filter((c) => c.fresh).forEach((c) => { c.fresh = false; });
    st.memReceipt = null;
    st.undo = null;
    deliver(st);
  }
});
store.onReset(() => { states.clear(); seed = null; });

/** Demo "Next event": move the clock until this Donor gets a new Card, not counting their routine Reminders (max two months). */
function nextEvent(donorId) {
  const st = get(donorId);
  const count = () => st.cards.filter((c) => !(c.type === 'reminder' && c.variant === 'due')).length;
  const before = count();
  for (let i = 0; i < PARTS * 60; i += 1) {
    store.stepClock();
    if (count() > before) break;
  }
  return store.clock();
}

module.exports = {
  get, view, answer, undo, snooze, cancelBooking, recordBooking, forgetBooking, hide, reopen, forget, undoMemory, deleteReading, hideResult, nextEvent,
  openForWriting, setAi, words, label, setLanguage, offerCard, logReading, chatContext, chartPoints, readinessOf: (donorId) => readiness(get(donorId)),
  newBadges, seeBadges, goals: (donorId) => goalsOf(get(donorId)), stopGoal, startGoalAgain, goalChatOf: goalChat,
  rememberText: (donorId, text, replacesPattern) => { const st = get(donorId); remember(st, text, replacesPattern ? new RegExp(replacesPattern, 'i') : null); return view(donorId); },
  BUDGETS, PRIORITY,
  _state: get, _addEvent: (donorId, ev) => addEvent(get(donorId), ev), _deliver: (donorId) => deliver(get(donorId)),
};
