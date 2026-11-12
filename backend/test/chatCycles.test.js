const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const chatCycles = require('../src/domain/chatCycles');

const guestA = { sub: 'guest-aaaa', guest: true, email: 'guest@tracedrop.app', name: 'Guest' };
const guestB = { sub: 'guest-bbbb', guest: true, email: 'guest@tracedrop.app', name: 'Guest' };

describe('chatCycles', () => {
  beforeEach(() => {
    chatCycles.resetState();
    store.resetDemo();
  });

  it('archives turns on demo reset', () => {
    chatCycles.recordTurn(guestA, 'D-001', 'general', { userText: 'Hi', assistantText: 'Hello', history: null });
    chatCycles.archiveCurrentCycle();
    store.resetDemo();
    const past = chatCycles.listPast(guestA, 'D-001');
    assert.ok(past.length >= 1);
    const full = chatCycles.getPast(guestA, 'D-001', past[0].id);
    assert.ok(full.chats.general.turns.length >= 1);
  });

  it('seeds a sample past cycle for demo personas', () => {
    const past = chatCycles.listPast(guestA, 'D-001');
    assert.ok(past.some((c) => c.label.includes('Earlier demo cycle')));
  });

  it('does not seed past cycles for the New donor persona', () => {
    const nu = store.allDonors().find((d) => d.newUser);
    if (!nu) return;
    assert.equal(chatCycles.listPast(guestA, nu.id).length, 0);
  });

  it('isolates chat between guest accounts on the same persona', () => {
    chatCycles.recordTurn(guestA, 'D-001', 'general', { userText: 'secret A', assistantText: 'reply A', history: null });
    chatCycles.recordTurn(guestB, 'D-001', 'general', { userText: 'secret B', assistantText: 'reply B', history: null });
    assert.equal(chatCycles.activeChat(guestA, 'D-001', 'general').turns.length, 1);
    assert.equal(chatCycles.activeChat(guestB, 'D-001', 'general').turns.length, 1);
    assert.equal(chatCycles.activeChat(guestA, 'D-001', 'general').turns[0].user, 'secret A');
    assert.equal(chatCycles.activeChat(guestB, 'D-001', 'general').turns[0].user, 'secret B');
  });
});
