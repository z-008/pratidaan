/**
 * In-memory data store backed by the synthetic data in data/synthetic/.
 *
 * Loads once at startup, indexes by donor, and keeps demo-session writes
 * (new donations, uploaded lab reports) in memory. "Today" is a
 * demo clock that starts at the simulation date in institutions.json and can be
 * moved forward (morning, afternoon, night) so Drop's behaviour over days and
 * weeks can be shown. Reset puts the clock and every demo-session write back.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../../data');

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'synthetic', name), 'utf8'));
}

function readOntology(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ontology', name), 'utf8'));
}

function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item[key])) map.set(item[key], []);
    map.get(item[key]).push(item);
  }
  return map;
}

const institutions = read('institutions.json');
let donationsByDonor;
let observationsByDonor;
let componentsByDonor;
const communities = new Map(read('communities.json').map((c) => [c.id, c]));
const policies = new Map(read('policies.json').map((p) => [p.id, p]));
const protocols = new Map(readOntology('protocols.json').map((p) => [p.id, p]));
const lifestyle = readOntology('lifestyle-recommendations.json');

function readDemo(name) {
  const file = path.join(DATA_DIR, 'demo', name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** The synthetic donors plus any the demo overlay adds (the New donor), without changing the synthetic ones. */
function loadDonors() {
  const overlay = readDemo('overlay.json') || {};
  return new Map([...read('donors.json'), ...(overlay.donors || [])].map((d) => [d.id, d]));
}
let donors = loadDonors();

/** (Re)load the records that demo sessions can change, plus the demo overlay (e.g. Arjun's 3 Oct donation). */
function loadRecords() {
  const overlay = readDemo('overlay.json') || {};
  donationsByDonor = groupBy([...read('donations.json'), ...(overlay.donations || [])], 'donorId');
  observationsByDonor = groupBy([...read('observations.json'), ...(overlay.observations || [])], 'donorId');
  componentsByDonor = groupBy([...read('components.json'), ...(overlay.components || [])], 'donorId');
  for (const list of donationsByDonor.values()) list.sort((a, b) => a.date.localeCompare(b.date));
}
loadRecords();

// Demo clock: a date plus a part of the day (8 am, 2 pm, 7 pm, 9 pm; 9 pm starts quiet hours)
const PARTS = ['morning', 'afternoon', 'evening', 'night'];
const START = { date: institutions.asOf, part: 0 };
let clock = { ...START };
const listeners = { step: [], reset: [] };

function addDays(isoDate, days) {
  return new Date(new Date(`${isoDate}T00:00:00Z`).getTime() + days * 864e5).toISOString().slice(0, 10);
}

// Demo-session state (resets on restart)
const session = {
  appointments: new Map(), // donorId -> [appointment]
};

module.exports = {
  DATA_DIR,
  institutions,
  protocols,
  lifestyle,
  policies,
  session,

  today: () => clock.date,
  clock: () => ({ date: clock.date, part: clock.part, partName: PARTS[clock.part], start: START.date }),
  /** Move the clock forward one part of the day, then let listeners (Drop) react. */
  stepClock() {
    clock = clock.part === PARTS.length - 1 ? { date: addDays(clock.date, 1), part: 0 } : { date: clock.date, part: clock.part + 1 };
    listeners.step.forEach((fn) => fn(clock));
  },
  /** Put the clock and all demo-session writes back to the start, including what donors chose (language, Choices). */
  resetDemo() {
    clock = { ...START };
    donors = loadDonors(); // fresh records: every donor's Choices and language go back to the start
    loadRecords();
    Object.values(session).forEach((map) => map.clear());
    listeners.reset.forEach((fn) => fn());
  },
  onStep: (fn) => listeners.step.push(fn),
  onReset: (fn) => listeners.reset.push(fn),

  getDonor: (id) => donors.get(id) || null,
  allDonors: () => [...donors.values()],
  getDonations: (donorId) => donationsByDonor.get(donorId) || [],
  // Lab results stay hidden until the demo clock reaches the day they arrive
  getObservations: (donorId) => (observationsByDonor.get(donorId) || []).filter((o) => !o.availableOn || o.availableOn <= clock.date),
  getComponents: (donorId) => componentsByDonor.get(donorId) || [],
  allComponents: () => [...componentsByDonor.values()].flat(),
  allDonations: () => [...donationsByDonor.values()].flat(),
  getCommunity: (id) => communities.get(id) || null,
  allCommunities: () => [...communities.values()],
  getPolicy: (id) => policies.get(id) || null,
  hospital: (id) => institutions.hospitals.find((h) => h.id === id),
  centre: (id) => institutions.bloodCentres.find((c) => c.id === id),
  readDemo,
  removeObservation(donorId, id) {
    const list = observationsByDonor.get(donorId) || [];
    observationsByDonor.set(donorId, list.filter((o) => o.id !== id));
  },

  addDonation(donation) {
    if (!donationsByDonor.has(donation.donorId)) donationsByDonor.set(donation.donorId, []);
    donationsByDonor.get(donation.donorId).push(donation);
  },
  addObservations(donorId, observations) {
    if (!observationsByDonor.has(donorId)) observationsByDonor.set(donorId, []);
    observationsByDonor.get(donorId).push(...observations);
  },
  addComponents(donorId, components) {
    if (!componentsByDonor.has(donorId)) componentsByDonor.set(donorId, []);
    componentsByDonor.get(donorId).push(...components);
  },
};
