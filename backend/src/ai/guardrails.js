/**
 * Donor-facing safety: static pre-checks on user text, shared prompt rules for every
 * LLM call, and post-checks on assistant wording.
 */

const DIAGNOSE = /\b(diagnos(e|is)|prescri(be|ption)|what (medicine|tablet|drug|dose|dosage)|should i take|am i (having|getting)|do i have (cancer|diabetes|covid)|cure for|treat(ment)? for)\b/i;
const EMERGENCY = /\b(chest pain|can't breathe|cannot breathe|suicid|kill myself|stroke|heart attack|bleeding heavily|unconscious)\b/i;
const PRESCRIBE_OUT = /\b(you should take|take \d|start taking|stop taking|try (this|these) (tablet|medicine|pill)|recommended dose)\b/i;
const MEDICINE_OUT = /\b(take|start|stop)\s+(this|that|the)?\s*(tablet|medicine|pill|dose)\b/i;

const PROMPT_SCOPE = `Scope and safety (always follow):
- Stay on blood donation, the donor's results, impact, cover, bookings and Pratidaan inside this app.
- Never diagnose, prescribe or recommend medicines or doses. Explain recorded results and the Plan; direct treatment decisions to a clinician.
- Emergency symptoms (chest pain, can't breathe, suicide, stroke, severe bleeding, etc.): tell them to call emergency services or go to hospital now; do not handle emergencies in chat.`;

const CHAT_SCOPE = `Off-scope requests (decline in one or two warm sentences — do not use tools to fulfill them):
- You are not a homework helper, essay writer, poet, coder, or general assistant. Refuse to draft essays, school assignments, letters to teachers, speeches, or long-form creative writing — even when the topic is blood donation or their journey.
- If they want facts for their own writing, give at most two short sentences of tool-backed stats (donation count, components, patients helped) and say you cannot write or structure the assignment for them.
- Decline finance, politics, sports scores, recipes, entertainment, and unrelated chit-chat the same way; redirect to results, impact, cover, booking, or their Plan.
- If you already offered help in an earlier turn but the deliverable is still an essay or assignment, decline when they confirm — scope does not change because the subject is donation-related.`;

const PROMPT_BY_KIND = {
  chat: `${PROMPT_SCOPE}
${CHAT_SCOPE}
- Use tools for in-app donor questions only; never invent labs, dates or recipients.
- For treatment questions, explain facts and offer check-up times (offer_care_slots), not medical advice.`,
  donor_copy: `${PROMPT_SCOPE}
- Use only the facts given; add no new clinical claims or medicines.`,
  translation: `Translate only. Do not add health advice, diagnoses or wording not in the source strings.`,
  extraction: `Extract printed values only. Do not interpret results as healthy or unhealthy or suggest treatment.`,
};

function augmentSystem(system, kind = 'donor_copy') {
  const tail = PROMPT_BY_KIND[kind];
  if (!tail) return String(system || '');
  return `${String(system || '').trim()}\n\n${tail}`;
}

function check(message) {
  const m = String(message || '').trim();
  if (!m) return { block: true, reply: 'Ask me in a short sentence — for example about your results, your blood\'s journey, or booking a check-up.' };

  if (EMERGENCY.test(m)) {
    return {
      block: true,
      reply: 'That sounds urgent. Please call emergency services or go to the nearest hospital now. Pratidaan cannot help with emergencies.',
      urgent: true,
    };
  }

  if (DIAGNOSE.test(m)) {
    return {
      block: true,
      reply: 'I cannot diagnose or prescribe. I can explain what your recorded results mean and what your Plan suggests — and I can offer check-up times to discuss with a clinician.',
      suggestCheckup: true,
    };
  }

  return { block: false };
}

/** Post-LLM: rewrite unsafe assistant text (copilot and similar). */
function sanitizeReply(text) {
  const t = String(text || '').trim();
  if (!t) return { reply: t, suggestCheckup: false };
  if (PRESCRIBE_OUT.test(t) || MEDICINE_OUT.test(t)) {
    return {
      reply: 'I cannot recommend medicines. I can explain your recorded results and offer check-up times to speak with a clinician.',
      suggestCheckup: true,
    };
  }
  return { reply: t, suggestCheckup: false };
}

module.exports = {
  check,
  sanitizeReply,
  augmentSystem,
  PROMPT_BY_KIND,
};
