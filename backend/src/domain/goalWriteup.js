/**
 * The Goal write-up, rules version (build plan step 2; ticket 01, "The AI's part").
 *
 * Once per Goal, when it is made or its findings change, never on each view:
 * - a two-sentence "why this matters"
 * - 2-3 steps, each tagged with a Habit (movement, food, mind), "see a doctor"
 *   (doctor) or "add a reading" (reading), each with the evidence it rests on
 *
 * Evidence comes only from data/ontology: the lead finding's protocol and the
 * lifestyle guidance. Grouping, the target and the order stay with goals.js.
 * The AI version waits on team decision D1 (Google Cloud's "no clinical purposes"
 * term); this rules version is what ships without it, and stays its fallback.
 */

const store = require('../data/store');

/** "Aerobic Exercise: 5-7 mmHg systolic (ICMR Guidelines, ACC/AHA 2017)", from the lifestyle guidance. */
function guide(topic, intervention) {
  const g = store.lifestyle[topic];
  const r = g && g.recommendations.find((x) => x.intervention === intervention);
  if (!r) throw new Error(`No guidance for ${topic}: ${intervention}`);
  const effect = r.expectedReduction || r.expectedOutcome || r.expectedImprovement || r.target;
  return `${r.intervention}: ${effect} (${g.source})`;
}

/** "Protocol BP-G1: Lifestyle modification with AAM visit in 2-4 weeks". */
function protocol(id) {
  const p = store.protocols.get(id);
  return p ? `Protocol ${p.id}: ${p.recommendedAction}` : null;
}

/** When to see a doctor, from the protocol's follow-up days. */
function within(id) {
  const days = store.protocols.get(id)?.followUpDays;
  if (days == null || days <= 1) return 'today';
  if (days % 7 === 0) return days === 7 ? 'within a week' : `within ${days / 7} weeks`;
  return `within ${days} days`;
}

const step = (tag, text, evidence) => ({ tag, text, evidence: evidence.filter(Boolean) });

function walks(evidence) {
  return step('movement', 'Brisk walks, 30 minutes on 5 days a week', evidence);
}

const LESS_SALT = () => step('food', 'Less salt in home cooking', [guide('hypertension_grade1', 'Dietary Sodium Restriction')]);
const WHOLE_GRAINS = () => step('food', 'Whole grains in place of refined ones', [guide('diabetes_management', 'Carbohydrate Quality')]);

function bp(goal) {
  const lead = goal.lead;
  const donation = goal.stopsDonation ? ', and your donations wait until it comes down' : '';
  if (lead.severity === 'urgent') {
    return {
      why: 'Your BP is very high, well above the 130/80 target. Please see a doctor today; Drop suggests no exercise until a doctor has seen you.',
      steps: [
        step('doctor', 'See a doctor today', [protocol(lead.protocolId), ...lead.evidence]),
        LESS_SALT(),
        step('reading', 'Add a BP reading after you have seen the doctor', [protocol(lead.protocolId)]),
      ],
    };
  }
  if (lead.severity === 'high') {
    return {
      why: `Your BP is above the 130/80 target${donation}. At this level the guidelines say to see a doctor soon, alongside walking and less salt.`,
      steps: [
        step('doctor', `See a doctor ${within(lead.protocolId)}`, [protocol(lead.protocolId), ...lead.evidence]),
        walks([guide('hypertension_grade1', 'Aerobic Exercise')]),
        LESS_SALT(),
      ],
    };
  }
  return {
    why: `Your BP is above the 130/80 target${donation}. At this level the guidelines start with lifestyle: regular walks and less salt can each bring it down by a few points.`,
    steps: [
      walks([guide('hypertension_grade1', 'Aerobic Exercise'), protocol(lead.protocolId)]),
      LESS_SALT(),
      step('doctor', `See a doctor ${within(lead.protocolId)}`, [protocol(lead.protocolId), ...lead.evidence]),
    ],
  };
}

function sugar(goal) {
  const lead = goal.lead;
  if (lead.id === 'DIABETES_RANGE') {
    return {
      why: "Your HbA1c is in the diabetes range, 6.5% or more. Only a doctor can confirm it and decide what's next, so the first step is a check within 30 days.",
      steps: [
        step('doctor', 'See a doctor within 30 days', [protocol(lead.protocolId), ...lead.evidence]),
        step('movement', '150 minutes a week of brisk walking or other moderate activity', [guide('diabetes_management', 'Physical Activity')]),
        WHOLE_GRAINS(),
      ],
    };
  }
  return {
    why: 'Your HbA1c is in the prediabetes range, above the 5.7% target. At this stage it can still go back to normal, and moving more is the first step the guidelines give.',
    steps: [
      step('movement', '150 minutes a week of brisk walking or other moderate activity', [guide('prediabetes_reversal', 'Moderate-Intensity Physical Activity'), protocol(lead.protocolId)]),
      WHOLE_GRAINS(),
      step('reading', 'Add your next HbA1c result, due in about 3 months', [protocol(lead.protocolId), ...lead.evidence]),
    ],
  };
}

function cholesterol(goal) {
  return {
    why: 'Your cholesterol or triglycerides are above the target, LDL under 130 and triglycerides under 150. What you eat and regular activity are where the guidelines start for both.',
    steps: [
      step('food', 'Whole grains, beans and vegetables in place of fried food', [guide('diabetes_management', 'Fiber Intake'), guide('general_cardiovascular_health', 'Mediterranean Diet'), ...goal.lead.evidence]),
      walks([guide('hypertension_grade1', 'Aerobic Exercise')]),
      step('reading', 'Add a lipid result if you test before your next donation', goal.lead.evidence),
    ],
  };
}

function iron(goal) {
  const lead = goal.lead;
  const ironFood = () => step('food', 'Iron-rich food at each meal, with lemon or tomato for vitamin C', [guide('anemia_management', 'Iron-Rich Foods'), guide('anemia_management', 'Vitamin C Combination')]);
  if (lead.severity === 'urgent') {
    return {
      why: 'Your haemoglobin is very low. Please see a doctor today.',
      steps: [step('doctor', 'See a doctor today', [protocol(lead.protocolId), ...lead.evidence]), ironFood()],
    };
  }
  const lowHb = goal.findings.some((f) => f.id === 'HB_LOW');
  const lowIron = goal.findings.some((f) => f.id === 'IRON_LOW');
  const first = lowHb
    ? `Your haemoglobin is below the ${goal.target.hb.toFixed(1)} you need to donate${lowIron ? ', and your iron stores are low' : ''}.`
    : 'Your iron stores are low, with ferritin under 15.';
  return {
    why: `${first} Iron-rich food with vitamin C, and tea or coffee away from meals, help your body take in more iron.`,
    steps: [
      ironFood(),
      step('food', 'Tea and coffee away from meals', [guide('anemia_management', 'Avoid Iron Inhibitors')]),
      step('doctor', `See a doctor ${within(lead.protocolId)} to find the cause`, [protocol(lead.protocolId), ...lead.evidence]),
    ],
  };
}

/** The rules write-up for one Goal (from goals.js). */
function rules(goal) {
  const lead = goal.lead;
  const write = lead.concept === 'hypertension' ? bp
    : ['prediabetes', 'diabetes'].includes(lead.concept) ? sugar
      : lead.concept === 'heart_disease' ? cholesterol
        : lead.concept === 'anemia' ? iron : null;
  if (!write) throw new Error(`No write-up for a Goal led by ${lead.id}`);
  return { ...write(goal), by: 'rules', writtenOn: store.today() };
}

/** What a write-up is written for: a new one is due when this changes, never on a view. */
function signature(goal) {
  return JSON.stringify([goal.lead.id, goal.findings.map((f) => f.id).sort(), goal.stopsDonation]);
}

const TAGS = ['movement', 'food', 'mind', 'doctor', 'reading'];

module.exports = { rules, signature, TAGS };
