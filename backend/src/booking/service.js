/** Confirm a slot, write the calendar event, and email the donor. */
const crypto = require('crypto');
const drop = require('../domain/drop');
const { findSlot, recommend } = require('../domain/bookingRank');
const { normalise, missing } = require('../domain/bookingChat');
const calendar = require('../calendar/googleCalendar');
const settings = require('../auth/userSettings');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Short code the centre's scanner can verify; it cannot be guessed from the appointment id alone. */
function checkInCode(appointmentId) {
  const secret = process.env.SESSION_SECRET || 'tracedrop-local';
  return crypto.createHmac('sha256', secret).update(`checkin:${appointmentId}`).digest('hex').slice(0, 8).toUpperCase();
}

function withCheckIn(appointment) {
  return appointment && appointment.status === 'booked' ? { ...appointment, checkInCode: checkInCode(appointment.id) } : appointment;
}

function rangeFor(slots) {
  if (!slots.length) return null;
  const dates = slots.map((slot) => slot.date).sort();
  return {
    timeMin: `${dates[0]}T00:00:00+05:30`,
    timeMax: `${dates[dates.length - 1]}T23:59:59+05:30`,
  };
}

async function availability(user, donorId, preferences, accessToken) {
  const prefs = normalise(preferences);
  let busy = null;
  let calendarConnected = false;
  if (accessToken) {
    await calendar.assertCalendarOwner(accessToken, user);
    const generated = require('../domain/bookingRank').candidates(donorId, prefs);
    const range = rangeFor(generated.slots);
    busy = range ? await calendar.freeBusy(accessToken, range.timeMin, range.timeMax) : [];
    calendarConnected = true;
  }
  const result = recommend(donorId, prefs, busy, 3);
  return { ...result, calendarConnected, searchedBusy: busy ? busy.length : 0 };
}

async function confirm(user, donor, body) {
  const prefs = normalise(body.preferences || {});
  if (missing(prefs)) throw httpError(400, 'Finish the booking questions first');
  const slot = findSlot(donor.id, prefs, body.slotId);
  if (!slot) throw httpError(400, 'That slot is not available');
  const ranked = recommend(donor.id, prefs, [], 50).slots.find((item) => item.id === slot.id);
  if (!ranked) throw httpError(400, 'That slot does not fit the chosen days, distance or centre hours');

  const appointment = {
    id: `APT-${crypto.randomUUID()}`,
    sub: user.sub,
    donorId: donor.id,
    ...slot,
    status: 'booked',
    reminderMinutes: prefs.reminderMinutes,
    eventId: null,
    emailSent: false,
  };
  const code = checkInCode(appointment.id);

  let email;
  if (body.accessToken) {
    email = await calendar.assertCalendarOwner(body.accessToken, user);
    const busy = await calendar.freeBusy(body.accessToken, `${slot.date}T00:00:00+05:30`, `${slot.date}T23:59:59+05:30`);
    if (calendarBusy(slot, busy)) throw httpError(409, 'That time is busy on your calendar. Choose another slot.');
  }

  await settings.saveAppointment(user, appointment);
  drop.recordBooking(donor.id, appointment);
  if (body.accessToken) {
    const eventId = crypto.randomUUID().replace(/-/g, '');
    await settings.saveAppointment(user, { ...appointment, eventId });
    appointment.eventId = eventId;
    try {
      const event = calendar.buildEvent({ slot, email, reminderMinutes: prefs.reminderMinutes, checkInCode: code });
      await calendar.createEvent(body.accessToken, { ...event, id: eventId });
    } catch (error) {
      appointment.calendarError = error.message;
      return withCheckIn(await settings.saveAppointment(user, appointment));
    }
    try {
      await calendar.sendConfirmation(body.accessToken, calendar.confirmationMail({ to: email, slot, reminderMinutes: prefs.reminderMinutes, checkInCode: code }));
      appointment.emailSent = true;
    } catch (error) {
      appointment.emailError = error.message;
    }
    return withCheckIn(await settings.saveAppointment(user, appointment));
  }
  return withCheckIn(appointment);
}

function calendarBusy(slot, busy) {
  const { overlaps } = require('../domain/bookingRank');
  return overlaps(slot, busy);
}

async function cancel(user, donorId, appointmentId, accessToken) {
  const list = await settings.listAppointments(user, donorId);
  const appointment = list.find((item) => item.id === appointmentId && item.status === 'booked');
  if (!appointment) throw httpError(404, 'Appointment not found');
  if (appointment.eventId && accessToken) await calendar.assertCalendarOwner(accessToken, user);
  let updated = await settings.saveAppointment(user, { ...appointment, status: 'cancelled', calendarError: null });
  drop.forgetBooking(donorId, appointment.id);
  if (appointment.eventId) {
    if (accessToken) {
      try {
        await calendar.deleteEvent(accessToken, appointment.eventId);
        updated = await settings.saveAppointment(user, { ...updated, eventId: null });
      } catch (error) {
        updated = await settings.saveAppointment(user, { ...updated, calendarError: error.message });
      }
    } else {
      updated = await settings.saveAppointment(user, { ...updated, calendarError: 'Google Calendar was not connected during cancellation' });
    }
  }
  return updated;
}

module.exports = { availability, confirm, cancel, checkInCode, withCheckIn };
