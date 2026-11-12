/** Rank donation slots from centre hours, travel, holidays and calendar free time. No model is involved. */

const fs = require('fs');
const path = require('path');
const store = require('../data/store');
const health = require('./health');

const schedule = JSON.parse(fs.readFileSync(path.join(store.DATA_DIR, 'synthetic', 'centre-schedule.json'), 'utf8'));
const WINDOWS = {
  morning: ['08:00', '12:00'],
  afternoon: ['12:00', '16:00'],
  evening: ['16:00', '20:00'],
};
const WINDOW_TIME = { morning: '09:30', afternoon: '14:00', evening: '16:30' };
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function haversineKm(from, to) {
  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function minutes(value) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function inWindow(time, windowName) {
  const [start, end] = WINDOWS[windowName];
  const value = minutes(time);
  return value >= minutes(start) && value < minutes(end);
}

function overlaps(slot, busy) {
  const start = Date.parse(`${slot.date}T${slot.time}:00+05:30`);
  const end = start + 45 * 60 * 1000;
  return busy.some((span) => start < Date.parse(span.end) && end > Date.parse(span.start));
}

function candidates(donorId, preferences) {
  const eligibility = health.eligibility(donorId);
  if (!eligibility.nextEligibleDate) return { eligibility, slots: [] };
  const windows = preferences.timeWindows && preferences.timeWindows.length ? preferences.timeWindows : Object.keys(WINDOW_TIME);
  const slots = [];
  const from = preferences.dateFrom && preferences.dateFrom > eligibility.nextEligibleDate ? preferences.dateFrom : eligibility.nextEligibleDate;
  const start = new Date(`${from}T00:00:00Z`);
  for (let day = 0; day < 21; day += 1) {
    const date = new Date(start.getTime() + day * 864e5);
    const iso = date.toISOString().slice(0, 10);
    if (preferences.dateTo && iso > preferences.dateTo) break;
    const weekday = date.getUTCDay();
    if (preferences.days?.length && !preferences.days.includes(DAY_NAMES[weekday])) continue;
    for (const centre of store.institutions.bloodCentres) {
      const meta = schedule.centres[centre.id];
      if (!meta || meta.closedDays.includes(weekday)) continue;
      for (const windowName of windows) {
        const time = WINDOW_TIME[windowName];
        if (minutes(time) < minutes(meta.open) || minutes(time) + 45 > minutes(meta.close)) continue;
        slots.push({
          id: `${centre.id}-${iso}-${time}`,
          centreId: centre.id,
          centre: centre.name,
          district: centre.district,
          date: iso,
          time,
          window: windowName,
          weekday: DAY_NAMES[weekday],
          lat: meta.lat,
          lng: meta.lng,
          holiday: schedule.holidays.includes(iso),
          downtime: meta.downtime.includes(iso),
        });
      }
    }
  }
  return { eligibility, slots };
}

function decorate(slot, preferences, busy) {
  const distanceKm = preferences.location ? Math.round(haversineKm(preferences.location, slot) * 10) / 10 : null;
  const preferredDay = !preferences.days || !preferences.days.length || preferences.days.includes(slot.weekday);
  const preferredTime = !preferences.timeWindows || !preferences.timeWindows.length || preferences.timeWindows.includes(slot.window);
  const conflict = overlaps(slot, busy || []);
  const tooFar = distanceKm != null && preferences.maxDistanceKm && distanceKm > preferences.maxDistanceKm;
  const hidden = slot.downtime || (preferences.avoidHolidays && slot.holiday) || conflict || tooFar;
  let score = 0;
  if (preferredDay) score += 30;
  if (preferredTime) score += 30;
  if (distanceKm != null) score += Math.max(0, 40 - distanceKm);
  const reasons = [];
  if (distanceKm != null) reasons.push(`${distanceKm} km away`);
  if (preferredDay && preferredTime) reasons.push(`${slot.window} on a day you chose`);
  if (busy) reasons.push(conflict ? 'Clashes with your calendar' : 'Free on your calendar');
  if (slot.holiday) reasons.push(preferences.avoidHolidays ? 'Public holiday, skipped' : 'Public holiday, centre is open');
  if (slot.downtime) reasons.push('Centre downtime');
  if (tooFar) reasons.push(`Beyond ${preferences.maxDistanceKm} km`);
  return { ...slot, distanceKm, conflict, tooFar, hidden, score, reasons };
}

function rankSlots(slots, preferences, busy) {
  return slots
    .map((slot) => decorate(slot, preferences, busy))
    .filter((slot) => !slot.hidden)
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

function recommend(donorId, preferences, busy, limit = 3) {
  const generated = candidates(donorId, preferences);
  return { eligibility: generated.eligibility, slots: rankSlots(generated.slots, preferences, busy).slice(0, limit) };
}

function findSlot(donorId, preferences, slotId) {
  return candidates(donorId, preferences).slots.find((slot) => slot.id === slotId) || null;
}

module.exports = {
  schedule, WINDOWS, haversineKm, overlaps, candidates, decorate, rankSlots, recommend, findSlot,
};
