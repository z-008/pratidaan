/**
 * Donation flow: book a slot at a blood centre, then check in on the day.
 * Check-in records screening vitals, runs the eligibility rules, and on a
 * completed donation creates the components (red cells, platelets, plasma)
 * and the free lab panel from the sample — so the donor sees new units start
 * their journey and new results land in their health record immediately.
 */

const store = require('../data/store');
const health = require('./health');

function slots(donorId) {
  const eligibility = health.eligibility(donorId);
  const from = eligibility.nextEligibleDate || null;
  if (!from) return { eligibility, slots: [] };
  const list = [];
  const start = new Date(from);
  for (let day = 0; list.length < 9 && day < 14; day += 1) {
    const d = new Date(start.getTime() + day * 864e5);
    if (d.getDay() === 0) continue;
    const date = d.toISOString().slice(0, 10);
    store.institutions.bloodCentres.forEach((c, i) => {
      if ((day + i) % 2 === 0 && list.length < 9) {
        list.push({ id: `${c.id}-${date}-${i}`, centreId: c.id, centre: c.name, district: c.district, date, time: ['09:30', '11:00', '16:30'][i] });
      }
    });
  }
  return { eligibility, slots: list };
}

function book(donorId, { slotId }) {
  const slot = slots(donorId).slots.find((s) => s.id === slotId);
  if (!slot) throw new Error('That slot is not available');
  const appointment = { id: `APT-${Date.now()}`, donorId, ...slot, status: 'booked' };
  const list = store.session.appointments.get(donorId) || [];
  list.push(appointment);
  store.session.appointments.set(donorId, list);
  return appointment;
}

/**
 * Demo check-in and donation simulation. Omitted vitals use the donor's
 * synthetic recent pattern; this is not a staff-verified screening.
 */
function prepareCheckIn(donorId, appointmentId, vitalsInput = {}, appointments = store.session.appointments.get(donorId) || []) {
  const appointment = appointments.find((a) => a.id === appointmentId);
  if (!appointment || appointment.status !== 'booked' || (appointment.donorId && appointment.donorId !== donorId)
    || store.getDonations(donorId).some((visit) => visit.appointmentId === appointmentId)) throw new Error('Appointment not found or already checked in');
  if (appointment.date !== store.today()) throw new Error('Check-in is only available on the appointment day');
  if (!health.eligibility(donorId).eligibleNow) throw new Error('Donation eligibility is currently blocked');
  const donor = store.getDonor(donorId);
  // This donor-triggered check-in is a demo simulation, not a verified staff
  // screening. Omitted readings use the synthetic previous pattern; explicit
  // entries must be complete and physiological, never silently substituted.
  const previous = store.getDonations(donorId).slice(-1)[0]?.vitals || { systolic: 120, diastolic: 78, haemoglobin: 14, weightKg: 65, pulse: 76 };
  const limits = { systolic: [70, 250], diastolic: [40, 150], pulse: [30, 220], haemoglobin: [3, 25], weightKg: [25, 300] };
  if (!vitalsInput || typeof vitalsInput !== 'object' || Array.isArray(vitalsInput)) throw new Error('Vitals must be an object');
  const assumed = [];
  const vitals = {};
  for (const [key, [low, high]] of Object.entries(limits)) {
    const supplied = Object.hasOwn(vitalsInput, key);
    if (!supplied) assumed.push(key);
    const raw = supplied ? vitalsInput[key] : previous[key];
    if ((supplied && (raw === null || raw === '' || typeof raw === 'boolean'))
      || (typeof raw !== 'number' && (typeof raw !== 'string' || !raw.trim()))
      || !Number.isFinite(Number(raw)) || Number(raw) < low || Number(raw) > high) {
      throw new Error(`Invalid ${key}: expected ${low}–${high}`);
    }
    vitals[key] = Number(raw);
  }
  if (vitals.systolic <= vitals.diastolic) throw new Error('Systolic pressure must exceed diastolic pressure');
  const hbMin = donor.sex === 'F' ? 12.5 : 13.0;
  const reasons = [];
  if (vitals.haemoglobin < hbMin) reasons.push(`Haemoglobin ${vitals.haemoglobin} below ${hbMin}`);
  if (vitals.systolic > 140 || vitals.diastolic > 90) reasons.push(`Blood pressure ${vitals.systolic}/${vitals.diastolic} above 140/90`);
  if (vitals.weightKg < 45) reasons.push('Weight below 45 kg');
  const status = reasons.length ? 'deferred' : 'completed';

  return { status, reasons, vitals, assumed, donor, appointment, hbMin };
}

function applyCheckIn(donorId, appointmentId, prepared) {
  if (store.getDonations(donorId).some((visit) => visit.appointmentId === appointmentId)) throw new Error('Appointment already checked in');
  const { status, reasons, vitals, assumed, donor, appointment, hbMin } = prepared;
  const visitNo = store.getDonations(donorId).length + 1;
  const visitId = `${donorId}-V${visitNo}`;
  const date = store.today();
  store.addDonation({ id: visitId, donorId, appointmentId, date, status, deferralReason: reasons.join('; ') || null, centreId: appointment.centreId,
    volumeMl: vitals.weightKg >= 55 ? 450 : 350, bagId: `BAG-${date.replace(/-/g, '').slice(2)}-${Math.floor(1000 + Math.random() * 9000)}`, vitals,
    demoSimulation: true, assumedVitals: assumed, confidentialFollowUp: false });

  // The free lab panel from the sample: carry forward the latest value per marker
  const labs = health.labSeries(donorId);
  const panel = Object.values(labs).map((list) => [...list].reverse().find((o) => o.source !== 'uploaded_report'))
    .filter((o) => o && o.key !== 'hb');
  store.addObservations(donorId, [
    { id: `OBS-${visitId}-hb`, donorId, visitId, code: '718-7', key: 'hb', name: 'Haemoglobin', value: vitals.haemoglobin, unit: 'g/dL', low: hbMin, high: null, date, source: 'donation_sample', labId: 'LAB-01', demoSimulation: true, assumed: assumed.includes('haemoglobin') },
    ...panel.map((o) => ({ ...o, id: `OBS-${visitId}-${o.key}`, visitId, date, demoSimulation: true, carriedForward: true })),
  ]);

  let components = [];
  if (status === 'completed') {
    const base = [{ type: 'collected', date }, { type: 'separated', date }];
    components = ['PRBC', 'PLT', 'FFP'].map((kind) => ({ id: `${visitId}-${kind}`, donationId: visitId, donorId, kind, bloodGroup: donor.bloodGroup, events: [...base], recipient: null, fractionation: null }));
    store.addComponents(donorId, components);
  }
  appointment.status = status;
  return { status, reasons, visitId, components: components.map((c) => c.kind), vitals, demoSimulation: true, assumedVitals: assumed };
}

function checkIn(donorId, appointmentId, vitalsInput = {}, appointments = store.session.appointments.get(donorId) || []) {
  return applyCheckIn(donorId, appointmentId, prepareCheckIn(donorId, appointmentId, vitalsInput, appointments));
}

module.exports = { slots, book, checkIn, prepareCheckIn, applyCheckIn };
