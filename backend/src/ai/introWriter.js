/**
 * The Intro in the donor's language: Gemini translates each step's words and buttons
 * (and the Intro's own words: the bar, Skip, coming back) when they are first shown,
 * once per language. A translation is used only if every number and every {placeholder}
 * survives; otherwise that text stays in English.
 *
 * This is its own check, not Drop's Card check: Card wording now has to match the rules
 * word for word, because Cards carry triage and eligibility. The Intro's words are
 * scripted and non-clinical (its example results stay in English in the pictures).
 */

const llm = require('./llm');

const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam' };
const TIMEOUT_MS = 15000;
const cache = new Map(); // `${language}|${english}` -> translation

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text'],
        properties: { id: { type: 'string' }, text: { type: 'string' } },
      },
    },
  },
};

function system(language) {
  return `You translate the words of Drop, the warm, plain-spoken assistant in Pratidaan, an app for voluntary blood donors in India, into ${LANGUAGE_NAMES[language]}.
Rules:
- Translate each item's text; return every id once.
- Keep every number as digits, and keep dates, "ml", BP, Hb, Pratidaan, Drop and Gemini as they are.
- Keep anything in curly braces exactly as it is, e.g. {first}, {title}, {n}, {total}, {date}.
- Button labels stay short (1-5 words). Use everyday words a person would say, not formal ones.`;
}

const placeholders = (t) => (t.match(/\{\w+\}/g) || []).sort().join(',');
const numbers = (t) => t.match(/\d+(?:[./]\d+)?/g) || [];
const ok = (english, translated) => typeof translated === 'string' && Boolean(translated.trim())
  && numbers(english).every((n) => translated.includes(n)) && placeholders(english) === placeholders(translated);

/**
 * Translate a list of English strings. Returns the strings in the same order (English
 * where there is no good translation) and whether any had to stay in English.
 */
async function translate(language, texts) {
  if (!LANGUAGE_NAMES[language] || language === 'en') return { texts, fallback: false };
  const unique = [...new Set(texts.filter((t) => t && !cache.has(`${language}|${t}`)))];
  if (unique.length && llm.available(3000)) {
    try {
      const call = llm.json({
        feature: 'intro_translate', system: system(language), maxTokens: 3000, effort: 'low', outputSchema: SCHEMA, guardrailKind: 'translation',
        messages: [{ role: 'user', content: JSON.stringify(unique.map((text, i) => ({ id: String(i), text })), null, 1) }],
      });
      const result = await Promise.race([call, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))]);
      for (const item of result.items || []) {
        const english = unique[Number(item.id)];
        if (english && ok(english, item.text)) cache.set(`${language}|${english}`, item.text);
      }
    } catch (error) {
      console.error(`[intro translate] ${language}: ${error.message}`);
    }
  }
  const out = texts.map((t) => (t && cache.get(`${language}|${t}`)) || t);
  return { texts: out, fallback: texts.some((t, i) => t && out[i] === t) };
}

module.exports = { translate, ok, LANGUAGE_NAMES };
