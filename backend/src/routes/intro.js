/**
 * Intro API: read Drop's Intro for a demo donor, answer a step, skip, replay and
 * finish. The rules live in domain/intro.js. Every response is the Intro's status,
 * its eight steps and what was chosen before (to fill in a replay).
 */

const express = require('express');
const store = require('../data/store');
const intro = require('../domain/intro');
const drop = require('../domain/drop');
const introWriter = require('../ai/introWriter');

const router = express.Router({ mergeParams: true });

router.use((req, res, next) => {
  if (!store.getDonor(req.params.donorId)) return res.status(404).json({ success: false, error: `Donor ${req.params.donorId} not found` });
  return next();
});

/** The signed-in person's first name for "You're all set, {first}" (none with sign-in off). */
function firstName(req) {
  const u = req.user;
  return u && !u.local && !u.guest && u.name ? String(u.name).split(' ')[0] : '';
}

function personal(text, first) {
  return first ? text.replace(/\{first\}/g, first) : text.replace(/, \{first\}/g, '').replace(/\{first\}/g, '');
}

/**
 * The steps shown so far and the Intro's own words, in Drop's language. Each text is
 * translated the first time it is shown in that language; what can't be stays in English.
 */
async function inLanguage(language, status, steps, ui) {
  if (language === 'en') return { steps, ui, translation: { language, fallback: false } };
  // "3 of 8" can come back with the numbers' roles swapped, so other languages get "3/8"
  ui.progress = '{n}/{total}';
  const shown = status.status === 'new' || status.status === 'running' ? status.step : 0;
  const slots = [];
  const put = (get, set) => slots.push({ get, set });
  steps.slice(0, shown).forEach((s) => {
    put(() => s.title, (t) => { s.title = t; });
    s.text.forEach((_, i) => put(() => s.text[i], (t) => { s.text[i] = t; }));
    s.after.forEach((_, i) => put(() => s.after[i], (t) => { s.after[i] = t; }));
    if (s.id !== 'language') s.buttons.forEach((b) => put(() => b.label, (t) => { b.label = t; }));
  });
  Object.keys(ui).filter((k) => k !== 'progress').forEach((k) => put(() => ui[k], (t) => { ui[k] = t; }));
  const english = slots.map((x) => x.get());
  const { texts, fallback } = await introWriter.translate(language, english);
  slots.forEach((x, i) => x.set(texts[i]));
  if (texts.every((t, i) => t === english[i])) ui.progress = intro.UI.progress; // nothing translated: plain English
  return { steps, ui, translation: { language, fallback } };
}

async function payload(req) {
  const donorId = req.params.donorId;
  const first = firstName(req);
  const status = intro.status(donorId);
  const steps = intro.steps().map((s) => ({
    ...s, text: s.text.map((t) => personal(t, first)), after: s.after.map((t) => personal(t, first)), buttons: s.buttons.map((b) => ({ ...b })),
  }));
  const ui = Object.fromEntries(Object.entries(intro.UI).map(([k, t]) => [k, personal(t, first)]));
  const language = drop.chatContext(donorId).language;
  return { ...status, ...(await inLanguage(language, status, steps, ui)), prefill: await intro.prefill(donorId, req.user) };
}

/** Run an Intro action; a rule it breaks (e.g. answering the wrong step) comes back as 400 with the reason. */
const act = (fn) => async (req, res) => {
  try {
    const result = await fn(req.params.donorId, req);
    res.json({ success: true, data: { ...(await payload(req)), ...(result && result.saved ? { saved: result.saved } : {}) } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

router.get('/', act(() => null));
router.post('/answer', act((donorId, req) => intro.answer(donorId, req.body.step, req.body.value, { user: req.user })));
router.post('/skip', act((donorId) => intro.skip(donorId)));
router.post('/replay', act((donorId) => intro.replay(donorId)));
router.post('/finish', act((donorId) => intro.finishIntro(donorId)));

module.exports = router;
