/**
 * Drop's chat: answers open questions across the platform ("how's my BP?",
 * "where did my platelets go?", "book me a check-up") by calling tools, and
 * replies in one or two sentences plus at most one Card (a chart, slots or a
 * reminder). Every turn it reads what it remembers about the Donor and their
 * Plan. Conversation history is kept client-side and sent back each turn.
 */

const store = require('../data/store');
const health = require('../domain/health');
const drop = require('../domain/drop');
const intro = require('../domain/intro');
const screenLines = require('../domain/screenLines');
const llm = require('./llm');
const { runAgent } = require('./agent');
const tools = require('./tools');
const guardrails = require('./guardrails');
const chatCycles = require('../domain/chatCycles');
const agentPlatform = require('./agentPlatform');

// Slots are offered as a Card (offer_care_slots), never listed as text
const CHAT_TOOLS = tools.definitions().map((d) => d.name).filter((n) => n !== 'find_care_slots');

const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam' };
const LANGUAGE_WORDS = {
  en: /\benglish\b/, hi: /\bhindi\b|हिंदी|हिन्दी/, kn: /\bkannada\b|ಕನ್ನಡ/, ta: /\btamil\b|தமிழ்/, te: /\btelugu\b|తెలుగు/, ml: /\bmalayalam\b|മലയാളം/,
};

const SYSTEM = `You are Drop, the assistant inside Pratidaan, an app for voluntary blood donors in India.
Pratidaan shows donors (1) where every component of their donated blood went and who it helped, without revealing recipients, (2) their health from the free lab panel run on each donation sample, with trends and a Plan, (3) how sustained good health raises their health-insurance cover for the same premium, and (4) the impact on their communities.

How you answer:
- Hard limit: two short, warm sentences (about 40 words), even when explaining results: say the one or two things that matter most and offer to say more. Longer only if they ask for detail. Never a list unless asked. Use the donor's first name now and then.
- Get facts from tools. Never invent numbers, dates, results or recipients; if a tool doesn't have it, say so.
- When something visual helps, show at most ONE card per reply and refer to it: show_chart for a trend ("Here's your BP since 2024."), offer_care_slots to book a free check-up, offer_reminder when they ask to be reminded of something.
- Only when they explicitly tell you a schedule or language preference, call remember with its canonical category and value. Never remember health statements, life details, religion, caste, income, family members' health or anything about recipients. When they tell you a BP reading, call log_reading.
- Health: explain plainly what a result means and what the Plan says next. You don't diagnose or prescribe medicine. For anything urgent, tell them to see a doctor today and offer_care_slots.
- Recipients are anonymous: only age band, clinical use and hospital type.
- Insurance: explain the illustrative score -> risk -> cover model; these are not issued benefits and no insurer receives the score. Never claim a modeled amount is approved cover.
- Booking: all clinic and blood-centre slots shown by Pratidaan are demo examples, not partner-confirmed reservations. A Microsoft Calendar event/email can be real, but neither confirms a centre reservation.
- When they ask where something is, call navigate.
- Match the topic they asked about: blood journey / who it helped -> get_donation_impact and navigate to impact, not BP or donation eligibility. BP or labs -> get_trend or show_chart. Booking -> offer_care_slots or navigate to donate.
- Write in the language given below unless they write in another language; then use theirs. Keep numbers as digits.
- Speak straight to the donor. Never call them "the user", and never include a plan, a draft or a critique.
- Not a writing service: refuse to write or outline essays, homework, school assignments, or letters for a teacher — even about their donation journey. You may share two short, factual sentences from tools if they want stats for their own work; do not draft paragraphs, introductions, or "structure" for them.`;

/** Who Drop is talking to. The New donor is the signed-in person themself, a new user with no records yet. */
function who(donor, userName) {
  if (!donor.newUser) return `${donor.name} (${donor.id})`;
  const first = userName ? String(userName).split(' ')[0] : null;
  return `a new user (${donor.id}) who has just joined: no donations, results, Circles or insurer yet. ${first ? `Their first name is ${first}.` : "You don't know their name, so don't use one."}`;
}

const HABITS = ['movement', 'food', 'mind'];

/** Donation screening/labs from the deterministic health engine (not chat-logged BP). */
function healthFacts(donorId) {
  const findings = health.findings(donorId);
  const score = health.currentScore(donorId);
  const visits = store.getDonations(donorId).filter((v) => v.status === 'completed');
  const last = visits[visits.length - 1];
  const flagged = findings.length
    ? findings.map((f) => `${f.title}: ${f.detail}`).join('; ')
    : 'none (all donation screening and lab results in range)';
  const lastVisit = last
    ? `Last completed donation ${last.date}: haemoglobin ${last.haemoglobin ?? '—'}, BP ${last.systolic ?? '—'}/${last.diastolic ?? '—'}, pulse ${last.pulse ?? '—'}.`
    : 'No completed donations yet.';
  return `Donation check-up data (authoritative for "latest results"): health score ${score?.score ?? '—'}/100; flagged findings: ${flagged}. ${lastVisit}`;
}

function context(donorId, userName, chat = 'general') {
  const donor = store.getDonor(donorId);
  const c = drop.chatContext(donorId);
  return `Today: ${store.today()}. Donor: ${who(donor, userName)}. Write in ${LANGUAGE_NAMES[c.language] || 'English'}.
${healthFacts(donorId)}
What you remember about them: ${c.memory.join('; ') || 'nothing yet'}.
Their Plan: ${c.plan.join('; ') || 'none yet'}. Reminders: ${c.reminders.join('; ') || 'none'}. Latest reading they told you in chat (not the donation panel): ${c.latestReading || 'none'}.
Cards waiting for them on Home: ${c.openCards.join(', ') || 'none'}.${goalLines(c.goals)}${chatLine(chat, c.goals)}${introLine(donorId)}`;
}

/** Each Goal's write-up: what Drop suggests stays within its steps. */
function goalLines(goals) {
  if (!goals.length) return '';
  return `\nTheir Goals, with the steps their results call for (suggest only these, in your own words). These steps come from Pratidaan's rules, not from their doctor: never say a doctor advised them. ${goals.map((g) =>
    `${g.name}${g.state === 'active' ? '' : ` (${g.state === 'upnext' ? 'Up next' : g.state})`}: target ${g.target}; why: ${g.why} Steps: ${g.steps.join('; ')}.${g.urgent ? ' This Goal is urgent: suggest no exercise, Movement plan or walks (not even gentle ones) until they say a doctor has seen them; say so kindly, and still help with the other steps.' : ''}`).join(' | ')}`;
}

/** Which Chat this is (CONTEXT.md: Chat). Week plans aren't built yet, so nothing can be saved or put in a calendar from here. */
function chatLine(chat, goals) {
  const goal = String(chat).startsWith('goal:') ? goals.find((g) => `goal:${g.id}` === chat) : null;
  const habit = String(chat).startsWith('habit:') && HABITS.includes(chat.slice(6)) ? chat.slice(6) : null;
  const where = goal ? `the Chat about their Goal "${goal.name}"` : habit ? `the Chat about their ${habit.charAt(0).toUpperCase()}${habit.slice(1)} Habit` : 'their General Chat';
  return `\nThis conversation is ${where}. If they ask for a plan for the week, suggest one or two concrete things from their Goals' steps${habit ? ` that fit ${habit}` : ''} (or, with no Goal, a simple everyday ${habit || 'habit'} idea with no health reason), then say that saving a Week plan and adding it to their calendar is coming soon in Pratidaan. Never claim you saved or scheduled anything.`;
}

/** While the Intro runs, Drop knows which step the person is on, so "what's this?" gets a sensible answer. */
function introLine(donorId) {
  const i = intro.status(donorId);
  if (i.status !== 'new' && i.status !== 'running') return '';
  return `\nThey are in the Intro, Drop's scripted first conversation, on step ${i.step} of ${i.total}: "${i.title}". If they ask about it, answer in one or two sentences about that step; the Intro's buttons let them carry on.`;
}

// A reply that opens with the model's own planning ("The user wants…") or leaked tool code ("tool_code", "default_api.…") is not for the donor
const NOTE_TO_SELF = /^(the user\b|okay, the user\b|i should\b|plan:|tool_code|```|print\(|default_api\.)|\bdefault_api\./i;
// Drop never calls the Donor "the user", and never narrates what it will do ("Given this, I should advise…")
const isNote = (text) => NOTE_TO_SELF.test(text) || /\bthe user('s)?\b/i.test(text) || /^(given|therefore|so|based on)\b[^.]*\bI (should|will|need to)\b/i.test(text) || /^I will (inform|tell|advise|explain)\b/i.test(text);

function intentHint(message) {
  const m = String(message || '').toLowerCase();
  if (/\b(where did my blood|blood go|who did my|platelets? go|red cells? go)\b/.test(m)) {
    return '\nThe donor is asking about donation impact / where components went. Use get_donation_impact; call navigate to impact. Do not talk about BP, labs, or whether they can donate unless they asked.';
  }
  if (/\b(bp|blood pressure)\b/.test(m) && /\b(how|doing|trend|chart)\b/.test(m)) {
    return '\nThey want a BP trend. Call get_trend or show_chart for bp, then explain briefly.';
  }
  if (/\b(check-?up|doctor)\b/.test(m) && /\b(book|schedule|see|visit|need|want|like)\b/.test(m)) {
    return '\nThey want to book a check-up. Call offer_care_slots (one card), do not list times as text.';
  }
  return '';
}

function replyTooLong(reply) {
  return String(reply || '').trim().split(/\s+/).length > 50;
}

function replyMatchesQuestion(message, reply) {
  const m = String(message || '').toLowerCase();
  const r = String(reply || '').toLowerCase();
  if (/\b(bp|blood pressure)\b/.test(m) && /\b(how|doing|trend|chart)\b/.test(m)) {
    if ((/\bhba1c\b|prediabetes|ferritin|haemoglobin|hemoglobin/i.test(r)) && !/\d{2,3}\s*\/\s*\d{2,3}/.test(r)) return false;
    return /\d{2,3}\s*\/\s*\d{2,3}/.test(r) || /\bblood pressure\b|\bbp\b/.test(r);
  }
  if (/\b(where did my blood|blood go)\b/.test(m)) {
    return !/\b138\/|donation eligibility|recipient details aren't\b/.test(r) && !/\bhba1c|ferritin\b/.test(r);
  }
  if (/\b(when can i donate|donate next|can i donate)\b/.test(m) || (/\bdonate\b/.test(m) && /\b(when|next|hold|eligible)\b/.test(m))) {
    if (/patient|chemo|trauma|postpartum|impact map|here's the bp/i.test(r)) return false;
    if (/\d{2,3}\s*\/\s*\d{2,3}/.test(r) && !/\bbp\b|blood pressure/i.test(m)) return false;
    return /\bdonat|hold|eligible|haemoglobin|hemoglobin|ferritin|from \d|remind/i.test(r);
  }
  return !replyTooLong(reply);
}

/** Common Home chips — one topic, rule-backed text, optional screen button (no full agent). */
function chipShortcut(donorId, message) {
  const m = String(message || '').toLowerCase();
  if (/\b(when can i donate|donate next|can i donate|next donation|eligible to donate)\b/.test(m)
    || (/\bdonate\b/.test(m) && /\b(when|next|hold|eligible)\b/.test(m))) {
    return { reply: screenLines.line(donorId, 'donate').text, actions: [{ type: 'navigate', screen: 'donate' }] };
  }
  if (/what do you remember/.test(m)) {
    const memory = drop.view(donorId).memory.map((x) => x.text);
    return {
      reply: memory.length ? `Here's what I remember: ${memory.join('; ')}. You can delete any of it from "What do you remember about me?".` : "I don't remember anything about you yet.",
      actions: [],
    };
  }
  if (/\b(cover|insurance|premium|insured)\b/.test(m)) {
    return { reply: screenLines.line(donorId, 'cover').text, actions: [{ type: 'navigate', screen: 'cover' }] };
  }
  return null;
}

function bestGrounded(donorId, message) {
  return chipShortcut(donorId, message) || groundedAnswer(donorId, message);
}

function bpSummaryLine(donorId) {
  const points = drop.chartPoints(donorId, 'bp');
  if (!points.length) return screenLines.line(donorId, 'health').text;
  const last = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : null;
  const trend = !prev ? '' : last.value > prev.value || last.value2 > prev.value2 ? ', up from your previous visit' : last.value < prev.value || last.value2 < prev.value2 ? ', down from your previous visit' : ', similar to your previous visit';
  return `Your latest donation BP was ${last.value}/${last.value2} mmHg${trend}.`;
}

/** Deterministic text + UI actions for common intents (agent fallback). */
function groundedAnswer(donorId, message) {
  const m = String(message || '').toLowerCase();
  if (/\b(bp|blood pressure)\b/.test(m) && /\b(how|doing|trend|chart)\b/.test(m)) {
    const charts = chartActionsForMessage(donorId, message);
    if (!charts.length) return null;
    return {
      reply: `${bpSummaryLine(donorId)} Here's your BP trend in the chart below.`,
      actions: charts,
    };
  }
  if (/\b(results?|labs?|score)\b/.test(m) && /\b(explain|latest|mean|what|how)\b/.test(m)) {
    const f = health.findings(donorId);
    const score = health.currentScore(donorId);
    const reply = f.length
      ? `Your latest results: ${f.slice(0, 3).map((x) => `${x.title} (${x.detail})`).join('; ')}. A doctor confirms all findings.`
      : `Your latest donation check-up results are all in the healthy range (health score ${score?.score ?? '—'}/100). Nothing needs watching right now.`;
    return { reply, actions: uiActionsForMessage(donorId, message, []) };
  }
  return null;
}

/** Drop chart cards unless the user asked for that marker (stops agent tool noise on unrelated chips). */
function alignActionsToQuestion(donorId, message, actions) {
  const allowed = chartActionsForMessage(donorId, message);
  const allowMarkers = new Set(allowed.map((c) => c.marker));
  const rest = (actions || []).filter((a) => a.type !== 'chart');
  const charts = (actions || []).filter((a) => a.type === 'chart' && allowMarkers.has(a.marker));
  if (charts.length) return [...rest, charts[0]];
  if (allowed.length) return [...rest, allowed[0]];
  return rest;
}

/** Charts, cards, and navigation the UI should show even if the model forgot a tool. */
function uiActionsForMessage(donorId, message, actions) {
  const m = String(message || '').toLowerCase();
  const out = [...actions];
  const has = (type) => out.some((a) => a.type === type);
  if (!has('chart')) {
    const charts = chartActionsForMessage(donorId, message);
    if (charts.length) out.push(charts[0]);
  }
  if (!has('navigate') && /\b(where did my blood|blood go|who did my|open my impact)\b/.test(m)) {
    out.push({ type: 'navigate', screen: 'impact' });
  }
  if (!has('navigate') && /\b(when can i donate|donate next|book a donation)\b/.test(m)) {
    out.push({ type: 'navigate', screen: 'donate' });
  }
  if (!has('card') && /\b(check-?up|doctor)\b/.test(m) && /\b(book|schedule|see|visit|need|want|like)\b/.test(m)) {
    const card = drop.offerCard(donorId, 'care_slots');
    out.push({ type: 'card', cardId: card.id });
  }
  return out;
}

async function chat({ user, donorId, history, message, userName, chat: chatId }) {
  await chatCycles.ensureScope(user, donorId);
  const chatKey = typeof chatId === 'string' ? chatId.slice(0, 40) : 'general';
  const sessionId = chatCycles.agentSessionUserId(user, donorId);
  const guard = guardrails.check(message);
  if (guard.block) {
    let actions = [];
    if (guard.suggestCheckup) {
      const card = drop.offerCard(donorId, 'care_slots');
      actions = [{ type: 'card', cardId: card.id }];
    }
    const server = chatCycles.activeChat(user, donorId, chatKey);
    const prior = Array.isArray(history) && history.length ? history.slice(-20) : (server.history || []).slice(-20);
    await chatCycles.recordTurn(user, donorId, chatKey, { userText: message, assistantText: guard.reply, history: prior });
    agentPlatform.appendEvent(sessionId, { role: 'user', text: message }).catch(() => {});
    agentPlatform.appendEvent(sessionId, { role: 'assistant', text: guard.reply }).catch(() => {});
    return { reply: guard.reply, steps: [], actions, history: prior, answeredByRules: true, guardrail: true };
  }

  const server = chatCycles.activeChat(user, donorId, chatKey);
  const prior = Array.isArray(history) && history.length ? history.filter((turn) => turn && ['user', 'assistant'].includes(turn.role) &&
    (typeof turn.content === 'string' || Array.isArray(turn.content))).slice(-20)
    : (server.history || []).filter((turn) => turn && ['user', 'assistant'].includes(turn.role)).slice(-20);
  const messages = [...prior, { role: 'user', content: message }];
  const turn = [{ role: 'user', content: message }];
  const system = `${SYSTEM}\n\n${context(donorId, userName, chatId)}${intentHint(message)}`;
  const finishChip = async (reply, actions, hist) => {
    const ui = alignActionsToQuestion(donorId, message, uiActionsForMessage(donorId, message, actions));
    await chatCycles.recordTurn(user, donorId, chatKey, { userText: message, assistantText: reply, history: hist, actions: ui });
    agentPlatform.appendEvent(sessionId, { role: 'user', text: message }).catch(() => {});
    agentPlatform.appendEvent(sessionId, { role: 'assistant', text: reply }).catch(() => {});
    return { reply, steps: [], actions: ui, history: hist };
  };
  const chip = chipShortcut(donorId, message);
  if (chip) return finishChip(chip.reply, uiActionsForMessage(donorId, message, chip.actions), prior);
  const impactAsk = /\b(where did my blood|blood go|who did my|impact|platelets? go|red cells? go)\b/i.test(message);
  if (impactAsk) {
    const fact = screenLines.line(donorId, 'impact').text;
    const actions = [{ type: 'navigate', screen: 'impact' }];
    const finishImpact = async (reply, hist) => {
      const ui = alignActionsToQuestion(donorId, message, uiActionsForMessage(donorId, message, actions));
      await chatCycles.recordTurn(user, donorId, chatKey, { userText: message, assistantText: reply, history: hist, actions: ui });
      agentPlatform.appendEvent(sessionId, { role: 'user', text: message }).catch(() => {});
      agentPlatform.appendEvent(sessionId, { role: 'assistant', text: reply }).catch(() => {});
      return { reply, steps: [], actions: ui, history: hist };
    };
    if (llm.available(600)) {
      try {
        const response = await llm.call({
          feature: 'copilot_impact',
          system: `You are Drop in Pratidaan for blood donors in India. They asked where their donation went. Use ONLY this fact from the app: "${fact}". Answer in one or two short, warm sentences: which parts helped patients (recipients stay anonymous — age band and clinical use only). Mention they can tap "Open My impact" below when they want the full journey map — do not say you are opening it for them. Do not discuss BP, lab results, donation eligibility, or booking a check-up.`,
          messages: turn,
          maxTokens: 220,
          effort: 'minimal',
          guardrailKind: 'chat',
        });
        const reply = guardrails.sanitizeReply(llm.text(response)).reply;
        if (reply && replyMatchesQuestion(message, reply)) return finishImpact(reply, messages);
      } catch { /* rules below */ }
    }
    return finishImpact(`${fact} Tap Open My impact below when you want the full journey map.`, prior);
  }
  const bpTrendAsk = /\b(bp|blood pressure)\b/i.test(message) && /\b(how|doing|trend|chart)\b/i.test(message);
  const urgentFinding = health.findings(donorId).find((f) => f.id === 'BP_URGENCY');
  if (bpTrendAsk && !urgentFinding) {
    const grounded = groundedAnswer(donorId, message);
    if (grounded) {
      const finishBp = async (reply, hist) => {
        const ui = alignActionsToQuestion(donorId, message, uiActionsForMessage(donorId, message, grounded.actions));
        await chatCycles.recordTurn(user, donorId, chatKey, { userText: message, assistantText: reply, history: hist, actions: ui });
        agentPlatform.appendEvent(sessionId, { role: 'user', text: message }).catch(() => {});
        agentPlatform.appendEvent(sessionId, { role: 'assistant', text: reply }).catch(() => {});
        return { reply, steps: [], actions: ui, history: hist };
      };
      if (llm.available(700)) {
        try {
          const response = await llm.call({
            feature: 'copilot_bp',
            system: `You are Drop in Pratidaan. They asked how their blood pressure is doing. Use ONLY: "${grounded.reply.replace(/ See the chart below\.$/, '')}". One or two warm sentences; mention the chart below. Do not mention HbA1c, cholesterol, or donation dates unless this text does.`,
            messages: [{ role: 'user', content: message }],
            maxTokens: 220,
            effort: 'minimal',
            guardrailKind: 'chat',
          });
          const reply = guardrails.sanitizeReply(llm.text(response)).reply;
          if (reply && replyMatchesQuestion(message, reply)) {
            const say = /\bchart\b/i.test(reply) ? reply : `${reply} See the chart below.`;
            return finishBp(say, messages);
          }
        } catch { /* rules below */ }
      }
      return finishBp(grounded.reply, prior);
    }
  }
  const resultsAsk = /\b(results?|labs?|score)\b/i.test(message) && /\b(explain|latest|mean|what|how)\b/i.test(message);
  if (resultsAsk) {
    const grounded = groundedAnswer(donorId, message);
    if (grounded) {
      const finishResults = async (reply, hist) => {
        const ui = alignActionsToQuestion(donorId, message, uiActionsForMessage(donorId, message, grounded.actions));
        await chatCycles.recordTurn(user, donorId, chatKey, { userText: message, assistantText: reply, history: hist, actions: ui });
        agentPlatform.appendEvent(sessionId, { role: 'user', text: message }).catch(() => {});
        agentPlatform.appendEvent(sessionId, { role: 'assistant', text: reply }).catch(() => {});
        return { reply, steps: [], actions: ui, history: hist };
      };
      if (llm.available(900)) {
        try {
          const response = await llm.call({
            feature: 'copilot_results',
            system: `You are Drop in Pratidaan. Explain their latest donation check-up results in one or two short sentences. Facts (authoritative):\n${healthFacts(donorId)}\nDo not invent values. Offer to say more.`,
            messages: turn,
            maxTokens: 400,
            effort: 'minimal',
            guardrailKind: 'chat',
          });
          const reply = guardrails.sanitizeReply(llm.text(response)).reply;
          if (reply && !replyTooLong(reply)) return finishResults(reply, messages);
        } catch { /* rules below */ }
      }
      return finishResults(grounded.reply, prior);
    }
  }
  const run = (sys, toolNames) => runAgent({ feature: 'copilot', system: sys, messages, donorId, toolNames, maxTokens: 2000, maxSteps: 5, effort: 'low' });
  let result;
  try {
    result = await run(system, CHAT_TOOLS);
  } catch (error) {
    if (!(error instanceof llm.LLMUnavailable)) throw error;
    const rules = fallback(donorId, message);
    const actions = alignActionsToQuestion(donorId, message, uiActionsForMessage(donorId, message, rules.actions));
    await chatCycles.recordTurn(user, donorId, chatKey, { userText: message, assistantText: rules.reply, history: prior, actions });
    return { ...rules, actions, history: prior, offline: true, reason: error.message };
  }
  // A reply that is the model's own notes ("The user wants…", "Plan: …") or tool code written as text gets one more try:
  // no tools this time, told to answer the donor directly
  if ((!result.text && !result.actions.length) || isNote(result.text || '')) {
    const first = result;
    result = await run(`${system}\n\nAnswer the donor directly in your own words, in plain sentences. Don't start with a heading or a note about what they want, and don't write code.`, []);
    result = { ...result, steps: [...first.steps, ...result.steps], actions: [...first.actions, ...result.actions] };
  }
  if (result.text && isNote(result.text)) {
    const rules = fallback(donorId, message);
    const reply = rules.generic ? 'Sorry, I lost my words there. Could you ask me that again?' : rules.reply;
    const actions = alignActionsToQuestion(donorId, message, uiActionsForMessage(donorId, message, [...result.actions, ...rules.actions.filter((a) => !result.actions.some((b) => b.type === a.type && b.text === a.text))]));
    await chatCycles.recordTurn(user, donorId, chatKey, { userText: message, assistantText: reply, history: prior, actions });
    return { reply, steps: result.steps, actions, history: prior, answeredByRules: true };
  }
  if (!result.text) {
    const rules = fallback(donorId, message);
    const existing = result.actions;
    const merged = [...existing, ...rules.actions.filter((a) => !existing.some((b) => b.type === a.type && b.marker === a.marker && b.cardId === a.cardId))];
    let actions = alignActionsToQuestion(donorId, message, uiActionsForMessage(donorId, message, merged));
    const grounded = groundedAnswer(donorId, message);
    let reply = existing.some((a) => ['memory', 'receipt', 'card'].includes(a.type)) ? defaultReply(existing) : rules.reply;
    if (grounded && actions.some((a) => a.type === 'chart')) reply = grounded.reply;
    else if (actions.some((a) => a.type === 'chart') && !replyMatchesQuestion(message, reply)) {
      reply = grounded?.reply || `${screenLines.line(donorId, 'health').text} See the chart below.`;
    }
    await chatCycles.recordTurn(user, donorId, chatKey, { userText: message, assistantText: reply, history: prior, actions });
    return { reply, steps: result.steps, actions, history: prior, answeredByRules: true, offline: true, reason: 'AI response incomplete' };
  }
  let reply = result.text;
  let actions = alignActionsToQuestion(donorId, message, uiActionsForMessage(donorId, message, result.actions));
  if (!replyMatchesQuestion(message, reply) || replyTooLong(reply)) {
    const grounded = bestGrounded(donorId, message);
    if (grounded) {
      reply = grounded.reply;
      actions = alignActionsToQuestion(donorId, message, uiActionsForMessage(donorId, message, grounded.actions));
    } else if (replyTooLong(reply)) {
      reply = fallback(donorId, message).reply;
      actions = alignActionsToQuestion(donorId, message, uiActionsForMessage(donorId, message, actions));
    }
  }
  const safe = guardrails.sanitizeReply(reply);
  reply = safe.reply;
  if (safe.suggestCheckup) {
    const card = drop.offerCard(donorId, 'care_slots');
    actions = [...actions.filter((a) => a.type !== 'card'), { type: 'card', cardId: card.id }];
  }
  actions = alignActionsToQuestion(donorId, message, actions);
  await chatCycles.recordTurn(user, donorId, chatKey, { userText: message, assistantText: reply, history: result.messages, actions });
  agentPlatform.appendEvent(sessionId, { role: 'user', text: message }).catch(() => {});
  agentPlatform.appendEvent(sessionId, { role: 'assistant', text: reply }).catch(() => {});
  const mem = drop.view(donorId).memory.map((x) => x.text);
  if (mem.length) agentPlatform.syncMemoryFromDrop(sessionId, mem).catch(() => {});
  return { reply, steps: result.steps, actions, history: result.messages };
}

/** Inline chart cards for trend questions — used by lite AI, fallback, and after tools. */
function chartActionsForMessage(donorId, message) {
  const m = String(message || '').toLowerCase();
  if (!store.getDonations(donorId).length) return [];
  const urgentBp = /\b(bp|blood pressure)\b/.test(m) && health.findings(donorId).find((f) => f.id === 'BP_URGENCY');
  if (urgentBp) return [];
  if (/\b(bp|blood pressure)\b/.test(m) && /\b(how|doing|trend|chart|over time)\b/.test(m)) {
    const points = drop.chartPoints(donorId, 'bp');
    return points.length ? [{ type: 'chart', marker: 'bp', points }] : [];
  }
  if (/\b(ferritin|iron|haemoglobin|hemoglobin|hba1c|cholesterol|ldl|triglycerides)\b/.test(m) || /\bhb\b/.test(m)) {
    const marker = /ferritin|iron/.test(m) ? 'ferritin' : /haemoglobin|hemoglobin|\bhb\b/.test(m) ? 'hb' : /hba1c/.test(m) ? 'hba1c' : /ldl|cholesterol/.test(m) ? 'ldl' : 'tg';
    const points = drop.chartPoints(donorId, marker);
    return /\b(trend|chart|over time|how|doing)\b/.test(m) && points.length ? [{ type: 'chart', marker, points }] : [];
  }
  return [];
}

/** When the model ends after a tool call without words, say what happened. */
function defaultReply(actions) {
  const kinds = actions.map((a) => a.type);
  if (kinds.includes('memory')) return "Got it, I'll remember that.";
  if (kinds.includes('receipt')) return 'Saved.';
  if (kinds.includes('card') || kinds.includes('chart')) return 'Here you go.';
  return 'Done.';
}

/** Rule-based answers for common questions when Azure OpenAI is unavailable. */
function fallback(donorId, message) {
  const m = String(message || '').toLowerCase();
  const out = (reply, actions = []) => ({ reply, steps: [], actions, history: null, offline: true, reason: llm.status().reason });
  // "Talk to me in Hindi", "English please": switch Drop's language (the Intro follows)
  const asked = Object.entries(LANGUAGE_WORDS).find(([, re]) => re.test(m));
  if (asked && /\b(speak|talk|switch|change|use|in|please|language)\b|^\S+$/.test(m)) {
    const r = tools.switchLanguage(donorId, asked[0]);
    return out(`Okay, I'll use ${LANGUAGE_NAMES[asked[0]]}${llm.status().live ? '' : " where I can. Without the AI connection some things stay in English"}.`, [r._ui]);
  }
  if (/remember/.test(m)) {
    const memory = drop.view(donorId).memory.map((x) => x.text);
    return out(memory.length ? `Here's what I remember: ${memory.join('; ')}. You can delete any of it from "What do you remember about me?".` : "I don't remember anything about you yet.");
  }
  // No donations yet: no results, readings or patients to talk about
  if (!store.getDonations(donorId).length && /\b(bp|blood pressure|trend|results?|explain|mean)\b/.test(m)) {
    return out(screenLines.line(donorId, 'health').text);
  }
  const urgentBp = /\b(bp|blood pressure)\b/.test(m) && health.findings(donorId).find((f) => f.id === 'BP_URGENCY');
  if (urgentBp) {
    const card = drop.view(donorId).open.find((c) => c.type === 'urgent');
    return out(`${urgentBp.title}: ${urgentBp.detail}. Please see a doctor today; if you feel unwell, seek urgent care.`, card ? [{ type: 'card', cardId: card.id }] : []);
  }
  if (/\b(cover|insurance|premium|insured)\b/.test(m)) return out(screenLines.line(donorId, 'cover').text);
  if (/\b(ferritin|iron|haemoglobin|hemoglobin|hb|hba1c|cholesterol|ldl|triglycerides)\b/.test(m)) {
    const marker = /ferritin|iron/.test(m) ? 'ferritin' : /haemoglobin|hemoglobin|\bhb\b/.test(m) ? 'hb' : /hba1c/.test(m) ? 'hba1c' : /ldl|cholesterol/.test(m) ? 'ldl' : 'tg';
    const points = drop.chartPoints(donorId, marker);
    const latest = points[points.length - 1];
    const finding = health.findings(donorId).find((f) => marker === 'ferritin' ? f.id === 'IRON_LOW' : marker === 'hb' ? f.id === 'HB_LOW' || f.id === 'HB_SEVERE' : f.detail.toLowerCase().includes(marker));
    const charts = chartActionsForMessage(donorId, message);
    return out(latest ? `${marker === 'hb' ? 'Haemoglobin' : marker === 'hba1c' ? 'HbA1c' : marker === 'ldl' ? 'LDL' : marker === 'tg' ? 'Triglycerides' : 'Ferritin'} was ${latest.value} at the latest recorded result.${finding ? ` ${finding.title}: ${finding.detail}. Check your Plan or speak with a doctor about next steps.` : ''}` : 'I do not have a recorded result for that marker.', charts);
  }
  if (/\b(bp|blood pressure)\b/.test(m)) {
    return out(screenLines.line(donorId, 'health').text, chartActionsForMessage(donorId, message));
  }
  if (/\btrend\b/.test(m)) return out('Which result would you like to see over time: BP, ferritin, haemoglobin or another marker?');
  if (/result|explain|mean/.test(m)) {
    const f = health.findings(donorId);
    const score = health.currentScore(donorId);
    return out(f.length ? `Your latest results: ${f.slice(0, 3).map((x) => `${x.title} (${x.detail})`).join('; ')}. A doctor confirms all findings.`
      : `Your latest donation check-up results are all in the healthy range (health score ${score?.score ?? '—'}/100). Nothing needs watching right now.`);
  }
  if (/what happens|at a donation|how long does/.test(m)) {
    return out('You answer a few health questions, then the centre checks your haemoglobin, blood pressure and pulse. Giving blood takes about 10 minutes and the whole visit about 45, and your sample gets a free health check.');
  }
  if (/blood go|helped|impact|platelet|red cell/.test(m)) {
    return out(`${screenLines.line(donorId, 'impact').text} Tap Open My impact below for the full journey map.`, [{ type: 'navigate', screen: 'impact' }]);
  }
  if (/donate|eligible|hold/.test(m)) return out(screenLines.line(donorId, 'donate').text);
  if (/check-?up|doctor|book/.test(m)) {
    const card = drop.offerCard(donorId, 'care_slots');
    return out('These check-up times are examples in Pratidaan — tap one to book in the app, then confirm with a real clinic.', [{ type: 'card', cardId: card.id }]);
  }
  const step = intro.explain(donorId);
  if (step) return out(step);
  return { ...out("I need the AI connection for free-form questions, and it isn't available right now. Try asking about your results, your BP, where your blood went, or when you can donate."), generic: true };
}

module.exports = { chat, fallback, SYSTEM, chartActionsForMessage, uiActionsForMessage, alignActionsToQuestion };
