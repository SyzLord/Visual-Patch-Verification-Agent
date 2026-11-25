'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {bm25} = require('../../project-v2.0/routing/score.cjs');
const protocol = require('./protocol.json');
const load = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function menu(family) {
  const config = protocol.menus[family];
  const data = load(path.join(__dirname, '../..', config.source));
  return (config.group ? data[config.group] : data).filter(([id]) => !config.exclude.includes(id))
    .map(([id, description]) => ({id, description}));
}
function screen(row) {
  const candidates = menu(row.family).filter(action => action.id !== 'ordinary');
  const scores = bm25(row.title || '', candidates.map(action => action.description));
  const ranking = candidates.map((action, index) => ({...action, score: scores[index]}))
    .sort((left, right) => right.score - left.score);
  const margin = ranking[0].score > 0 ? (ranking[0].score - ranking[1].score) / ranking[0].score : null;
  let disposition = row.exclusion || null;
  if (!disposition && margin === null) disposition = 'no-positive-text-score';
  if (!disposition && margin > protocol.threshold) disposition = 'above-threshold';
  return {...row, ranking, margin, disposition: disposition || 'low-margin'};
}
if (require.main === module) {
  const rows = load(process.argv[2]);
  console.log(JSON.stringify(rows.map(screen), null, 2));
}
module.exports = {menu, screen};
