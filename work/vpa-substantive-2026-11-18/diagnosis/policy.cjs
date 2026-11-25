'use strict';
const assert = require('node:assert/strict');
const {budget} = require('../protocol.json');

async function follow(order, execute, confirmed) {
  const trace = [];
  for (const action of ['ordinary', ...order].slice(0, budget)) {
    const row = await execute(action);
    assert.equal(row.errors.length, 0);
    assert.equal(row.pass, !confirmed.includes(action), 'unstable ' + action);
    trace.push(row);
    if (!row.pass) {
      assert.ok(row.publicFailure);
      break;
    }
  }
  const hit = trace.at(-1).pass ? null : trace.length;
  return {hit, at2:hit !== null && hit <= 2, by3:hit !== null && hit <= 3, exactly3:hit === 3,
    candidateActions:trace.length, candidateGestures:trace.reduce((n, row) => n + row.gestures.length, 0), trace};
}
module.exports = {follow};
