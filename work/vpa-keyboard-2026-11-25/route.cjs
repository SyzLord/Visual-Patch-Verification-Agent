'use strict';
const assert = require('node:assert/strict');
const {bm25} = require('../../project-v2.0/routing/score.cjs');

// Keep compound uses such as “tab panel” from counting on their own.
const keyboardCues = [
  /\b(?:keyboard|keypress(?:es)?|key\s*press(?:es)?|key\s+up\s*\/\s*down|arrow\s*keys?|arrowup|arrowdown|arrowleft|arrowright)\b/gi,
  /\b(?:shift|ctrl|alt|meta)\s*\+\s*(?:tab|enter|escape)\b/gi,
  /\b(?:tab|enter|escape|esc|space|backspace)\s+key\b/gi,
  /\b(?:press(?:ing|ed)?|hit(?:ting)?|us(?:e|ing)|with|on)\s+(?:the\s+)?(?:tab|enter|escape|esc|spacebar|backspace)\b/gi,
  /\b(?:tabbing|tabbed)\b/gi,
];

function plan(title, menu) {
  assert.equal(typeof title, 'string');
  assert.equal(menu[0]?.id, 'ordinary');
  const actions = menu.slice(1);
  assert.ok(actions.length >= 2 && new Set(menu.map(action => action.id)).size === menu.length);
  const scores = bm25(title, actions.map(action => action.description));
  const ranking = actions.map((action, i) => ({...action, score:scores[i]})).sort((a,b) => b.score - a.score);
  const baseline = ranking.map(action => action.id);
  const cues = [...new Set(keyboardCues.flatMap(pattern => [...title.matchAll(pattern)].map(match => match[0].toLowerCase())))];
  const index = baseline.indexOf('keys');
  const promoted = cues.length > 0 && index >= 2;
  const keyboard = baseline.slice();
  if (promoted) keyboard.splice(1, 0, ...keyboard.splice(index, 1));
  return {title, ranking, cues, promoted, displaced:promoted ? baseline[1] : null,
    orders:{bm25:baseline, keyboard}};
}

if (require.main === module) {
  const request = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(plan(request.title, request.menu), null, 2));
}
module.exports = {plan};
