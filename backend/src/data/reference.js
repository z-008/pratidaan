/**
 * Reference data for the between-donation features, read once from data/:
 * Indian foods and nutrient needs (data/nutrition), bands, care levels and
 * marker ↔ signal links (data/ontology). Static, versioned in git.
 */

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./store');

const cache = {};
function read(dir, name) {
  const key = `${dir}/${name}`;
  if (!cache[key]) cache[key] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, dir, name), 'utf8'));
  return cache[key];
}

module.exports = {
  foods: () => read('nutrition', 'foods.json').foods,
  foodsMeta: () => { const f = read('nutrition', 'foods.json'); return { note: f._note, asOf: f.asOf }; },
  requirements: () => read('nutrition', 'requirements.json'),
  regions: () => read('nutrition', 'regions.json'),
  absorption: () => read('nutrition', 'absorption.json'),
  adjustments: () => read('nutrition', 'adjustments.json'),
  habitsLib: () => read('nutrition', 'habits.json').habits,
  bands: () => read('ontology', 'bands.json'),
  careLevels: () => read('ontology', 'care-levels.json'),
  markerSignals: () => read('ontology', 'marker-signals.json'),
};
