/**
 * Every donor API answers normally for the New donor, who has no donations, results,
 * blood group, Circles or insurer. Runs the real routes on a local port with sign-in off.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const store = require('../src/data/store');

let base;
let server;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { sub: 'local', email: 'local-dev', name: 'Local development', local: true }; next(); });
  app.use('/api/donors/:donorId/drop', require('../src/routes/drop'));
  app.use('/api/donors', require('../src/routes/donors'));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/donors/D-NEW`;
});
test.after(() => server.close());
test.beforeEach(() => store.resetDemo());

async function get(path) {
  const res = await fetch(`${base}${path}`);
  const body = await res.json();
  assert.equal(res.status, 200, `${path}: ${body.error}`);
  return body.data;
}

test('overview: no donations, no score, no cover linked, no Circles', async () => {
  const o = await get('/overview');
  assert.equal(o.donor.newUser, true);
  assert.deepEqual(o.donations, { completed: 0, deferred: 0, firstDate: null, litres: 0 });
  assert.equal(o.impact.patientsHelped, 0);
  assert.equal(o.health.score, null);
  assert.deepEqual(o.health.findings, []);
  assert.equal(o.cover, null);
  assert.deepEqual(o.communities, []);
  assert.equal(o.eligibility.lastDonationDate, null);
  assert.deepEqual(o.eligibility.blockers, []);
});

test('health, impact, cover, community and eligibility answer with empty values', async () => {
  const h = await get('/health');
  assert.deepEqual(h.findings, []);
  assert.deepEqual(h.scores, []);
  assert.deepEqual(h.vitals, []);
  assert.equal(h.bmi, null);
  const i = await get('/impact');
  assert.deepEqual(i.journeys, []);
  assert.equal(i.summary.patientsHelped, 0);
  const st = await get('/stakeholders');
  assert.ok(st.length > 0);
  const c = await get('/cover');
  assert.equal(c.linked, false);
  assert.equal(c.currentCover, null);
  assert.equal(c.conditions.consentToShare.met, false);
  const sim = await get('/cover/simulate?score=80');
  assert.equal(sim.cover, null);
  assert.deepEqual(await get('/communities'), []);
  const slots = await get('/slots');
  assert.equal(slots.eligibility.eligibleNow, true);
  assert.ok(slots.slots.length > 0, 'can book a first donation');
  assert.deepEqual(await get('/appointments'), []);
  assert.deepEqual(await get('/concerns'), []);
});

test("Drop answers too: an empty start and a true line on every screen", async () => {
  const v = await get('/drop');
  assert.deepEqual(v.open, []);
  assert.deepEqual(v.memory, []);
  for (const screen of ['health', 'impact', 'donate', 'cover', 'community']) {
    const line = await get(`/drop/line/${screen}`);
    assert.ok(line.text.length > 10, screen);
    assert.doesNotMatch(line.text, /null|undefined|NaN|\b0 patients/, screen);
  }
});
