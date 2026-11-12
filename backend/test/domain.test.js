/**
 * Tests for the deterministic layer: the parts that decide safety, money and
 * privacy must be correct regardless of the AI. Run: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const health = require('../src/domain/health');
const cover = require('../src/domain/cover');
const impact = require('../src/domain/impact');
const community = require('../src/domain/community');
const donation = require('../src/domain/donation');
const labReader = require('../src/ai/labReader');
const donorRoutes = require('../src/routes/donors');
const settings = require('../src/auth/userSettings');

function postHandler(path) {
  return donorRoutes.stack.find((layer) => layer.route?.path === path).route.stack[0].handle;
}

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('lab save rechecks marker, value and real demo-date independently of extraction hints', () => {
  store.resetDemo();
  const donorId = 'D-003';
  const before = store.getObservations(donorId).length;
  const today = store.today();
  const save = (results, reportDate = today) => labReader.save(donorId, { reportDate, results });
  const valid = { marker: 'ldl', value: 350, plausible: false, name: 'wrong', unit: '%', loinc: 'wrong' };
  for (const invalid of [
    { marker: 'other', value: 100, plausible: true },
    { marker: 'ldl', value: 999, plausible: true },
    { marker: 'ldl', value: '100', plausible: true },
    { marker: 'ldl', value: Infinity, plausible: true },
    { marker: 'ldl', value: NaN, plausible: true },
  ]) {
    if (invalid.value === 999) {
      assert.equal(save([invalid]).saved, 0);
    } else {
      assert.throws(() => save([valid, invalid]), /marker and finite numeric value/);
    }
    assert.equal(store.getObservations(donorId).length, before);
  }
  for (const date of ['2026-02-30', '2026-13-01', '2026-10-11', '0000-01-01', 'yesterday', 123]) {
    assert.throws(() => save([valid], date), /Report date/);
    assert.equal(store.getObservations(donorId).length, before);
  }
  const result = save([valid, { marker: 'hb', value: 30, plausible: true }]);
  assert.equal(result.saved, 1);
  const added = store.getObservations(donorId).slice(before);
  assert.equal(added[0].key, 'ldl');
  assert.equal(added[0].code, labReader.MARKERS.ldl.loinc);
  assert.equal(added[0].unit, labReader.MARKERS.ldl.unit);
  assert.equal(added[0].source, 'uploaded_report');
  store.resetDemo();
});

test('lab save route reports invalid payloads as 400', () => {
  store.resetDemo();
  const before = store.getObservations('D-003').length;
  const res = response();
  postHandler('/:donorId/labs/save')({ donor: store.getDonor('D-003'), body: {
    reportDate: '2026-10-99', results: [{ marker: 'hb', value: 14 }],
  } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(store.getObservations('D-003').length, before);
  store.resetDemo();
});

test('check-in route resolves appointments for the account and persists demo status', async () => {
  store.resetDemo();
  const donorId = 'D-003';
  const a = { id: 'APT-test-clinical', donorId, date: store.today(), centreId: 'BC-01', status: 'booked' };
  store.session.appointments.set(donorId, [a]);
  const handler = postHandler('/:donorId/appointments/:appointmentId/checkin');
  const makeReq = (appointmentId) => ({ user: { sub: 'local', local: true }, donor: store.getDonor(donorId), params: { appointmentId }, body: {} });
  const missing = response();
  await handler(makeReq('APT-other'), missing);
  assert.equal(missing.statusCode, 400);
  assert.equal(store.getDonations(donorId).some((v) => v.appointmentId === a.id), false);
  const res = response();
  await handler(makeReq(a.id), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.demoSimulation, true);
  assert.equal(store.session.appointments.get(donorId)[0].status, 'completed');
  const repeated = response();
  await handler(makeReq(a.id), repeated);
  assert.equal(repeated.statusCode, 400);
  assert.equal(store.getDonations(donorId).filter((v) => v.appointmentId === a.id).length, 1);
  store.resetDemo();
});

test('a failed appointment status write does not create a simulated donation', async () => {
  store.resetDemo();
  const donorId = 'D-003';
  const appointment = { id: 'APT-write-fails', donorId, date: store.today(), centreId: 'BC-01', status: 'booked' };
  store.session.appointments.set(donorId, [appointment]);
  const previous = settings.saveAppointment;
  settings.saveAppointment = async () => { throw new Error('Appointment storage unavailable'); };
  try {
    const before = store.getDonations(donorId).length;
    const res = response();
    await postHandler('/:donorId/appointments/:appointmentId/checkin')({
      user: { sub: 'local', local: true }, donor: store.getDonor(donorId),
      params: { appointmentId: appointment.id }, body: {},
    }, res);
    assert.equal(res.body.success, false);
    assert.equal(appointment.status, 'booked');
    assert.equal(store.getDonations(donorId).length, before);
  } finally {
    settings.saveAppointment = previous;
    store.resetDemo();
  }
});

test('external reports change current score and cover, not historical donation scores', () => {
  store.resetDemo();
  const donorId = 'D-003';
  const history = health.scoreHistory(donorId);
  const previous = health.currentScore(donorId);
  const beforeCover = cover.evaluate(donorId);
  labReader.save(donorId, { reportDate: store.today(), results: [
    { marker: 'hba1c', value: 12 }, { marker: 'ldl', value: 350 }, { marker: 'hb', value: 8 },
  ] });
  assert.deepEqual(health.scoreHistory(donorId), history);
  const current = health.currentScore(donorId);
  assert.ok(current.score < previous.score);
  assert.equal(current.parts.find((p) => p.name === 'Haemoglobin').value, '8 g/dL');
  assert.ok(cover.evaluate(donorId).healthScore < beforeCover.healthScore);
  assert.ok(cover.evaluate(donorId).eligibleCover < beforeCover.eligibleCover);
  assert.equal(health.eligibility(donorId).eligibleNow, false);
  assert.ok(health.findings(donorId).some((finding) => finding.id === 'HB_LOW'));
  assert.deepEqual(cover.evaluate(donorId).history.map((point) => point.score), history.map((point) => point.score));
  store.resetDemo();
});

test('check-in rejects future, blocked, invalid or repeated attempts before mutation', () => {
  store.resetDemo();
  const donorId = 'D-003';
  const baseline = [store.getDonations(donorId).length, store.getObservations(donorId).length, store.getComponents(donorId).length];
  const booked = (date = store.today()) => ({ id: `APT-${date}`, date, centreId: 'BC-01', status: 'booked' });
  const future = booked(health.addDays(store.today(), 1));
  const assertUntouched = (appointment, vitals, pattern) => {
    assert.throws(() => donation.checkIn(donorId, appointment.id, vitals, [appointment]), pattern);
    assert.equal(appointment.status, 'booked');
    assert.deepEqual([store.getDonations(donorId).length, store.getObservations(donorId).length, store.getComponents(donorId).length], baseline);
  };
  assertUntouched(future, {}, /appointment day/);
  const today = booked();
  for (const vitals of [
    { haemoglobin: null }, { systolic: '' }, { pulse: NaN }, { diastolic: Infinity },
    { haemoglobin: 30 }, { weightKg: 0 }, { systolic: 110, diastolic: 120 },
  ]) assertUntouched(today, vitals, /Invalid|exceed/);
  const blocked = booked();
  assert.throws(() => donation.checkIn('D-017', blocked.id, {}, [blocked]), /eligibility/);
  assert.equal(blocked.status, 'booked');
  assert.equal(store.getDonations('D-017').filter((v) => v.appointmentId === blocked.id).length, 0);
  const foreign = { ...today, donorId: 'D-017' };
  assertUntouched(foreign, {}, /Appointment not found/);
  const result = donation.checkIn(donorId, today.id, {}, [today]);
  assert.equal(result.status, 'completed');
  assert.equal(result.demoSimulation, true);
  assert.deepEqual(result.assumedVitals.sort(), ['diastolic', 'haemoglobin', 'pulse', 'systolic', 'weightKg'].sort());
  assert.equal(store.getDonations(donorId).at(-1).appointmentId, today.id);
  const count = store.getDonations(donorId).length;
  assert.throws(() => donation.checkIn(donorId, today.id, {}, [{ ...today, status: 'booked' }]), /already checked in/);
  assert.equal(store.getDonations(donorId).length, count);
  store.resetDemo();
});

test('urgent blood pressure blocks donation and is flagged urgent', () => {
  const findings = health.findings('D-017');
  assert.equal(findings[0].id, 'BP_URGENCY');
  assert.equal(findings[0].severity, 'urgent');
  const e = health.eligibility('D-017');
  assert.equal(e.eligibleNow, false);
  assert.equal(e.nextEligibleDate, null);
});

test('low haemoglobin with falling ferritin is detected as iron deficiency', () => {
  const ids = health.findings('D-002').map((f) => f.id);
  assert.ok(ids.includes('HB_LOW'));
  assert.ok(ids.includes('IRON_LOW'));
  assert.equal(health.eligibility('D-002').eligibleNow, false);
});

test('healthy donor has no findings, a top score and top cover', () => {
  assert.deepEqual(health.findings('D-003'), []);
  const c = cover.evaluate('D-003');
  assert.equal(c.healthScore, 100);
  assert.equal(c.currentCover, 800000);
});

test('rising blood pressure trend is caught before it becomes hypertension', () => {
  const ids = health.findings('D-050').map((f) => f.id); // Karthik: 126 -> 132 -> 138
  assert.ok(ids.includes('BP_RISING'));
  assert.ok(!ids.includes('BP_GRADE1'));
});

test("Arjun's 3 Oct donation (demo overlay) shows stage 1 BP on top of the rising trend", () => {
  const ids = health.findings('D-001').map((f) => f.id);
  assert.ok(ids.includes('BP_RISING'));
  assert.ok(ids.includes('BP_GRADE1'));
});

test('cover never goes below base and never above the cap', () => {
  for (const d of store.allDonors().filter((x) => x.policyId)) {
    const c = cover.evaluate(d.id);
    assert.ok(c.currentCover >= c.baseCover, d.id);
    assert.ok(c.currentCover <= 800000, d.id);
  }
});

test('cover is monotonic in health score', () => {
  let last = 0;
  for (let s = 0; s <= 100; s += 1) {
    const { cover: value } = cover.simulate('D-001', s);
    assert.ok(value >= last, `score ${s}`);
    last = value;
  }
});

test('cover increase requires consent and consistent monitoring', () => {
  const donor = store.getDonor('D-033');
  const c = cover.evaluate('D-033');
  assert.ok(c.eligibleCover > c.baseCover);
  assert.equal(c.currentCover, c.baseCover);
  assert.equal(c.blockedBy, 'monitoring');
  const consent = donor.consent.shareHealthWithInsurer;
  donor.consent.shareHealthWithInsurer = false;
  assert.equal(cover.evaluate('D-003').currentCover, 800000);
  donor.consent.shareHealthWithInsurer = consent;
});

test('recipients are anonymised: no names, ids, exact ages or hospital names', () => {
  const allowed = new Set(['patient', 'context', 'contextKey', 'place', 'outcome', 'generalised']);
  for (const d of store.allDonors().slice(0, 80)) {
    for (const j of impact.donorJourneys(d.id)) {
      if (!j.recipient) continue;
      for (const key of Object.keys(j.recipient)) assert.ok(allowed.has(key), `unexpected field ${key}`);
      assert.doesNotMatch(JSON.stringify(j.recipient), /H-\d\d|"age"/);
      for (const e of j.events) {
        if (['transfused', 'issued', 'outcome'].includes(e.type)) assert.doesNotMatch(e.when, /^\d{4}-\d{2}-\d{2}$/);
      }
    }
  }
});

test('units from a donation with a confidential follow-up are withheld with no reason', () => {
  const journeys = impact.donorJourneys('D-033');
  const withheld = journeys.filter((j) => j.withheld);
  assert.ok(withheld.length > 0);
  for (const j of withheld) {
    assert.equal(j.recipient, null);
    assert.equal(j.status, 'withheld');
  }
});

test('community views expose only aggregates and opted-in names', () => {
  for (const c of community.forDonor('D-001')) {
    for (const row of c.leaderboard) {
      assert.deepEqual(Object.keys(row).sort(), ['donations', 'isYou', 'lastDonation', 'name', 'onlyYou', 'patientsHelped'].sort());
    }
    assert.doesNotMatch(JSON.stringify(c), /haemoglobin|systolic|hba1c|ferritin/i);
  }
});
