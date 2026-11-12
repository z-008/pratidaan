/** Booking preferences and appointments stored in Azure Blob Storage. */

const { isEphemeral } = require('./ephemeral');
const users = require('../azure/userRepository');

const memory = new Map();

function memKey(user) {
  if (!user) return 'local';
  if (user.sub === 'local' || user.local) return 'local';
  if (user.guest || String(user.sub).startsWith('guest-')) return user.sub;
  return null;
}

async function getPreferences(user) {
  const local = memKey(user);
  if (local) return memory.get(local)?.preferences || null;
  return (await users.read(user.sub))?.preferences || null;
}

async function savePreferences(user, preferences) {
  const local = memKey(user);
  if (local) {
    memory.set(local, { ...(memory.get(local) || {}), preferences });
    return preferences;
  }
  await users.update(user.sub, (doc) => { doc.preferences = preferences; return doc; });
  return preferences;
}

function localAppointments(user) {
  const store = require('../data/store');
  const sub = user.sub || 'local';
  return [...store.session.appointments.values()].flat().filter((item) => item.sub === sub || item.sub === 'local' || !item.sub);
}

async function listAppointments(user, donorId) {
  const rows = isEphemeral(user) ? localAppointments(user) : ((await users.read(user.sub))?.appointments || []);
  return rows.filter((item) => item.donorId === donorId);
}

async function saveAppointment(user, appointment) {
  const store = require('../data/store');
  if (!isEphemeral(user)) {
    await users.update(user.sub, (doc) => {
      doc.appointments = (doc.appointments || []).filter((item) => item.id !== appointment.id);
      doc.appointments.push(appointment);
      return doc;
    });
  }
  const list = (store.session.appointments.get(appointment.donorId) || []).filter((item) => item.id !== appointment.id);
  list.push(appointment);
  store.session.appointments.set(appointment.donorId, list);
  return appointment;
}

async function deletePreferences(user) {
  const local = memKey(user);
  if (local) {
    memory.set(local, { ...(memory.get(local) || {}), preferences: null });
    return;
  }
  await users.update(user.sub, (doc) => { doc.preferences = null; return doc; });
}

async function allAppointments(user) {
  if (isEphemeral(user)) return localAppointments(user);
  return (await users.read(user.sub))?.appointments || [];
}

async function deleteAppointment(user, appointment) {
  const store = require('../data/store');
  const list = store.session.appointments.get(appointment.donorId) || [];
  store.session.appointments.set(appointment.donorId, list.filter((item) => item.id !== appointment.id));
  if (!isEphemeral(user)) {
    await users.update(user.sub, (doc) => {
      doc.appointments = (doc.appointments || []).filter((item) => item.id !== appointment.id);
      return doc;
    });
  }
}

module.exports = { getPreferences, savePreferences, deletePreferences, listAppointments, allAppointments, saveAppointment, deleteAppointment };
