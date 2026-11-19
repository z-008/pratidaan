/**
 * Food coaching (CONTEXT.md: Food profile, Food habit): local, affordable foods
 * that fit how the Donor eats, for a marker that is low or on the low side.
 * Fixed rules: the care level decides whether food leads (careLevel.js); the
 * Food profile, region, season, budget and a safety check across all findings
 * decide which foods; the AI may only word what this returns. Food first,
 * never food instead: the doctor's line from the care level always goes with it.
 */

const store = require('../data/store');
const health = require('./health');
const careLevel = require('./careLevel');
const explain = require('./explain');
const signals = require('./signals');
const ref = require('../data/reference');

const DIETS = ['veg', 'egg', 'nonveg', 'vegan', 'jain'];
const BUDGETS = { tight: 8, moderate: 20, flexible: Infinity };
const DIET_WORDS = { veg: 'Vegetarian', egg: 'Eggetarian', nonveg: 'Non-vegetarian', vegan: 'Vegan', jain: 'Jain' };
const BUDGET_WORDS = { tight: 'Tight budget (₹10–20 a day)', moderate: 'Moderate budget (₹20–50 a day)', flexible: 'Flexible budget' };
const NUTRIENT = { iron: 'iron', b12: 'b12', vitd: 'vitd', bp: 'potassium', sugar: 'fibre', lipids: 'fibre' };
const UNITS = { iron: 'mg', b12: 'µg', vitd: 'IU', potassium: 'mg', fibre: 'g' };
const FIELDS = {
  diet: DIETS, budget: Object.keys(BUDGETS), region: ['south', 'north', 'east', 'west', 'northeast'],
  staple: ['rice', 'roti', 'millet'], eatsAt: ['home', 'canteen', 'hostel', 'tiffin'],
};

/** The Donor's Food profile, or the safe default (vegetarian, region from the district) until they set one. */
function profile(st) {
  const set = signals.ensure(st).foodProfile;
  if (set) return { ...set, isDefault: false };
  const donor = store.getDonor(st.donorId);
  return { diet: 'veg', region: ref.regions().byDistrict[donor?.district] || 'south', regionFrom: 'district', staple: 'rice', eatsAt: 'home', budget: 'moderate', allergies: [], fasting: [], dislikes: [], isDefault: true };
}

/** Saves a Food profile the Donor chose. Every field is from a fixed list; nothing is inferred. */
function setProfile(st, input = {}) {
  const p = { ...profile(st), ...input };
  for (const [k, list] of Object.entries(FIELDS)) if (!list.includes(p[k])) throw new Error(`Choose a ${k} from the list`);
  const clean = {
    diet: p.diet, budget: p.budget, region: p.region, regionFrom: input.region ? 'donor' : p.regionFrom || 'district', staple: p.staple, eatsAt: p.eatsAt,
    allergies: (p.allergies || []).filter((a) => ['peanut', 'gluten', 'dairy', 'egg', 'fish', 'sesame'].includes(a)),
    fasting: (p.fasting || []).filter((f) => /^(navratri|ramzan|ekadashi|weekly:(mon|tue|wed|thu|fri|sat|sun))$/.test(f)),
    dislikes: (p.dislikes || []).filter((id) => ref.foods().some((f) => f.id === id)),
    setOn: store.today(),
  };
  signals.ensure(st).foodProfile = clean;
  return { ...clean, isDefault: false };
}

function clearProfile(st) { signals.ensure(st).foodProfile = null; }

const allowedFor = (diet, f) => {
  if (diet === 'nonveg') return true;
  if (diet === 'egg') return ['plant', 'dairy', 'egg'].includes(f.kind);
  if (diet === 'vegan') return f.kind === 'plant';
  if (diet === 'jain') return ['plant', 'dairy'].includes(f.kind) && !f.root;
  return ['plant', 'dairy'].includes(f.kind); // vegetarian
};

const WEEKDAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const fastingToday = (p) => (p.fasting || []).includes(`weekly:${WEEKDAY[new Date(`${store.today()}T00:00:00Z`).getUTCDay()]}`);
const monthSeason = () => { const m = Number(store.today().slice(5, 7)); return m >= 11 || m <= 2 ? 'winter' : m <= 5 ? 'summer' : 'monsoon'; };

/** Foods the Donor's other findings rule out, with the reason (no jaggery for prediabetes, and so on). */
function safetyRules(donorId) {
  const ids = health.findings(donorId).map((f) => f.id);
  const labs = health.labSeries(donorId);
  const creat = labs.creat && labs.creat[labs.creat.length - 1]?.value;
  const ferritin = labs.ferritin && labs.ferritin[labs.ferritin.length - 1]?.value;
  const rules = [];
  if (ids.some((id) => ['PREDIABETES', 'DIABETES_RANGE'].includes(id))) rules.push({ flag: 'highSugar', why: 'Your HbA1c is in the prediabetes or diabetes range, so sweet foods like jaggery and dates are left out.' });
  if (ids.some((id) => id.startsWith('BP_'))) rules.push({ flag: 'highSodium', why: 'Your BP is above ideal, so salty foods are left out.' });
  if (creat && creat > 1.3) rules.push({ flag: 'highPotassium', why: 'Your creatinine is raised, so high-potassium foods wait for a doctor.' });
  if (ferritin && ferritin > ref.careLevels().iron.highFerritin) rules.push({ flag: 'iron', why: 'Your iron stores are high, so no extra iron.' });
  return rules;
}

const localName = (f, language) => (f.names && f.names[language]) || f.en;

/**
 * Up to five foods for one marker (iron, b12, vitd, bp, sugar, lipids), filtered and ranked by rules.
 * With a care level of doctor_first or urgent, no foods: the rule text and the doctor come first.
 */
function suggest(st, marker = 'iron', { maxCost } = {}) {
  const donorId = st.donorId;
  const level = careLevel.of(donorId, st, marker);
  const p = profile(st);
  const language = st.language || 'en';
  const tips = (ref.absorption()[marker] || []).map((t) => ({ id: t.id, text: t.text, source: t.source }));
  const limit = ref.absorption().limit[marker] || [];
  const base = { marker, label: careLevel.LABELS[marker], level, profile: p, tips, limit, foods: [], doctor: level?.doctor || null };
  if (!level) return { ...base, text: 'No results for this yet: your next donation will tell.' };
  if (level.coaching === 'rules_only') {
    return { ...base, rulesOnly: true, tips: [], text: `${level.rule} ${level.doctor.text}`, explanation: explainFor(st, base, level, [], p) };
  }
  if (level.coaching === 'none') return { ...base, tips: [], text: level.rule };

  const nutrient = NUTRIENT[marker];
  const safety = safetyRules(donorId);
  const cap = Math.min(maxCost || Infinity, BUDGETS[p.budget]);
  const recent = signals.ensure(st).foodSeen || {};
  const pool = allowedFoods(st, marker, p, cap, safety);
  const amount = (f) => f.per[nutrient] || 0;
  const best = Math.max(1, ...pool.map(amount));
  const perRupee = (f) => amount(f) / ((f.cost[0] + f.cost[1]) / 2);
  const bestRupee = Math.max(0.01, ...pool.map(perRupee));
  const scored = pool.map((f) => ({
    f,
    score: 0.4 * (perRupee(f) / bestRupee) + 0.3 * (amount(f) / best)
      + 0.15 * (f.regions.includes(p.region) ? 1 : 0.5) + 0.15 * (recent[f.id] ? 0 : 1)
      + (p.staple === 'millet' && f.group === 'millet' ? 0.05 : 0),
  })).sort((a, b) => b.score - a.score || a.f.id.localeCompare(b.f.id));
  const picked = [];
  const perGroup = {};
  for (const { f } of scored) {
    if (picked.length >= 5) break;
    if ((perGroup[f.group] || 0) >= 2) continue;
    perGroup[f.group] = (perGroup[f.group] || 0) + 1;
    picked.push(f);
  }
  const foods = picked.map((f) => ({
    id: f.id, name: localName(f, language), nameEn: f.en, serving: f.serving,
    amount: amount(f) ? `${amount(f)} ${UNITS[nutrient]} ${nutrient === 'fibre' ? 'fibre' : nutrient === 'potassium' ? 'potassium' : nutrient === 'iron' ? 'iron' : nutrient === 'b12' ? 'B12' : 'vitamin D'} per serving` : null,
    cost: { min: f.cost[0], max: f.cost[1] }, fitIn: f.fitIn[p.region] || f.fitIn.default,
    pairWith: (f.pair || []).map((id) => { const x = ref.foods().find((y) => y.id === id); return x ? localName(x, language) : id; }),
    approx: !f.verified,
  }));
  const req = ref.requirements()[nutrient];
  const donor = store.getDonor(donorId);
  const target = req && donor?.sex ? { value: req[donor.sex], unit: req.unit, text: `${donor.sex === 'F' ? 'Women' : 'Men'} need about ${req[donor.sex]} ${req.unit} of ${nutrient === 'iron' ? 'iron' : nutrient} a day (${ref.requirements().source}).` } : null;
  // What the Donor actually eats, from their food app: the gap the foods are meant to close
  const eaten = nutrient === 'iron' ? signals.average(st, 'iron_mg', store.today(), 7) : null;
  if (target && eaten && eaten.days >= 3) {
    const top3 = picked.slice(0, 3).reduce((s, f) => s + (f.per.iron || 0), 0);
    target.eaten = Math.round(eaten.value * 10) / 10;
    target.text += ` Your food app (${eaten.app}) shows about ${target.eaten} mg a day; these three add about ${Math.round(top3 * 10) / 10} mg.`;
  }
  const cost = foods.slice(0, 3).reduce((s, f) => [s[0] + f.cost.min, s[1] + f.cost.max], [0, 0]);
  const names = foods.slice(0, 3).map((f) => f.name);
  const text = foods.length
    ? `${names.join(', ')}${foods.length ? ` — about ₹${cost[0]}–${cost[1]} a day for all three` : ''}. ${level.doctor ? level.doctor.text : ''}`.trim()
    : `Nothing in the food list fits your choices for this yet. ${level.doctor ? level.doctor.text : ''}`.trim();
  const out = { ...base, foods, target, costPerDay: { min: cost[0], max: cost[1] }, text, safety: safety.map((r) => r.why), source: ref.foodsMeta() };
  out.explanation = explainFor(st, out, level, foods, p, safety);
  return out;
}

function explainFor(st, s, level, foods, p, safety = []) {
  const regionWord = ref.regions().labels[p.region] || p.region;
  return explain.make({
    title: `Why these foods for your ${s.label.toLowerCase()}`,
    dataUsed: level.evidence.map((text) => ({ text, source: 'Your donation results' })),
    rule: { id: level.ruleId, text: `${level.rule} (proposed thresholds, pending clinical review)` },
    guidance: [
      ...(s.target ? [{ text: s.target.text, source: ref.requirements().source }] : []),
      ...s.tips.slice(0, 2).map((t) => ({ text: t.text, source: t.source })),
      { text: 'Nutrient amounts are approximate, from Indian food composition data (IFCT 2017, ICMR-NIN).', source: 'ICMR-NIN' },
    ],
    preferences: [DIET_WORDS[p.diet], `${regionWord} food`, BUDGET_WORDS[p.budget], ...(p.isDefault ? ['(not set yet: vegetarian until you tell Drop)'] : []), ...safety.map((r) => r.why)],
    effect: level.doctor ? level.doctor.text : null,
    wouldChange: foods.length ? 'Change your Food profile, or tell Drop a food you dislike, and the list changes.' : null,
    notUsed: ['Drop never names a medicine or supplement, and food never replaces treatment your doctor gives you.'],
  });
}

/** Every food the rules allow for this marker and Donor (diet, allergies, region, season, dislikes, fasting, safety, budget), before ranking. */
function allowedFoods(st, marker, p = profile(st), cap = BUDGETS[p.budget], safety = safetyRules(st.donorId)) {
  const season = monthSeason();
  const fasting = fastingToday(p);
  return ref.foods().filter((f) => f.goodFor.includes(marker))
    .filter((f) => allowedFor(p.diet, f))
    .filter((f) => !(f.allergens || []).some((a) => (p.allergies || []).includes(a)))
    .filter((f) => f.regions.includes('all') || f.regions.includes(p.region))
    .filter((f) => !f.seasons || f.seasons.includes(season))
    .filter((f) => !(p.dislikes || []).includes(f.id))
    .filter((f) => !fasting || f.fasting)
    .filter((f) => !safety.some((r) => (r.flag === 'iron' ? marker === 'iron' : f.flags?.[r.flag])))
    .filter((f) => f.cost[1] <= cap);
}

/** Remember which foods were suggested, so next week's list varies. */
function markSeen(st, ids) {
  const seen = signals.ensure(st).foodSeen;
  for (const id of ids) seen[id] = store.today();
}

module.exports = { profile, setProfile, clearProfile, suggest, allowedFoods, safetyRules, markSeen, allowedFor, DIET_WORDS, BUDGET_WORDS, FIELDS };
