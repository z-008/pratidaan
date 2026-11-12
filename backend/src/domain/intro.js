/**
 * Drop's Intro: the scripted first conversation with a new user in Home's chat
 * (CONTEXT.md: Intro). Eight steps, each with Drop's words, an optional picture
 * and reply buttons. It works with the AI off; the AI only translates the words.
 *
 * State lives in server memory per demo donor and is put back by demo Reset. Only
 * the New donor starts it; every other Persona has done it and can't replay it.
 * Answers land where they belong: the language becomes Drop's language, the Choices
 * become the donor's Choices, and "when can you donate" is saved with the signed-in
 * Google account through the same preferences store booking reads.
 */

const store = require('../data/store');
const impact = require('./impact');
const drop = require('./drop');
const settings = require('../auth/userSettings');
const { normalise } = require('./bookingChat');
const { schedule } = require('./bookingRank');

const TOTAL = 8;
const EXAMPLE_DONOR = 'D-001';
const EXAMPLE_DONATION = 'D-001-V4'; // the demo's 3 Oct donation, shown as an example without a name
const LANGUAGES = [['en', 'English'], ['hi', 'हिंदी'], ['kn', 'ಕನ್ನಡ'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['ml', 'മലയാളം']];
const CHOICES = ['shareHealthWithInsurer', 'showOnLeaderboard', 'includeInCommunityStats'];
const DAY_SETS = { weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'], saturday: ['sat'], any: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] };
const TIME_SETS = { morning: ['morning'], afternoon: ['afternoon'], evening: ['evening'], any: ['morning', 'afternoon', 'evening'] };

const count = (n) => ['no', 'one', 'two', 'three', 'four', 'five'][n] || String(n);
const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/* ------------------------------------------------------------------ the eight steps */

function exampleDonation() {
  return store.getDonations(EXAMPLE_DONOR).find((d) => d.id === EXAMPLE_DONATION);
}

/** How many parts the example donation was split into, as of the demo clock. */
function exampleParts(d) {
  return store.getComponents(EXAMPLE_DONOR).filter((c) => c.donationId === d.id && c.events.length && c.events[0].date <= store.today()).length;
}

/** Drop's English words for each step. {first} is the person's first name (dropped when unknown). */
function script() {
  const d = exampleDonation();
  const parts = exampleParts(d);
  return [
    { id: 'language', title: 'Language', text: ["Hi, I'm Drop, your Pratidaan assistant. Which language should I use?"],
      buttons: LANGUAGES.map(([code, label]) => ({ label, value: code, primary: code === 'en' })) },
    { id: 'hello', title: 'What Pratidaan is',
      text: ['Pratidaan follows the blood you give all the way to the patient, and helps you stay well until you can give again.', "Here's how it works. It takes about a minute."],
      buttons: [{ label: 'Show me', value: 'next', primary: true }] },
    { id: 'journey', title: "Your blood's journey", picture: 'journey',
      text: [`Here's an example: someone gave ${d.volumeMl} ml on ${fmt(d.date)}. It was split into ${count(parts)} parts, and each one goes its own way.`],
      after: ["Once you donate, I'll tell you each time a part of your blood reaches a patient. Patients always stay anonymous."],
      buttons: [{ label: 'Watch the story', value: 'story', primary: true }, { label: 'Next', value: 'next' }] },
    { id: 'health', title: 'Health between donations', picture: 'results',
      text: ['Every donation is also a free check-up. Your sample is tested, and I explain the results in plain words.'],
      after: ['If something needs watching, like blood pressure, we make a small Plan together. No food logging and no daily nagging: at most one new card a day, and reminders only when you ask for them.'],
      buttons: [{ label: 'Got it', value: 'next', primary: true }] },
    { id: 'data', title: 'Your data', picture: 'data',
      text: ['Here is what Pratidaan keeps about you, and where.'],
      after: ['You can see and delete any of it in Your data, in the account menu.'],
      buttons: [{ label: 'Got it', value: 'next', primary: true }, { label: 'Open Your data', value: 'open-data' }] },
    { id: 'choices', title: 'Your choices', picture: 'choices',
      text: ['Three choices. You can change them any time in Your data.'],
      buttons: [{ label: 'Save my choices', value: 'save', primary: true }] },
    { id: 'donate', title: 'When you can donate', picture: 'days',
      text: ["Last one, and it's optional: when does donating suit you? I'll use this whenever you book."],
      buttons: [{ label: 'Save', value: 'save', primary: true }, { label: 'Skip for now', value: 'skip' }] },
    { id: 'done', title: 'All set', picture: 'summary',
      text: ["You're all set, {first}. You can book your first donation whenever you're ready, and I'm here if you have a question."],
      buttons: [{ label: 'Book my first donation', value: 'book', primary: true }, { label: 'Start using Pratidaan', value: 'finish' }] },
  ];
}

/** The example journey: the demo's 3 Oct donation as it stands on the demo clock, with no name. */
function journeyPicture() {
  const d = exampleDonation();
  const parts = impact.donorJourneys(EXAMPLE_DONOR).filter((j) => j.donationDate === d.date);
  const tested = parts.flatMap((j) => j.events).find((e) => e.type === 'tested');
  const frozen = (kind) => ['FFP', 'CRYO'].includes(kind);
  // A part can reach a patient while the patient's details stay hidden (too few similar cases to share them)
  const rows = parts.map((j) => (j.helped
    ? { name: j.name, tag: j.events.find((e) => e.type === 'transfused')?.when || 'Used', good: true, text: j.recipient ? `Helped a patient: ${j.recipient.context.toLowerCase()} (${j.recipient.patient.toLowerCase()})` : 'Helped a patient' }
    : { name: j.name, tag: frozen(j.kind) ? 'Frozen' : 'Waiting', good: false, text: frozen(j.kind) ? 'Frozen and kept for up to a year' : 'At the blood centre, ready for the right patient' }));
  const helped = rows.filter((r) => r.good);
  const waiting = rows.filter((r) => !r.good);
  const story = [
    `${fmt(d.date)}. Someone gave ${d.volumeMl} ml of blood at ${store.centre(d.centreId).name}.`,
    `It was tested and split into ${count(parts.length)} parts: ${parts.map((j) => j.name.toLowerCase()).join(', ')}.`,
    ...helped.map((r) => (r.text === 'Helped a patient' ? `${r.tag}. The ${r.name.toLowerCase()} reached a patient.` : `${r.tag}. The ${r.name.toLowerCase()} reached a patient: ${r.text.replace('Helped a patient: ', '')}.`)),
    ...(waiting.length ? [`The ${waiting.map((r) => r.name.toLowerCase()).join(' and ')} ${waiting.length === 1 && !/s$/.test(waiting[0].name) ? 'is' : 'are'} waiting for the next patients who need them.`] : []),
    'One donation can help up to three people. Yours will too.',
  ];
  return { label: 'Example', date: fmt(d.date), volumeMl: d.volumeMl, tested: tested ? fmt(tested.when) : null, parts: rows, story };
}

/** An example results card from the same donation's sample (shown even before those results reach the example donor). */
function resultsPicture() {
  const d = exampleDonation();
  const obs = ((store.readDemo('overlay.json') || {}).observations || []).filter((o) => o.visitId === EXAMPLE_DONATION);
  const row = (key) => {
    const o = obs.find((x) => x.key === key);
    if (!o) return null;
    const ok = (o.low == null || o.value >= o.low) && (o.high == null || o.value <= o.high);
    return { name: o.name, value: `${o.value}${key === 'plt' ? '' : ` ${o.unit}`}`, status: ok ? 'In range' : 'Outside the range', good: ok };
  };
  const { systolic: s, diastolic: dia } = d.vitals;
  const bp = { name: 'Blood pressure', value: `${s}/${dia}`, status: s >= 140 || dia >= 90 ? 'A bit high' : s >= 130 || dia >= 80 ? 'Above ideal' : 'In range', good: s < 130 && dia < 80 };
  return { label: 'Example', title: `Results from a ${fmt(d.date)} donation`, rows: [row('hb'), row('plt'), bp].filter(Boolean), note: 'When something needs watching, I offer a free doctor check-up near you.' };
}

/** What is kept and where: the same groups as the "Your data" screen. */
const DATA_PICTURE = {
  rows: [
    { icon: 'lock', what: 'Your Google name, email and photo, and your sign-ins', where: 'With your Google account, in Google Cloud' },
    { icon: 'calendar', what: 'When donating suits you, and your bookings', where: 'With your Google account, in Google Cloud' },
    { icon: 'shield', what: 'Your choices, and things you ask me to remember', where: 'With your profile in this session. I never remember health facts, religion, caste or income' },
    { icon: 'flask', what: 'Donations and test results', where: 'From the blood centre. You have none yet' },
  ],
  note: "When you chat with me or add a lab report, it goes to Google's Gemini AI to answer you. Google doesn't train its AI on it.",
};

const CHOICE_ROWS = [
  { key: 'shareHealthWithInsurer', label: 'Share my health score with my insurer', sub: 'Can raise your cover at the same premium. Only the score, never your results.' },
  { key: 'showOnLeaderboard', label: "Show me on my Circles' leaderboards", sub: 'Your first name, donations and patients helped' },
  { key: 'includeInCommunityStats', label: "Count my donations in my Circles' totals", sub: 'Anonymous numbers only' },
];

function daysPicture() {
  return {
    days: [{ id: 'weekdays', label: 'Weekdays' }, { id: 'saturday', label: 'Saturday' }, { id: 'any', label: 'Any open day' }],
    times: [{ id: 'morning', label: 'Morning' }, { id: 'afternoon', label: 'Afternoon' }, { id: 'evening', label: 'Late afternoon' }, { id: 'any', label: 'Any time' }],
    places: [{ id: 'gps', label: 'Near me' }, ...Object.entries(schedule.places).map(([id, p]) => ({ id, label: p.label }))],
  };
}

const SUMMARY_PICTURE = {
  rows: [
    { what: 'Your first donation', value: 'Book it any time' },
    { what: 'Your results', value: 'After your first donation' },
    { what: 'Replay this intro', value: 'Account menu' },
  ],
};

/** The eight steps in English with their pictures. */
function steps() {
  const pictures = { journey: journeyPicture(), results: resultsPicture(), data: DATA_PICTURE, choices: { rows: CHOICE_ROWS }, days: daysPicture(), summary: SUMMARY_PICTURE };
  return script().map((s, i) => ({ n: i + 1, ...s, after: s.after || [], picture: s.picture || null, pictureData: s.picture ? pictures[s.picture] : null }));
}

/** The Intro's own words around the steps: the bar, Skip, coming back, the folded line. {…} are filled in on screen. */
const UI = {
  bar: 'Getting started',
  progress: '{n} of {total}',
  skip: 'Skip intro',
  skipAsk: "Skip the rest? Anything you haven't chosen keeps its default (insurer sharing off). You can replay the intro any time from the account menu.",
  skipYes: 'Skip the intro',
  keepGoing: 'Keep going',
  carryOn: 'Carry on',
  carryOnStep: 'Carry on: {title}',
  welcomeBack: 'Welcome back, {first}. We stopped at {title} (step {n} of {total}).',
  doneSoFar: 'Done so far',
  backTo: 'Back to {title}',
  input: 'Ask Drop anything. The intro waits for you.',
  watched: 'Watched the story',
  finished: 'Intro · finished {date}',
  skipped: 'Intro · skipped {date}',
  replay: 'Replay',
  questions: 'Questions you asked',
};

/* ------------------------------------------------------------------ state */

const states = new Map();

function get(donorId) {
  if (!states.has(donorId)) {
    const donor = store.getDonor(donorId);
    states.set(donorId, donor && donor.newUser
      ? { status: 'new', step: 1, finishedOn: null, replay: null, questions: [] }
      : { status: 'done', step: TOTAL, finishedOn: null, replay: null, questions: [] });
  }
  return states.get(donorId);
}

const live = (st) => st.status === 'new' || st.status === 'running';

function status(donorId) {
  const st = get(donorId);
  const donor = store.getDonor(donorId);
  return {
    status: st.status, step: st.step, total: TOTAL, finishedOn: st.finishedOn, replay: Boolean(st.replay),
    stepId: live(st) ? script()[st.step - 1].id : null, title: live(st) ? script()[st.step - 1].title : null,
    canReplay: Boolean(donor && donor.newUser), questions: st.questions,
  };
}

/** Time-of-day and place answers in the same shape the booking preferences use. */
function prefsFrom(value, saved) {
  const base = normalise(saved || {});
  const next = { ...base };
  if (DAY_SETS[value.days]) next.days = DAY_SETS[value.days];
  if (TIME_SETS[value.time]) next.timeWindows = TIME_SETS[value.time];
  if (typeof value.place === 'string' && schedule.places[value.place]) next.location = { ...schedule.places[value.place], source: 'manual' };
  else if (value.place && typeof value.place === 'object') next.location = normalise({ location: { ...value.place, source: 'gps' } }).location;
  return normalise(next);
}

/** The saved preferences as the step's chip ids, to fill in a replay. */
function prefsPrefill(saved) {
  if (!saved) return null;
  const same = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...b].sort());
  const days = Object.keys(DAY_SETS).find((k) => same(saved.days, DAY_SETS[k])) || null;
  const time = Object.keys(TIME_SETS).find((k) => same(saved.timeWindows, TIME_SETS[k])) || null;
  const place = saved.location
    ? (saved.location.source === 'gps' ? 'gps' : Object.keys(schedule.places).find((k) => schedule.places[k].label === saved.location.label) || null)
    : null;
  return { days, time, place };
}

/** What the person chose before, so a replay starts filled in. */
async function prefill(donorId, user) {
  const saved = user ? await settings.getPreferences(user).catch(() => null) : null;
  return { language: drop.chatContext(donorId).language, choices: { ...store.getDonor(donorId).consent }, donate: prefsPrefill(saved) };
}

function advance(st) {
  st.step = Math.min(st.step + 1, TOTAL);
}

function finish(st) {
  st.status = 'done';
  st.step = TOTAL;
  st.finishedOn = store.today();
  st.replay = null;
}

/**
 * Answer the current step. Returns what was saved (an empty list when nothing changed,
 * as in a replay that keeps the earlier answers).
 */
async function answer(donorId, step, value, { user } = {}) {
  const st = get(donorId);
  if (!live(st)) throw new Error('The intro is not running');
  if (Number(step) !== st.step) throw new Error(`The intro is on step ${st.step}, not ${step}`);
  const donor = store.getDonor(donorId);
  const saved = [];
  st.status = 'running';
  switch (script()[st.step - 1].id) {
    case 'language': {
      if (!LANGUAGES.some(([code]) => code === value)) throw new Error('Unsupported language');
      if (drop.chatContext(donorId).language !== value || donor.language !== value) {
        drop.setLanguage(donorId, value);
        donor.language = value; // Home's language switch offers English plus this one
        saved.push('language');
      }
      break;
    }
    case 'choices': {
      for (const key of CHOICES) {
        if (value && typeof value[key] === 'boolean' && donor.consent[key] !== value[key]) {
          donor.consent[key] = value[key];
          saved.push(key);
        }
      }
      break;
    }
    case 'donate': {
      if (value === 'skip' || !value) break;
      const before = user ? await settings.getPreferences(user) : null;
      const next = prefsFrom(value, before);
      const changed = ['days', 'timeWindows', 'location'].some((k) => JSON.stringify(next[k]) !== JSON.stringify(normalise(before || {})[k]));
      if (changed && user) {
        await settings.savePreferences(user, { ...next, onboardingComplete: true, onboardingSkipped: false });
        saved.push('preferences');
      }
      break;
    }
    case 'done':
      finish(st);
      return { saved };
    default:
      break;
  }
  advance(st);
  return { saved };
}

/** Skip the rest. A first run keeps the defaults and counts as skipped; skipping a replay changes nothing. */
function skip(donorId) {
  const st = get(donorId);
  if (!live(st)) throw new Error('The intro is not running');
  if (st.replay) {
    Object.assign(st, { status: st.replay.status, finishedOn: st.replay.finishedOn, questions: st.replay.questions, step: TOTAL, replay: null });
  } else {
    Object.assign(st, { status: 'skipped', finishedOn: store.today(), step: TOTAL, replay: null });
  }
  return status(donorId);
}

/** Start again from step 1 with what was chosen before filled in. Only for the New donor. */
function replay(donorId) {
  const st = get(donorId);
  if (!store.getDonor(donorId).newUser) throw new Error('Only the New donor can replay the intro');
  if (live(st)) return status(donorId);
  Object.assign(st, { replay: { status: st.status, finishedOn: st.finishedOn, questions: st.questions }, status: 'running', step: 1, questions: [] });
  return status(donorId);
}

/** End the intro from its last step. */
function finishIntro(donorId) {
  const st = get(donorId);
  if (!live(st)) return status(donorId);
  if (st.step !== TOTAL) throw new Error(`The intro is on step ${st.step}, not ${TOTAL}`);
  finish(st);
  return status(donorId);
}

/** A question the person typed while the intro was running, kept with the intro. */
function noteQuestion(donorId, question, reply) {
  const st = get(donorId);
  if (!live(st)) return;
  st.questions.push({ q: String(question).slice(0, 300), a: String(reply || '').slice(0, 600), step: st.step });
  st.questions = st.questions.slice(-10);
}

/** A rule answer about the current step, for when the AI is off. */
function explain(donorId) {
  const st = get(donorId);
  if (!live(st)) return null;
  const s = script()[st.step - 1];
  return `We're on step ${st.step} of ${TOTAL}, "${s.title}". ${s.text[0].replace(', {first}', '')} When you're ready, tap "Carry on".`;
}

store.onReset(() => states.clear());

module.exports = { steps, status, prefill, answer, skip, replay, finishIntro, noteQuestion, explain, UI, TOTAL, LANGUAGES, CHOICE_ROWS };
