/**
 * Drop's voice: Gemini rewrites the wording of open Cards (at most 3 at a
 * time) in the Donor's language. The rules engine has already decided which
 * Cards exist and what they say; the AI only phrases them. A Card keeps its
 * rule wording if the AI is unavailable or cannot be checked safely.
 */

const store = require('../data/store');
const drop = require('../domain/drop');
const llm = require('./llm');

const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam' };
const MAX_CARDS = 3;
const TIMEOUT_MS = 12000;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text'],
        properties: {
          id: { type: 'string' },
          text: { type: 'string', description: 'The message, one or two short sentences' },
          main: { type: 'string', description: 'Main button label, 1-4 words' },
          out: { type: 'string', description: 'Secondary button label, 1-4 words' },
          chips: { type: 'array', items: { type: 'string' }, description: 'Chip labels, same count and order as given' },
        },
      },
    },
  },
};

function system(language) {
  return `You are Drop, the warm, plain-spoken assistant in Pratidaan, an app for voluntary blood donors in India.
Rewrite each card's message so it sounds like Drop talking to this donor.
Rules:
- Keep every fact exactly: numbers, dates, times, places, blood groups. Add nothing that is not in the card.
- One or two short sentences. If the card is written as I/my, keep that first person. Otherwise write in the second person, and use the donor's first name at most once across all cards.
- Never diagnose. Never mention medicines unless the card does. For urgent cards keep "see a doctor today" clear and calm.
- Button and chip labels: 1-4 words, same meaning, same number of chips in the same order; keep dates, times and place names in chips.
- Write in ${LANGUAGE_NAMES[language] || 'English'}. Keep numbers as digits and keep BP, Hb and HbA1c as they are.`;
}

/** A numeric match alone does not preserve triage, donation eligibility or negation. */
function keepsFacts(ruleText, aiText) {
  if (typeof ruleText !== 'string' || typeof aiText !== 'string' || !aiText.trim()) return false;
  const numbers = ruleText.match(/\d+(?:[./]\d+)?/g) || [];
  if (!numbers.every((n) => aiText.includes(n))) return false;
  // Semantically equivalent phrasing cannot be established from digits or keywords.
  // Only cosmetic whitespace/punctuation changes are safe without a factual verifier.
  return ruleText.replace(/[\s.,!?;:]+/g, ' ').trim().toLowerCase() === aiText.replace(/[\s.,!?;:]+/g, ' ').trim().toLowerCase();
}

async function write(donorId) {
  // Existing safety-sensitive Cards always retain deterministic rule wording.
  const pending = drop.openForWriting(donorId).filter(({ card, words }) => !card.urgent && keepsFacts(words.text, words.text)).slice(0, MAX_CARDS);
  if (!pending.length || !llm.available(2000)) return 0;
  const donor = store.getDonor(donorId);
  const language = drop.chatContext(donorId).language;
  const input = pending.map(({ card, words }) => ({
    id: card.id, label: drop.label(card), text: words.text,
    main: words.main?.label, out: words.out?.label, chips: (words.chips || []).map((c) => c.label),
  }));
  const call = llm.json({
    feature: 'drop_cards', system: system(language), maxTokens: 1500, effort: 'low', outputSchema: SCHEMA, guardrailKind: 'donor_copy',
    messages: [{ role: 'user', content: `Donor's first name: ${donor.newUser ? 'not known, use no name' : donor.name.split(' ')[0]}.\nCards:\n${JSON.stringify(input, null, 1)}` }],
  });
  const result = await Promise.race([call, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))]);
  let written = 0;
  for (const out of llm.structured(result, SCHEMA).cards) {
    const given = input.find((c) => c.id === out.id);
    if (!given || !keepsFacts(given.text, out.text)) continue;
    // Do not let button or chip rewrites alter the effect of a donor action.
    if (out.main && out.main !== given.main || out.out && out.out !== given.out || out.chips && JSON.stringify(out.chips) !== JSON.stringify(given.chips)) continue;
    drop.setAi(donorId, out.id, {
      sig: pending.find((p) => p.card.id === out.id).sig,
      text: out.text,
      labels: null,
    });
    written += 1;
  }
  return written;
}

/** Best effort: never block or break the Drop view. */
async function tryWrite(donorId) {
  try {
    return await write(donorId);
  } catch (error) {
    console.error(`[drop writer] ${donorId}: ${error.message}`);
    return 0;
  }
}

module.exports = { write, tryWrite, keepsFacts };
