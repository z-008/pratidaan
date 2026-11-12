/**
 * Drop engine rules: the six walkthroughs from the Drop-first Home prototype,
 * run against the real engine and the demo clock (starts Sat 10 Oct 2026, morning).
 */

const test = require('node:test');
const assert = require('node:assert');
const store = require('../src/data/store');
const health = require('../src/domain/health');
const drop = require('../src/domain/drop');

const DAY = 4; // parts of a day on the demo clock
const advance = (parts) => { for (let i = 0; i < parts; i += 1) store.stepClock(); };
const open = (donorId) => drop.view(donorId).open;
const card = (donorId, type, variant) => open(donorId).find((c) => c.type === type && (!variant || c.variant === variant));

test.beforeEach(() => store.resetDemo());

test('results to booking: one new card a day, and the slots Arjun asked for skip the budget', () => {
  assert.deepEqual(open('D-001').map((c) => c.type), ['impact']);
  advance(DAY); // Sun 11 Oct morning: results arrive
  const results = card('D-001', 'results', 'results');
  assert.ok(results, 'results card sent');
  assert.match(results.text, /148\/94/);
  assert.equal(drop.view('D-001').budget.today, 1);
  drop.answer('D-001', results.id, 'book');
  const slots = card('D-001', 'slots', 'care');
  assert.ok(slots, 'slots card opened');
  assert.equal(drop.view('D-001').budget.today, 1, 'asked-for cards do not count');
  const view = drop.answer('D-001', slots.id, slots.chips[0].value);
  assert.ok(view.receipts.some((r) => /^Booked Sat 17 Oct/.test(r.receipt)));
});

test('budget: at most one new card a day; the rest wait', () => {
  drop.view('D-001');
  drop._addEvent('D-001', { key: 't1', kind: 'checkin', at: '2026-10-10', data: { marker: 'bp' } });
  drop._addEvent('D-001', { key: 't2', kind: 'donate', at: '2026-10-10', data: { from: '2027-01-01' } });
  drop._deliver('D-001');
  // The seeded impact card already used today's one new card
  assert.equal(open('D-001').length, 1);
  assert.equal(drop.view('D-001').waiting.length, 2);
  advance(DAY); // Sunday: results (priority 2) beats both
  assert.ok(card('D-001', 'results'));
  assert.ok(!card('D-001', 'slots', 'donate'));
});

test('quiet hours: nothing new at 9 pm; it waits until morning', () => {
  drop.view('D-001');
  advance(3); // Sat 9 pm
  drop._addEvent('D-001', { key: 't-night', kind: 'checkin', at: '2026-10-10', data: { marker: 'bp' } });
  drop._deliver('D-001');
  assert.ok(!card('D-001', 'checkin'));
  assert.ok(drop.view('D-001').budget.quiet);
});

test('urgent cards come first, cannot be hidden and can only wait an hour', () => {
  const urgent = card('D-017', 'urgent');
  assert.ok(urgent);
  assert.throws(() => drop.hide('D-017', urgent.id), /can't be hidden/);
  assert.throws(() => drop.snooze('D-017', urgent.id, 'tomorrow'), /an hour/);
  drop.snooze('D-017', urgent.id, 'hour');
  assert.ok(!card('D-017', 'urgent'));
  advance(1);
  assert.ok(card('D-017', 'urgent'), 'back after an hour');
});

test('snoozed three times, a card folds into the next weekly report', () => {
  advance(DAY);
  let results = card('D-001', 'results', 'results');
  drop.snooze('D-001', results.id, 'tonight'); // 7 pm, not in quiet hours
  advance(2);
  results = card('D-001', 'results', 'results');
  assert.ok(results, 'back at 7 pm');
  drop.snooze('D-001', results.id, 'tomorrow');
  advance(2);
  results = card('D-001', 'results', 'results');
  drop.snooze('D-001', results.id, 'week');
  assert.ok(drop.view('D-001').later.some((l) => l.label === 'Results' && l.status === 'folded'));
});

test('Sunday afternoon report folds in what is waiting, with a button to answer it', () => {
  advance(DAY); // Sun morning
  drop.answer('D-001', card('D-001', 'results').id, 'book');
  drop._addEvent('D-001', { key: 't-wait', kind: 'checkin', at: '2026-10-11', data: { marker: 'bp' } });
  advance(1); // Sun afternoon: report
  const report = card('D-001', 'report');
  assert.ok(report);
  assert.ok(report.chips.some((c) => /Check-in/.test(c.label)), 'waiting check-in offered from the report');
  drop.answer('D-001', report.id, report.chips.find((c) => /Check-in/.test(c.label)).value);
  assert.ok(card('D-001', 'checkin', 'bp'));
});

test('a week unanswered, a card folds into the report', () => {
  drop.view('D-001');
  advance(DAY * 7);
  assert.ok(!card('D-001', 'impact'));
  assert.ok(drop.view('D-001').later.some((l) => l.reason === 'unanswered for a week'));
});

test('memory: weekday evenings replace Saturdays, with an undo line', () => {
  advance(DAY);
  drop.answer('D-001', card('D-001', 'results').id, 'book');
  const view = drop.answer('D-001', card('D-001', 'slots', 'care').id, 'evenings');
  assert.ok(view.memory.some((m) => /evenings/.test(m.text)));
  assert.ok(!view.memory.some((m) => /Saturdays/.test(m.text)));
  assert.match(view.memReceipt, /replaces "Saturdays suit you"/);
  assert.match(card('D-001', 'slots', 'care').text, /Weekday evenings/);
  assert.ok(drop.undoMemory('D-001').memory.some((m) => /Saturdays/.test(m.text)));
});

test('reminders: outside the budget, and unanswered ones become "no answer"', () => {
  advance(DAY);
  const st = drop._state('D-001');
  st.reminders.push({ id: 'r-test', label: 'BP tablet', time: '21:00' });
  advance(3); // Sun 9 pm
  const r = card('D-001', 'reminder', 'due');
  assert.ok(r, 'reminder shows at night');
  advance(1); // Mon morning
  assert.ok(!card('D-001', 'reminder', 'due'));
  assert.equal(st.reminderLog[0].answer, 'no answer');
});

test("Meera's report with Hb 12.6 clears her deferral and brings the goal card at once", () => {
  assert.equal(health.eligibility('D-002').eligibleNow, false);
  const checkin = card('D-002', 'checkin', 'hb');
  drop.answer('D-002', checkin.id, { value: 12.6, date: '2026-10-08', source: 'sample report' });
  assert.equal(health.eligibility('D-002').eligibleNow, true);
  assert.match(card('D-002', 'results', 'goal').text, /12\.6/);
  drop.undo('D-002');
  assert.equal(health.eligibility('D-002').eligibleNow, false, 'undo removes the uploaded result');
});

const tools = require('../src/ai/tools');
const screenLines = require('../src/domain/screenLines');
const { keepsFacts } = require('../src/ai/dropWriter');

test('chat memory: preferences are kept, health facts are refused', () => {
  assert.ok(tools.run('remember', { fact: 'I take my BP tablet at night' }, 'D-001').error);
  assert.ok(tools.run('remember', { fact: 'You take metformin 500 mg' }, 'D-001').error);
  const day = tools.run('remember', { category: 'schedule_day', value: 'weekday' }, 'D-001');
  assert.match(day._ui.text, /replaces "Saturdays suit you"/);
  const time = tools.run('remember', { category: 'schedule_time', value: 'evening' }, 'D-001');
  assert.equal(time.remembered, 'Evenings suit you');
});

test('a reading told in chat lands in Health and moves the BP goal line', () => {
  drop.answer('D-001', (advance(DAY), card('D-001', 'results', 'results')).id, 'ok');
  // His BP Goal comes from his results, so there's no Plan to save first
  tools.run('log_reading', { systolic: 141, diastolic: 90 }, 'D-001');
  assert.match(screenLines.line('D-001', 'health').text, /^BP 141\/90 on .*, down from 148\. Target: BP under 130\/80\.$/);
  assert.throws(() => tools.run('log_reading', { systolic: 60, diastolic: 90 }, 'D-001'), /out of range/);
});

test('every screen has a true line for every demo Persona', () => {
  for (const id of ['D-001', 'D-002', 'D-003', 'D-017', 'D-050', 'D-033']) {
    for (const screen of Object.keys(screenLines.SCREENS)) assert.ok(screenLines.line(id, screen).text.length > 10, `${id} ${screen}`);
  }
});

test('switching language clears AI wording so open Cards are rewritten', () => {
  const [{ sig }] = drop.openForWriting('D-001');
  const c = card('D-001', 'impact');
  drop.setAi('D-001', c.id, { text: 'AI text with 3 Oct', labels: null, sig });
  assert.equal(card('D-001', 'impact').text, 'AI text with 3 Oct');
  drop.setLanguage('D-001', 'kn');
  assert.notEqual(card('D-001', 'impact').text, 'AI text with 3 Oct');
  assert.throws(() => drop.setLanguage('D-001', 'xx'), /Unsupported/);
});

test('AI wording allows cosmetic changes but rejects unverified paraphrases and missing numbers', () => {
  assert.ok(keepsFacts('BP 148/94, up (132, 136, 148).', 'BP 148/94: up (132, 136, 148)!'));
  assert.ok(!keepsFacts('BP 148/94, up (132, 136, 148).', 'Your BP was 148/94: 132, 136 then 148.'));
  assert.ok(!keepsFacts('BP 148/94, up (132, 136, 148).', 'Your BP went up to 148.'));
});

test('demo booking cards keep rule wording and slot labels even when AI offers replacements', () => {
  advance(DAY);
  drop.answer('D-001', card('D-001', 'results', 'results').id, 'book');
  const slots = drop.openForWriting('D-001').find((p) => p.card.variant === 'care');
  drop.setAi('D-001', slots.card.id, { text: 'Saturdays: pick one', labels: { chips: ['Sat A', 'Sat B', 'Sat C', 'Evenings'] }, sig: slots.sig });
  const before = card('D-001', 'slots', 'care');
  assert.equal(before.byAi, false);
  assert.equal(before.text, before.ruleText);
  assert.match(before.chips[0].label, /17 Oct/);
  drop.answer('D-001', slots.card.id, 'evenings');
  const after = card('D-001', 'slots', 'care');
  assert.equal(after.byAi, false);
  assert.match(after.chips[0].label, /18:30/);
});

test('Next event follows the Donor being viewed and skips their routine reminders', () => {
  drop.view('D-002'); // Meera has a daily 2 pm reminder
  drop.nextEvent('D-001');
  assert.equal(store.clock().date, '2026-10-11', "Arjun's results, not Meera's reminder");
});

test('a booked check-up shows as coming up, and can be changed or cancelled later', () => {
  advance(DAY);
  drop.answer('D-001', card('D-001', 'results', 'results').id, 'book');
  assert.equal(drop.view('D-001').receipts.length, 0, 'no "booking…" receipt: the slots card is the response');
  const slots = card('D-001', 'slots', 'care');
  drop.answer('D-001', slots.id, slots.chips[0].value);
  advance(1); // Undo is gone once time moves on
  const [booking] = drop.view('D-001').bookings;
  assert.ok(booking, 'listed as coming up');
  drop.cancelBooking('D-001', booking.id, { reschedule: true });
  assert.equal(drop.view('D-001').bookings.length, 0);
  assert.ok(card('D-001', 'slots', 'care'), 'Change offers new slots');
  assert.ok(drop._state('D-001').events.every((e) => !e.key.startsWith('postvisit:') || e.status === 'cancelled'), 'no "how did it go?" for a cancelled visit');
});

/* ------------------------------------------------------------------ new Badges (Story and Badge spec section 5) */

const donation = require('../src/domain/donation');

/** Vikram (D-017, 4 patients) gets a 20 Sep 2026 donation whose units are transfused on the given days. */
function vikramUnits(units) {
  const adult = store.getComponents('D-017').find((c) => c.recipient).recipient;
  const d = '2026-09-20';
  store.addDonation({ id: 'D-017-T1', donorId: 'D-017', date: d, status: 'completed', centreId: 'BC-02', confidentialFollowUp: false });
  store.getDonations('D-017').sort((a, z) => a.date.localeCompare(z.date));
  store.addComponents('D-017', units.map(({ kind, on, age }) => ({
    id: `D-017-T1-${kind}`, donationId: 'D-017-T1', donorId: 'D-017', kind, bloodGroup: 'A+', fractionation: null, recipient: { ...adult, age: age ?? adult.age },
    events: [{ type: 'collected', date: d }, { type: 'separated', date: d }, { type: 'tested', date: '2026-09-21' }, { type: 'stored', date: '2026-09-21' }, { type: 'issued', date: on }, { type: 'transfused', date: on }],
  })));
}
const until = (donorId, find, days = 30) => {
  for (let i = 0; i < days * DAY; i += 1) { const c = find(open(donorId)); if (c) return c; store.stepClock(); }
  return null;
};
const reportFrom = (donorId, from) => until(donorId, (list) => list.find((c) => c.type === 'report' && c.createdOn >= from));
const newIds = (donorId) => drop.newBadges(donorId).map((b) => b.id);

test('Badges earned before Drop started are never New, and a seeded impact Card keeps its postcard', () => {
  for (const id of ['D-001', 'D-002', 'D-003', 'D-017', 'D-050', 'D-033']) assert.deepEqual(newIds(id), [], id);
  const c = card('D-001', 'impact');
  assert.equal(c.last.postcard.component, 'Platelets');
  assert.equal(c.badgeSlide, null);
  assert.equal(screenLines.line('D-001', 'impact').text.includes('Badge'), false);
});

test("a Badge completed by an impact Card's unit replaces the postcard", () => {
  vikramUnits([{ kind: 'PRBC', on: '2026-10-12' }]);
  drop.view('D-017');
  const c = until('D-017', (list) => list.find((x) => x.type === 'impact'));
  assert.ok(c, 'impact card sent');
  assert.equal(c.last.badge.id, 'patients_5');
  assert.equal(c.last.held, 6, 'his 4, Regular donor from the added donation, and this one');
  assert.deepEqual(c.badgeSlide, { at: c.story.length, ids: ['patients_5'] });
  assert.deepEqual(newIds('D-017'), ['patients_5'], 'New until the Donor reaches the slide');
  assert.equal(screenLines.line('D-017', 'impact').text, "You earned 5 patients in October 2026. It's on your shelf below.");
  drop.seeBadges('D-017', c.badgeSlide.ids);
  assert.deepEqual(newIds('D-017'), []);
  // Shown in the Story, so the report doesn't repeat it
  assert.ok(!reportFrom('D-017', '2026-10-18').story.some((s) => /New Badge/.test(s)));
});

test('a Badge completed by a later unit, by plasma or by Regular donor lands in the report', () => {
  // A later unit of the donation: Helped a child
  vikramUnits([{ kind: 'PRBC', on: '2026-10-12' }, { kind: 'PLT', on: '2026-10-14', age: 9 }]);
  drop.view('D-017');
  const week = reportFrom('D-017', '2026-10-18');
  assert.deepEqual(week.badgeSlide, { at: week.story.indexOf('New Badge: Helped a child. Share it from your Badges on My Impact.'), ids: ['helped_child'] });
  assert.ok(week.badgeSlide.at >= 0);
  assert.equal(week.last, null, 'no share buttons in a report');

  // Plasma made into medicines, for the New donor (monthly report, first Sunday of the month)
  store.resetDemo();
  const plasma = store.allComponents().find((c) => c.kind === 'PLASMA' && c.fractionation);
  drop.view('D-NEW');
  store.addDonation({ id: 'D-NEW-T1', donorId: 'D-NEW', date: '2026-09-01', status: 'completed', centreId: 'BC-01', confidentialFollowUp: false });
  store.addComponents('D-NEW', [{ id: 'D-NEW-T1-PLASMA', donationId: 'D-NEW-T1', donorId: 'D-NEW', kind: 'PLASMA', bloodGroup: 'O+', recipient: null, fractionation: plasma.fractionation,
    events: [{ type: 'collected', date: '2026-09-01' }, { type: 'separated', date: '2026-09-01' }, { type: 'tested', date: '2026-09-02' }, { type: 'fractionation', date: '2026-09-20' }, { type: 'products_released', date: '2026-10-13' }] }]);
  const month = reportFrom('D-NEW', '2026-11-01');
  assert.ok(month.story.includes('New Badges: Nothing wasted, Plasma to medicine. Share them from your Badges on My Impact.'));

  // Regular donor: Rohan (D-033) checks in a third donation
  store.resetDemo();
  drop.view('D-033');
  const apt = { id: 'APT-T', date: store.today(), centreId: 'BC-01', status: 'booked' };
  donation.checkIn('D-033', apt.id, {}, [apt]);
  assert.deepEqual(newIds('D-033'), ['regular_donor'], 'New on the day it is earned');
  assert.ok(reportFrom('D-033', '2026-11-01').story.includes('New Badge: Regular donor. Share it from your Badges on My Impact.'));
});

test("an impact Card's own unit is not repeated in the report; a later unit of the same donation is", () => {
  // Vikram: the red cells get the Card, the platelets two days later go in the report
  vikramUnits([{ kind: 'PRBC', on: '2026-10-12' }, { kind: 'PLT', on: '2026-10-14' }]);
  drop.view('D-017');
  const week = reportFrom('D-017', '2026-10-18');
  assert.deepEqual(week.story.filter((s) => /^My .* helped a patient/.test(s)).map((s) => s.split(' from ')[0]), ['My platelets']);

  // Arjun: his seeded Card's platelets reached a patient before Drop started, so his red cells (15 Oct) are the first unit Drop sees, yet a later one
  store.resetDemo();
  drop.view('D-001');
  const arjun = reportFrom('D-001', '2026-10-18');
  assert.deepEqual(arjun.story.filter((s) => /^My .* helped a patient/.test(s)).map((s) => s.split(' from ')[0]), ['My red blood cells']);
});

test('two Badges at once: the Story carries the first, the report and Drop\'s line list the rest', () => {
  vikramUnits([{ kind: 'PRBC', on: '2026-10-12', age: 9 }]);
  drop.view('D-017');
  const c = until('D-017', (list) => list.find((x) => x.type === 'impact'));
  assert.equal(c.last.badge.id, 'patients_5', 'first in shelf order');
  assert.deepEqual(newIds('D-017'), ['patients_5', 'helped_child']);
  assert.equal(screenLines.line('D-017', 'impact').text, 'You earned 2 new Badges: 5 patients and Helped a child.');
  const week = reportFrom('D-017', '2026-10-18');
  assert.ok(week.story.includes('New Badge: Helped a child. Share it from your Badges on My Impact.'));
  assert.ok(!week.story.some((s) => /^New Badge.*5 patients/.test(s)), 'the Story already showed 5 patients');
});

test('"New" survives undo\'s snapshot and clears on reset', () => {
  vikramUnits([{ kind: 'PRBC', on: '2026-10-12' }]);
  drop.view('D-017');
  const c = until('D-017', (list) => list.find((x) => x.type === 'impact'));
  drop.answer('D-017', c.id, 'seen'); // closed the Story before its last slide
  drop.undo('D-017');
  assert.deepEqual(newIds('D-017'), ['patients_5'], 'still New after undo');
  drop.seeBadges('D-017', c.badgeSlide.ids);
  drop.answer('D-017', c.id, 'seen');
  drop.undo('D-017');
  assert.deepEqual(newIds('D-017'), [], 'undo cannot make a seen Badge New again');
  assert.equal(card('D-017', 'impact').last.badge.id, 'patients_5', 'the Story keeps its Badge after undo');
  store.resetDemo();
  assert.deepEqual(newIds('D-017'), []);
  assert.deepEqual(drop._state('D-017').badgesShown.filter((b) => b === 'patients_5'), [], 'reset starts Drop over');
});

test('earning a Badge never adds a Card or uses the budget', () => {
  const before = drop.view('D-033');
  const created = drop._state('D-033').created;
  const apt = { id: 'APT-T', date: store.today(), centreId: 'BC-01', status: 'booked' };
  donation.checkIn('D-033', apt.id, {}, [apt]);
  drop._deliver('D-033');
  const after = drop.view('D-033');
  assert.deepEqual(newIds('D-033'), ['regular_donor']);
  assert.equal(drop._state('D-033').created, created);
  assert.deepEqual(after.open.map((c) => c.id), before.open.map((c) => c.id));
  assert.equal(after.budget.today, before.budget.today);
  assert.equal(after.budget.week, before.budget.week);
});
