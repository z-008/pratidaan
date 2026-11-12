/** Google Calendar and Gmail calls. The access token is used for this request only and is never stored. */

const FREEBUSY_SCOPE = 'https://www.googleapis.com/auth/calendar.events.freebusy';
const OWNED_SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const SCOPES = [FREEBUSY_SCOPE, OWNED_SCOPE, GMAIL_SCOPE, 'https://www.googleapis.com/auth/userinfo.email'];

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function googleFetch(url, token, options, fetchImpl) {
  const response = await (fetchImpl || fetch)(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options && options.headers),
    },
  });
  const text = await response.text();
  let body = {};
  if (text) {
    try { body = JSON.parse(text); } catch { body = { error: { message: text.slice(0, 200) } }; }
  }
  if (!response.ok) {
    const message = body.error && body.error.message ? body.error.message : `Google request failed (${response.status})`;
    throw httpError(response.status === 401 ? 401 : 502, message);
  }
  return body;
}

async function accountEmail(token, fetchImpl) {
  if (!token || typeof token !== 'string') throw httpError(401, 'Connect Google Calendar to continue');
  const body = await googleFetch('https://www.googleapis.com/oauth2/v3/userinfo', token, {}, fetchImpl);
  if (!body.email) throw httpError(401, 'Google did not confirm the Calendar account');
  return String(body.email).toLowerCase();
}

async function assertCalendarOwner(token, user, fetchImpl) {
  const email = await accountEmail(token, fetchImpl);
  if (user && !user.local && String(user.email || '').toLowerCase() !== email) {
    throw httpError(403, 'Calendar account does not match the signed-in Google account');
  }
  return email;
}

async function freeBusy(token, timeMin, timeMax, fetchImpl) {
  const body = await googleFetch('https://www.googleapis.com/calendar/v3/freeBusy', token, {
    method: 'POST',
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: 'primary' }] }),
  }, fetchImpl);
  return ((body.calendars && body.calendars.primary && body.calendars.primary.busy) || [])
    .map((span) => ({ start: span.start, end: span.end }));
}

function reminderOverrides(minutes) {
  const overrides = [];
  for (const value of minutes) {
    overrides.push({ method: 'email', minutes: value });
    if (overrides.length < 5) overrides.push({ method: 'popup', minutes: value });
  }
  return overrides.slice(0, 5);
}

function buildEvent({ slot, email, reminderMinutes, checkInCode }) {
  const start = `${slot.date}T${slot.time}:00+05:30`;
  const [hour, minute] = slot.time.split(':').map(Number);
  const endMinutes = hour * 60 + minute + 45;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  return {
    summary: `Pratidaan donation slot at ${slot.centre}`,
    location: `${slot.centre}, ${slot.district} (illustrative; not reserved)`,
    description: `This is not a reservation with the blood centre. Do not travel on the basis of this event.${checkInCode ? ` Check-in code (not valid at a centre): ${checkInCode}.` : ''}`,
    start: { dateTime: start, timeZone: 'Asia/Kolkata' },
    end: { dateTime: `${slot.date}T${endTime}:00+05:30`, timeZone: 'Asia/Kolkata' },
    attendees: [{ email }],
    reminders: { useDefault: false, overrides: reminderOverrides(reminderMinutes) },
  };
}

async function createEvent(token, event, fetchImpl) {
  return googleFetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', token, {
    method: 'POST',
    body: JSON.stringify(event),
  }, fetchImpl);
}

async function deleteEvent(token, eventId, fetchImpl) {
  await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, token, {
    method: 'DELETE',
  }, fetchImpl);
}

function confirmationMail({ to, slot, reminderMinutes, checkInCode }) {
  const leads = reminderMinutes.map((value) => (value >= 1440 ? `${value / 1440} day${value === 1440 ? '' : 's'}` : `${value / 60} hour${value === 60 ? '' : 's'}`)).join(' and ');
  const text = [
    `Your Pratidaan slot is saved for ${slot.date} at ${slot.time}. This is not a reservation with a blood centre; do not travel based on this message.`,
    `${slot.centre}, ${slot.district} (illustrative).`,
    checkInCode ? `Check-in code: ${checkInCode}. It cannot be used at a blood centre.` : null,
    `Your connected calendar may remind you ${leads} before the slot.`,
    'Before you come: eat a meal 3 to 4 hours before, sleep at least 6 hours, drink water, and skip alcohol for 24 hours.',
    'Bring a photo ID.',
  ].filter(Boolean).join('\n');
  const raw = Buffer.from([
    `To: ${to}`,
    'Subject: Your Pratidaan slot is saved',
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
  ].join('\r\n')).toString('base64url');
  return { raw, text };
}

async function sendConfirmation(token, message, fetchImpl) {
  await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', token, {
    method: 'POST',
    body: JSON.stringify({ raw: message.raw }),
  }, fetchImpl);
}

module.exports = {
  SCOPES, FREEBUSY_SCOPE, OWNED_SCOPE, GMAIL_SCOPE,
  accountEmail, assertCalendarOwner, freeBusy, reminderOverrides, buildEvent,
  createEvent, deleteEvent, confirmationMail, sendConfirmation,
};
