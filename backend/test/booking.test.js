const test = require('node:test');
const assert = require('node:assert/strict');

const { turn, normalise } = require('../src/domain/bookingChat');
const { haversineKm, overlaps, rankSlots, recommend, findSlot } = require('../src/domain/bookingRank');
const cover = require('../src/domain/cover');
const calendar = require('../src/calendar/googleCalendar');
const { reminderOverrides, buildEvent, confirmationMail, assertCalendarOwner } = calendar;
const booking = require('../src/booking/service');
const settings = require('../src/auth/userSettings');
const store = require('../src/data/store');

function prefs(extra = {}) {
  return normalise({
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    timeWindows: ['morning'],
    maxDistanceKm: 15,
    avoidHolidays: true,
    reminderMinutes: [1440, 120],
    location: { label: 'Bengaluru Urban', lat: 12.97, lng: 77.59, source: 'manual' },
    ...extra,
  });
}

function slot(extra) {
  return {
    id: extra.id, date: '2026-10-13', time: '09:30', window: 'morning', weekday: 'tue',
    lat: 12.9716, lng: 77.5946, holiday: false, downtime: false,
    centre: 'Bengaluru Central Blood Centre', district: 'Bengaluru Urban', centreId: 'BC-01', ...extra,
  };
}

test('booking questions advance one at a time', () => {
  const first = turn({});
  assert.equal(first.step, 'days');
  const ignored = turn(first.preferences, { step: 'times', value: 'morning' });
  assert.equal(ignored.step, 'days');
  const days = turn(first.preferences, { step: 'days', value: 'weekdays' });
  assert.equal(days.step, 'times');
  assert.deepEqual(days.preferences.days, ['mon', 'tue', 'wed', 'thu', 'fri']);
});

test('a district answer is stored as an approximate location', () => {
  let state = turn({});
  for (const answer of [
    { step: 'days', value: 'any' },
    { step: 'times', value: 'morning' },
    { step: 'distance', value: '15' },
    { step: 'holidays', value: 'yes' },
  ]) state = turn(state.preferences, answer);
  state = turn(state.preferences, { step: 'place', value: { label: 'Here', lat: 12.97194, lng: 77.59369, source: 'gps' } });
  assert.equal(state.ready, true);
  assert.deepEqual(state.preferences.location, { label: 'Here', lat: 12.97, lng: 77.59, source: 'gps' });
  assert.deepEqual(state.preferences.reminderMinutes, [1440]);
});

test('distance, holidays, downtime and calendar clashes remove slots', () => {
  const ready = prefs();
  const ranked = rankSlots([
    slot({ id: 'near', date: '2026-10-14' }),
    slot({ id: 'holiday', holiday: true }),
    slot({ id: 'down', downtime: true }),
    slot({ id: 'far', lat: 12.2958, lng: 76.6394 }),
    slot({ id: 'busy' }),
  ], ready, [{ start: '2026-10-13T09:00:00+05:30', end: '2026-10-13T10:00:00+05:30' }]);
  assert.deepEqual(ranked.map((item) => item.id), ['near']);
  assert.ok(ranked[0].reasons.some((reason) => reason.includes('km away')));
  assert.ok(haversineKm({ lat: 12.97, lng: 77.59 }, { lat: 12.2958, lng: 76.6394 }) > 100);
  assert.equal(overlaps(slot({ id: 'busy' }), [{ start: '2026-10-13T09:00:00+05:30', end: '2026-10-13T10:00:00+05:30' }]), true);
});

test('selected days constrain suggested and confirmable slots', () => {
  const monday = prefs({ days: ['mon'] });
  const slots = recommend('D-003', monday, [], 50).slots;
  assert.ok(slots.length > 0);
  assert.ok(slots.every((item) => item.weekday === 'mon'));
  assert.equal(findSlot('D-003', monday, 'BC-01-2026-10-10-09:30'), null);
});

test('cover scenarios reject scores outside the health scale', () => {
  for (const score of [-200, 101, Number.NaN, Infinity]) {
    assert.throws(() => cover.simulate('D-001', score), /between 0 and 100/);
  }
});

test('a booking email and calendar reminders are both created', () => {
  const event = buildEvent({ slot: slot({ id: 'near' }), email: 'a@gmail.com', reminderMinutes: [1440, 120] });
  assert.equal(event.start.dateTime, '2026-10-13T09:30:00+05:30');
  assert.match(event.description, /not a reservation/);
  assert.deepEqual(event.attendees, [{ email: 'a@gmail.com' }]);
  assert.deepEqual(reminderOverrides([1440, 120]), [
    { method: 'email', minutes: 1440 }, { method: 'popup', minutes: 1440 },
    { method: 'email', minutes: 120 }, { method: 'popup', minutes: 120 },
  ]);
  assert.equal(reminderOverrides([1440, 120, 60]).length, 5);
  const mail = confirmationMail({ to: 'a@gmail.com', slot: slot({ id: 'near' }), reminderMinutes: [1440], checkInCode: 'AB12CD34' });
  assert.match(mail.text, /09:30/);
  assert.match(mail.text, /AB12CD34/);
  assert.match(mail.text, /1 day before/);
  assert.match(mail.text, /not a reservation/);
  assert.ok(mail.raw.length > 20);
});

test('a calendar token for a different Google account is rejected', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ email: 'other@gmail.com' }) });
  await assert.rejects(
    () => assertCalendarOwner('token', { email: 'a@gmail.com', local: false }, fetchImpl),
    /does not match/,
  );
});

test('Calendar event ID is saved before creation and cancellation survives missing access', async () => {
  store.resetDemo();
  const originals = { save: settings.saveAppointment, list: settings.listAppointments, owner: calendar.assertCalendarOwner,
    busy: calendar.freeBusy, create: calendar.createEvent, mail: calendar.sendConfirmation };
  const saved = [];
  let created = null;
  settings.saveAppointment = async (_user, appointment) => {
    const copy = { ...appointment };
    saved.push(copy);
    return originals.save({ sub: 'local', local: true }, copy);
  };
  settings.listAppointments = async (_user, donorId) => originals.list({ sub: 'local', local: true }, donorId);
  calendar.assertCalendarOwner = async () => 'donor@example.com';
  calendar.freeBusy = async () => [];
  calendar.createEvent = async (_token, event) => {
    created = event;
    assert.ok(saved.some((a) => a.eventId === event.id && a.status === 'booked'));
    return { id: event.id };
  };
  calendar.sendConfirmation = async () => {};
  try {
    const user = { sub: 'local', local: true };
    const { slots } = recommend('D-003', prefs(), [], 50);
    const booked = await booking.confirm(user, store.getDonor('D-003'), { preferences: prefs(), slotId: slots[0].id, accessToken: 'token' });
    assert.match(created.id, /^[a-f0-9]{32}$/);
    assert.equal(booked.eventId, created.id);
    assert.equal(booked.emailSent, true);
    const cancelled = await booking.cancel(user, 'D-003', booked.id);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.eventId, created.id);
    assert.match(cancelled.calendarError, /not connected/);
  } finally {
    settings.saveAppointment = originals.save;
    settings.listAppointments = originals.list;
    calendar.assertCalendarOwner = originals.owner;
    calendar.freeBusy = originals.busy;
    calendar.createEvent = originals.create;
    calendar.sendConfirmation = originals.mail;
    store.resetDemo();
  }
});
