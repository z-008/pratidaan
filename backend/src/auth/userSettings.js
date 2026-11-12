/** Booking preferences and appointments saved against the signed-in Google account (in memory with sign-in off). */
const { isEphemeral } = require('./ephemeral');

const memory = new Map();
let db;

function firestore() {
  if (!db) {
    const { Firestore } = require('@google-cloud/firestore');
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    db = new Firestore(projectId ? { projectId } : {});
  }
  return db;
}

function memKey(user) {
  if (!user) return 'local';
  if (user.sub === 'local' || user.local) return 'local';
  if (user.guest || String(user.sub).startsWith('guest-')) return user.sub;
  return null;
}

async function getPreferences(user) {
  const key = memKey(user);
  if (key) return memory.get(key) || null;
  const snap = await firestore().collection('users').doc(user.sub).get();
  return snap.exists && snap.data().booking ? snap.data().booking : null;
}

async function savePreferences(user, preferences) {
  const key = memKey(user);
  if (key) {
    memory.set(key, preferences);
    return preferences;
  }
  await firestore().collection('users').doc(user.sub).set({ booking: preferences }, { merge: true });
  return preferences;
}

async function listAppointments(user, donorId) {
  const { session } = require('../data/store');
  if (isEphemeral(user)) {
    const sub = user.sub || 'local';
    return (session.appointments.get(donorId) || []).filter((item) => item.sub === sub || item.sub === 'local' || !item.sub);
  }
  const snap = await firestore().collection('appointments').where('sub', '==', user.sub).get();
  return snap.docs.map((doc) => doc.data()).filter((item) => item.donorId === donorId);
}

async function saveAppointment(user, appointment) {
  const store = require('../data/store');
  if (!isEphemeral(user)) await firestore().collection('appointments').doc(appointment.id).set(appointment);
  const list = (store.session.appointments.get(appointment.donorId) || []).filter((item) => item.id !== appointment.id);
  list.push(appointment);
  store.session.appointments.set(appointment.donorId, list);
  return appointment;
}

async function deletePreferences(user) {
  const key = memKey(user);
  if (key) {
    memory.delete(key);
    return;
  }
  const { FieldValue } = require('@google-cloud/firestore');
  await firestore().collection('users').doc(user.sub).set({ booking: FieldValue.delete() }, { merge: true });
}

/** Every appointment the account made, for any demo donor. */
async function allAppointments(user) {
  const { session } = require('../data/store');
  if (isEphemeral(user)) {
    const sub = user.sub || 'local';
    return [...session.appointments.values()].flat().filter((item) => item.sub === sub || item.sub === 'local' || !item.sub);
  }
  const snap = await firestore().collection('appointments').where('sub', '==', user.sub).get();
  return snap.docs.map((doc) => doc.data());
}

/** Remove an appointment record for good (cancel it first if it is still booked). */
async function deleteAppointment(user, appointment) {
  const store = require('../data/store');
  const list = store.session.appointments.get(appointment.donorId) || [];
  store.session.appointments.set(appointment.donorId, list.filter((item) => item.id !== appointment.id));
  if (!isEphemeral(user)) await firestore().collection('appointments').doc(appointment.id).delete();
}

module.exports = { getPreferences, savePreferences, deletePreferences, listAppointments, allAppointments, saveAppointment, deleteAppointment };
