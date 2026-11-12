const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const guardrails = require('../src/ai/guardrails');

describe('guardrails', () => {
  it('blocks diagnosis requests', () => {
    const r = guardrails.check('What medicine should I take for my BP?');
    assert.equal(r.block, true);
    assert.equal(r.suggestCheckup, true);
  });
  it('chat prompt declines essays and homework via LLM rules', () => {
    const out = guardrails.augmentSystem('Base.', 'chat');
    assert.match(out, /essay|homework|assignment/i);
    assert.match(out, /cannot write|Refuse to draft|not a homework/i);
  });
  it('does not regex-block donation-themed essay asks (model declines via prompt)', () => {
    const r = guardrails.check('Write an essay for my teacher about my blood donation journey');
    assert.equal(r.block, false);
  });
  it('allows donation questions', () => {
    const r = guardrails.check('When can I donate next?');
    assert.equal(r.block, false);
  });
  it('appends safety rules to system prompts', () => {
    const out = guardrails.augmentSystem('Base.', 'chat');
    assert.match(out, /Never diagnose/);
    assert.match(out, /Base\./);
  });
  it('sanitizes prescription-like replies', () => {
    const r = guardrails.sanitizeReply('You should take this tablet twice daily.');
    assert.match(r.reply, /cannot recommend medicines/i);
    assert.equal(r.suggestCheckup, true);
  });
});
