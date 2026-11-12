/**
 * What Pratidaan keeps about the signed-in Google account, and deleting it ("Your data").
 * In Firestore: the user record (name, email, photo, sign-in count, donation preferences),
 * one sign-in record per sign-in, and every booking. With sign-in off (a laptop) there is
 * only the server's in-memory copy of the preferences and bookings.
 */

const { isEphemeral, isGuest } = require('./ephemeral');
const settings = require('./userSettings');
const calendar = require('../calendar/googleCalendar');

let db;

function firestore() {
  if (!db) {
    const { Firestore } = require('@google-cloud/firestore');
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    db = new Firestore(projectId ? { projectId } : {});
  }
  return db;
}

const local = (user) => isEphemeral(user);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** "Chrome on Mac" from a browser's user agent string. */
function browserName(userAgent) {
  const ua = String(userAgent || '');
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'A browser';
  const system = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : null;
  return system ? `${browser} on ${system}` : browser;
}

// An event someone already deleted in Google Calendar (Google answers "Not Found" or "Resource has been deleted")
const alreadyGone = (error) => /not found|has been deleted/i.test(error.message || '');

const publicBooking = (a) => ({
  id: a.id, donorId: a.donorId, date: a.date, time: a.time, centre: a.centre, district: a.district, status: a.status, calendar: Boolean(a.eventId),
});

async function signInDocs(user) {
  return (await firestore().collection('accessEvents').where('sub', '==', user.sub).get()).docs;
}

async function deleteDocs(docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = firestore().batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/** The account's profile, sign-in history and bookings, for "Your data". */
async function read(user) {
  const bookings = (await settings.allAppointments(user)).map(publicBooking).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  if (local(user)) {
    const guest = isGuest(user);
    return {
      local: !guest,
      guest,
      name: guest ? 'Guest' : 'Local development',
      email: guest ? 'Browsing without Google sign-in' : 'local-dev',
      picture: '',
      firstSeen: null,
      signIns: 0,
      lastSignIn: null,
      lastBrowser: null,
      bookings,
    };
  }
  const doc = await firestore().collection('users').doc(user.sub).get();
  const profile = doc.exists ? doc.data() : {};
  const events = (await signInDocs(user)).map((d) => d.data()).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return {
    local: false,
    name: profile.name || user.name,
    email: profile.email || user.email,
    picture: profile.picture || user.picture || '',
    firstSeen: events.length ? events[events.length - 1].at : null,
    signIns: events.length,
    lastSignIn: events[0] ? events[0].at : null,
    lastBrowser: events[0] ? browserName(events[0].userAgent) : null,
    bookings,
  };
}

/** Delete every sign-in record and the counts kept on the user record. */
async function deleteSignIns(user) {
  if (local(user)) return { deleted: 0 };
  const docs = await signInDocs(user);
  await deleteDocs(docs);
  const ref = firestore().collection('users').doc(user.sub);
  if ((await ref.get()).exists) {
    const { FieldValue } = require('@google-cloud/firestore');
    await ref.update({ firstSeen: FieldValue.delete(), lastSeen: FieldValue.delete(), signInCount: FieldValue.delete() });
  }
  return { deleted: docs.length };
}

/** Delete one booking; one still to come is cancelled first, and its Calendar event removed. */
async function deleteBooking(user, id, { accessToken } = {}) {
  const booking = (await settings.allAppointments(user)).find((a) => a.id === id);
  if (!booking) throw httpError(404, 'Booking not found');
  if (booking.status === 'booked') {
    if (booking.eventId) {
      if (!accessToken) throw httpError(400, 'Connect Google Calendar again to remove the event');
      await calendar.assertCalendarOwner(accessToken, user);
      await calendar.deleteEvent(accessToken, booking.eventId).catch((error) => { if (!alreadyGone(error)) throw error; });
    }
    require('../domain/drop').forgetBooking(booking.donorId, booking.id);
  }
  await settings.deleteAppointment(user, booking);
  return { deleted: id };
}

/**
 * Delete the account: every booking (cancelling upcoming ones first, and removing the
 * Calendar events Pratidaan added when asked), every sign-in record, and the user record
 * with its donation preferences. With sign-in off this clears the in-memory copies.
 */
async function deleteAccount(user, { accessToken, removeCalendar } = {}) {
  const bookings = await settings.allAppointments(user);
  const removeEvents = Boolean(removeCalendar && accessToken);
  if (removeEvents) await calendar.assertCalendarOwner(accessToken, user);
  let calendarRemoved = 0;
  let calendarFailed = 0;
  for (const booking of bookings) {
    // An event that can't be removed doesn't stop the account being deleted; the page says how many are left
    if (removeEvents && booking.eventId && booking.status !== 'cancelled') {
      try {
        await calendar.deleteEvent(accessToken, booking.eventId);
        calendarRemoved += 1;
      } catch (error) {
        if (alreadyGone(error)) calendarRemoved += 1;
        else calendarFailed += 1;
      }
    }
    if (booking.status === 'booked') require('../domain/drop').forgetBooking(booking.donorId, booking.id);
    await settings.deleteAppointment(user, booking);
  }
  await settings.deletePreferences(user);
  let signIns = 0;
  if (!local(user)) {
    const docs = await signInDocs(user);
    signIns = docs.length;
    await deleteDocs(docs);
    await firestore().collection('users').doc(user.sub).delete();
  }
  return { bookings: bookings.length, calendarRemoved, calendarFailed, signIns, local: local(user) };
}

module.exports = { read, deleteSignIns, deleteBooking, deleteAccount, browserName };
