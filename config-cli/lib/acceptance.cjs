'use strict';
const {isDeepStrictEqual} = require('node:util');

function evaluate(conditions, states) {
  return conditions.map(condition=>{
    const {at,field,equals} = condition;
    const state = at === 'last' ? states.at(-1) : states[at];
    const actual = field.split('.').reduce((value,key)=>value != null && Object.hasOwn(value,key) ? value[key] : undefined,state);
    return {at,field,expected:equals,actual:actual ?? null,present:actual !== undefined,
      pass:actual !== undefined && isDeepStrictEqual(actual,equals)};
  });
}

function assess(action, row) {
  const expect = evaluate(action.expect,row.states);
  const failure = evaluate(action.failure || [],row.states);
  const expected = expect.every(check=>check.pass);
  const known = failure.length > 0 && failure.every(check=>check.pass);
  let outcome = 'pass';
  if (row.errors.length || row.states.length !== action.steps.length+1 ||
      [...expect,...failure].some(check=>!check.present) || expected && known) outcome = 'error';
  else if (!expected) outcome = known ? 'known-failure' : 'unexpected';
  return {...row,expect,failure,outcome};
}

async function accept(actions, run) {
  const reference = [], candidate = [], confirmations = [];
  for (const action of actions) reference.push(await run('reference',action,'reference'));
  for (const action of actions) candidate.push(await run('candidate',action,'candidate'));
  const failures = candidate.filter(row=>row.outcome==='known-failure');
  for (const row of failures) {
    const action = actions.find(item=>item.id===row.action);
    confirmations.push(await run('candidate',action,'confirmation'));
  }
  const qualified = reference.every(row=>row.outcome==='pass') &&
    candidate.every(row=>['pass','known-failure'].includes(row.outcome)) &&
    confirmations.every(row=>row.outcome==='known-failure');
  return {reference,candidate,confirmations,confirmed:qualified ? failures.map(row=>row.action) : [],
    status:!qualified ? 'inconclusive' : failures.length ? 'regression' : 'pass'};
}

async function compare(spec, plan, acceptance, run) {
  const comparisons = {};
  if (acceptance.status === 'inconclusive') return comparisons;
  for (const [method, order] of Object.entries(plan.orders)) {
    const scheduled = ['ordinary',...order].slice(0,spec.budget);
    const trace = [];
    let firstHit = null;
    let consistent = true;
    for (const id of scheduled) {
      const action = spec.actions.find(item=>item.id===id);
      const row = await run('candidate',action,null);
      trace.push(row);
      const expected = acceptance.confirmed.includes(id) ? 'known-failure' : 'pass';
      if (expected !== row.outcome) {
        consistent = false;
        break;
      }
      if (expected === 'known-failure') {
        firstHit = trace.length;
        break;
      }
    }
    comparisons[method] = {scheduled,firstHit,consistent,steps:trace.length,
      gestures:trace.reduce((count,row)=>count+row.performed,0),referenceActions:0,referenceImages:0,trace};
  }
  return comparisons;
}
module.exports = {assess, accept, compare};
