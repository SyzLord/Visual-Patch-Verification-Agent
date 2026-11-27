'use strict';
const {bm25} = require('./bm25.cjs');

// The November 25 title cues, with optional reservation of the final slot.
const cues = [
  /\b(?:keyboard|keypress(?:es)?|key\s*press(?:es)?|key\s+up\s*\/\s*down|arrow\s*keys?|arrowup|arrowdown|arrowleft|arrowright)\b/gi,
  /\b(?:shift|ctrl|alt|meta)\s*\+\s*(?:tab|enter|escape)\b/gi,
  /\b(?:tab|enter|escape|esc|space|backspace)\s+key\b/gi,
  /\b(?:press(?:ing|ed)?|hit(?:ting)?|us(?:e|ing)|with|on)\s+(?:the\s+)?(?:tab|enter|escape|esc|spacebar|backspace)\b/gi,
  /\b(?:tabbing|tabbed)\b/gi
];

function plan(spec) {
  const actions = spec.actions.slice(1);
  const title = spec.ticket.title;
  const scores = bm25(title, actions.map(action=>action.description));
  const ranking = actions.map(({id,description},index)=>({id,description,score:scores[index]})).sort((a,b)=>b.score-a.score);
  const bm25Order = ranking.map(row=>row.id);
  const keyboardOrder = bm25Order.slice();
  const matches = [...new Set(cues.flatMap(pattern=>[...title.matchAll(pattern)].map(hit=>hit[0].toLowerCase())))];
  const keyboardIndex = bm25Order.indexOf(spec.keyboardAction);
  const lastSearchSlot = spec.budget-2;
  const promoted = spec.budget >= 3 && matches.length > 0 && keyboardIndex > lastSearchSlot;
  if (promoted) keyboardOrder.splice(lastSearchSlot,0,...keyboardOrder.splice(keyboardIndex,1));
  return {title,ranking,cues:matches,promoted,displaced:promoted ? bm25Order[lastSearchSlot] : null,
    orders:{fixed:actions.map(row=>row.id),bm25:bm25Order,keyboard:keyboardOrder}};
}
module.exports = {plan};
