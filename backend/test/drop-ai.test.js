/**
 * Drop answers questions about the between-donation features through the model (copilot.chat → runAgent →
 * tools → checks after the model), with rule answers only when the model is unavailable. A scripted stand-in
 * for the model calls the tools an LLM would and answers from their results, so the whole path is exercised:
 * the tools each Chat offers, the context Drop is given, multi-turn history, the food and plan checks that
 * replace foods the rules didn't choose or any medicine and add every doctor line, Week plan Cards, and the
 * offline fallback for every Persona.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const llm = require('../src/ai/llm');
const copilot = require('../src/ai/copilot');
const store = require('../src/data/store');
const improvements = require('../src/domain/improvements');
const drop = require('../src/domain/drop');

const original = llm.call;
test.afterEach(() => { llm.call = original; store.resetDemo(); });
const user = { sub: 'test-drop-ai', name: 'Guest' };
const PERSONAS = { 'D-001': 'Arjun', 'D-002': 'Meera', 'D-003': 'Ananya', 'D-017': 'Vikram', 'D-050': 'Karthik', 'D-033': 'Rohan', 'D-175': 'Asha' };

/** Which tool a model would call for a question (what the tool descriptions and Drop's prompt ask for). */
function toolFor(text) {
  if (/improve|healthier|what should i eat|vitamin|b12|deficien|habits? (should|to)|plan for my health/i.test(text)) return { name: 'get_health_plan', input: {} };
  if (/sleep|steps|active|walked|my apps|this week/i.test(text)) return { name: 'get_habits_from_apps', input: {} };
  if (/ready|before (my )?donat/i.test(text)) return { name: 'get_readiness', input: {} };
  if (/plan (for |this )?(the )?week|plan my week/i.test(text)) return { name: 'offer_week_plan', input: { habit: /food|eat/i.test(text) ? 'food' : 'movement' } };
  if (/breakfast|lunch|snack|iron food|foods? for/i.test(text)) return { name: 'find_foods', input: { marker: 'iron' } };
  if (/cycle report|since my last donation|compared/i.test(text)) return { name: 'get_cycle_report', input: {} };
  return null;
}

/**
 * The stand-in model. `say(result, tool)` writes the answer from the tool result (an LLM would phrase it);
 * every call is recorded so the test can check the tools and context Drop gave it.
 */
function standIn(say, calls) {
  return async (req) => {
    calls.push(req);
    const last = req.messages[req.messages.length - 1];
    if (Array.isArray(last.content) && last.content.some((b) => b.type === 'tool_result')) {
      const r = last.content.find((b) => b.type === 'tool_result');
      const question = [...req.messages].reverse().find((x) => x.role === 'user' && typeof x.content === 'string')?.content || '';
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: say(JSON.parse(r.content), r.name, question) }] };
    }
    const q = typeof last.content === 'string' ? last.content : '';
    const t = toolFor(q);
    if (t && req.tools.some((d) => d.name === t.name)) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: `${t.name}:0`, name: t.name, input: t.input }] };
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Happy to help with that.' }] };
  };
}

/** A faithful answer: the plan's own foods and habits, and the result each helps. */
const faithful = (r, tool, question = '') => {
  if (tool === 'get_health_plan') return r.plan === null ? r.note : `${r.headline} Try ${r.foodsThatHelpMost.slice(0, 2).map((f) => `${f.name} (helps ${f.helps.join(' and ').toLowerCase()})`).join(' and ')}, and ${r.habitsThatHelpMost[0].habit.toLowerCase()}.`;
  if (tool === 'get_habits_from_apps') return `This week: ${r.habits.filter((h) => !/sleep/i.test(question) || h.habit === 'mind').flatMap((h) => h.measured).slice(0, 2).join('; ')}.`;
  if (tool === 'get_readiness') return `Before your next donation: ${r.checklist.slice(0, 2).join('; ')}.`;
  if (tool === 'find_foods') return r.rulesOnly ? r.say : `For breakfast: ${r.foods[0].name}, ${r.foods[0].fitIn}.`;
  if (tool === 'offer_week_plan') return 'Here is a plan for this week: tap Save on the card to keep it.';
  if (tool === 'get_cycle_report') return r.report ? r.report.slice(0, 2).join(' ') : r.note;
  return 'Done.';
};

async function ask(donorId, message, { chat = 'general', history = [], say = faithful, calls = [] } = {}) {
  llm.call = standIn(say, calls);
  const r = await copilot.chat({ user, donorId, history, message, userName: PERSONAS[donorId], chat });
  return { ...r, calls };
}

test('every Chat offers Drop the between-donation tools, and its context carries the plan from the results', async () => {
  for (const chat of ['general', 'habit:food', 'habit:movement', 'habit:mind']) {
    const { calls } = await ask('D-175', 'What should I improve in my health?', { chat });
    const names = calls[0].tools.map((t) => t.name);
    for (const t of ['get_health_plan', 'get_habits_from_apps', 'get_readiness', 'find_foods', 'offer_week_plan']) assert.ok(names.includes(t), `${chat}: ${t}`);
    assert.match(calls[0].system, /From their results: Your results ask for: vitamin D/);
    assert.match(calls[0].system, /Their apps, last 7 days/);
    assert.ok(!/saving a Week plan .* is coming soon/.test(calls[0].system), 'no more "coming soon"');
  }
});

test('"What should I improve?" is answered by the model from the plan, for every Persona, with every doctor line added', async () => {
  for (const id of Object.keys(PERSONAS)) {
    const r = await ask(id, 'What should I improve in my health?');
    assert.ok(r.steps.some((s) => s.tool === 'get_health_plan'), `${id} used the plan`);
    assert.ok(!r.offline, `${id} answered by the model`);
    const plan = improvements.plan(drop._state(id));
    for (const d of plan.doctors) assert.ok(r.reply.includes(d.text), `${id}: doctor line "${d.text}"`);
    assert.ok(!/tablet|supplement|capsule/i.test(r.reply), `${id}: no medicine`);
  }
});

test("the model can't slip in a medicine or a food the rules didn't choose: the rule wording replaces it", async () => {
  const bad = await ask('D-175', 'What should I improve? Anything for vitamin D?', { say: () => 'Take a vitamin D sachet and eat chicken liver every day.' });
  assert.ok(!/sachet|chicken liver/i.test(bad.reply));
  assert.match(bad.reply, /vitamin D/);
  const stray = await ask('D-002', 'Breakfast ideas for my iron?', { chat: 'habit:food', say: () => 'Have chicken liver for breakfast.' });
  assert.ok(!/chicken liver/i.test(stray.reply), 'Meera is vegetarian');
  assert.match(stray.reply, /See a doctor within 2 weeks/);
});

test('multi-turn: the follow-up keeps the conversation and gets its own tool', async () => {
  const calls = [];
  const first = await ask('D-001', 'How did I sleep this week?', { calls });
  assert.ok(first.steps.some((s) => s.tool === 'get_habits_from_apps'));
  assert.match(first.reply, /Sleep/);
  const history = [{ role: 'user', content: 'How did I sleep this week?' }, { role: 'assistant', content: first.reply }];
  const second = await ask('D-001', 'What habits should I build to improve that?', { history, calls });
  assert.ok(second.steps.some((s) => s.tool === 'get_health_plan'));
  const lastCall = calls[calls.length - 1];
  assert.ok(lastCall.messages.some((m) => m.role === 'assistant' && /Sleep/.test(typeof m.content === 'string' ? m.content : JSON.stringify(m.content))), 'the first answer is in the history');
  assert.match(second.reply, /See a doctor within 3 weeks/);
});

test('a Week plan asked for in any Chat opens a Card the Donor taps to save', async () => {
  for (const chat of ['general', 'habit:movement']) {
    store.resetDemo();
    const r = await ask('D-050', 'Can you plan my week for walking?', { chat });
    assert.ok(r.steps.some((s) => s.tool === 'offer_week_plan'), chat);
    const card = r.actions.find((a) => a.type === 'card');
    assert.ok(card, `${chat}: a Card`);
    assert.equal(drop.view('D-050').open.find((c) => c.id === card.cardId).type, 'weekplan');
  }
});

test('readiness, apps and the Cycle report are answered from their tools', async () => {
  const ready = await ask('D-003', 'Am I ready for my next donation?');
  assert.ok(ready.steps.some((s) => s.tool === 'get_readiness'));
  assert.match(ready.reply, /Haemoglobin/);
  const report = await ask('D-001', 'Show my cycle report compared with last time');
  assert.ok(report.steps.some((s) => s.tool === 'get_cycle_report'));
});

test('Vikram (urgent BP): the plan says see a doctor today and suggests no exercise', async () => {
  const r = await ask('D-017', 'What should I improve? Should I start running?');
  assert.match(r.reply, /Please see a doctor today/);
  assert.ok(!r.reply.match(/brisk walk|30-minute/i));
});

test('with the model unavailable, the rules answer the same questions for every Persona', async () => {
  llm.call = async () => { throw new llm.LLMUnavailable('offline'); };
  for (const id of Object.keys(PERSONAS)) {
    for (const [chat, q, expect] of [
      ['general', 'What should I improve in my health?', /results/i],
      ['habit:food', 'Breakfast ideas for my iron?', /iron|doctor/i],
      ['habit:mind', 'How did I sleep this week?', /Sleep/],
      ['habit:movement', 'Help me plan this week\'s movement', /plan/i],
    ]) {
      const r = await copilot.chat({ user, donorId: id, history: [], message: q, userName: PERSONAS[id], chat });
      assert.ok(r.offline || r.answeredByRules, `${id} ${chat}: rules`);
      assert.match(r.reply, expect, `${id} ${chat}: "${r.reply.slice(0, 80)}"`);
    }
    store.resetDemo();
  }
});
