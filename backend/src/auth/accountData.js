/** Read and delete the account data Pratidaan stores in Azure. */

const { isEphemeral, isGuest } = require('./ephemeral');
const settings = require('./userSettings');
const calendar = require('../calendar/microsoftGraph');
const users = require('../azure/userRepository');

const local = (user) => isEphemeral(user);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function browserName(userAgent) {
  const ua = String(userAgent || '');
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'A browser';
  const system = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : null;
  return system ? `${browser} on ${system}` : browser;
}

const alreadyGone = (error) => /not found|has been deleted|ErrorItemNotFound/i.test(error.message || '');
const publicBooking = (a) => ({ id: a.id, donorId: a.donorId, date: a.date, time: a.time, centre: a.centre,
  district: a.district, status: a.status, calendar: Boolean(a.eventId) });

async function read(user) {
  const bookings = (await settings.allAppointments(user)).map(publicBooking).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  if (local(user)) {
    const guest = isGuest(user);
    return { local: !guest, guest, name: guest ? 'Guest' : 'Local development',
      email: guest ? 'Browsing without Microsoft sign-in' : 'local-dev', picture: '', firstSeen: null,
      signIns: 0, lastSignIn: null, lastBrowser: null, bookings };
  }
  const doc = await users.read(user.sub) || {};
  const profile = doc.profile || {};
  const events = doc.signIns || [];
  return { local: false, name: profile.name || user.name, email: profile.email || user.email,
    picture: profile.picture || user.picture || '', firstSeen: profile.firstSeen || events.at(-1)?.at || null,
    signIns: events.length, lastSignIn: events[0]?.at || null,
    lastBrowser: events[0] ? browserName(events[0].userAgent) : null, bookings };
}

async function deleteSignIns(user) {
  if (local(user)) return { deleted: 0 };
  let deleted = 0;
  await users.update(user.sub, (doc) => {
    deleted = (doc.signIns || []).length;
    doc.signIns = [];
    if (doc.profile) {
      delete doc.profile.firstSeen;
      delete doc.profile.lastSeen;
      delete doc.profile.signInCount;
    }
    return doc;
  });
  return { deleted };
}

async function deleteBooking(user, id, { accessToken } = {}) {
  const booking = (await settings.allAppointments(user)).find((a) => a.id === id);
  if (!booking) throw httpError(404, 'Booking not found');
  if (booking.status === 'booked') {
    if (booking.eventId) {
      if (!accessToken) throw httpError(400, 'Connect Microsoft Calendar again to remove the event');
      await calendar.assertCalendarOwner(accessToken, user);
      await calendar.deleteEvent(accessToken, booking.eventId).catch((error) => { if (!alreadyGone(error)) throw error; });
    }
    require('../domain/drop').forgetBooking(booking.donorId, booking.id);
  }
  await settings.deleteAppointment(user, booking);
  return { deleted: id };
}

async function deleteAccount(user, { accessToken, removeCalendar } = {}) {
  const bookings = await settings.allAppointments(user);
  const removeEvents = Boolean(removeCalendar && accessToken);
  if (removeEvents) await calendar.assertCalendarOwner(accessToken, user);
  let calendarRemoved = 0;
  let calendarFailed = 0;
  for (const booking of bookings) {
    if (removeEvents && booking.eventId && booking.status !== 'cancelled') {
      try { await calendar.deleteEvent(accessToken, booking.eventId); calendarRemoved += 1; }
      catch (error) { if (alreadyGone(error)) calendarRemoved += 1; else calendarFailed += 1; }
    }
    if (booking.status === 'booked') require('../domain/drop').forgetBooking(booking.donorId, booking.id);
    await settings.deleteAppointment(user, booking);
  }
  await settings.deletePreferences(user);
  const signIns = local(user) ? 0 : ((await users.read(user.sub))?.signIns || []).length;
  if (!local(user)) await users.remove(user.sub);
  return { bookings: bookings.length, calendarRemoved, calendarFailed, signIns, local: local(user) };
}

module.exports = { read, deleteSignIns, deleteBooking, deleteAccount, browserName };
