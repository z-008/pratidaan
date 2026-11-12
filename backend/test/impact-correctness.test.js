const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const impact = require('../src/domain/impact');
const community = require('../src/domain/community');
const { componentStory, PRIVATE } = require('../src/domain/story');
const platform = require('../src/routes/platform');

function network() {
  let response;
  const handler = platform.stack.find((layer) => layer.route?.path === '/network').route.stack[0].handle;
  handler({}, { json: (body) => { response = body.data; } });
  return response;
}

function dateAfter(isoDate, days) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
}

test('every released recipient combination has at least five visible, non-withheld transfusions', () => {
  store.resetDemo();
  const released = store.allDonors().flatMap((d) => impact.donorJourneys(d.id)).filter((j) => j.recipient);
  const counts = new Map();
  for (const { recipient } of released) {
    const key = JSON.stringify([recipient.patient, recipient.context, recipient.contextKey, recipient.place, recipient.outcome]);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  assert.ok(counts.size > 0);
  for (const count of counts.values()) assert.ok(count >= impact.K_ANON, `released a group of ${count}`);
  assert.ok(released.some((j) => j.recipient.generalised));
});

test('sparse age/sex/outcome combinations generalise together and do not use future records', () => {
  store.resetDemo();
  const allComponents = store.allComponents;
  const allDonations = store.allDonations;
  const today = store.today();
  const tomorrow = dateAfter(today, 1);
  const hospitalId = store.institutions.hospitals[0].id;
  const donation = { id: 'PRIVACY-V', donorId: 'D-001', date: today, status: 'completed', centreId: store.institutions.bloodCentres[0].id };
  const components = Array.from({ length: 5 }, (_, i) => ({
    id: `PRIVACY-${i}`, donationId: donation.id, donorId: donation.donorId, kind: 'PRBC',
    events: [
      { type: 'collected', date: today }, { type: 'transfused', date: i === 4 ? tomorrow : today },
      { type: 'outcome', date: dateAfter(today, 2) },
    ],
    recipient: { age: i === 0 ? 9 : 32, sex: i === 0 ? 'F' : 'M', contextKey: 'test',
      context: 'Test treatment', hospitalId, outcome: 'recovered' },
  }));
  try {
    store.allComponents = () => components;
    store.allDonations = () => [donation];
    const before = components.slice(0, 4).map((c) => impact.publicJourney(c, donation).recipient);
    assert.ok(before.every((r) => r === null), 'four visible recipients must be suppressed');
    for (let i = 0; i < 4; i += 1) store.stepClock();
    const after = components.map((c) => impact.publicJourney(c, donation));
    assert.ok(after.every((j) => j.recipient));
    assert.ok(after.every((j) => j.recipient.generalised));
    assert.ok(after.every((j) => j.recipient.patient === 'Patient (age and sex not shared)'));
    assert.ok(after.every((j) => j.recipient.outcome === 'not_shared'));
    assert.ok(after.every((j) => !j.events.some((e) => e.type === 'outcome')));
    assert.ok(after.every((j) => j.recipient.contextKey === 'test'));
  } finally {
    store.allComponents = allComponents;
    store.allDonations = allDonations;
    store.resetDemo();
  }
});

test('a generalised outcome cannot be inferred from its timeline event', () => {
  store.resetDemo();
  const allComponents = store.allComponents;
  const allDonations = store.allDonations;
  const today = store.today();
  const donation = { id: 'OUTCOME-V', donorId: 'D-001', date: today, centreId: store.institutions.bloodCentres[0].id };
  const components = Array.from({ length: 5 }, (_, i) => ({
    id: `OUTCOME-${i}`, donationId: donation.id, donorId: donation.donorId, kind: 'PRBC',
    events: [{ type: 'collected', date: today }, { type: 'transfused', date: today }, { type: 'outcome', date: today }],
    recipient: { age: 45, sex: 'F', contextKey: 'test', context: 'Test treatment',
      hospitalId: store.institutions.hospitals[0].id, outcome: i === 0 ? 'ongoing' : 'recovered' },
  }));
  try {
    store.allComponents = () => components;
    store.allDonations = () => [donation];
    const journeys = components.map((c) => impact.publicJourney(c, donation));
    assert.ok(journeys.every((j) => j.recipient.outcome === 'not_shared'));
    assert.ok(journeys.every((j) => j.status === 'transfused' && !j.events.some((e) => e.type === 'outcome')));
  } finally {
    store.allComponents = allComponents;
    store.allDonations = allDonations;
    store.resetDemo();
  }
});

test('terminal journeys and stakeholders describe produced components, not stock or hospital types', () => {
  store.resetDemo();
  const journeys = store.allDonors().flatMap((d) => impact.donorJourneys(d.id));
  const expired = journeys.find((j) => j.status === 'expired');
  const withheld = journeys.find((j) => j.withheld);
  assert.ok(expired.events.some((e) => e.type === 'expired'));
  assert.ok(withheld.events.some((e) => e.type === 'withheld'));
  assert.equal(withheld.recipient, null);
  const stakeholders = impact.stakeholders('D-001');
  assert.match(stakeholders.find((s) => s.id === 'blood_bank').headline, /components produced/);
  const hospitals = stakeholders.find((s) => s.id === 'hospitals');
  assert.match(hospitals.headline, /disclosed hospital categories/);
  assert.equal(Number(hospitals.headline.match(/(\d+) disclosed hospital categories/)[1]), hospitals.drilldown.length);
});

test('network transfusion totals and date follow session writes and demo clock', () => {
  store.resetDemo();
  const today = store.today();
  const tomorrow = dateAfter(today, 1);
  const baseline = network();
  const source = store.allComponents().find((c) => c.recipient);
  const donation = { id: 'NETWORK-FUTURE-V', donorId: 'D-001', date: today, status: 'completed' };
  const component = {
    id: 'NETWORK-FUTURE-C', donationId: donation.id, donorId: donation.donorId, kind: 'PRBC',
    events: [{ type: 'collected', date: today }, { type: 'transfused', date: tomorrow }],
    recipient: { ...source.recipient },
  };
  try {
    // A session write appears immediately, and advancing the clock reveals its transfusion.
    store.addDonation(donation);
    store.addComponents(donation.donorId, [component]);
    const before = network();
    assert.equal(before.patientsHelped, baseline.patientsHelped);
    assert.equal(before.components, baseline.components + 1);
    for (let i = 0; i < 4; i += 1) store.stepClock();
    const after = network();
    assert.equal(after.asOf, tomorrow);
    assert.equal(after.patientsHelped, before.patientsHelped + 1);
    assert.equal(after.components, before.components);
  } finally {
    store.resetDemo();
  }
});

test('community opt-out removes contributions and reset restores original consent', () => {
  store.resetDemo();
  const donor = store.getDonor('D-001');
  const circle = donor.communityIds[0];
  const original = { ...donor.consent };
  const baseline = community.summary(circle, donor.id);
  const stats = impact.donorJourneys(donor.id).filter((j) => j.recipient);
  const treated = impact.summarise(impact.donorJourneys(donor.id)).patientsHelped;
  try {
    donor.consent.includeInCommunityStats = false;
    const optedOut = community.summary(circle, donor.id);
    assert.equal(optedOut.memberCount, baseline.memberCount);
    assert.equal(optedOut.totals.donations, baseline.totals.donations - store.getDonations(donor.id).filter((d) => d.status === 'completed').length);
    assert.equal(optedOut.totals.patientsHelped, baseline.totals.patientsHelped - treated);
    const expectedContexts = new Map();
    for (const { recipient } of stats) expectedContexts.set(recipient.context, (expectedContexts.get(recipient.context) || 0) + 1);
    for (const { context, count } of optedOut.contexts) {
      assert.equal(count, (baseline.contexts.find((c) => c.context === context)?.count || 0) - (expectedContexts.get(context) || 0));
    }
    assert.ok(!optedOut.leaderboard.some((m) => m.isYou));
    assert.equal(optedOut.hiddenMembers, baseline.hiddenMembers + Number(original.showOnLeaderboard));
    store.resetDemo();
    assert.deepEqual(store.getDonor(donor.id).consent, original);
    assert.deepEqual(community.summary(circle, donor.id).totals, baseline.totals);
  } finally {
    store.resetDemo();
  }
});

test("D-001's 3 Oct platelets Story is fully generalised and says details stay private", () => {
  store.resetDemo();
  const story = componentStory('D-001', 'D-001-V4-PLT');
  const text = story.slides.join(' ');
  assert.equal(story.slides.length, 4);
  assert.equal(story.slides[0], 'On 3 October 2026 you gave blood at Whitefield Community Blood Bank.');
  assert.equal(story.slides[2], 'In October 2026 they went to a hospital in Karnataka.');
  assert.ok(story.slides[3].startsWith('They helped a patient in hospital.'));
  assert.ok(text.includes(PRIVATE));
  assert.doesNotMatch(text, /Adult|Teenager|Child|Newborn|aged|female|male|not shared|Bengaluru Urban|Tumakuru/);
  assert.equal(story.postcard.headline, 'My platelets reached a patient');
  assert.equal(story.postcard.context, impact.COMPONENTS.PLT.role); // context generalised, so the role
  assert.equal(story.postcard.month, 'October 2026');
  assert.equal(story.postcard.patientsHelped, impact.summarise(impact.donorJourneys('D-001')).patientsHelped);
});

test('plasma made into medicines gets the medicines Story', () => {
  store.resetDemo();
  const story = componentStory('D-001', 'D-001-V2-FFP');
  assert.deepEqual(story.slides, [
    'On 15 July 2025 you gave blood at Whitefield Community Blood Bank.',
    'Your plasma was pooled with 2,600 donations.',
    'In May 2026 your share became about 0.5 vial of albumin, 0.2 dose of IVIG and 45 IU of factor VIII.',
  ]);
  assert.equal(story.postcard.headline, 'My plasma became medicines');
  assert.equal(story.postcard.context, 'Albumin, immunoglobulin and clotting factor');
});

test('expired, withheld and in-progress units have no Story', () => {
  store.resetDemo();
  const expired = store.allDonors().flatMap((d) => impact.donorJourneys(d.id).map((j) => [d.id, j])).find(([, j]) => j.status === 'expired');
  assert.ok(expired);
  assert.equal(componentStory(expired[0], expired[1].id), null);
  assert.equal(componentStory('D-001', 'D-001-V4-PRBC'), null); // stored, not yet used
  const withheld = store.allDonors().flatMap((d) => impact.donorJourneys(d.id).map((j) => [d.id, j])).find(([, j]) => j.withheld);
  if (withheld) assert.equal(componentStory(withheld[0], withheld[1].id), null);
});

test('Story keeps capitals in proper names', () => {
  store.resetDemo();
  const text = impact.donorJourneys('D-001').map((j) => componentStory('D-001', j.id)).filter(Boolean).flatMap((s) => s.slides).join(' ');
  assert.ok(text.includes('in Bengaluru Urban'));
  assert.ok(text.includes('a hospital in Karnataka'));
  assert.doesNotMatch(text, /bengaluru urban|karnataka|whitefield/);
});
