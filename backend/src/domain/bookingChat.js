/** One question at a time. The answers become the preferences used to rank slots. */

const { schedule } = require('./bookingRank');

const DAY_SETS = {
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  saturday: ['sat'],
  any: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
};
const DEFAULT_REMINDER = [1440];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const PROMPTS = {
  days: {
    text: 'Which days are convenient for a donation?',
    chips: [
      { id: 'weekdays', label: 'Weekdays' },
      { id: 'saturday', label: 'Saturday' },
      { id: 'any', label: 'Any open day' },
    ],
  },
  times: {
    text: 'What time of day works best?',
    chips: [
      { id: 'morning', label: 'Morning' },
      { id: 'afternoon', label: 'Afternoon' },
      { id: 'evening', label: 'Late afternoon' },
      { id: 'any', label: 'Any time' },
    ],
  },
  distance: {
    text: 'How far are you willing to travel?',
    chips: [
      { id: '5', label: 'Up to 5 km' },
      { id: '15', label: 'Up to 15 km' },
      { id: '30', label: 'Up to 30 km' },
    ],
  },
  holidays: {
    text: 'Should public holidays be avoided?',
    chips: [
      { id: 'yes', label: 'Avoid holidays' },
      { id: 'no', label: 'Holidays are fine' },
    ],
  },
  place: {
    text: 'Where should we look for a centre? You can use this device’s location or pick a district.',
    chips: [
      { id: 'gps', label: 'Use my location' },
      ...Object.entries(schedule.places).map(([id, place]) => ({ id, label: place.label })),
    ],
  },
};

function normalise(raw) {
  const prefs = raw && typeof raw === 'object' ? raw : {};
  return {
    days: Array.isArray(prefs.days) ? prefs.days.filter((day) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(day)) : [],
    timeWindows: Array.isArray(prefs.timeWindows) ? prefs.timeWindows.filter((item) => ['morning', 'afternoon', 'evening'].includes(item)) : [],
    maxDistanceKm: [5, 15, 30].includes(Number(prefs.maxDistanceKm)) ? Number(prefs.maxDistanceKm) : null,
    avoidHolidays: typeof prefs.avoidHolidays === 'boolean' ? prefs.avoidHolidays : null,
    reminderMinutes: DEFAULT_REMINDER,
    location: placeOrNull(prefs.location),
    dateFrom: ISO_DATE.test(prefs.dateFrom) ? prefs.dateFrom : null,
    dateTo: ISO_DATE.test(prefs.dateTo) ? prefs.dateTo : null,
    onboardingComplete: Boolean(prefs.onboardingComplete),
    onboardingSkipped: Boolean(prefs.onboardingSkipped),
  };
}

function placeOrNull(location) {
  if (!location || typeof location !== 'object') return null;
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    label: String(location.label || 'Chosen location').slice(0, 80),
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
    source: location.source === 'gps' ? 'gps' : 'manual',
  };
}

function missing(prefs) {
  if (!prefs.days.length) return 'days';
  if (!prefs.timeWindows.length) return 'times';
  if (!prefs.maxDistanceKm) return 'distance';
  if (prefs.avoidHolidays === null) return 'holidays';
  if (!prefs.location) return 'place';
  return null;
}

function apply(prefs, answer) {
  const next = normalise(prefs);
  if (!answer || answer.step !== missing(next)) return next;
  if (answer.step === 'days' && DAY_SETS[answer.value]) next.days = DAY_SETS[answer.value];
  if (answer.step === 'times') {
    next.timeWindows = answer.value === 'any' ? ['morning', 'afternoon', 'evening'] : [answer.value].filter((item) => ['morning', 'afternoon', 'evening'].includes(item));
  }
  if (answer.step === 'distance' && [5, 15, 30].includes(Number(answer.value))) next.maxDistanceKm = Number(answer.value);
  if (answer.step === 'holidays') next.avoidHolidays = answer.value === 'yes';
  if (answer.step === 'place') {
    if (typeof answer.value === 'string' && schedule.places[answer.value]) {
      next.location = { ...schedule.places[answer.value], source: 'manual' };
    } else {
      next.location = placeOrNull(answer.value);
    }
  }
  return next;
}

function turn(preferences, answer) {
  const prefs = apply(preferences, answer);
  const step = missing(prefs);
  const places = PROMPTS.place.chips.filter((chip) => chip.id !== 'gps');
  if (!step) return { preferences: prefs, step: null, prompt: null, chips: [], ready: true, places };
  return { preferences: prefs, step, prompt: PROMPTS[step].text, chips: PROMPTS[step].chips, ready: false, places };
}

module.exports = { normalise, missing, apply, turn, PROMPTS };
