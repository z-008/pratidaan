/** Azure OpenAI request mapping. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { toMessages } = require('../src/ai/llm');

test('plain user text stays plain text', () => {
  assert.deepEqual(toMessages([{ role: 'user', content: 'Hello' }]), [{ role: 'user', content: 'Hello' }]);
});

test('lab report images become Azure OpenAI data URLs', () => {
  const messages = toMessages([{ role: 'user', content: [
    { type: 'text', text: 'Read this' },
    { type: 'image', source: { media_type: 'image/png', data: 'YWJj' } },
  ] }]);
  assert.equal(messages[0].content[1].image_url.url, 'data:image/png;base64,YWJj');
});

test('tool call ids are preserved on calls and tool results', () => {
  const messages = toMessages([
    { role: 'assistant', content: [{ type: 'tool_use', id: 'fallback', name: 'get_profile', input: {}, callId: 'call-1' }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'fallback', call_id: 'call-1', content: '{"name":"Arjun"}' }] },
  ]);
  assert.equal(messages[0].tool_calls[0].id, 'call-1');
  assert.equal(messages[0].tool_calls[0].function.name, 'get_profile');
  assert.equal(messages[1].tool_call_id, 'call-1');
  assert.equal(messages[1].content, '{"name":"Arjun"}');
});
