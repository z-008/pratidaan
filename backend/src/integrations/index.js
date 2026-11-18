/**
 * Connected apps: the habit apps, watches and food apps a Donor already uses.
 * Pratidaan reads what they record (and can write a habit back); it doesn't
 * track habits itself. Terms: CONTEXT.md (Connection, Signal).
 *
 * Three modes:
 * - demo:    a demo connector replays a Persona's storyline (integrations/demo.js), labelled "demo" everywhere
 * - sandbox: a real third-party API with generated data (Junction sandbox), synced into the Persona
 * - live:    the signed-in person's own account (Habitify, Microsoft To Do); the key or token stays in the
 *            page, is sent per request and never stored, and the data is shown only to that session
 */

const PROVIDERS = {
  fitbit_demo: { id: 'fitbit_demo', label: 'Fitbit', kind: 'wearable', mode: 'demo', dataTypes: ['steps', 'active_min', 'sleep_min', 'rhr_bpm'], canWrite: false, blurb: 'Steps, active minutes, sleep and resting heart rate' },
  oura_demo: { id: 'oura_demo', label: 'Oura Ring', kind: 'wearable', mode: 'demo', dataTypes: ['sleep_min', 'rhr_bpm', 'steps'], canWrite: false, blurb: 'Sleep, resting heart rate and steps' },
  habitify_demo: { id: 'habitify_demo', label: 'Habitify', kind: 'habit', mode: 'demo', dataTypes: ['habit_done'], canWrite: true, blurb: 'Your habits, their streaks, and Drop can add a habit' },
  todo_demo: { id: 'todo_demo', label: 'Microsoft To Do', kind: 'habit', mode: 'demo', dataTypes: ['habit_done'], canWrite: true, blurb: 'Recurring tasks you tick off; Drop can add one' },
  cronometer_demo: { id: 'cronometer_demo', label: 'Cronometer', kind: 'food', mode: 'demo', dataTypes: ['iron_mg', 'water_ml'], canWrite: false, blurb: 'Iron from food and water, from the meals you log' },
  junction_sandbox: { id: 'junction_sandbox', label: 'Fitbit via Junction', kind: 'wearable', mode: 'sandbox', dataTypes: ['steps', 'active_min', 'sleep_min'], canWrite: false, blurb: 'A live call to the Junction sandbox API, which returns generated wearable data', requires: 'JUNCTION_API_KEY' },
  habitify_live: { id: 'habitify_live', label: 'Habitify (your account)', kind: 'habit', mode: 'live', dataTypes: ['habit_done'], canWrite: true, blurb: 'Paste your Habitify API key (Habitify app → Settings → API). It stays in this browser tab.' },
  todo_live: { id: 'todo_live', label: 'Microsoft To Do (your account)', kind: 'habit', mode: 'live', dataTypes: ['habit_done'], canWrite: true, blurb: 'Sign in with Microsoft to let Drop add your Week plan as recurring tasks. The token stays in this browser tab.' },
};

const GROUPS = [
  { id: 'habit', label: 'Habit apps' },
  { id: 'wearable', label: 'Watch & phone health' },
  { id: 'food', label: 'Food & water apps' },
];

function provider(id) {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown app ${id}`);
  return p;
}

/** The catalogue the Connected apps screen shows, with whether a sandbox key is configured. */
function catalogue() {
  return {
    groups: GROUPS,
    providers: Object.values(PROVIDERS).map((p) => ({ ...p, available: !p.requires || Boolean(process.env[p.requires]) })),
  };
}

module.exports = { PROVIDERS, GROUPS, provider, catalogue };
