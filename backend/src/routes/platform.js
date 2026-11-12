/**
 * Platform-wide views: network impact across all donors (for the "ecosystem"
 * drill-down) and the AI console (live model status, token budget, traces).
 * Only aggregates are returned here.
 */

const express = require('express');
const store = require('../data/store');
const impact = require('../domain/impact');
const health = require('../domain/health');
const cover = require('../domain/cover');
const llm = require('../ai/llm');
const agentPlatform = require('../ai/agentPlatform');

const router = express.Router();

function network() {
  const today = store.today();
  // The network figures cover the synthetic donors; the New donor has no records to add
  const donors = store.allDonors().filter((d) => !d.newUser);
  const donations = store.allDonations();
  const completed = donations.filter((d) => d.status === 'completed' && d.date <= today);
  const components = store.allComponents().filter((c) => c.events[0]?.date <= today);
  const used = components.filter((c) => c.recipient && c.events.some((e) => e.type === 'transfused' && e.date <= today));
  const byContext = {};
  const byHospitalKind = {};
  const byKind = {};
  for (const c of components) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
  for (const c of used) {
    byContext[c.recipient.context] = (byContext[c.recipient.context] || 0) + 1;
    const h = store.hospital(c.recipient.hospitalId);
    byHospitalKind[h.kind] = (byHospitalKind[h.kind] || 0) + 1;
  }
  const expired = components.filter((c) => c.events.some((e) => e.type === 'expired' && e.date <= today)).length;

  // Population health signal from donation-sample screening (anonymised)
  let elevatedBp = 0;
  let prediabetes = 0;
  let lowHb = 0;
  let coverUp = 0;
  for (const d of donors) {
    const f = health.findings(d.id).map((x) => x.id);
    if (f.some((x) => x.startsWith('BP_') && x !== 'BP_RISING')) elevatedBp += 1;
    if (f.includes('PREDIABETES') || f.includes('DIABETES_RANGE')) prediabetes += 1;
    if (f.includes('HB_LOW')) lowHb += 1;
    if (cover.evaluate(d.id).currentCover > store.getPolicy(d.policyId).baseCover) coverUp += 1;
  }
  const pct = (n) => donors.length ? Math.round((n / donors.length) * 100) : 0;
  const repeat = donors.filter((d) => store.getDonations(d.id).filter((v) => v.status === 'completed' && v.date <= today).length >= 2).length;

  return {
    asOf: today,
    donors: donors.length,
    donations: completed.length,
    deferrals: donations.filter((d) => d.status !== 'completed' && d.date <= today).length,
    components: components.length,
    patientsHelped: used.length,
    wastage: components.length ? Math.round((expired / components.length) * 100) : 0,
    repeatDonorRate: pct(repeat),
    byKind: Object.entries(byKind).map(([kind, count]) => ({ kind, name: impact.COMPONENTS[kind].name, count })),
    byContext: Object.entries(byContext).sort((a, b) => b[1] - a[1]).map(([context, count]) => ({ context, count })),
    byHospitalKind: Object.entries(byHospitalKind).sort((a, b) => b[1] - a[1]).map(([kind, count]) => ({ kind, count })),
    screening: { elevatedBp: pct(elevatedBp), prediabetes: pct(prediabetes), lowHb: pct(lowHb), donorsWithCoverIncrease: pct(coverUp) },
    labTests: donors.reduce((s, d) => s + store.getObservations(d.id).length, 0) + completed.length * 5,
  };
}

router.get('/network', (req, res) => res.json({ success: true, data: network() }));

router.get('/ai/status', (req, res) => res.json({ success: true, data: llm.status() }));
router.get('/ai/traces', (req, res) => res.json({ success: true, data: llm.traces().slice(0, 50) }));
router.get('/agent/status', (req, res) => res.json({ success: true, data: agentPlatform.status() }));

module.exports = router;
