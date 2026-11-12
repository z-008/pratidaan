/**
 * Home-screen insight: the single most useful thing to tell this donor today.
 *
 * Several signals compete (a unit that just reached a patient, a rising
 * trend, being 2 points from the next cover step, a new eligibility date, a
 * friend circle close to a goal). Choosing and phrasing the one that matters
 * for this person is a judgement call, so the model ranks them; candidates are
 * computed deterministically, so it can only pick from real facts.
 */

const store = require('../data/store');
const health = require('../domain/health');
const cover = require('../domain/cover');
const impact = require('../domain/impact');
const community = require('../domain/community');
const llm = require('./llm');

const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam' };

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidateId', 'title', 'message', 'cta'],
  properties: {
    candidateId: { type: 'string' },
    title: { type: 'string', description: 'Max 7 words' },
    message: { type: 'string', description: '1-2 sentences, warm, specific, second person' },
    cta: { type: 'string', enum: ['impact', 'health', 'cover', 'community', 'donate', 'plan'] },
  },
};

const SYSTEM = `You choose the one insight a blood donor should see first on their home screen today, from candidate facts, and phrase it.
Priorities: anything urgent for their health first; then something that motivates an action they can take now (donate, recheck, small habit change that unlocks cover); then emotional reward (a recent patient helped).
Use only the facts given. Don't diagnose. Write in the requested language.`;

function candidates(donorId) {
  const list = [];
  const findings = health.findings(donorId);
  const urgent = findings.find((f) => f.severity === 'urgent');
  if (urgent) list.push({ id: 'urgent', cta: 'plan', fact: `URGENT: ${urgent.title} (${urgent.detail}). Protocol says see a doctor the same day.` });
  const trend = findings.find((f) => f.id === 'BP_RISING' || f.id === 'IRON_LOW' || f.id === 'PREDIABETES');
  if (trend) list.push({ id: 'trend', cta: 'health', fact: `${trend.title}: ${trend.detail}` });
  const c = cover.evaluate(donorId);
  if (c.pointsToNextStep != null && c.pointsToNextStep <= 10) list.push({ id: 'cover', cta: 'cover', fact: `Demo health score ${c.healthScore}; ${c.pointsToNextStep} points from the illustrative cover model rising ₹${c.currentCover / 1e5} lakh -> ₹${c.nextStep / 1e5} lakh at the same modeled premium; no insurer has issued this increase.` });
  if (c.blockedBy === 'monitoring') list.push({ id: 'cover_unlock', cta: 'donate', fact: `The illustrative score model reaches ₹${c.eligibleCover / 1e5} lakh but needs 2 monitored visits in 12 months; another demo visit can change the simulated amount, not an issued policy.` });
  const e = health.eligibility(donorId);
  if (e.eligibleNow && !e.lastDonationDate) list.push({ id: 'eligible', cta: 'donate', fact: 'Has not donated yet and can book a first donation today.' });
  else if (e.eligibleNow) list.push({ id: 'eligible', cta: 'donate', fact: `Eligible to donate today (last donation ${e.lastDonationDate}). Blood group ${store.getDonor(donorId).bloodGroup}.` });
  const journeys = impact.donorJourneys(donorId).filter((j) => j.recipient);
  const recent = journeys.sort((a, b) => b.donationDate.localeCompare(a.donationDate))[0];
  if (recent) list.push({ id: 'impact', cta: 'impact', fact: `Their ${recent.name.toLowerCase()} from ${recent.donationDate} was used for ${recent.recipient.context.toLowerCase()} (${recent.recipient.patient}, ${recent.recipient.place}). Total patients helped: ${journeys.length}.` });
  const circles = community.forDonor(donorId);
  const top = circles.sort((a, b) => b.totals.patientsHelped - a.totals.patientsHelped)[0];
  if (top) list.push({ id: 'community', cta: 'community', fact: `${top.name} (${top.kind}) has helped ${top.totals.patientsHelped} patients together; ${top.participation}% of members donated this year.` });
  return list;
}

async function forDonor(donorId) {
  const donor = store.getDonor(donorId);
  const list = candidates(donorId);
  if (!list.length || list[0].id === 'urgent') return fallback(donorId);
  const pick = await llm.json({
    // The model may only pick one of these candidates, so its id is limited to theirs
    feature: 'home_insight', system: SYSTEM, maxTokens: 800, effort: 'low', guardrailKind: 'donor_copy',
    outputSchema: { ...SCHEMA, properties: { ...SCHEMA.properties, candidateId: { type: 'string', enum: list.map((c) => c.id) } } },
    messages: [{ role: 'user', content: `Donor: ${donor.newUser ? 'a new user (name not known)' : donor.name.split(' ')[0]}. Language: ${LANGUAGE_NAMES[donor.language] || 'English'}.\nCandidates:\n${list.map((c) => `- [${c.id}] ${c.fact}`).join('\n')}` }],
  });
  const chosen = list.find((c) => c.id === pick.candidateId);
  if (!chosen || chosen.cta !== pick.cta) return fallback(donorId);
  // The model selects, but cannot introduce claims not present in candidate facts.
  const titles = { urgent: 'Please see a doctor today', trend: 'A trend worth watching', cover: 'Close to more cover', cover_unlock: 'One check-up unlocks more cover', eligible: 'You can donate today', impact: 'Your blood reached a patient', community: 'Your circle is making a difference' };
  return { candidateId: chosen.id, title: titles[chosen.id], message: chosen.fact, cta: chosen.cta,
    generatedBy: 'ai', considered: list.map((c) => c.id) };
}

function fallback(donorId) {
  const [first] = candidates(donorId);
  if (!first) return { title: 'Welcome back', message: 'Thank you for being a donor.', cta: 'impact', generatedBy: 'rules', considered: [] };
  return { candidateId: first.id, title: { urgent: 'Please see a doctor today', trend: 'A trend worth watching', cover: 'Close to more cover', cover_unlock: 'One check-up unlocks more cover', eligible: 'You can donate today', impact: 'Your blood reached a patient', community: 'Your circle is making a difference' }[first.id],
    message: first.fact, cta: first.cta, generatedBy: 'rules', considered: candidates(donorId).map((c) => c.id) };
}

module.exports = { forDonor, fallback, candidates };
