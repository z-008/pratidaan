/**
 * Drop's between-donation Cards (CONTEXT.md: Week plan, Your day, Comeback
 * Card, Food habit, Cycle report). Called by drop.js through four small hooks;
 * the existing Cards, budget and timing are untouched:
 *
 * - They only reach a Donor who has used a between-donation feature (signals.active).
 * - Unprompted ones have their own allowance: at most one a week, only in the
 *   evening, never on a day an existing Card was sent or while one is waiting,
 *   never with an urgent Card open, and never counted in the Message budget.
 * - Cards the Donor asked for (a Week plan) and Your day go outside the budget,
 *   as CONTEXT.md says; "See a doctor first" goes at once, like an urgent Card.
 * - Next event ignores all of them, so the existing demo scripts stop where they did.
 */

const store = require('../data/store');
const signals = require('./signals');
const weekPlan = require('./weekPlan');
const routine = require('./routine');
const adjustments = require('./adjustments');
const careLevel = require('./careLevel');
const foodCoach = require('./foodCoach');
const cycle = require('./cycle');
const explain = require('./explain');
const demo = require('../integrations/demo');
const { addDays, weekStart, dow, fmt, range, between } = require('./dates');

const TYPES = ['weekplan', 'day', 'comeback', 'food', 'prep'];
const EVENING = 2;
const LABELS = {
  'weekplan:offer': 'Week plan', 'weekplan:renew': 'Plan next week', 'day:due': 'Your day', 'day:barrier': 'Your day',
  'comeback:offer': 'A lighter week', 'comeback:stepup': 'Step back up', 'food:lownormal': 'Food for your iron', 'food:doctorfirst': 'See a doctor first',
  'prep:next': 'Before your next donation',
};
const HABIT_WORDS = { movement: 'Movement', food: 'Food', mind: 'Mind' };
const partOfTime = (hhmm) => { const h = Number(String(hhmm).slice(0, 2)); return h < 12 ? 0 : h < 17 ? 1 : h < 21 ? 2 : 3; };

const handles = (c) => TYPES.includes(c.type);
const label = (c) => LABELS[`${c.type}:${c.variant}`] || null;

/** Asha's (and any seeded Persona's) starting set-up, applied once. */
function init(st, hooks) {
  const w = signals.ensure(st);
  if (w.keys.init) return;
  w.keys.init = true;
  const p = demo.preset(st.donorId);
  if (!p) return;
  const today = store.today();
  for (const c of p.connections || []) signals.connect(st, c.provider, c);
  if (p.foodProfile) foodCoach.setProfile(st, p.foodProfile);
  if (p.weekPlan) {
    const habitApp = w.connections.find((c) => c.kind === 'habit');
    const goal = signals.goals(st).find((g) => g.state === 'active');
    const plan = weekPlan.save(st, p.weekPlan.map((i) => (i.forGoal && goal ? { ...i, goalId: goal.id, forText: `for your ${goal.name}` } : i)));
    // Items already in their habit app before Drop started, so their ticks have a history
    plan.items.forEach((i) => { if (habitApp && i.measuredBy !== 'active_min') i.sync = { connectionId: habitApp.id, app: habitApp.label, since: demo.storyline(st.donorId).history }; });
  }
  if (p.day) weekPlan.setDay(st, p.day.time);
  if (p.openFoodCard) {
    const level = careLevel.of(st.donorId, st, p.openFoodCard);
    w.keys[`food:${p.openFoodCard}`] = true;
    hooks.pushCard(st, 'food', 'lownormal', { marker: p.openFoodCard, level: level?.level || null });
    w.coachSent[weekStart(today)] = 1;
  }
  hooks.log(st, `Between donations: ${w.connections.map((c) => c.label).join(', ')} connected (demo)${w.weekPlan ? ', Week plan' : ''}${w.foodProfile ? ', Food profile' : ''} set up for the demo.`);
}

const existingCardToday = (st) => (st.sentByDay[store.today()] || 0) > 0;
// An existing Card that could still go today (its budget isn't used up) always goes first; one held back by the
// weekly budget isn't delayed by a coaching Card, which is outside the budget
function existingWaiting(st, hooks) {
  const b = hooks.budget(st);
  const canSend = b.today < b.perDay && b.week < b.perWeek;
  return canSend && st.events.some((e) => e.status === 'pending' && e.at <= store.today() && !e.foldOnly && e.kind !== 'urgent');
}
const openOf = (st, type, variant) => st.cards.find((c) => c.status === 'open' && c.type === type && (!variant || c.variant === variant));

/** Runs after the existing Drop rules on every step of the demo clock. */
function deliver(st, hooks) {
  init(st, hooks);
  if (!signals.active(st)) return;
  const w = signals.ensure(st);
  const { date: today, part } = store.clock();

  if (w.lastDate !== today) {
    // Yesterday's Your day goes quietly: a skipped day is never mentioned (CONTEXT.md)
    st.cards.filter((c) => c.type === 'day' && c.status === 'open' && c.data.day < today).forEach((c) => { c.status = 'gone'; });
    // An unanswered coaching Card goes quietly after 6 days: it never nags, and never folds into the Weekly report
    st.cards.filter((c) => TYPES.includes(c.type) && ['open', 'snoozed', 'hidden'].includes(c.status) && between(c.createdOn, today) >= 6).forEach((c) => { c.status = 'gone'; });
    w.lastDate = today;
  }

  // Your day, at the time the Donor chose (allowed in quiet hours, like their Reminders)
  if (w.day && w.weekPlan && w.weekPlan.endsOn >= today && partOfTime(w.day.time) === part && !st.cards.some((c) => c.type === 'day' && c.data.day === today)) {
    hooks.pushCard(st, 'day', 'due', { day: today });
  }

  // See a doctor first: new results that food can't fix go at once, outside the budget
  // (iron, B12, vitamin D: for BP and blood sugar the existing Goals and urgent Card already put the doctor first)
  for (const l of careLevel.all(st.donorId, st).filter((x) => ['iron', 'b12', 'vitd'].includes(x.marker) && ['doctor_first', 'urgent'].includes(x.level))) {
    const key = `df:${l.marker}:${l.evidence[0]}`;
    if (w.keys[key]) continue;
    w.keys[key] = true;
    // A food Card from before no longer fits: the doctor comes first now
    st.cards.filter((c) => c.type === 'food' && c.variant === 'lownormal' && c.status === 'open' && (c.data.marker || 'iron') === l.marker).forEach((c) => { c.status = 'answered'; c.receipt = 'Replaced by "See a doctor first"'; c.answeredOn = today; });
    hooks.pushCard(st, 'food', 'doctorfirst', { marker: l.marker, rule: l.rule, evidence: l.evidence });
    hooks.log(st, `Care level: ${l.label} needs a doctor first (${l.ruleId}). Sent "See a doctor first" (outside the budget).`);
  }

  if (part !== EVENING) return;
  if (existingCardToday(st) || existingWaiting(st, hooks)) return;
  if (st.cards.some((c) => c.status === 'open' && c.urgent)) return;
  const wk = weekStart(today);
  if ((w.coachSent[wk] || 0) >= 1) return;
  const send = (type, variant, data, logText) => {
    hooks.pushCard(st, type, variant, data);
    w.coachSent[wk] = (w.coachSent[wk] || 0) + 1;
    hooks.log(st, `${logText} (coaching allowance: 1 a week, not counted in the budget).`);
  };

  // New results with iron on the low side
  const iron = careLevel.of(st.donorId, st, 'iron');
  if (iron && ['low_normal', 'below'].includes(iron.level) && !w.keys[`food:iron:${iron.evidence[0]}`] && !w.keys['food:iron']) {
    const visits = store.getDonations(st.donorId);
    const last = visits[visits.length - 1];
    if (last && last.date >= st.createdOn) {
      w.keys[`food:iron:${iron.evidence[0]}`] = true;
      return send('food', 'lownormal', { marker: 'iron', level: iron.level }, `Iron ${iron.level === 'below' ? 'below the donation level' : 'on the low side'}: sent "Food for your iron"`);
    }
  }

  // A routine slipped: one small adjustment
  const d = routine.detect(st, today)[0];
  if (d) {
    const key = `cb:${d.ruleId}:${d.itemId || d.habit}:${wk}`;
    const options = adjustments.candidates(st, d);
    if (!w.keys[key] && options.length && !openOf(st, 'comeback')) {
      w.keys[key] = true;
      return send('comeback', 'offer', { disruption: d, adjId: options[0].id, tried: [] }, `Routine: ${d.ruleId} (${d.evidence[0]}). Offered "${options[0].text}"`);
    }
  }

  // A stepped-down item kept on 5 of 7 days: offer to step back up (only applied with a tap)
  for (const item of (w.weekPlan?.items || []).filter((i) => i.stepDown && i.stepDown.adjId && !i.setAside)) {
    const key = `su:${item.id}:${item.stepDown.on}`;
    if (w.keys[key] || between(item.stepDown.on, today) < 5) continue;
    const days = range(addDays(today, -6), today).map((x) => weekPlan.kept(st, item, x)).filter(Boolean).length;
    if (days >= 5) { w.keys[key] = true; return send('comeback', 'stepup', { itemId: item.id }, `"${item.stepDown.text}" kept on ${days} of 7 days: offered a step back up`); }
  }

  // Sunday: the Week plan ends today, so offer next week's
  if (dow(today) === 0 && w.weekPlan && w.weekPlan.endsOn <= today && !w.keys[`renew:${today}`]) {
    w.keys[`renew:${today}`] = true;
    return send('weekplan', 'renew', { items: w.weekPlan.items.map((i) => ({ habit: i.habit, kind: i.kind, text: i.text, perWeek: i.perWeek, minutes: i.minutes, measuredBy: i.measuredBy, goalId: i.goalId, focus: i.focus, forText: i.forText, source: i.source })) }, 'Week plan ends today: offered next week\'s');
  }

  // Two weeks before the next free health check
  const c = cycle.current(st.donorId);
  if (c && c.nextFrom && !c.eligibleNow && c.daysTo > 0 && c.daysTo <= 14 && !w.keys[`prep:${c.nextFrom}`]) {
    w.keys[`prep:${c.nextFrom}`] = true;
    return send('prep', 'next', { from: c.nextFrom }, 'Next donation in 2 weeks: sent "Before your next donation"');
  }
}

const why = (id) => ({ label: 'Why this?', value: null, why: id });

function adjustmentOf(id) { return require('../data/reference').adjustments().library.find((a) => a.id === id); }

function disruptionWords(d) {
  const habit = { R1: 'your walks', R2: 'your walks', R3: 'your sleep', R4: 'your iron add-on' }[d.ruleId];
  const when = d.pattern ? `, mostly on ${d.pattern.days.join(' and ')}` : '';
  const said = d.barrier ? ` (you said: ${d.barrier.label.toLowerCase()})` : '';
  return `Rough week? ${habit.charAt(0).toUpperCase()}${habit.slice(1)} slipped${when}${said}.`;
}

/** The comeback Card's explanation: the disruption rule, its evidence, and why this adjustment. */
function comebackExplanation(st, d, a) {
  const plan = signals.ensure(st).weekPlan;
  const item = plan?.items.find((i) => i.id === d.itemId) || plan?.items.find((i) => i.habit === d.habit);
  const syncConn = item?.sync && signals.ensure(st).connections.find((c) => c.id === item.sync.connectionId);
  return explain.make({
    title: 'Why Drop suggested a lighter week',
    dataUsed: [...d.evidence.map((text) => ({ text, source: 'Your connected apps' })), ...(d.barrier ? [{ text: `What got in the way: ${d.barrier.label} (${d.barrier.count} day${d.barrier.count > 1 ? 's' : ''})`, source: d.barrier.source === 'you' ? 'What you told Drop' : 'Your habit app\'s skip notes (demo)' }] : []), ...(d.pattern ? [{ text: d.pattern.text, source: 'Your last 4 weeks' }] : [])],
    rule: { id: d.ruleId, text: d.text },
    guidance: [{ text: a.why, source: a.source }],
    preferences: item ? [`Your Week plan: ${item.text}`] : [],
    effect: (() => { const f = cycle.focus(st); return f && f.targets.some((t) => t.habit === d.habit) ? `Your Cycle's focus is ${f.label.toLowerCase()}; a smaller step keeps it moving until your next free health check.` : 'A smaller step keeps the habit alive between donations.'; })(),
    wouldChange: 'Keep the smaller step on 5 of 7 days and Drop offers to step back up. Turn it down and Drop suggests something else, or nothing.',
    notUsed: [syncConn && syncConn.writeBack ? `Only the habit's name and target go to ${syncConn.label}.` : 'Nothing is sent to your apps unless you allow Write back.'],
  });
}

/** What a coaching Card says and offers (actions may open a screen with `go` or the "Why this?" sheet with `why`). */
function words(st, c) {
  const d = c.data || {};
  const hi = st.language === 'hi';
  switch (`${c.type}:${c.variant}`) {
    case 'weekplan:offer':
    case 'weekplan:renew': {
      const items = d.items || [];
      const habitApp = signals.ensure(st).connections.find((x) => x.kind === 'habit' && x.writeBack);
      const today = store.today();
      const ends = fmt(c.variant === 'renew' || dow(today) === 0 ? addDays(today, 7) : require('./dates').sundayOf(today));
      return {
        text: `${c.variant === 'renew' ? 'Next week, the same again? ' : ''}Here's a plan until ${ends}: ${items.map((i) => `${i.text}${i.perWeek && i.perWeek < 7 ? `, ${i.perWeek} days` : ''}${i.forText ? ` (${i.forText})` : ''}`).join('; ')}.${d.note ? ` ${d.note}` : ''}`,
        main: { label: 'Save my Week plan', value: 'save' },
        chips: habitApp ? [{ label: `Save and add to ${habitApp.label}`, value: 'save_sync' }] : [],
        out: { label: 'Not now', value: 'none' },
      };
    }
    case 'day:due': {
      const items = (signals.ensure(st).weekPlan?.items || []).filter((i) => !i.setAside);
      return {
        text: hi ? 'आज कैसा रहा? जो किया उस पर टैप करें.' : 'How did today go? Tap what you did; a day off is fine.',
        chips: [{ label: hi ? 'सब किया' : 'Did all of it', value: 'all' }, ...items.map((i) => ({ label: `✓ ${weekPlan.effective(i).text}`, value: { done: [i.id] } }))],
        out: { label: hi ? 'आज नहीं' : 'Not today', value: 'none' },
      };
    }
    case 'day:barrier':
      return {
        text: 'No problem. Anything get in the way? (optional)',
        chips: Object.entries(routine.BARRIERS).filter(([k]) => k !== 'other').map(([value, l]) => ({ label: l, value })),
        out: { label: 'Skip', value: 'skip' },
      };
    case 'comeback:offer': {
      const a = adjustmentOf(d.adjId);
      const plan = signals.ensure(st).weekPlan;
      const item = plan?.items.find((i) => i.id === d.disruption.itemId) || plan?.items.find((i) => i.habit === d.disruption.habit);
      const app = item?.sync && signals.ensure(st).connections.find((x) => x.id === item.sync.connectionId && x.writeBack);
      return {
        text: `${disruptionWords(d.disruption)} How about this instead: ${a.text}? ${app ? `I'll update it in ${app.label}.` : ''}`.trim(),
        main: { label: 'Try this', value: 'accept' },
        chips: [...(adjustments.candidates(st, d.disruption, [...(d.tried || []), d.adjId]).length ? [{ label: 'Another idea', value: 'next' }] : []), ...(item ? [{ label: 'Pause it for a week', value: 'pause' }] : []), why(`card:${c.id}`)],
        out: { label: 'Not now', value: 'later' },
      };
    }
    case 'comeback:stepup': {
      const item = signals.ensure(st).weekPlan?.items.find((i) => i.id === d.itemId);
      return {
        text: item ? `You kept "${item.stepDown?.text || item.text}" on 5 of the last 7 days. Step back up to "${item.text}"?` : 'You kept the smaller step all week. Step back up?',
        main: { label: 'Yes, step up', value: 'yes' },
        out: { label: 'Keep it as it is', value: 'keep' },
      };
    }
    case 'food:lownormal': {
      const plan = require('./improvements').plan(st);
      if (plan && plan.needs.length > 1) {
        const needs = plan.needs.slice(0, 3).map((n) => `${n.label.toLowerCase().replace(/^vitamin (\w+)/, (m, x) => `vitamin ${x.toUpperCase()}`)}: ${n.levelWords.toLowerCase()}`).join(', ');
        const foods = plan.foods.slice(0, 3).map((f) => f.name).join(', ');
        const habit = plan.habits[0];
        const doc = plan.doctors[0];
        return {
          label: hi ? 'आपकी जाँच के आधार पर' : 'From your results',
          text: (hi
            ? `आपकी जाँच: ${needs}। खाने में: ${foods}। आदत: ${habit ? habit.text : ''}। ${doc ? doc.text : ''}`
            : `Your results: ${needs}. To eat: ${foods}. A habit that helps: ${habit ? habit.text.toLowerCase() : ''}. ${doc ? doc.text : ''}`).replace(/\s+/g, ' ').trim(),
          main: { label: hi ? 'मेरी योजना देखें' : 'See my plan', value: 'see', go: 'progress:plan' },
          chips: [{ label: hi ? 'जाँच का समय चुनें' : 'Book a demo check-up', value: 'book' }, why('plan')],
          out: { label: hi ? 'बाद में' : 'Later', value: 'later' },
        };
      }
      const s = foodCoach.suggest(st, d.marker || 'iron');
      const names = s.foods.slice(0, 3).map((f) => f.name).join(', ');
      const value = s.level?.evidence?.map((e) => e.split(' on ')[0]).join(', ') || '';
      const below = s.level?.level === 'below';
      const text = hi
        ? `${below ? 'आपका आयरन रक्तदान के स्तर से कम है' : 'आपका आयरन रक्तदान के लिए ठीक है, पर कम की तरफ़ है'} (${value})। ${names ? `आपके खाने और बजट के हिसाब से: ${names} — लगभग ₹${s.costPerDay.min}–${s.costPerDay.max} रोज़।` : ''} ${s.doctor ? s.doctor.text : ''}`
        : `${below ? 'Your iron is below the donation level' : 'Your iron is fine for donating, but on the low side'} (${value}). ${names ? `Foods that fit how you eat: ${names}, about ₹${s.costPerDay.min}–${s.costPerDay.max} a day.` : ''} ${s.doctor ? s.doctor.text : ''}`;
      return {
        text: text.replace(/\s+/g, ' ').trim(),
        main: { label: hi ? 'खाने के सुझाव देखें' : 'See foods for me', value: 'see', go: `progress:${d.marker || 'iron'}` },
        chips: [{ label: hi ? 'जाँच का समय चुनें' : 'Book a demo check-up', value: 'book' }, why(`food:${d.marker || 'iron'}`)],
        out: { label: hi ? 'बाद में' : 'Later', value: 'later' },
      };
    }
    case 'food:doctorfirst': {
      const l = careLevel.doctorFor('doctor_first', st.language);
      const fact = String((d.evidence || [])[0] || '').split(' on ')[0];
      return {
        text: hi
          ? `${fact}: यह केवल खाने से ठीक नहीं होगा। ${l.text} ये डेमो समय हैं, क्लिनिक अपॉइंटमेंट नहीं।`
          : `${fact}. ${d.rule || ''} ${l.text} These are demo check-up times, not clinic appointments.`.replace(/^\. /, ''),
        main: { label: 'Choose a demo check-up time', value: 'book' },
        out: { label: 'I will seek real care', value: 'call' },
      };
    }
    case 'prep:next':
      return {
        text: `You can donate again from ${fmt(d.from)}: your next free health check. The week before: sleep 6+ hours, drink extra water, keep up your iron, and eat 3–4 hours before you go.`,
        main: { label: 'Book a demo donation slot', value: 'book' },
        out: { label: 'Got it', value: 'seen' },
      };
    default:
      return null;
  }
}

/**
 * The Donor answered a coaching Card. `ctx` comes from drop.answer: done(receipt), handOff(receipt), pushCard.
 * Returns 'stay' when the Card stays open with new content ("Another idea").
 */
function answer(st, c, value, ctx) {
  const w = signals.ensure(st);
  const today = store.today();
  const plan = w.weekPlan;
  switch (`${c.type}:${c.variant}`) {
    case 'weekplan:offer':
    case 'weekplan:renew': {
      if (value === 'none') return ctx.done('No Week plan this time. Ask any time.');
      const app = value === 'save_sync' ? w.connections.find((x) => x.kind === 'habit' && x.writeBack) : null;
      const saved = weekPlan.save(st, c.data.items || [], { sync: app });
      return ctx.done(`Week plan saved until ${fmt(saved.endsOn)}${app ? ` · added to ${app.label}${app.mode === 'demo' ? ' (demo)' : ''}` : ''}`);
    }
    case 'day:due': {
      const items = (plan?.items || []).filter((i) => !i.setAside);
      if (value === 'none') {
        items.forEach((i) => weekPlan.log(st, i.id, c.data.day, 'skipped'));
        ctx.handOff('Your day: a day off');
        ctx.pushCard(st, 'day', 'barrier', { day: c.data.day });
        return null;
      }
      const ids = value === 'all' ? items.map((i) => i.id) : (value?.done || []);
      ids.forEach((id) => weekPlan.log(st, id, c.data.day, 'done'));
      return ctx.done(`Your day: ${value === 'all' ? 'all done' : `${items.find((i) => i.id === ids[0])?.text || 'done'} ✓`}`);
    }
    case 'day:barrier':
      if (value !== 'skip' && routine.BARRIERS[value]) {
        (plan?.items || []).filter((i) => w.planLog[c.data.day]?.[i.id] === 'skipped').forEach((i) => w.barriers.push({ date: c.data.day, code: value, itemId: i.id, source: 'you' }));
        return ctx.done(`Noted: ${routine.BARRIERS[value].toLowerCase()}. Drop will keep it in mind.`);
      }
      return ctx.done('Okay.');
    case 'comeback:offer': {
      const d = c.data.disruption;
      const a = adjustmentOf(c.data.adjId);
      let item = plan?.items.find((i) => i.id === d.itemId) || plan?.items.find((i) => i.habit === d.habit && !i.setAside);
      if (value === 'next') {
        const tried = [...(c.data.tried || []), c.data.adjId];
        const next = adjustments.candidates(st, d, tried)[0];
        w.adjustments.push({ adjId: c.data.adjId, on: today, answer: 'declined' });
        if (!next) return ctx.done('No other ideas this week. Your plan stays as it is.');
        c.data.adjId = next.id;
        c.data.tried = tried;
        return 'stay';
      }
      if (value === 'pause') {
        if (item) item.stepDown = { ...adjustments.stepDownFor(item, a, today, addDays(today, 7)), perWeek: 0, text: `${item.text} (paused)`, by: 'pause' };
        w.adjustments.push({ adjId: c.data.adjId, on: today, answer: 'paused' });
        return ctx.done(`Paused for a week: back on ${fmt(addDays(today, 7))}.`);
      }
      if (value === 'later') {
        w.adjustments.push({ adjId: c.data.adjId, on: today, answer: 'declined' });
        return ctx.done('Okay, your plan stays as it is.');
      }
      if (!item) item = weekPlan.save(st, [{ habit: d.habit, kind: 'session', text: a.text, perWeek: 3, minutes: a.minutes || null, measuredBy: d.habit === 'movement' ? 'active_min' : d.habit === 'mind' ? 'sleep_min' : 'you' }]).items.slice(-1)[0];
      else item.stepDown = adjustments.stepDownFor(item, a, today, addDays(today, 7));
      w.adjustments.push({ adjId: a.id, on: today, answer: 'accepted', itemId: item.id });
      const app = item.sync && w.connections.find((x) => x.id === item.sync.connectionId && x.writeBack);
      return ctx.done(`This week: ${a.text}${app ? ` · updated in ${app.label}${app.mode === 'demo' ? ' (demo)' : ''}` : ''}`);
    }
    case 'comeback:stepup': {
      const item = plan?.items.find((i) => i.id === c.data.itemId);
      if (value === 'yes' && item) { item.stepDown = null; return ctx.done(`Back to "${item.text}".`); }
      if (item && item.stepDown) item.stepDown.until = addDays(today, 7);
      return ctx.done('Keeping the smaller step for another week.');
    }
    case 'food:lownormal':
      if (value === 'book') { ctx.handOff('Food for your iron · chose check-up options'); ctx.pushCard(st, 'slots', 'care', { purpose: 'care' }); return null; }
      if (value === 'see') { foodCoach.markSeen(st, foodCoach.suggest(st, c.data.marker || 'iron').foods.map((f) => f.id)); return ctx.done('Opened foods for your iron · on Progress'); }
      return ctx.done('Okay. The foods stay on your Progress screen.');
    case 'food:doctorfirst':
      if (value === 'book') { ctx.handOff('See a doctor first · chose check-up options'); ctx.pushCard(st, 'slots', 'care', { purpose: 'care' }); return null; }
      return ctx.done('Acknowledged. No clinic was called; please see a doctor.');
    case 'prep:next':
      if (value === 'book') { ctx.handOff('Before your next donation · chose a donation slot'); ctx.pushCard(st, 'slots', 'donate', { purpose: 'donate' }); return null; }
      return ctx.done('Got it.');
    default:
      return 'unhandled';
  }
}

/** Slides added after the existing Weekly report slides, only for a Donor using these features. */
function reportSlides(st, from, to) {
  if (!signals.active(st)) return [];
  const w = signals.ensure(st);
  const out = [];
  // The existing report already has an active-minutes slide for a Donor with an activity plan: don't repeat it
  const line = require('./habits').weekLine(st, { skip: st.plan?.activity ? ['active_min'] : [] });
  if (line) out.push(`From my apps this week: ${line}.`);
  const items = (w.weekPlan?.items || []).filter((i) => !i.setAside);
  if (items.length) {
    const parts = items.map((i) => {
      const days = range(from, to).map((d) => weekPlan.kept(st, i, d)).filter(Boolean).length;
      const planned = Math.round(weekPlan.effective(i, from).perWeek * Math.max(1, (between(from, to) + 1) / 7));
      return `${HABIT_WORDS[i.habit]} · ${weekPlan.effective(i, from).text}: kept ${days} of ${planned}`;
    });
    out.push(`My Week plan: ${parts.join('; ')}.`);
  }
  const changed = w.adjustments.filter((a) => a.answer === 'accepted' && a.on >= from && a.on <= to);
  if (changed.length) out.push(`What changed and why: ${changed.map((a) => adjustmentOf(a.adjId).text.toLowerCase()).join('; ')}, after a rough few days.`);
  const top = routine.topBarrier(st, to);
  if (top) out.push(`What got in the way most: ${top.label.toLowerCase()} (${top.count} day${top.count > 1 ? 's' : ''}).`);
  return out;
}

/** The explanation behind a Card or a recommendation: card:<id>, food:<marker>. */
function explanationFor(st, recId) {
  const [kind, key] = String(recId).split(':');
  if (kind === 'card') {
    const c = st.cards.find((x) => x.id === key);
    if (!c) throw new Error('That Card is gone');
    if (c.type === 'comeback' && c.variant === 'offer') return comebackExplanation(st, c.data.disruption, adjustmentOf(c.data.adjId));
    if (c.type === 'food') { const p = require('./improvements').plan(st); return p && p.needs.length > 1 ? p.explanation : foodCoach.suggest(st, c.data.marker || 'iron').explanation; }
    throw new Error('No explanation for that Card');
  }
  if (kind === 'food') return foodCoach.suggest(st, key || 'iron').explanation;
  if (kind === 'plan') return require('./improvements').plan(st).explanation;
  throw new Error('Unknown recommendation');
}

module.exports = { TYPES, handles, label, init, deliver, words, answer, reportSlides, explanationFor, comebackExplanation };
