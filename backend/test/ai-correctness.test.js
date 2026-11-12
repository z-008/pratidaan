const test = require('node:test');
const assert = require('node:assert/strict');
const llm = require('../src/ai/llm');
const tools = require('../src/ai/tools');
const copilot = require('../src/ai/copilot');
const insights = require('../src/ai/insights');
const dropWriter = require('../src/ai/dropWriter');
const drop = require('../src/domain/drop');
const store = require('../src/data/store');
const { runAgent } = require('../src/ai/agent');

const originalCall = llm.call;
const originalJson = llm.json;
test.afterEach(() => { llm.call = originalCall; llm.json = originalJson; store.resetDemo(); });

test('structured results reject missing fields, wrong types and unknown properties', () => {
  const schema = { type: 'object', required: ['score'], additionalProperties: false,
    properties: { score: { type: 'integer', minimum: 0, maximum: 100 } } };
  assert.deepEqual(llm.structured({ score: 80 }, schema), { score: 80 });
  for (const bad of [null, [], {}, { score: '80' }, { score: 101 }, { score: 80, extra: 'yes' }]) {
    assert.throws(() => llm.structured(bad, schema), /invalid structured result/);
  }
});

test('tool arguments cannot mutate memory, readings or navigation on malformed input', () => {
  const before = drop.view('D-001').memory.length;
  assert.match(tools.run('remember', { fact: 'My migraines worsen' }, 'D-001').error, /Invalid tool arguments/);
  assert.match(tools.run('remember', { category: 'schedule_day', value: 'migraines' }, 'D-001').error, /Invalid tool arguments/);
  assert.equal(drop.view('D-001').memory.length, before);
  assert.match(tools.run('log_reading', { systolic: '140', diastolic: 90 }, 'D-001').error, /Invalid tool arguments/);
  assert.match(tools.run('navigate', { screen: 'billing', reason: 'visit' }, 'D-001').error, /Invalid tool arguments/);
  const remembered = tools.run('remember', { category: 'schedule_time', value: 'evening' }, 'D-001');
  assert.equal(remembered.remembered, 'Evenings suit you');
});

test('offline BP urgency recommends same-day care and offers a card', () => {
  const answer = copilot.fallback('D-017', 'How is my blood pressure?');
  assert.match(answer.reply, /doctor today/i);
  assert.ok(answer.actions.some((a) => a.type === 'card'));
});

test('offline ferritin trend and cover hold do not answer as BP or donation holds', () => {
  const ferritin = copilot.fallback('D-001', 'Show my ferritin trend');
  assert.equal(ferritin.actions[0]?.marker, 'ferritin');
  assert.match(ferritin.reply, /ferritin/i);
  const insurance = copilot.fallback('D-001', 'Why is my insurance cover on hold?');
  assert.match(insurance.reply, /cover|score|check-up/i);
  assert.ok(!insurance.actions.some((a) => a.marker === 'bp'));
});

test('trend tool includes donor-entered BP readings like the chart', () => {
  drop.logReading('D-001', { s: 129, d: 81 });
  const trend = tools.run('get_trend', { marker: 'bp' }, 'D-001');
  assert.deepEqual(trend.at(-1), { date: store.today(), value: '129/81', source: 'yours' });
});

test('card safety messages are not eligible for model rewrite even with matching numbers', () => {
  assert.equal(dropWriter.keepsFacts('BP 180/120. Please see a doctor today.', 'BP 180/120. No need to see a doctor today.'), false);
  assert.equal(dropWriter.keepsFacts('You can donate from 14 Oct.', 'You cannot donate from 14 Oct.'), false);
});

test('insight rejects an unknown candidate or mismatched CTA', async () => {
  llm.json = async () => ({ candidateId: 'fabricated', title: 'Fabricated', message: 'Unknown', cta: 'health' });
  const unknown = await insights.forDonor('D-001');
  assert.equal(unknown.generatedBy, 'rules');
  const candidate = insights.candidates('D-001')[0];
  llm.json = async () => ({ candidateId: candidate.id, title: 'Wrong', message: 'Unknown', cta: 'labs' });
  const mismatched = await insights.forDonor('D-001');
  assert.equal(mismatched.generatedBy, 'rules');
});

test('a saved reading receipt remains visible if the next model call fails', async () => {
  let calls = 0;
  llm.call = async () => {
    calls += 1;
    if (calls > 1) throw new llm.LLMUnavailable('Vertex request failed');
    return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'log_reading:0', name: 'log_reading', input: { systolic: 133, diastolic: 84 } }] };
  };
  const result = await runAgent({ feature: 'test', system: '', messages: [{ role: 'user', content: 'My BP is 133/84' }], donorId: 'D-001', toolNames: ['log_reading'] });
  assert.equal(result.incomplete, true);
  assert.ok(result.actions.some((a) => a.type === 'receipt' && /133\/84/.test(a.text)));
});
