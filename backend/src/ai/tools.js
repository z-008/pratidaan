/**
 * Tools the Pratidaan agents can call. Each tool reads from the deterministic
 * domain layer, so every number an agent states is grounded in real data and
 * shows up in the agent trace. Tools are scoped to the signed-in donor; no
 * tool can read another donor's records or any recipient identity.
 */

const store = require('../data/store');
const health = require('../domain/health');
const cover = require('../domain/cover');
const impact = require('../domain/impact');
const community = require('../domain/community');
const drop = require('../domain/drop');
const llm = require('./llm');

// Only canonical, non-clinical preferences may become long-lived memory.
const PREFERENCES = {
  schedule_day: { saturday: 'Saturdays suit you', sunday: 'Sundays suit you', weekday: 'Weekdays suit you', weekend: 'Weekends suit you' },
  schedule_time: { morning: 'Mornings suit you', afternoon: 'Afternoons suit you', evening: 'Evenings suit you' },
  language: { english: 'English suits you', hindi: 'Hindi suits you', kannada: 'Kannada suits you', tamil: 'Tamil suits you', telugu: 'Telugu suits you', malayalam: 'Malayalam suits you' },
};
const REPLACES = { schedule_day: 'Saturdays|Sundays|Weekdays|Weekends', schedule_time: 'Mornings|Afternoons|evenings', language: 'English|Hindi|Kannada|Tamil|Telugu|Malayalam' };

const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

const DEFINITIONS = [
  {
    name: 'get_profile',
    description: 'Donor profile: name, age, sex, blood group, language, district, donation count, eligibility, and donationStatus: the exact sentence to use when they ask when they can donate.',
    input_schema: obj({}),
  },
  {
    name: 'get_health_findings',
    description: 'Current health findings from the latest screening and lab results, each with severity, evidence and the clinical protocol id. Use before giving any health advice.',
    input_schema: obj({}),
  },
  {
    name: 'get_trend',
    description: 'History of one marker across visits, oldest first. Markers: bp, haemoglobin, weight, hba1c, ldl, hdl, tg, ferritin, alt, creat, tsh.',
    input_schema: obj({ marker: { type: 'string', enum: ['bp', 'haemoglobin', 'weight', 'hba1c', 'ldl', 'hdl', 'tg', 'ferritin', 'alt', 'creat', 'tsh'] } }, ['marker']),
  },
  {
    name: 'get_health_score',
    description: 'Health score history (0-100) with the per-factor breakdown of the latest score.',
    input_schema: obj({}),
  },
  {
    name: 'get_protocol',
    description: 'Clinical protocol (ICMR / ACC-AHA based) for a protocol id from a finding, e.g. BP-G1, HB-DEF, DM-PREDIAB: recommended action, follow-up days, escalation threshold.',
    input_schema: obj({ protocol_id: { type: 'string' } }, ['protocol_id']),
  },
  {
    name: 'get_lifestyle_guidance',
    description: 'Evidence-based lifestyle interventions with expected effect sizes. Topics: hypertension_grade1, prediabetes_reversal, diabetes_management, anemia_management, general_cardiovascular_health.',
    input_schema: obj({ topic: { type: 'string', enum: ['hypertension_grade1', 'prediabetes_reversal', 'diabetes_management', 'anemia_management', 'general_cardiovascular_health'] } }, ['topic']),
  },
  {
    name: 'get_insurance_cover',
    description: 'Illustrative, synthetic health-linked insurance cover model, not an issued policy or insurer-approved benefit: base/current modeled sum, next step, conditions and method. recentHistory shows hypothetical cover at each past score; no insurer data transfer occurs.',
    input_schema: obj({}),
  },
  {
    name: 'simulate_cover',
    description: 'What-if: the sum insured the donor would qualify for at a given health score (0-100).',
    input_schema: obj({ score: { type: 'integer', minimum: 0, maximum: 100 } }, ['score']),
  },
  {
    name: 'get_donation_impact',
    description: 'Where the donor\'s blood components went: per component journey status and anonymised recipient context (age band, clinical use, hospital type). Includes totals.',
    input_schema: obj({}),
  },
  {
    name: 'get_stakeholder_impact',
    description: 'What the donor\'s contribution meant for the blood centre, hospitals, labs, government programmes and society, with metrics.',
    input_schema: obj({}),
  },
  {
    name: 'get_communities',
    description: 'The donor\'s communities (family, friends, workplace) with aggregate donations, patients helped and participation.',
    input_schema: obj({}),
  },
  {
    name: 'find_care_slots',
    description: 'Illustrative demo primary-care and partner clinic times near the donor; these are not real availability or reservations.',
    input_schema: obj({ within_days: { type: 'integer', minimum: 0, maximum: 60 } }, ['within_days']),
  },
  {
    name: 'show_chart',
    description: 'Show the donor a small trend chart card in the chat. Use when they ask how a marker is going. Markers: bp (includes readings they added), hb, hba1c, ldl, tg, ferritin.',
    input_schema: obj({ marker: { type: 'string', enum: ['bp', 'hb', 'hba1c', 'ldl', 'tg', 'ferritin'] } }, ['marker']),
  },
  {
    name: 'offer_care_slots',
    description: 'Show a card with simulated check-up times, not confirmed clinic availability. For urgent findings tell the donor to seek real medical care today.',
    input_schema: obj({}),
  },
  {
    name: 'offer_reminder',
    description: 'Show a card offering a daily reminder the donor asked for, e.g. a tablet their doctor started. label = what to remind them about.',
    input_schema: obj({ label: { type: 'string' } }, ['label']),
  },
  {
    name: 'remember',
    description: 'Store only a preference the donor explicitly stated, never a health fact, reading, medicine, condition, result, or sensitive detail. Choose a category and canonical value; other facts cannot be stored.',
    input_schema: obj({ category: { type: 'string', enum: ['schedule_day', 'schedule_time', 'language'] }, value: { type: 'string', enum: ['saturday', 'sunday', 'weekday', 'weekend', 'morning', 'afternoon', 'evening', 'english', 'hindi', 'kannada', 'tamil', 'telugu', 'malayalam'] } }, ['category', 'value']),
  },
  {
    name: 'log_reading',
    description: 'Save a blood pressure reading the donor tells you, e.g. "141/90 at the pharmacy today".',
    input_schema: obj({ systolic: { type: 'integer' }, diastolic: { type: 'integer' } }, ['systolic', 'diastolic']),
  },
  {
    name: 'set_language',
    description: 'Switch the language Drop writes in when the donor asks (e.g. "talk to me in Hindi", "English please"). Also changes the Intro and the Cards on Home.',
    input_schema: obj({ language: { type: 'string', enum: ['en', 'hi', 'kn', 'ta', 'te', 'ml'] } }, ['language']),
  },
  {
    name: 'navigate',
    description: 'Open a screen in the app for the donor. Use when the donor asks where to find something or wants to go somewhere.',
    input_schema: obj({
      screen: { type: 'string', enum: ['home', 'donate', 'impact', 'health', 'cover', 'community', 'plan', 'labs'] },
      reason: { type: 'string' },
    }, ['screen', 'reason']),
  },
];

const MARKER_KEYS = { haemoglobin: 'hb' };

function careSlots(donor, withinDays) {
  // Deterministic synthetic slots so the demo is reproducible
  const base = new Date(store.today());
  const places = [
    { name: `Ayushman Arogya Mandir, ${donor.district}`, kind: 'Free government primary care', cost: 0 },
    { name: `Partner clinic, ${donor.district}`, kind: 'Insurer network clinic (cashless)', cost: 0 },
  ];
  const slots = [];
  for (let day = 1; day <= Math.min(withinDays || 7, 14); day += 1) {
    const d = new Date(base.getTime() + day * 864e5);
    if (d.getDay() === 0) continue;
    places.forEach((p, i) => {
      if ((day + i) % 2 === 0) slots.push({ ...p, date: d.toISOString().slice(0, 10), time: i ? '18:30' : '10:00' });
    });
  }
  return slots.slice(0, 6);
}

function run(name, input, donorId) {
  const definition = DEFINITIONS.find((d) => d.name === name);
  if (!definition) return { error: `Unknown tool ${name}` };
  if (!llm.validate(input, definition.input_schema)) return { error: 'Invalid tool arguments' };
  const donor = store.getDonor(donorId);
  switch (name) {
    case 'get_profile': {
      const visits = store.getDonations(donorId);
      return {
        name: donor.name, age: donor.age, sex: donor.sex, bloodGroup: donor.bloodGroup, language: donor.language,
        district: donor.district, smoker: donor.smoker, familyHistory: donor.familyHistory,
        donations: visits.filter((v) => v.status === 'completed').length, deferrals: visits.filter((v) => v.status === 'deferred').length,
        eligibility: health.eligibility(donorId), today: store.today(),
        // Plain answer to "when can I donate?" (use this, not the raw dates)
        donationStatus: require('../domain/screenLines').line(donorId, 'donate').text,
      };
    }
    case 'get_health_findings':
      return health.findings(donorId).map(({ id, title, severity, detail, evidence, protocolId, date }) => ({ id, title, severity, detail, evidence, protocolId, date }));
    case 'get_trend': {
      if (input.marker === 'bp') return drop.chartPoints(donorId, 'bp').map((p) => ({ date: p.date, value: `${p.value}/${p.value2}`, source: p.source }));
      if (input.marker === 'haemoglobin') return drop.chartPoints(donorId, 'hb').map((p) => ({ date: p.date, value: p.value, source: p.source }));
      if (input.marker === 'weight') return health.vitalsSeries(donorId).map((v) => ({ date: v.date, value: v.weightKg }));
      const key = MARKER_KEYS[input.marker] || input.marker;
      return (health.labSeries(donorId)[key] || []).map((o) => ({ date: o.date, value: o.value, unit: o.unit, low: o.low, high: o.high }));
    }
    case 'get_health_score': {
      const history = health.scoreHistory(donorId);
      return { history: history.map((h) => ({ date: h.date, score: h.score })), latestBreakdown: history.length ? history[history.length - 1].parts : [] };
    }
    case 'get_protocol': {
      const p = store.protocols.get(input.protocol_id);
      return p ? { id: p.id, name: p.name, recommendedAction: p.recommendedAction, followUpDays: p.followUpDays,
        escalationThreshold: p.escalationThreshold, lifestyle: p.lifestyle, monitoring: p.monitoringIntervals } : { error: 'Unknown protocol id' };
    }
    case 'get_lifestyle_guidance': {
      const g = store.lifestyle[input.topic];
      return g ? { title: g.title, source: g.source, recommendations: g.recommendations.map((r) => ({
        intervention: r.intervention, target: r.target, expectedEffect: r.expectedReduction || r.expectedOutcome || null, tips: r.tips || r.examples || [],
      })) } : { error: 'Unknown topic' };
    }
    case 'get_insurance_cover': {
      const c = cover.evaluate(donorId);
      const { history, ...rest } = c;
      return { ...rest, recentHistory: history.slice(-4) };
    }
    case 'simulate_cover':
      return cover.simulate(donorId, input.score);
    case 'get_donation_impact': {
      const journeys = impact.donorJourneys(donorId);
      return {
        totals: impact.summarise(journeys),
        components: journeys.map((j) => ({ id: j.id, component: j.name, donated: j.donationDate, status: j.statusLabel,
          patient: j.recipient && j.recipient.patient, use: j.recipient && j.recipient.context, place: j.recipient && j.recipient.place,
          outcome: j.recipient && j.recipient.outcome, withheld: j.withheld })),
      };
    }
    case 'get_stakeholder_impact':
      return impact.stakeholders(donorId).map(({ name, headline, metrics, story }) => ({ name, headline, metrics, story }));
    case 'get_communities':
      return community.forDonor(donorId).map(({ name, kind, memberCount, totals, participation, contexts }) => ({ name, kind, memberCount, totals, participation, topUses: contexts.slice(0, 3) }));
    case 'find_care_slots':
      return careSlots(donor, input.within_days);
    case 'show_chart': {
      const points = drop.chartPoints(donorId, input.marker);
      return { marker: input.marker, points: points.slice(-8), _ui: { type: 'chart', marker: input.marker, points } };
    }
    case 'offer_care_slots': {
      const card = drop.offerCard(donorId, 'care_slots');
      return { shown: card.text, slots: card.chips.map((c) => c.label), _ui: { type: 'card', cardId: card.id } };
    }
    case 'offer_reminder': {
      const card = drop.offerCard(donorId, 'reminder', { label: input.label });
      return { shown: card.text, _ui: { type: 'card', cardId: card.id } };
    }
    case 'remember': {
      const fact = PREFERENCES[input.category]?.[input.value];
      if (!fact) return { error: 'Not stored. Only supported schedule and language preferences can be remembered.' };
      const v = drop.rememberText(donorId, fact, REPLACES[input.category]);
      return { remembered: fact, _ui: { type: 'memory', text: v.memReceipt } };
    }
    case 'log_reading': {
      const receipt = drop.logReading(donorId, { s: input.systolic, d: input.diastolic });
      return { saved: receipt, _ui: { type: 'receipt', text: receipt } };
    }
    case 'set_language':
      return switchLanguage(donorId, input.language);
    case 'navigate':
      return { ok: true, screen: input.screen };
    default:
      return { error: `Unknown tool ${name}` };
  }
}

const LANGUAGE_LABELS = { en: 'English', hi: 'हिंदी', kn: 'ಕನ್ನಡ', ta: 'தமிழ்', te: 'తెలుగు', ml: 'മലയാളം' };

/** Drop writes in this language from now on; Home's switch keeps offering English plus it. */
function switchLanguage(donorId, language) {
  drop.setLanguage(donorId, language);
  if (language !== 'en') store.getDonor(donorId).language = language;
  return { language, _ui: { type: 'receipt', text: `Language: ${LANGUAGE_LABELS[language]}` } };
}

function definitions(names) {
  return names ? DEFINITIONS.filter((d) => names.includes(d.name)) : DEFINITIONS;
}

module.exports = { definitions, run, careSlots, switchLanguage };
