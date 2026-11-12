/** Microsoft Graph Calendar and Mail calls. Access tokens are never stored. */

const SCOPES = ['User.Read', 'Calendars.ReadWrite', 'Mail.Send'];

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function graphFetch(path, token, options = {}, fetchImpl) {
  const response = await (fetchImpl || fetch)(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (response.status === 204) return {};
  const text = await response.text();
  let body = {};
  if (text) {
    try { body = JSON.parse(text); } catch { body = { error: { message: text.slice(0, 200) } }; }
  }
  if (!response.ok) throw httpError(response.status === 401 ? 401 : 502,
    body.error?.message || `Microsoft Graph request failed (${response.status})`);
  return body;
}

async function accountEmail(token, fetchImpl) {
  if (!token || typeof token !== 'string') throw httpError(401, 'Connect Microsoft Calendar to continue');
  const body = await graphFetch('/me?$select=mail,userPrincipalName,displayName', token, {}, fetchImpl);
  const email = body.mail || body.userPrincipalName;
  if (!email) throw httpError(401, 'Microsoft did not confirm the Calendar account');
  return String(email).toLowerCase();
}

async function assertCalendarOwner(token, user, fetchImpl) {
  const email = await accountEmail(token, fetchImpl);
  if (user && !user.local && String(user.email || '').toLowerCase() !== email) {
    throw httpError(403, 'Calendar account does not match the signed-in Microsoft account');
  }
  return email;
}

async function freeBusy(token, timeMin, timeMax, fetchImpl) {
  const email = await accountEmail(token, fetchImpl);
  const body = await graphFetch('/me/calendar/getSchedule', token, {
    method: 'POST',
    body: JSON.stringify({ schedules: [email],
      startTime: { dateTime: new Date(timeMin).toISOString(), timeZone: 'UTC' },
      endTime: { dateTime: new Date(timeMax).toISOString(), timeZone: 'UTC' }, availabilityViewInterval: 30 }),
  }, fetchImpl);
  return (body.value?.[0]?.scheduleItems || []).map((item) => ({
    start: new Date(`${item.start.dateTime}${item.start.dateTime.endsWith('Z') ? '' : 'Z'}`).toISOString(),
    end: new Date(`${item.end.dateTime}${item.end.dateTime.endsWith('Z') ? '' : 'Z'}`).toISOString(),
  }));
}

function buildEvent({ slot, email, reminderMinutes, checkInCode, transactionId }) {
  const start = `${slot.date}T${slot.time}:00`;
  const [hour, minute] = slot.time.split(':').map(Number);
  const endMinutes = hour * 60 + minute + 45;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`;
  return {
    subject: `Pratidaan donation slot at ${slot.centre}`,
    body: { contentType: 'text', content: `This is not a reservation with the blood centre. Do not travel on the basis of this event.${checkInCode ? ` Check-in code (not valid at a centre): ${checkInCode}.` : ''}` },
    location: { displayName: `${slot.centre}, ${slot.district} (illustrative; not reserved)` },
    start: { dateTime: start, timeZone: 'India Standard Time' },
    end: { dateTime: `${slot.date}T${endTime}`, timeZone: 'India Standard Time' },
    attendees: [{ emailAddress: { address: email, name: email }, type: 'required' }],
    isReminderOn: reminderMinutes.length > 0,
    reminderMinutesBeforeStart: Math.min(...reminderMinutes),
    ...(transactionId ? { transactionId } : {}),
  };
}

async function createEvent(token, event, fetchImpl) {
  return graphFetch('/me/events', token, { method: 'POST', body: JSON.stringify(event) }, fetchImpl);
}

async function deleteEvent(token, eventId, fetchImpl) {
  await graphFetch(`/me/events/${encodeURIComponent(eventId)}`, token, { method: 'DELETE' }, fetchImpl);
}

function confirmationMail({ to, slot, reminderMinutes, checkInCode }) {
  const leads = reminderMinutes.map((value) => value >= 1440 ? `${value / 1440} day${value === 1440 ? '' : 's'}` : `${value / 60} hour${value === 60 ? '' : 's'}`).join(' and ');
  const text = [`Your Pratidaan slot is saved for ${slot.date} at ${slot.time}. This is not a reservation with a blood centre; do not travel based on this message.`,
    `${slot.centre}, ${slot.district} (illustrative).`, checkInCode ? `Check-in code: ${checkInCode}. It cannot be used at a blood centre.` : null,
    `Your connected calendar may remind you ${leads} before the slot.`,
    'Before you come: eat a meal 3 to 4 hours before, sleep at least 6 hours, drink water, and skip alcohol for 24 hours.',
    'Bring a photo ID.'].filter(Boolean).join('\n');
  return { to, text };
}

async function sendConfirmation(token, message, fetchImpl) {
  await graphFetch('/me/sendMail', token, { method: 'POST', body: JSON.stringify({ message: {
    subject: 'Your Pratidaan slot is saved', body: { contentType: 'text', content: message.text },
    toRecipients: [{ emailAddress: { address: message.to } }],
  }, saveToSentItems: true }) }, fetchImpl);
}

module.exports = { SCOPES, accountEmail, assertCalendarOwner, freeBusy, buildEvent, createEvent, deleteEvent, confirmationMail, sendConfirmation };
