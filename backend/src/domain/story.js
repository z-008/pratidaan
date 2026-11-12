/**
 * A component's Story: the slides Drop's impact Card plays and My Impact
 * replays, plus the data for the summary postcard that ends it.
 *
 * Only transfused units and plasma that became medicines get a Story. It is
 * built from the public journey, so impact.js's release rules decide what it
 * may say: a generalised field is left out of the sentence, never printed,
 * and a privacy line says something was held back.
 */

const store = require('../data/store');
const impact = require('./impact');

const PRIVATE = 'Some details stay private so no one can be identified.';
const GENERAL_PLACE = 'A hospital in Karnataka';
const GENERAL_CONTEXT = 'Treatment (details not shared)';

const day = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthOf = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const lcFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const num = (n) => n.toLocaleString('en-IN');

/** "Adult (18–39), female" → "a woman aged 18–39"; null when generalised. */
function who(patient) {
  const m = /^(.+), (female|male)$/.exec(patient);
  if (!m) return null;
  const [, band, sex] = m;
  const f = sex === 'female';
  if (band === 'Newborn') return f ? 'a newborn girl' : 'a newborn boy';
  if (band === 'Child') return f ? 'a girl' : 'a boy';
  if (band === 'Teenager') return f ? 'a teenage girl' : 'a teenage boy';
  const adult = f ? 'a woman' : 'a man';
  const ages = /\((\d+)–(\d+)\)/.exec(band);
  if (ages) return `${adult} aged ${ages[1]}–${ages[2]}`;
  if (/60\+/.test(band)) return `${adult} over 60`;
  return null;
}

/** "Government tertiary hospital, Bengaluru Urban" → "a government tertiary hospital in Bengaluru Urban". */
function where(place) {
  if (place === GENERAL_PLACE) return lcFirst(place);
  const [kind, district] = place.split(', ');
  return `${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${lcFirst(kind)} in ${district}`;
}

/** The date an event of this type happened, for month-rounded wording. */
function eventDate(donorId, componentId, type) {
  const c = store.getComponents(donorId).find((x) => x.id === componentId);
  return c.events.find((e) => e.type === type && e.date <= store.today())?.date;
}

function transfusedStory(donorId, j, patientsHelped) {
  const r = j.recipient; // null when even the broadest group is too small
  const name = j.name.toLowerCase();
  const month = monthOf(eventDate(donorId, j.id, 'transfused'));
  const person = r && who(r.patient);
  const context = r && r.context !== GENERAL_CONTEXT ? r.context : null;
  const helped = context
    ? `They helped ${person || 'a patient'} with ${lcFirst(context)}.`
    : `They helped ${person || 'a patient'} in hospital.`;
  const extra = [r?.outcome === 'recovered' && 'The hospital recorded a good recovery.', (!r || r.generalised) && PRIVATE].filter(Boolean);
  return {
    slides: [
      `On ${day(j.donationDate)} you gave blood at ${j.centre}.`,
      `It was separated into parts. One was your ${name}: ${lcFirst(j.role)}.`,
      `In ${month} they went to ${where(r ? r.place : GENERAL_PLACE)}.`,
      [helped, ...extra].join(' '),
    ],
    postcard: {
      kind: j.kind,
      component: j.name,
      headline: `My ${name} reached a patient`,
      context: context || j.role,
      month,
      patientsHelped,
    },
  };
}

function plasmaStory(donorId, j, patientsHelped) {
  const f = j.fractionation;
  const month = monthOf(eventDate(donorId, j.id, 'products_released'));
  return {
    slides: [
      `On ${day(j.donationDate)} you gave blood at ${j.centre}.`,
      `Your plasma was pooled with ${num(f.poolSize)} donations.`,
      `In ${month} your share became about ${f.albuminVials} vial of albumin, ${f.ivigVials} dose of IVIG and ${num(f.factorViiiIu)} IU of factor VIII.`,
    ],
    postcard: {
      kind: j.kind,
      component: j.name,
      headline: 'My plasma became medicines',
      context: 'Albumin, immunoglobulin and clotting factor',
      month,
      patientsHelped,
    },
  };
}

/** The Story for one of the Donor's components, or null if that unit has none (expired, withheld, in progress). */
function componentStory(donorId, componentId) {
  const journeys = impact.donorJourneys(donorId);
  const j = journeys.find((x) => x.id === componentId);
  if (!j || j.withheld) return null;
  const { patientsHelped } = impact.summarise(journeys);
  if (j.events.some((e) => e.type === 'transfused')) return transfusedStory(donorId, j, patientsHelped);
  if (j.fractionation && j.status === 'products_released') return plasmaStory(donorId, j, patientsHelped);
  return null;
}

module.exports = { componentStory, PRIVATE };
