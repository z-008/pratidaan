/**
 * Drop's one line at the top of each screen: the most useful true sentence
 * about that screen for this Donor, picked by fixed rules (first match wins),
 * plus 2-3 fixed questions to ask Drop about it. Never filler.
 */

const store = require('../data/store');
const health = require('./health');
const impact = require('./impact');
const cover = require('./cover');
const community = require('./community');
const drop = require('./drop');

const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const lakh = (n) => `₹${(n / 1e5).toFixed(n % 1e5 ? 1 : 0)} lakh`;
// Lower-cases a sentence start, never an acronym ("BP under 130/80")
const lcFirst = (t) => (/^[A-Z]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
const has = (name) => (/s$/i.test(name) ? 'have' : 'has');
const is = (name) => (/s$/i.test(name) ? 'are' : 'is');

const firstTime = (donorId) => store.getDonations(donorId).length === 0;

function healthLine(donorId) {
  const urgent = health.findings(donorId).find((f) => f.severity === 'urgent');
  if (urgent) return `${urgent.title}: ${urgent.detail}. Please see a doctor today.`;
  if (firstTime(donorId)) return 'Every donation includes a free health check. Your results will show here after your first one.';
  const view = drop.view(donorId);
  const live = drop.goals(donorId).filter((g) => g.state === 'active' || g.state === 'upnext');
  const bp = view.readings.filter((r) => r.marker === 'bp');
  const goal = live.find((g) => g.target.marker === 'bp');
  if (goal && bp.length) {
    const last = bp[bp.length - 1];
    const visits = health.vitalsSeries(donorId);
    const prev = bp.length > 1 ? bp[bp.length - 2].s : visits[visits.length - 1].systolic;
    return `BP ${last.s}/${last.d} on ${fmt(last.date)}, ${last.s <= prev ? 'down' : 'up'} from ${prev}. Target: ${lcFirst(goal.target.text)}.`;
  }
  const hbGoal = live.find((g) => g.target.hb);
  const hb = view.readings.filter((r) => r.marker === 'hb').pop();
  if (hbGoal && hb) return `Hb ${hb.value} on ${fmt(hb.date)}. Target: ${hbGoal.target.hb.toFixed(1)} or more, so you can donate again.`;
  const f = health.findings(donorId).find((x) => x.severity !== 'watch') || health.findings(donorId)[0];
  if (f) return `${f.title}: ${f.detail}.`;
  const latest = new Set(store.getObservations(donorId).map((o) => o.key)).size;
  return `All ${latest} of your results are in the healthy range.`;
}

const listOf = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]);

function impactLine(donorId) {
  if (firstTime(donorId)) return 'Your first donation will show here: each part of it, and the patient it helps.';
  // New Badges are said here, never in a Card
  const fresh = drop.newBadges(donorId);
  if (fresh.length === 1) return `You earned ${fresh[0].name} in ${fresh[0].earnedLabel}. It's on your shelf below.`;
  if (fresh.length > 1) return `You earned ${fresh.length} new Badges: ${listOf(fresh.map((b) => b.name))}.`;
  const journeys = impact.donorJourneys(donorId);
  const last = (j) => j.events[j.events.length - 1];
  const newest = [...journeys].sort((a, b) => (a.donationDate === b.donationDate ? 0 : a.donationDate < b.donationDate ? 1 : -1))[0];
  const total = impact.summarise(journeys).patientsHelped;
  if (newest) {
    const fromSame = journeys.filter((j) => j.donationDate === newest.donationDate);
    const helped = fromSame.find((j) => j.recipient);
    const waiting = fromSame.find((j) => !j.recipient && ['stored', 'tested', 'separated'].includes(j.status));
    if (helped && waiting) return `Your ${helped.name.toLowerCase()} from ${fmt(newest.donationDate)} ${has(helped.name)} helped a patient; your ${waiting.name.toLowerCase()} ${is(waiting.name)} still at the centre.`;
    if (waiting) return `Your ${waiting.name.toLowerCase()} from ${fmt(newest.donationDate)} ${is(waiting.name)} ${lcFirst(last(waiting).label || waiting.statusLabel)}. Units are usually used within a few weeks.`;
  }
  return `You have helped ${total} patient${total === 1 ? '' : 's'} so far.`;
}

function donateLine(donorId) {
  const from = drop.readinessOf(donorId);
  const donor = store.getDonor(donorId);
  if (firstTime(donorId)) return 'You can book your first donation now. It takes about a minute.';
  if (from && from <= store.today()) return `You can donate now. ${donor.bloodGroup} donors are always needed.`;
  if (from) return `You can donate from ${fmt(from)}. Drop will remind you three weeks before.`;
  const el = health.eligibility(donorId);
  return `Donation is on hold for now: ${lcFirst(el.blockers[0] || 'a recent result')}. Drop will tell you when that changes.`;
}

function coverLine(donorId) {
  const c = cover.evaluate(donorId);
  if (!c.linked) return 'No health cover linked yet. Once it is, a good health score can raise it at the same premium.';
  if (c.blockedBy === 'monitoring') return `Your score already qualifies for ${lakh(c.eligibleCover)}; one more check-up this year unlocks it.`;
  if (c.pointsToNextStep != null) return `${c.pointsToNextStep} more health point${c.pointsToNextStep === 1 ? '' : 's'} would raise your cover to ${lakh(c.nextStep)}, same premium.`;
  return `Your cover is ${lakh(c.currentCover)}, the top step.`;
}

function communityLine(donorId) {
  const circles = community.forDonor(donorId);
  const top = [...circles].sort((a, b) => b.totals.patientsHelped - a.totals.patientsHelped)[0];
  if (!top) return "You're not in a Circle yet. A Circle is family, friends or colleagues who see their impact together.";
  return `${top.name} has helped ${top.totals.patientsHelped} patients together; ${top.participation}% of members donated this year.`;
}

const SCREENS = {
  health: { rule: healthLine, questions: ['What do my results mean?', 'Show my BP trend', 'Am I ready to donate?'] },
  impact: { rule: impactLine, questions: ['Where did my blood go?', 'Who did my last donation help?'] },
  donate: { rule: donateLine, questions: ['When can I donate next?', 'Why am I on hold?', 'What happens at a donation?'] },
  cover: { rule: coverLine, questions: ['How do I raise my cover?', 'Why did my cover change?'] },
  community: { rule: communityLine, questions: ['How has my circle helped?', 'How do I invite someone?'] },
};

function line(donorId, screen) {
  const s = SCREENS[screen];
  if (!s) throw new Error(`No Drop line for ${screen}`);
  return { screen, text: s.rule(donorId), questions: s.questions, date: store.today() };
}

module.exports = { line, SCREENS };
