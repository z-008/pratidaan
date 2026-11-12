/**
 * Health-linked insurance cover ("HealthLimit").
 *
 * Works like a credit-limit increase: the premium stays fixed and the sum
 * insured steps up as the donor shows sustained good health and engagement.
 *
 * Actuarial basis (illustrative, transparent):
 *   - The base premium P is priced for a population with expected annual
 *     claims C0 = P x targetLossRatio.
 *   - Expected claims for a donor scale with a relative risk RR derived from
 *     their screening markers (RR = 1 at score 70, lower when healthier).
 *   - Expected claims grow sub-linearly with sum insured (most claims are well
 *     below the limit), modelled as C(SI) = C0 x RR x (SI / SI0)^0.6.
 *   - The largest SI that keeps C(SI) <= C0 is SI0 x (1/RR)^(1/0.6).
 *   - The result is capped at +60% of base and rounded down to the cover
 *     ladder (Rs 5L -> 6L -> 7L -> 8L). Increases need consistent evidence
 *     (2+ monitored visits in 12 months) and the donor's consent to share
 *     their score (never raw results) with the insurer.
 * Partner insurers would replace these parameters with their filed rating
 * factors; the mechanism (score -> RR -> cover headroom) stays the same.
 */

const store = require('../data/store');
const health = require('./health');

const LADDER = [500000, 600000, 700000, 800000];
const ELASTICITY = 0.6;
const MAX_MULTIPLE = 1.6;
const BASE_PREMIUM = 9800; // illustrative annual premium for Rs 5L, age 25-35 band

function relativeRisk(score) {
  // Each 10 points above 70 lowers expected claims ~11%; below 70 raises them
  return Math.exp(-0.0115 * (score - 70));
}

function headroom(score, base) {
  const rr = relativeRisk(score);
  return Math.min(base * MAX_MULTIPLE, base * (1 / rr) ** (1 / ELASTICITY));
}

function ladderStep(amount, base) {
  return LADDER.filter((step) => step >= base && step <= amount).pop() || base;
}

// What the base policy covers (illustrative terms, by policy type)
const BASE_TERMS = {
  group: [
    { label: 'Who is covered', value: 'You, your spouse and up to 2 children, sharing the sum insured' },
    { label: 'Hospital room', value: 'Single private room, no cap' },
    { label: 'Co-payment', value: 'None' },
    { label: 'Existing illnesses', value: 'Covered from day 1' },
    { label: 'Waiting period', value: 'None' },
    { label: 'Day-care procedures', value: 'Covered' },
    { label: 'Maternity', value: 'Up to ₹50,000' },
    { label: 'Ambulance', value: 'Up to ₹2,000 per claim' },
  ],
  retail: [
    { label: 'Who is covered', value: 'You' },
    { label: 'Hospital room', value: 'Up to 1% of the sum insured per day' },
    { label: 'Co-payment', value: 'None below age 60' },
    { label: 'Existing illnesses', value: 'Covered after 3 years' },
    { label: 'Waiting period', value: '30 days for new illnesses (accidents covered at once)' },
    { label: 'Day-care procedures', value: 'Covered' },
    { label: 'Maternity', value: 'Not covered' },
    { label: 'Ambulance', value: 'Up to ₹2,000 per claim' },
  ],
};

// Other cover a donor holds, so the stack can be shown (synthetic, fixed per donor)
const OTHER_COVER = [
  [{ name: 'Personal health policy', insurer: 'Bharat Health Insurance', cover: 300000, premium: 7200, kind: 'personal' }],
  [],
  [{ name: 'Super top-up', insurer: 'Suraksha General', cover: 1000000, deductible: 500000, premium: 3400, kind: 'topup' }],
];

/** Premium discounts the donor qualifies for on the policies they pay for themselves. */
function discounts(donor, score, recentVisits) {
  return [
    { id: 'donor', label: 'Regular blood donor', rule: '2 or more donations in the last 12 months', percent: 5, met: recentVisits >= 2 },
    { id: 'wellness', label: 'Wellness reward', rule: 'Health score of 75 or more (10% at 85 or more)', percent: score >= 85 ? 10 : 5, met: score >= 75 },
    { id: 'nonsmoker', label: 'Non-smoker', rule: 'No tobacco declared', percent: 5, met: !donor.smoker },
  ];
}

function stack(donor, policy, cover) {
  const n = Number(donor.id.replace(/\D/g, '')) || 0;
  const others = OTHER_COVER[n % OTHER_COVER.length];
  const layers = [
    { name: `${policy.kind} (health-linked)`, insurer: policy.sponsor, cover, kind: 'base', order: 1, note: 'Used first for every claim, cashless at network hospitals' },
    ...others.map((o, i) => ({
      ...o,
      order: i + 2,
      note: o.kind === 'topup' ? `Pays only after a single bill crosses ₹${(o.deductible / 100000).toFixed(0)} lakh` : 'Used when the first policy runs out, or for what it does not cover',
    })),
  ];
  const total = layers.reduce((sum, l) => sum + l.cover, 0);
  return { layers, total, multiple: layers.length > 1 };
}

/** A Donor with no insurer linked yet (the New donor): nothing to step up, only what sharing would do. */
function notLinked(donor, score) {
  return {
    linked: false,
    policy: null,
    baseCover: null,
    currentCover: null,
    eligibleCover: null,
    nextStep: null,
    pointsToNextStep: null,
    healthScore: score ? score.score : null,
    conditions: {
      consentToShare: { met: donor.consent.shareHealthWithInsurer, detail: donor.consent.shareHealthWithInsurer ? 'Sharing is on, for when an insurer is linked' : 'Sharing is off' },
    },
    history: [],
    blockedBy: null,
  };
}

function evaluate(donorId) {
  const donor = store.getDonor(donorId);
  const policy = store.getPolicy(donor.policyId);
  if (!policy) return notLinked(donor, health.currentScore(donorId));
  const base = policy.baseCover;
  const history = health.scoreHistory(donorId);
  const current = health.currentScore(donorId)?.score ?? 60;
  const yearAgo = health.addDays(store.today(), -365);
  const recentVisits = store.getDonations(donorId).filter((v) => v.date >= yearAgo);

  const consistent = recentVisits.length >= 2;
  const consented = donor.consent.shareHealthWithInsurer;
  const target = ladderStep(headroom(current, base), base);
  const cover = consistent && consented ? target : base;

  const nextStep = LADDER.find((step) => step > cover);
  let pointsToNext = null;
  // When a condition (not the score) is holding cover back, points don't help
  if (nextStep && target <= cover) {
    for (let s = current; s <= 100; s += 1) {
      if (ladderStep(headroom(s, base), base) >= nextStep) {
        pointsToNext = s - current;
        break;
      }
    }
  }

  const missing = [];
  if (!consistent) missing.push(`one more monitored visit in the next ${Math.max(1, 365 - health.daysBetween(recentVisits[0]?.date || yearAgo, store.today()))} days (needs 2 in 12 months)`);
  if (!consented) missing.push('consent to share your health score with the insurer');
  const toReachNext = !nextStep ? 'You are at the top step.'
    : [pointsToNext ? `raise your health score by ${pointsToNext} point(s) to ${current + pointsToNext}` : null, ...missing].filter(Boolean).join(' AND ');

  // What the insurer Choice does right now: cover with sharing on, and with it off (always the base)
  const coverIfOn = consistent ? target : base;
  const nextIfOn = LADDER.find((step) => step > coverIfOn) || null;
  let scoreForNext = null;
  if (nextIfOn) {
    for (let s = current; s <= 100; s += 1) {
      if (ladderStep(headroom(s, base), base) >= nextIfOn) { scoreForNext = s; break; }
    }
  }
  const insurerEffect = { on: coverIfOn, off: base, qualifies: target, next: nextIfOn, scoreForNext, needsVisit: !consistent && target > base };

  const group = policy.id !== 'P-RETAIL';
  const coverStack = stack(donor, policy, cover);
  const offers = discounts(donor, current, recentVisits.length);
  const percentOff = Math.min(20, offers.filter((d) => d.met).reduce((sum, d) => sum + d.percent, 0));
  const selfPaid = [
    ...(group ? [] : [{ name: policy.kind, premium: BASE_PREMIUM }]),
    ...coverStack.layers.filter((l) => l.premium).map((l) => ({ name: l.name, premium: l.premium })),
  ];
  const fullPremium = selfPaid.reduce((sum, p) => sum + p.premium, 0);

  return {
    linked: true,
    policy: { ...policy, premium: BASE_PREMIUM, paidBy: group ? policy.sponsor : 'You' },
    baseTerms: BASE_TERMS[group ? 'group' : 'retail'],
    stack: coverStack,
    discounts: {
      rows: offers,
      percentOff,
      cap: 20,
      premiumsYouPay: selfPaid,
      fullPremium,
      saving: Math.round((fullPremium * percentOff) / 100),
    },
    baseCover: base,
    currentCover: cover,
    eligibleCover: target,
    nextStep: nextStep || null,
    pointsToNextStep: pointsToNext,
    healthScore: current,
    relativeRisk: Number(relativeRisk(current).toFixed(2)),
    conditions: {
      consistentMonitoring: { met: consistent, detail: `${recentVisits.length} monitored visit(s) in the last 12 months (needs 2)` },
      consentToShare: { met: consented, detail: consented ? 'You share your health score (not raw results) with your insurer' : 'Sharing is off' },
    },
    // Cover each past score would have qualified for (before the monitoring/consent conditions)
    history: history.map((h) => ({ date: h.date, score: h.score, cover: ladderStep(headroom(h.score, base), base) })),
    // Why the donor isn't getting the cover their score qualifies for
    blockedBy: target > cover ? (consented ? 'monitoring' : 'consent') : null,
    insurerEffect,
    toReachNextStep: toReachNext,
    method: 'Cover = largest ladder step where expected claims at your risk level stay within the premium priced for Rs 5L. '
      + `Relative risk from score: e^(-0.0115 x (score - 70)); claims grow with cover^${ELASTICITY}; capped at ${MAX_MULTIPLE}x base.`,
  };
}

/** What-if: cover if the score changed by `delta` points. */
function simulate(donorId, newScore) {
  if (!Number.isFinite(newScore) || newScore < 0 || newScore > 100) throw new RangeError('Health score must be between 0 and 100');
  const donor = store.getDonor(donorId);
  const policy = store.getPolicy(donor.policyId);
  if (!policy) return { score: newScore, cover: null, relativeRisk: Number(relativeRisk(newScore).toFixed(2)) };
  const base = policy.baseCover;
  return { score: newScore, cover: ladderStep(headroom(newScore, base), base), relativeRisk: Number(relativeRisk(newScore).toFixed(2)) };
}

module.exports = { evaluate, simulate, LADDER };
