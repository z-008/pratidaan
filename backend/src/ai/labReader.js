/**
 * Lab-report reader.
 *
 * Donors already get tests done elsewhere — every lab in India prints them
 * differently ("Hb", "Haemoglobin (Cyanmeth)", "HGB"; mg/dL vs mmol/L;
 * scanned photos). This turns any report (pasted text or an image) into
 * structured results mapped to Pratidaan's LOINC-coded markers, converting
 * units, so they join the donor's health timeline and feed the same rules,
 * score and cover engine as donation-sample results.
 *
 * Output is schema-constrained; values are then validated against plausible
 * physiological ranges before anything is saved, and the donor confirms.
 */

const store = require('../data/store');
const llm = require('./llm');

const MARKERS = {
  hb: { loinc: '718-7', name: 'Haemoglobin', unit: 'g/dL', range: [3, 25] },
  hba1c: { loinc: '4548-4', name: 'HbA1c', unit: '%', range: [3, 18] },
  ldl: { loinc: '13457-7', name: 'LDL cholesterol', unit: 'mg/dL', range: [10, 400] },
  hdl: { loinc: '2085-9', name: 'HDL cholesterol', unit: 'mg/dL', range: [5, 150] },
  tg: { loinc: '2571-8', name: 'Triglycerides', unit: 'mg/dL', range: [10, 2000] },
  tc: { loinc: '2093-3', name: 'Total cholesterol', unit: 'mg/dL', range: [50, 600] },
  ferritin: { loinc: '2276-4', name: 'Ferritin', unit: 'ng/mL', range: [1, 3000] },
  alt: { loinc: '1742-6', name: 'ALT (liver enzyme)', unit: 'U/L', range: [1, 2000] },
  creat: { loinc: '2160-0', name: 'Creatinine', unit: 'mg/dL', range: [0.1, 20] },
  tsh: { loinc: '3016-3', name: 'TSH (thyroid)', unit: 'mIU/L', range: [0.01, 100] },
  wbc: { loinc: '6690-2', name: 'White blood cells', unit: '10^3/uL', range: [0.5, 100] },
  plt: { loinc: '777-3', name: 'Platelets', unit: '10^3/uL', range: [5, 1500] },
  mcv: { loinc: '787-2', name: 'Mean corpuscular volume', unit: 'fL', range: [40, 140] },
  fbs: { loinc: '1558-6', name: 'Fasting glucose', unit: 'mg/dL', range: [20, 600] },
  vitd: { loinc: '1989-3', name: 'Vitamin D', unit: 'ng/mL', range: [1, 200] },
  b12: { loinc: '2132-9', name: 'Vitamin B12', unit: 'pg/mL', range: [20, 3000] },
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['labName', 'reportDate', 'results', 'unmapped', 'notes'],
  properties: {
    labName: { type: 'string' },
    reportDate: { type: 'string', description: 'YYYY-MM-DD, or empty if not printed' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['marker', 'printedName', 'printedValue', 'printedUnit', 'value', 'confidence'],
        properties: {
          marker: { type: 'string', enum: Object.keys(MARKERS) },
          printedName: { type: 'string' },
          printedValue: { type: 'string' },
          printedUnit: { type: 'string' },
          value: { type: 'number', description: 'Value converted to the canonical unit for this marker' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    unmapped: { type: 'array', items: { type: 'string' }, description: 'Tests on the report with no matching marker' },
    notes: { type: 'string', description: 'Unit conversions done, or anything ambiguous' },
  },
};

const SYSTEM = `You extract results from Indian laboratory reports into a fixed set of markers.
Canonical markers and units: ${Object.entries(MARKERS).map(([k, m]) => `${k} = ${m.name} (${m.unit})`).join('; ')}.
Rules:
- Map synonyms (e.g. HGB/Hb/Haemoglobin -> hb; Glycated haemoglobin/A1c -> hba1c; SGPT -> alt; Thyroid stimulating hormone -> tsh; FBS/Fasting plasma glucose -> fbs; Platelet count in lakh/cumm -> plt in 10^3/uL).
- Convert to the canonical unit: cholesterol mmol/L x 38.67; triglycerides mmol/L x 88.57; glucose mmol/L x 18.02; creatinine umol/L / 88.4; Hb g/L / 10; platelets lakh/cumm x 100; HbA1c mmol/mol -> % via (mmol/mol / 10.929) + 2.15. Note each conversion in notes.
- Copy printed name/value/unit exactly. Do not guess values that are not printed; use confidence low if text is unclear.
- Ignore reference ranges, patient details and comments. Put tests without a canonical marker in unmapped.`;

async function extract({ donorId, text, image }) {
  const content = [];
  if (image) {
    const match = /^data:(image\/(png|jpeg|webp|gif));base64,(.+)$/.exec(image);
    if (!match) throw new Error('Image must be a base64 data URL (png, jpeg, webp or gif)');
    content.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[3] } });
  }
  content.push({ type: 'text', text: text ? `Lab report text:\n\n${text}` : 'Extract the results from this lab report image.' });

  const parsed = await llm.json({ feature: 'lab_reader', system: SYSTEM, messages: [{ role: 'user', content }], maxTokens: 3000, effort: 'low', outputSchema: SCHEMA, guardrailKind: 'extraction' });
  return validate(donorId, parsed);
}

/** Range-check each value and attach the donor's previous result for comparison. */
function validate(donorId, parsed) {
  const previous = {};
  for (const o of store.getObservations(donorId)) {
    if (!previous[o.key] || o.date > previous[o.key].date) previous[o.key] = o;
  }
  const results = parsed.results.map((r) => {
    const m = MARKERS[r.marker];
    const plausible = r.value >= m.range[0] && r.value <= m.range[1];
    return {
      ...r, name: m.name, unit: m.unit, loinc: m.loinc, plausible,
      previous: previous[r.marker] ? { value: previous[r.marker].value, date: previous[r.marker].date } : null,
    };
  });
  return { ...parsed, results };
}

/** Save confirmed results into the donor's timeline. */
function save(donorId, { reportDate, labName, results } = {}) {
  // An undated report is recorded at the demo clock's today; a supplied date
  // must be a real calendar date, not a future result in this demo timeline.
  const today = store.today();
  const date = reportDate == null || reportDate === '' ? today : reportDate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    || date < '1900-01-01' || date > today) throw new Error('Report date must be a real date no later than today');
  if (!Array.isArray(results)) throw new Error('Results must be an array');
  // The confirmation payload is untrusted: never rely on its plausible flag,
  // canonical name, unit or LOINC code supplied by the browser.
  for (const r of results) {
    if (!r || !Object.hasOwn(MARKERS, r.marker) || typeof r.value !== 'number' || !Number.isFinite(r.value)) {
      throw new Error('Each result needs a known marker and finite numeric value');
    }
  }
  const accepted = results.filter((r) => r.value >= MARKERS[r.marker].range[0] && r.value <= MARKERS[r.marker].range[1]);
  const visitId = `EXT-${Date.now()}`;
  const observations = accepted.map((r) => ({
    id: `OBS-${visitId}-${r.marker}`, donorId, visitId, code: MARKERS[r.marker].loinc, key: r.marker,
    name: MARKERS[r.marker].name, value: r.value, unit: MARKERS[r.marker].unit, low: null, high: null,
    date, source: 'uploaded_report', labId: labName || 'External lab',
  }));
  if (observations.length) store.addObservations(donorId, observations);
  return { saved: observations.length, date };
}

module.exports = { extract, save, MARKERS };
