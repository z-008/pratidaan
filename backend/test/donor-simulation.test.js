const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const concerns = require('../src/domain/concerns');
const drop = require('../src/domain/drop');

test.beforeEach(() => store.resetDemo());

const card = (donorId, type, variant) => drop.view(donorId).open.find((c) => c.type === type && (!variant || c.variant === variant));
const advanceDays = (days) => { for (let i = 0; i < days * 4; i += 1) store.stepClock(); };

test('concern walkthrough never claims delivery, real acknowledgement, or real authority reply', () => {
  const raised = concerns.raise('D-001', { category: 'tracking', details: 'Timeline looks wrong' });
  assert.match(raised.steps[0].text, /Concern saved.*Nothing was sent/);
  advanceDays(3);
  const example = concerns.list('D-001')[0];
  assert.ok(example.answered);
  assert.ok(example.steps.some((s) => /Illustrative acknowledgement.*no acknowledgement was sent or received/.test(s.text)));
  assert.ok(example.steps.some((s) => /Illustrative answer.*Illustrative reply \(not from/.test(s.text)));
  const escalated = concerns.escalate('D-001', raised.id);
  assert.ok(escalated.steps.some((s) => /Escalated to.*No authority was contacted/.test(s.text)));
  assert.ok(concerns.resolve('D-001', raised.id).steps.some((s) => /no external case was resolved/.test(s.text)));
});

test('privacy and conduct demo replies disclose no insurer or clinic contact', () => {
  for (const category of ['privacy', 'conduct']) {
    const raised = concerns.raise('D-001', { category });
    advanceDays(3);
    const reply = concerns.list('D-001').find((c) => c.id === raised.id).steps.find((s) => s.text.startsWith('Illustrative answer'));
    assert.match(reply.text, /Illustrative reply \(not from a centre\)/);
    assert.match(reply.text, category === 'privacy' ? /does not share.*insurer/ : /No staff were contacted/);
  }
});

test('urgent call choice does not call and care bookings never reserve a clinic', () => {
  const urgent = card('D-017', 'urgent');
  assert.match(urgent.text, /not clinic appointments/);
  assert.ok(urgent.chips.some((chip) => chip.label === 'I will seek real care'));
  assert.match(drop.answer('D-017', urgent.id, 'call').receipts[0].receipt, /No clinic was called/);

  const offered = drop.offerCard('D-001', 'care_slots');
  assert.match(offered.text, /No real clinic is reserved/);
  assert.match(offered.chips[0].label, /\d{1,2} \w{3}/);
  const booking = drop.answer('D-001', offered.id, offered.chips[0].value);
  assert.match(booking.receipts[0].receipt, /No clinic reservation was made/);
  assert.equal(booking.bookings[0].kind, 'care');
});

test('Drop donation receipt names its in-memory booking; guided bookings require Donate for cancellation', () => {
  assert.ok(drop.view('D-001').earlier.some((e) => e.receipt.includes('No real centre reservation')));
  const seeded = card('D-033', 'slots', 'donate');
  assert.ok(seeded);
  assert.match(seeded.text, /रक्तदान|वास्तविक केंद्र/);
  const local = drop.answer('D-033', seeded.id, seeded.chips[0].value);
  assert.match(local.receipts[0].receipt, /Booked to donate.*no centre reservation/);

  drop.recordBooking('D-001', { id: 'APT-guided-example', date: '2026-10-17', time: '10:00', centre: 'Example centre' });
  const guided = drop.view('D-001').bookings.find((b) => b.id === 'APT-guided-example');
  assert.equal(guided.guided, true);
  assert.throws(() => drop.cancelBooking('D-001', guided.id), /use Donate/);
  assert.ok(drop.view('D-001').bookings.some((b) => b.id === guided.id));
  assert.ok(drop.cancelBooking('D-033', local.bookings[0].id).bookings.every((b) => b.id !== local.bookings[0].id));
});
