/**
 * Care levels (CONTEXT.md: Care level): for each marker, whether Drop coaches
 * on food or the doctor comes first. Fixed rules, thresholds in
 * data/ontology/care-levels.json (PROPOSED, pending clinical sign-off).
 * Never changes a Goal, a finding, eligibility or the score: it only decides
 * how Drop's food coaching speaks, and adds the doctor's line it must always show.
 *
 * Levels: optimal · low_normal (food leads, a doctor's check recommended) ·
 * below (food and a doctor within weeks) · doctor_first (rules only) · urgent · not_needed
 */

const store = require('../data/store');
const health = require('./health');
const bands = require('./bands');
const ref = require('../data/reference');

const COACHING = { optimal: 'maintain', low_normal: 'food', below: 'food_and_doctor', doctor_first: 'rules_only', urgent: 'rules_only', not_needed: 'none' };
const URGENCY = { low_normal: 'recommended', below: 'weeks', doctor_first: 'first', urgent: 'today' };
const LABELS = { iron: 'Iron', bp: 'Blood pressure', sugar: 'Blood sugar', lipids: 'Cholesterol', b12: 'Vitamin B12', vitd: 'Vitamin D' };

function doctorFor(level, language, marker) {
  const urgency = URGENCY[level];
  if (!urgency) return null;
  // "On the low side" fits iron and vitamins; BP, sugar and cholesterol creep up instead
  const key = urgency === 'recommended' && ['bp', 'sugar', 'lipids'].includes(marker) ? 'recommendedHigh' : urgency;
  const t = ref.careLevels().doctor[key];
  return { urgency, text: t[language] || t.en };
}

function result(marker, level, ruleId, rule, evidence, language) {
  return { marker, label: LABELS[marker], level, ruleId, rule, evidence, coaching: COACHING[level], doctor: doctorFor(level, language, marker), proposed: true };
}

function iron(donorId, v, language, redFlag) {
  const c = ref.careLevels().iron;
  const donor = store.getDonor(donorId);
  if (!v.hb && !v.ferritin) return null;
  const min = health.hbMin(donor);
  const hb = v.hb?.value;
  const ferritin = v.ferritin?.value;
  const ev = [];
  if (hb !== undefined) ev.push(`Haemoglobin ${hb} g/dL on ${v.hb.date} (donation minimum ${min})`);
  if (ferritin !== undefined) ev.push(`Ferritin ${ferritin} ng/mL on ${v.ferritin.date}`);
  const hbVisits = health.vitalsSeries(donorId).map((x) => x.haemoglobin);
  const drop = hbVisits.length > 1 ? Math.round((hbVisits[hbVisits.length - 2] - hbVisits[hbVisits.length - 1]) * 10) / 10 : 0;
  const r = (level, id, text) => result('iron', level, id, text, ev, language);
  if (hb !== undefined && hb < c.urgentHb) return r('urgent', 'IRON-URGENT', `Haemoglobin under ${c.urgentHb} needs a doctor today.`);
  if (hb !== undefined && hb < c.doctorFirstHb) return r('doctor_first', 'IRON-DF-HB', `Haemoglobin under ${c.doctorFirstHb}: food alone can't fix this, so the doctor comes first.`);
  if (v.mcv && v.mcv.value < c.lowMcv && ferritin !== undefined && ferritin >= c.optimalFerritin && hb !== undefined && hb < min + c.optimalHbMargin) {
    ev.push(`MCV ${v.mcv.value} fL with normal ferritin`);
    return r('doctor_first', 'IRON-DF-MCV', 'Small red cells with normal iron stores can be an inherited trait (such as thalassaemia trait), not low iron: a doctor should check before you add iron.');
  }
  if (redFlag) return r('doctor_first', 'IRON-DF-FLAG', `You mentioned ${redFlag.text}: that needs a doctor before anything else.`);
  if ((hb !== undefined && hb < min) || (ferritin !== undefined && ferritin < c.lowFerritin)) return r('below', 'IRON-BELOW', `Below the donation level (haemoglobin under ${min} or ferritin under ${c.lowFerritin}).`);
  if (ferritin !== undefined && ferritin > c.highFerritin) return r('not_needed', 'IRON-HIGH', `Ferritin above ${c.highFerritin}: no extra iron needed.`);
  if ((hb !== undefined && hb < min + c.optimalHbMargin) || (ferritin !== undefined && ferritin < c.optimalFerritin) || drop >= c.hbDrop) {
    if (drop >= c.hbDrop) ev.push(`Haemoglobin down ${drop} since the donation before`);
    return r('low_normal', 'IRON-LN', `Within the donation limit but on the low side (haemoglobin under ${min + c.optimalHbMargin} or ferritin under ${c.optimalFerritin}).`);
  }
  return r('optimal', 'IRON-OK', 'Comfortable for donating, with healthy iron stores.');
}

function bp(v, language) {
  if (!v.bp) return null;
  const c = ref.careLevels().bp;
  const { s, d } = v.bp;
  const ev = [`BP ${s}/${d} on ${v.bp.date}`];
  const over = ([x, y]) => s >= x || d >= y;
  if (over(c.urgent)) return result('bp', 'urgent', 'BP-URGENT', `${c.urgent.join('/')} or more needs a doctor today.`, ev, language);
  if (over(c.doctorFirst)) return result('bp', 'doctor_first', 'BP-DF', `${c.doctorFirst.join('/')} or more: the doctor comes first.`, ev, language);
  if (over(c.below)) return result('bp', 'below', 'BP-BELOW', `${c.below.join('/')} or more (stage 1).`, ev, language);
  if (s >= c.lowNormal[0]) return result('bp', 'low_normal', 'BP-LN', `Top number ${c.lowNormal[0]}–${c.below[0] - 1}: above ideal.`, ev, language);
  return result('bp', 'optimal', 'BP-OK', 'Under 120/80.', ev, language);
}

function sugar(v, language) {
  if (!v.hba1c) return null;
  const c = ref.careLevels().sugar;
  const x = v.hba1c.value;
  const ev = [`HbA1c ${x}% on ${v.hba1c.date}`];
  if (x >= c.doctorFirst) return result('sugar', 'doctor_first', 'SUGAR-DF', `${c.doctorFirst}% or more is in the diabetes range: the doctor comes first.`, ev, language);
  if (x >= c.below) return result('sugar', 'below', 'SUGAR-BELOW', `${c.below}–${c.doctorFirst - 0.1}% is the prediabetes range.`, ev, language);
  if (x >= c.lowNormal) return result('sugar', 'low_normal', 'SUGAR-LN', `${c.lowNormal}–${c.below - 0.1}% is close to the prediabetes line.`, ev, language);
  return result('sugar', 'optimal', 'SUGAR-OK', `Under ${c.lowNormal}%.`, ev, language);
}

function lipids(v, language) {
  if (!v.ldl && !v.tg) return null;
  const c = ref.careLevels().lipids;
  const ldl = v.ldl?.value ?? 0;
  const tg = v.tg?.value ?? 0;
  const ev = [v.ldl && `LDL ${ldl} mg/dL`, v.tg && `Triglycerides ${tg} mg/dL`].filter(Boolean);
  if (ldl >= c.ldlDoctorFirst || tg >= c.tgDoctorFirst) return result('lipids', 'doctor_first', 'LIPIDS-DF', `LDL ${c.ldlDoctorFirst}+ or triglycerides ${c.tgDoctorFirst}+: the doctor comes first.`, ev, language);
  if (ldl >= c.ldlBelow || tg >= c.tgBelow) return result('lipids', 'below', 'LIPIDS-BELOW', `LDL ${c.ldlBelow}+ or triglycerides ${c.tgBelow}+.`, ev, language);
  if (ldl >= c.ldlLowNormal) return result('lipids', 'low_normal', 'LIPIDS-LN', `LDL ${c.ldlLowNormal}–${c.ldlBelow - 1}: near optimal.`, ev, language);
  if (v.hdl && v.hdl.value < 40) return result('lipids', 'low_normal', 'LIPIDS-HDL', `HDL ${v.hdl.value} mg/dL: under 40, the protective cholesterol is low.`, [...ev, `HDL ${v.hdl.value} mg/dL`], language);
  return result('lipids', 'optimal', 'LIPIDS-OK', `LDL under ${c.ldlLowNormal}.`, ev, language);
}

function vitamin(marker, v, language, vegan) {
  const key = marker === 'b12' ? 'b12' : 'vitd';
  if (!v[key]) return null;
  const c = ref.careLevels()[key];
  const x = v[key].value;
  const unit = key === 'b12' ? 'pg/mL' : 'ng/mL';
  const ev = [`${LABELS[key]} ${x} ${unit} on ${v[key].date} (from a lab report you added)`];
  if (x < c.doctorFirst) return result(key, 'doctor_first', `${key.toUpperCase()}-DF`, `Under ${c.doctorFirst} ${unit}: the doctor comes first.`, ev, language);
  if (x < c.below) return result(key, 'below', `${key.toUpperCase()}-BELOW`, `Under ${c.below} ${unit}.`, ev, language);
  if (x < c.lowNormal) {
    // With no dairy or eggs, food alone rarely brings B12 up: the doctor is always part of it
    if (key === 'b12' && vegan) return result(key, 'below', 'B12-VEGAN', `Under ${c.lowNormal} ${unit} on a vegan diet: food alone is often not enough.`, ev, language);
    return result(key, 'low_normal', `${key.toUpperCase()}-LN`, `${c.below}–${c.lowNormal - 1} ${unit}: on the low side.`, ev, language);
  }
  return result(key, 'optimal', `${key.toUpperCase()}-OK`, `${c.lowNormal} ${unit} or more.`, ev, language);
}

/** Care levels for every marker with data. `st` (the Drop state) gives the language, red flags and diet. */
function all(donorId, st) {
  const v = bands.latest(donorId);
  const language = st?.language || 'en';
  const today = store.today();
  const flag = (st?.wb?.redFlags || []).find((f) => f.date >= new Date(Date.parse(`${today}T00:00:00Z`) - 14 * 864e5).toISOString().slice(0, 10));
  const vegan = st?.wb?.foodProfile?.diet === 'vegan';
  const levels = [iron(donorId, v, language, flag), bp(v, language), sugar(v, language), lipids(v, language), vitamin('b12', v, language, vegan), vitamin('vitd', v, language)].filter(Boolean);
  // When the Donor's Goal already says when to see a doctor (from its protocol), the food coaching says the same
  if (st && st.goals && language === 'en') {
    const goals = require('./signals').goals(st).filter((g) => g.state === 'active' || g.state === 'upnext');
    for (const l of levels.filter((x) => x.doctor && x.doctor.urgency === 'weeks')) {
      const g = goals.find((x) => x.id === (l.marker === 'iron' ? 'iron' : ['bp', 'sugar', 'lipids'].includes(l.marker) ? 'lifestyle' : null));
      const step = g?.writeup?.steps.find((s) => s.tag === 'doctor');
      if (step) l.doctor = { ...l.doctor, text: `${step.text.replace(/\.$/, '')}${/cause/.test(step.text) ? '' : ' to find the cause'}, as your Goal says.` };
    }
  }
  return levels;
}

const of = (donorId, st, marker) => all(donorId, st).find((x) => x.marker === marker) || null;

module.exports = { all, of, LABELS, COACHING, doctorFor };
