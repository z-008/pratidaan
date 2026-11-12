/**
 * Deterministic health engine.
 *
 * Turns screening vitals and lab results into findings, a 0-100 health score
 * and donation eligibility. All clinical thresholds live here as code, so the
 * same input always gives the same result; the AI layer only explains and
 * plans around these outputs, it never decides them.
 */

const store = require('../data/store');

const DAY = 24 * 60 * 60 * 1000;

const RESULT_KEYS = ['hb', 'hba1c', 'ldl', 'hdl', 'tg', 'ferritin', 'alt', 'creat', 'tsh', 'wbc', 'plt', 'mcv', 'tc'];

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / DAY);
}

function addDays(isoDate, days) {
  return new Date(new Date(isoDate).getTime() + days * DAY).toISOString().slice(0, 10);
}

/** Latest value per lab key plus full history (oldest first). */
function labSeries(donorId) {
  const series = {};
  for (const o of store.getObservations(donorId)) {
    if (!series[o.key]) series[o.key] = [];
    series[o.key].push(o);
  }
  for (const list of Object.values(series)) list.sort((a, b) => a.date.localeCompare(b.date));
  return series;
}

function latest(series, key) {
  const list = series[key];
  return list && list.length ? list[list.length - 1] : null;
}

function vitalsSeries(donorId) {
  return store.getDonations(donorId).map((d) => ({ date: d.date, visitId: d.id, status: d.status, ...d.vitals }));
}

function bmi(donor, weightKg) {
  return weightKg / (donor.heightCm / 100) ** 2;
}

/** The donation minimum for haemoglobin (NBTC): 12.5 g/dL for women, 13.0 for men. */
function hbMin(donor) {
  return donor.sex === 'F' ? 12.5 : 13.0;
}

/** Findings that stop the Donor donating until they clear. */
function blocksDonation(f) {
  return ['urgent', 'high'].includes(f.severity) || ['HB_LOW', 'HB_SEVERE', 'BP_GRADE1'].includes(f.id);
}

/** Findings from the latest visit and lab results, ordered most severe first. */
function findings(donorId) {
  const donor = store.getDonor(donorId);
  const vitals = vitalsSeries(donorId);
  const labs = labSeries(donorId);
  const out = [];
  if (!donor || !vitals.length) return out;

  const last = vitals[vitals.length - 1];
  const add = (f) => out.push({ date: last.date, ...f });

  // Blood pressure (ACC/AHA 2017 / ICMR)
  const { systolic: s, diastolic: d } = last;
  if (s >= 180 || d >= 120) {
    add({ id: 'BP_URGENCY', title: 'Very high blood pressure', severity: 'urgent', protocolId: 'BP-URGENCY', concept: 'hypertension',
          detail: `${s}/${d} mmHg at your last visit`, evidence: [`BP ${s}/${d} on ${last.date}`] });
  } else if (s >= 160 || d >= 100) {
    add({ id: 'BP_GRADE2', title: 'High blood pressure (stage 2)', severity: 'high', protocolId: 'BP-G2', concept: 'hypertension',
          detail: `${s}/${d} mmHg`, evidence: [`BP ${s}/${d} on ${last.date}`] });
  } else if (s >= 140 || d >= 90) {
    add({ id: 'BP_GRADE1', title: 'High blood pressure (stage 1)', severity: 'moderate', protocolId: 'BP-G1', concept: 'hypertension',
          detail: `${s}/${d} mmHg`, evidence: [`BP ${s}/${d} on ${last.date}`] });
  } else if (s >= 130 || d >= 80) {
    add({ id: 'BP_ELEVATED', title: 'Blood pressure above ideal', severity: 'watch', concept: 'hypertension',
          detail: `${s}/${d} mmHg — not high yet, but above the 120/80 ideal`, evidence: [`BP ${s}/${d} on ${last.date}`] });
  }
  if (vitals.length >= 3) {
    const first = vitals[0];
    const rise = s - first.systolic;
    const years = Math.max(daysBetween(first.date, last.date) / 365, 0.5);
    if (rise >= 8 && s >= 125) {
      add({ id: 'BP_RISING', title: 'Blood pressure rising over time', severity: 'watch', concept: 'hypertension',
            detail: `Up ${rise} mmHg over ${years.toFixed(1)} years (${vitals.map((v) => v.systolic).join(' → ')})`,
            evidence: vitals.map((v) => `${v.date}: ${v.systolic}/${v.diastolic}`) });
    }
  }

  // Haemoglobin and iron
  const hbMinimum = hbMin(donor);
  const ferritin = latest(labs, 'ferritin');
  // An external report on or after the last visit gives the current Hb;
  // same-day donation samples still defer to the measured screening vital.
  const labHb = latest(labs, 'hb');
  const hb = labHb && (labHb.date > last.date || (labHb.date === last.date && labHb.source === 'uploaded_report'))
    ? { value: labHb.value, date: labHb.date } : { value: last.haemoglobin, date: last.date };
  if (hb.value < 7) {
    add({ id: 'HB_SEVERE', title: 'Severe anaemia', severity: 'urgent', protocolId: 'HB-SEV', concept: 'anemia',
          detail: `Haemoglobin ${hb.value} g/dL`, evidence: [`Hb ${hb.value} on ${hb.date}`] });
  } else if (hb.value < hbMinimum) {
    const ev = [`Hb ${hb.value} g/dL on ${hb.date} (donor minimum ${hbMinimum})`];
    if (ferritin) ev.push(`Ferritin ${ferritin.value} ng/mL`);
    add({ id: 'HB_LOW', title: 'Haemoglobin below donation level', severity: 'moderate', protocolId: 'HB-DEF', concept: 'anemia',
          detail: `${hb.value} g/dL (needs ${hbMinimum}+)`, evidence: ev });
  }
  if (ferritin && ferritin.value < 15) {
    add({ id: 'IRON_LOW', title: 'Iron stores depleted', severity: 'moderate', protocolId: 'HB-DEF', concept: 'anemia',
          detail: `Ferritin ${ferritin.value} ng/mL`, evidence: (labs.ferritin || []).map((o) => `${o.date}: ferritin ${o.value}`) });
  }

  // Glucose
  const a1c = latest(labs, 'hba1c');
  if (a1c && a1c.value >= 6.5) {
    add({ id: 'DIABETES_RANGE', title: 'HbA1c in the diabetes range', severity: 'high', protocolId: 'DM-DIAB', concept: 'diabetes',
          detail: `HbA1c ${a1c.value}% (diabetes ≥ 6.5%)`, evidence: (labs.hba1c || []).map((o) => `${o.date}: ${o.value}%`) });
  } else if (a1c && a1c.value >= 5.7) {
    add({ id: 'PREDIABETES', title: 'Prediabetes range HbA1c', severity: 'moderate', protocolId: 'DM-PREDIAB', concept: 'prediabetes',
          detail: `HbA1c ${a1c.value}% (normal < 5.7%)`, evidence: (labs.hba1c || []).map((o) => `${o.date}: ${o.value}%`) });
  }

  // Lipids
  const ldl = latest(labs, 'ldl');
  const tg = latest(labs, 'tg');
  const hdl = latest(labs, 'hdl');
  const lipidEvidence = [ldl && `LDL ${ldl.value}`, tg && `Triglycerides ${tg.value}`, hdl && `HDL ${hdl.value}`].filter(Boolean);
  if ((ldl && ldl.value >= 160) || (tg && tg.value >= 200)) {
    add({ id: 'LIPIDS_HIGH', title: 'Cholesterol / triglycerides high', severity: 'moderate', concept: 'heart_disease',
          detail: lipidEvidence.join(', ') + ' mg/dL', evidence: lipidEvidence });
  } else if ((ldl && ldl.value >= 130) || (tg && tg.value >= 150) || (hdl && hdl.value < 40)) {
    add({ id: 'LIPIDS_BORDERLINE', title: 'Cholesterol borderline', severity: 'watch', concept: 'heart_disease',
          detail: lipidEvidence.join(', ') + ' mg/dL', evidence: lipidEvidence });
  }

  const alt = latest(labs, 'alt');
  if (alt && alt.value > 45) {
    add({ id: 'ALT_HIGH', title: 'Liver enzyme raised', severity: 'watch', concept: null,
          detail: `ALT ${alt.value} U/L (normal ≤ 45)`, evidence: [`ALT ${alt.value} on ${alt.date}`] });
  }

  const b = bmi(donor, last.weightKg);
  if (b >= 27.5) {
    add({ id: 'BMI_HIGH', title: 'Weight above healthy range', severity: 'watch', concept: 'weight_management',
          detail: `BMI ${b.toFixed(1)} (Asian cut-off 23–27.5)`, evidence: [`Weight ${last.weightKg} kg, height ${donor.heightCm} cm`] });
  }

  const rank = { urgent: 0, high: 1, moderate: 2, watch: 3 };
  return out.sort((x, y) => rank[x.severity] - rank[y.severity]);
}

/**
 * Health score 0-100: weighted by how far each marker is from its healthy
 * range. Used for the insurance cover ladder, so it is fully deterministic.
 */
function scoreAt(donor, visit, labsByKey) {
  const parts = [];
  const push = (name, weight, points, value) => parts.push({ name, weight, points: Math.round(points), value });
  const s = visit.systolic;
  const d = visit.diastolic;
  push('Blood pressure', 25, s < 120 && d < 80 ? 100 : s < 130 && d < 85 ? 85 : s < 140 && d < 90 ? 65 : s < 160 && d < 100 ? 35 : 10, `${s}/${d}`);
  const hbMinimum = hbMin(donor);
  push('Haemoglobin', 15, visit.haemoglobin >= hbMinimum ? 100 : visit.haemoglobin >= hbMinimum - 1 ? 60 : 25, `${visit.haemoglobin} g/dL`);
  const a1c = labsByKey.hba1c;
  if (a1c != null) push('Blood sugar (HbA1c)', 20, a1c < 5.7 ? 100 : a1c < 6.0 ? 70 : a1c < 6.5 ? 50 : 20, `${a1c}%`);
  const ldl = labsByKey.ldl;
  const tg = labsByKey.tg;
  if (ldl != null) {
    let p = ldl < 100 ? 100 : ldl < 130 ? 85 : ldl < 160 ? 60 : 30;
    if (tg != null && tg >= 150) p -= tg >= 200 ? 20 : 10;
    push('Cholesterol', 15, Math.max(p, 10), `LDL ${ldl}${tg != null ? `, TG ${tg}` : ''}`);
  }
  const b = bmi(donor, visit.weightKg);
  push('Weight (BMI)', 15, b < 23 && b >= 18.5 ? 100 : b < 25 ? 85 : b < 27.5 ? 65 : b < 30 ? 40 : 20, b.toFixed(1));
  push('Lifestyle', 10, donor.smoker ? 30 : 100, donor.smoker ? 'Smoker' : 'Non-smoker');

  const total = parts.reduce((sum, p) => sum + p.weight, 0);
  const score = Math.round(parts.reduce((sum, p) => sum + p.points * p.weight, 0) / total);
  return { score, parts };
}

/** Score history: one point per visit, using the labs from that visit's sample. */
function scoreHistory(donorId) {
  const donor = store.getDonor(donorId);
  const visits = vitalsSeries(donorId);
  const obs = store.getObservations(donorId);
  let carried = {};
  return visits.map((v) => {
    const labs = { ...carried };
    for (const o of obs) if (o.visitId === v.visitId) labs[o.key] = o.value;
    carried = labs;
    return { date: v.date, visitId: v.visitId, ...scoreAt(donor, v, labs) };
  });
}

/** Current score uses the newest available labs, including external reports, without
 * rewriting the sample-based score recorded for each past donation. */
function currentScore(donorId) {
  const donor = store.getDonor(donorId);
  const last = vitalsSeries(donorId).slice(-1)[0];
  if (!last) return null;
  const labs = labSeries(donorId);
  const values = Object.fromEntries(Object.entries(labs).map(([key, list]) => [key, list[list.length - 1].value]));
  const hb = latest(labs, 'hb');
  const visit = hb && hb.source === 'uploaded_report' && hb.date >= last.date
    ? { ...last, haemoglobin: hb.value } : last;
  return scoreAt(donor, visit, values);
}

/** Whole-blood donation eligibility under NBTC (India) rules. */
function eligibility(donorId) {
  const donor = store.getDonor(donorId);
  const visits = store.getDonations(donorId);
  const lastDonation = [...visits].reverse().find((v) => v.status === 'completed');
  const gapDays = donor.sex === 'F' ? 120 : 90;
  const blockers = findings(donorId).filter(blocksDonation);
  let nextDate = lastDonation ? addDays(lastDonation.date, gapDays) : store.today();
  if (nextDate < store.today()) nextDate = store.today();
  const eligibleNow = !blockers.length && nextDate <= store.today();
  return {
    eligibleNow,
    nextEligibleDate: blockers.length ? null : nextDate,
    gapDays,
    lastDonationDate: lastDonation ? lastDonation.date : null,
    blockers: blockers.map((f) => f.title),
  };
}

module.exports = { RESULT_KEYS, findings, scoreHistory, currentScore, eligibility, labSeries, vitalsSeries, bmi, hbMin, blocksDonation, daysBetween, addDays };
