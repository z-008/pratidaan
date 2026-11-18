/** Date helpers on ISO dates (UTC days), shared by the between-donation modules. Same rules as drop.js. */

const DAY = 864e5;
const dayNum = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const dow = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const weekStart = (iso) => addDays(iso, -((dow(iso) + 6) % 7));
const sundayOf = (iso) => addDays(weekStart(iso), 6);
const between = (a, b) => dayNum(b) - dayNum(a);
const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtMonth = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
function range(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

module.exports = { DAY, dayNum, addDays, dow, weekStart, sundayOf, between, fmt, fmtMonth, range };
