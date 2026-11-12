/**
 * Donation impact: where every component of a donor's blood went, and what it
 * meant for the blood bank, hospitals, labs, government programmes and society.
 *
 * Privacy rules (enforced here, before anything leaves the server):
 *   - Recipient age band, sex, clinical context, hospital type/district and
 *     outcome are released only in combinations shared by at least K=5
 *     currently transfused, non-withheld units; sparse fields are generalised.
 *   - Exact use dates are rounded to the month.
 *   - Units from a donation with a confidential follow-up show "withheld for
 *     safety" with no reason.
 */

const store = require('../data/store');

const K_ANON = 5;

const COMPONENTS = {
  PRBC: { name: 'Red blood cells', shelf: '42 days', role: 'Carry oxygen — used in surgery, trauma, childbirth and anaemia' },
  PLT: { name: 'Platelets', shelf: '5 days', role: 'Stop bleeding — used in dengue, cancer and leukaemia care' },
  FFP: { name: 'Fresh frozen plasma', shelf: '1 year frozen', role: 'Clotting factors — used in liver disease, burns and major bleeding' },
  CRYO: { name: 'Cryoprecipitate', shelf: '1 year frozen', role: 'Concentrated fibrinogen — used in childbirth bleeding and haemophilia' },
  PLASMA: { name: 'Plasma for medicines', shelf: '—', role: 'Pooled to make albumin, immunoglobulin (IVIG) and clotting factor' },
};

const STAGE_LABELS = {
  collected: 'Collected', separated: 'Separated into components', tested: 'Passed safety tests',
  stored: 'Stored at the blood centre', issued: 'Issued to a hospital', transfused: 'Transfused to a patient',
  outcome: 'Patient follow-up recorded', expired: 'Reached shelf-life limit', fractionation: 'Sent for fractionation',
  products_released: 'Medicines released from plasma pool', withheld: 'Withheld from use for safety',
};

const AGE_BANDS = [[0, 0, 'Newborn'], [1, 12, 'Child'], [13, 17, 'Teenager'], [18, 39, 'Adult (18–39)'],
  [40, 59, 'Adult (40–59)'], [60, 120, 'Older adult (60+)']];

function ageBand(age) {
  return AGE_BANDS.find(([lo, hi]) => age >= lo && age <= hi)[2];
}

function month(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

const GENERAL_PATIENT = 'Patient (age and sex not shared)';
const GENERAL_CONTEXT = 'Treatment (details not shared)';
const GENERAL_PLACE = 'A hospital in Karnataka';
const GENERAL_OUTCOME = 'not_shared';

function recipientFields(c) {
  const h = store.hospital(c.recipient.hospitalId);
  return {
    patient: `${ageBand(c.recipient.age)}, ${c.recipient.sex === 'F' ? 'female' : 'male'}`,
    context: c.recipient.context,
    contextKey: c.recipient.contextKey,
    place: `${h.kind}, ${h.district}`,
    outcome: c.events.some((e) => e.type === 'outcome' && e.date <= store.today()) ? c.recipient.outcome : GENERAL_OUTCOME,
  };
}

// Each candidate contains every recipient field the API releases. Removing a
// dimension generalises both its displayed value and any machine-readable key.
const RECIPIENT_LEVELS = [
  ['patient', 'context', 'place', 'outcome'],
  ['patient', 'context', 'place'],
  ['patient', 'context'],
  ['context'],
  [],
];

function recipientKey(fields, level) {
  return JSON.stringify(level.map((field) => fields[field]));
}

function visibleRecipients() {
  const today = store.today();
  const donations = new Map(store.allDonations().map((d) => [d.id, d]));
  return store.allComponents().filter((c) => c.recipient && !donations.get(c.donationId)?.confidentialFollowUp
    && c.events.some((e) => e.type === 'transfused' && e.date <= today));
}

function recipientGroups() {
  let remaining = visibleRecipients().map((c) => ({ id: c.id, fields: recipientFields(c) }));
  const released = new Map();
  for (const level of RECIPIENT_LEVELS) {
    const groups = new Map();
    for (const entry of remaining) {
      const key = recipientKey(entry.fields, level);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    remaining = [];
    for (const group of groups.values()) {
      if (group.length < K_ANON) {
        remaining.push(...group);
      } else {
        for (const entry of group) released.set(entry.id, {
          patient: level.includes('patient') ? entry.fields.patient : GENERAL_PATIENT,
          context: level.includes('context') ? entry.fields.context : GENERAL_CONTEXT,
          contextKey: level.includes('context') ? entry.fields.contextKey : 'general',
          place: level.includes('place') ? entry.fields.place : GENERAL_PLACE,
          outcome: level.includes('outcome') ? entry.fields.outcome : GENERAL_OUTCOME,
          generalised: level.length !== RECIPIENT_LEVELS[0].length,
        });
      }
    }
  }
  return released; // Fewer than K even at the broadest level: suppress recipient.
}

const SHELF_DAYS = { PRBC: 42, PLT: 5, FFP: 365, CRYO: 365 };
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/**
 * Why an expired unit was never used, from what the dataset shows about the same
 * component and blood group in the days it was on the shelf, and what follows from it.
 */
function expiryReason(c) {
  const stored = c.events.find((e) => e.type === 'stored') || c.events[0];
  const expired = c.events.find((e) => e.type === 'expired');
  if (!expired) return null;
  const days = Math.max(1, dayDiff(stored.date, expired.date));
  const name = COMPONENTS[c.kind].name.toLowerCase();
  const sameGroup = store.allComponents().filter((o) => o.id !== c.id && o.kind === c.kind && o.bloodGroup === c.bloodGroup);
  const inWindow = (o, type) => o.events.some((e) => e.type === type && e.date >= stored.date && e.date <= expired.date);
  const issued = sameGroup.filter((o) => inWindow(o, 'issued')).length;
  const alsoExpired = sameGroup.filter((o) => inWindow(o, 'expired')).length;

  const cause = [`${COMPONENTS[c.kind].name} keep for ${SHELF_DAYS[c.kind] >= 365 ? 'about a year frozen' : `${SHELF_DAYS[c.kind]} days`}. This unit was on the shelf for ${days} day${days === 1 ? '' : 's'}.`];
  if (issued === 0) cause.push(`No hospital in the network asked for ${c.bloodGroup} ${name} in that time.`);
  else cause.push(`In that time hospitals were issued ${issued} other ${c.bloodGroup} ${name} unit${issued === 1 ? '' : 's'}. Older units go out first, so this one ran out of time.`);
  if (alsoExpired > 0) cause.push(`${alsoExpired} other ${c.bloodGroup} ${name} unit${alsoExpired === 1 ? '' : 's'} also expired then, so supply was higher than demand.`);

  const effect = [
    'The unit was discarded safely under biomedical waste rules. It was never given to anyone.',
    'It counts in the blood centre\'s wastage rate, which the centre reports to the State Blood Transfusion Council.',
    c.kind === 'PLT'
      ? 'Platelets expire fastest. Your next donation can be timed for when platelet requests rise, or you can be called for a platelet-only donation when a patient needs one.'
      : `Your next slot can be suggested when ${c.bloodGroup} stock runs low, so the blood is used sooner.`,
  ];
  return { days, issuedMeanwhile: issued, alsoExpired, cause, effect };
}

/** A component's journey as of the demo clock: later steps haven't happened yet. */
function publicJourney(c, donation, releasedRecipients = recipientGroups()) {
  const withheld = donation.confidentialFollowUp;
  const today = store.today();
  const happened = c.events.filter((e) => e.date <= today);
  const events = withheld
    ? happened.filter((e) => ['collected', 'separated', 'tested'].includes(e.type)).concat([{ type: 'withheld', date: happened[happened.length - 1].date }])
    : happened;
  const transfused = happened.some((e) => e.type === 'transfused');
  const recipient = withheld || !transfused ? null : releasedRecipients.get(c.id) || null;
  // A generalised outcome must not be reconstructible from the event list.
  const publicEvents = recipient?.outcome === GENERAL_OUTCOME ? events.filter((e) => e.type !== 'outcome') : events;
  const lastType = publicEvents[publicEvents.length - 1].type;
  return {
    id: c.id,
    kind: c.kind,
    ...COMPONENTS[c.kind],
    donationDate: donation.date,
    centre: store.centre(donation.centreId).name,
    status: lastType,
    statusLabel: STAGE_LABELS[lastType],
    helped: ['transfused', 'outcome'].includes(lastType) || lastType === 'products_released',
    events: publicEvents.map((e) => ({ type: e.type, label: STAGE_LABELS[e.type], when: ['transfused', 'outcome', 'issued'].includes(e.type) ? month(e.date) : e.date })),
    recipient,
    fractionation: withheld ? null : c.fractionation,
    expiry: !withheld && lastType === 'expired' ? expiryReason(c) : null,
    withheld,
  };
}

function donorJourneys(donorId) {
  const donations = new Map(store.getDonations(donorId).map((d) => [d.id, d]));
  const releasedRecipients = recipientGroups();
  return store.getComponents(donorId)
    .filter((c) => c.events.length && c.events[0].date <= store.today())
    .map((c) => publicJourney(c, donations.get(c.donationId), releasedRecipients));
}

/** Patients helped: one per transfused unit; plasma pools count as a share. */
function summarise(journeys) {
  const transfused = journeys.filter((j) => !j.withheld && j.events.some((e) => e.type === 'transfused'));
  const disclosed = transfused.filter((j) => j.recipient);
  const fractions = journeys.filter((j) => j.fractionation && j.status === 'products_released');
  const plasmaShare = fractions.reduce((sum, j) => sum + (j.fractionation.albuminVials + j.fractionation.ivigVials), 0);
  const contexts = {};
  for (const j of disclosed) contexts[j.recipient.context] = (contexts[j.recipient.context] || 0) + 1;
  return {
    components: journeys.length,
    patientsHelped: transfused.length,
    medicineDosesShare: Number(plasmaShare.toFixed(1)),
    children: disclosed.filter((j) => ['Newborn', 'Child', 'Teenager'].some((b) => j.recipient.patient.startsWith(b))).length,
    inProgress: journeys.filter((j) => ['stored', 'tested', 'separated', 'fractionation'].includes(j.status)).length,
    contexts: Object.entries(contexts).sort((a, b) => b[1] - a[1]).map(([context, count]) => ({ context, count })),
  };
}

/**
 * What the donor's contribution meant for each institution. Unit values are
 * illustrative and labelled as estimates in the UI.
 */
function stakeholders(donorId) {
  const donor = store.getDonor(donorId);
  const visits = store.getDonations(donorId);
  const completed = visits.filter((v) => v.status === 'completed' && v.date <= store.today());
  const journeys = donorJourneys(donorId);
  const transfused = journeys.filter((j) => !j.withheld && j.events.some((e) => e.type === 'transfused'));
  const disclosed = transfused.filter((j) => j.recipient);
  const byKind = (k) => journeys.filter((j) => j.kind === k);
  const rareGroup = Boolean(donor.bloodGroup && donor.bloodGroup.endsWith('-'));
  const labTests = store.getObservations(donorId).length;
  const hospitalKinds = {};
  for (const j of disclosed) {
    const category = j.recipient.place === GENERAL_PLACE ? GENERAL_PLACE : j.recipient.place.split(', ')[0];
    hospitalKinds[category] = (hospitalKinds[category] || 0) + 1;
  }
  const ttiTests = completed.length * 5; // HIV, HBV, HCV, syphilis, malaria per unit

  return [
    {
      id: 'blood_bank', name: 'Blood centre', icon: 'droplet',
      headline: `${completed.length} donations → ${journeys.length} components produced`,
      metrics: [
        { label: 'Units collected', value: completed.length },
        { label: 'Components produced', value: journeys.length },
        { label: 'Units used (not wasted)', value: `${Math.round((journeys.filter((j) => j.helped).length / Math.max(journeys.length, 1)) * 100)}%` },
        { label: 'Repeat-donor status', value: completed.length >= 3 ? 'Regular (safest donor category)' : 'Building' },
      ],
      story: `Repeat voluntary donors are the safest blood supply and cut the centre's replacement-donor dependence. ${!donor.bloodGroup ? 'Your blood group is found at your first donation.' : rareGroup ? `Your ${donor.bloodGroup} group is rare — under 2% of donors — so the centre calls you for emergencies.` : `Your ${donor.bloodGroup} group is among the most requested.`}`,
      drilldown: Object.keys(COMPONENTS).map((k) => ({ label: COMPONENTS[k].name, value: byKind(k).length })),
    },
    {
      id: 'hospitals', name: 'Hospitals', icon: 'hospital',
      headline: `${transfused.length} patients treated; ${Object.keys(hospitalKinds).length} disclosed hospital categories`,
      metrics: [
        { label: 'Units transfused', value: transfused.length },
        { label: 'Surgeries supported', value: disclosed.filter((j) => /surgery|accident/i.test(j.recipient.context)).length },
        { label: 'Emergency / critical care', value: disclosed.filter((j) => /accident|childbirth|dengue|burns/i.test(j.recipient.context)).length },
      ],
      story: 'Hospital type and district are disclosed only when the full recipient combination meets the privacy threshold; otherwise the location is generalised.',
      drilldown: Object.entries(hospitalKinds).map(([label, value]) => ({ label, value })),
    },
    {
      id: 'labs', name: 'Labs & screening', icon: 'flask',
      headline: `${ttiTests + labTests} tests run on your samples`,
      metrics: [
        { label: 'Infection-safety tests on your units', value: ttiTests },
        { label: 'Health tests for you (free)', value: labTests },
        { label: 'Est. value of your free check-ups', value: `₹${(completed.length * 2400).toLocaleString('en-IN')}` },
      ],
      story: 'Every unit is screened for HIV, hepatitis B and C, syphilis and malaria. The same sample also gives you a full health panel at no cost.',
      drilldown: [{ label: 'Infection screening (per unit × 5)', value: ttiTests }, { label: 'Health panel results', value: labTests }],
    },
    {
      id: 'government', name: 'Government & public health', icon: 'landmark',
      headline: `Supports thalassaemia, maternal-health and dengue programmes`,
      metrics: [
        { label: 'Thalassaemia transfusions', value: disclosed.filter((j) => j.recipient.contextKey === 'thalassaemia').length },
        { label: 'Mothers supported (childbirth)', value: disclosed.filter((j) => j.recipient.contextKey === 'obstetric').length },
        { label: 'Dengue patients (platelets)', value: disclosed.filter((j) => j.recipient.contextKey === 'dengue').length },
        { label: 'Anonymised health data points', value: labTests },
      ],
      story: 'Your anonymised screening data adds to district non-communicable-disease surveillance (blood pressure, diabetes, anaemia) without any personal identifiers.',
      drilldown: [{ label: 'Free-blood programmes (thalassaemia)', value: disclosed.filter((j) => j.recipient.contextKey === 'thalassaemia').length },
        { label: 'Maternal health', value: disclosed.filter((j) => j.recipient.contextKey === 'obstetric').length }],
    },
    {
      id: 'society', name: 'Society', icon: 'users',
      headline: `${transfused.length} families kept together`,
      metrics: [
        { label: 'Patients helped', value: transfused.length },
        { label: 'Children helped', value: summarise(journeys).children },
        { label: 'Medicine doses (plasma share)', value: summarise(journeys).medicineDosesShare },
      ],
      story: 'One donation can help up to three people. Your community circles multiply that — see Community.',
      drilldown: summarise(journeys).contexts.map((c) => ({ label: c.context, value: c.count })),
    },
  ];
}

module.exports = { COMPONENTS, STAGE_LABELS, donorJourneys, summarise, stakeholders, publicJourney, K_ANON };
