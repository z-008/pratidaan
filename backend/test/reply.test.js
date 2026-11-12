const test = require('node:test');
const assert = require('node:assert/strict');
const { visibleReply } = require('../src/ai/llm');

const NOTE = `The user wants to know about their latest results. The results show high blood pressure.

Plan:
- Summarize the findings.

Draft 1: Your latest results show high blood pressure.

Critique 1: This draft is fine.

Final Answer: Your latest results show high blood pressure (stage 1) at 148/94 mmHg. Would you like to know what to do next?`;

test('a reasoning note is reduced to the answer for the donor', () => {
  assert.equal(visibleReply(NOTE), 'Your latest results show high blood pressure (stage 1) at 148/94 mmHg. Would you like to know what to do next?');
});

test('an ordinary reply is left as it is', () => {
  const reply = 'Your latest results show high blood pressure (stage 1) at 148/94 mmHg.';
  assert.equal(visibleReply(reply), reply);
});
