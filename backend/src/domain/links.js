/**
 * What moves this marker (Progress screen): a marker's value at each donation,
 * with the Donor's linked signals averaged over each Cycle before it. The words
 * say what happened alongside, never "because" (data/ontology/marker-signals.json).
 */

const store = require('../data/store');
const bands = require('./bands');
const signals = require('./signals');
const ref = require('../data/reference');

const SIGNAL_WORDS = { steps: 'steps a day', active_min: 'active minutes a day', sleep_min: 'hours of sleep', iron_mg: 'mg of iron from food a day' };

function history(st, marker) {
  const donorId = st.donorId;
  const visits = store.getDonations(donorId).filter((v) => v.vitals);
  const focusKey = Object.entries(ref.markerSignals().focus).find(([, f]) => f.markers.includes(marker))?.[0];
  const linked = focusKey ? ref.markerSignals().focus[focusKey].signals.filter((s) => s !== 'food_habit') : [];
  const points = visits.map((v, i) => {
    const at = bands.atVisit(donorId, v.id)[marker];
    const from = i ? visits[i - 1].date : null;
    const sig = {};
    for (const s of linked) {
      if (!from) continue;
      const list = signals.daily(st, s, from, v.date);
      if (list.length >= 7) sig[s] = Math.round(signals.mean(list) * (s === 'sleep_min' ? 1 / 60 : 1) * 10) / 10;
    }
    return { date: v.date, value: at ? (marker === 'bp' ? at.s : at.value) : null, value2: at && marker === 'bp' ? at.d : null, text: at ? bands.text(marker, at) : null, signals: sig };
  }).filter((p) => p.value !== null);
  return { marker, linked, points, sentence: sentence(marker, points, linked) };
}

/** "Your steps went 9,100 → 5,200 a day across your last 4 Cycles, alongside BP 132/82 → 148/94." Needs 3+ Cycles. */
function sentence(marker, points, linked) {
  const def = ref.bands().markers[marker];
  for (const s of linked) {
    const withSig = points.filter((p) => p.signals[s] !== undefined);
    if (withSig.length < 3) continue;
    const a = withSig[0];
    const z = withSig[withSig.length - 1];
    const fmtSig = (v) => (s === 'steps' ? Math.round(v).toLocaleString('en-IN') : v);
    return `Your ${SIGNAL_WORDS[s]} went ${fmtSig(a.signals[s])} → ${fmtSig(z.signals[s])} across your last ${withSig.length} Cycles, alongside ${def.label.toLowerCase()} ${a.text} → ${z.text}. This shows them together; it doesn't prove one caused the other.`;
  }
  return null;
}

module.exports = { history, sentence };
