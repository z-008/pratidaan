/**
 * Demo controls: the jump-ahead bar moves the shared demo clock so Drop's
 * behaviour over days and weeks can be shown, and Reset puts everything back.
 * On by default because every record is synthetic; DEMO_MODE=false turns it off.
 */

const express = require('express');
const store = require('../data/store');
const drop = require('../domain/drop');
const chatCycles = require('../domain/chatCycles');
const agentPlatform = require('../ai/agentPlatform');

const router = express.Router();
const MAX_STEPS = 4 * 60; // two months, in parts of a day

const ok = (res, data) => res.json({ success: true, data });

function enabled() {
  return !['0', 'false', 'no'].includes(String(process.env.DEMO_MODE || 'true').trim().toLowerCase());
}

router.use((req, res, next) => (enabled() ? next() : res.status(404).json({ success: false, error: 'Demo mode is off' })));

router.get('/', (req, res) => ok(res, store.clock()));

/** Move forward by a number of parts of a day (4 = one day). */
router.post('/advance', (req, res) => {
  const parts = Math.max(1, Math.min(MAX_STEPS, Math.round(Number(req.body.parts) || 1)));
  for (let i = 0; i < parts; i += 1) store.stepClock();
  ok(res, store.clock());
});

/** Jump to the next moment the Donor being viewed gets a new Card. */
router.post('/next', (req, res) => {
  const donorId = String(req.body.donorId || '');
  if (!store.getDonor(donorId)) return res.status(400).json({ success: false, error: 'donorId is required' });
  return ok(res, drop.nextEvent(donorId));
});

router.post('/reset', (req, res) => {
  chatCycles.archiveCurrentCycle();
  agentPlatform.onDemoReset();
  store.resetDemo();
  ok(res, store.clock());
});

module.exports = router;
module.exports.enabled = enabled;
