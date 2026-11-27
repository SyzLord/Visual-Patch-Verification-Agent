'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadConfig} = require('../lib/config.cjs');
const {assess,accept,compare} = require('../lib/acceptance.cjs');
const {plan} = require('../lib/ranking.cjs');
const {verify} = require('../lib/evidence.cjs');

const suite = id=>loadConfig(path.join(__dirname,'../examples',id+'.json'));
const observed = (action, outcome)=>({action:action.id, performed:action.steps.length,outcome});

test('both adapters load released packages with a frozen budget and common menu',()=>{
  const bundles = [1943,2342,654,631].map(suite);
  assert.deepEqual(new Set(bundles.map(b=>b.spec.fixture.adapter)),new Set(['flatpickr','air-datepicker']));
  assert.ok(bundles.every(b=>b.spec.budget===3));
  const menu = bundles[0].spec.actions.map(({id,description})=>[id,description]);
  for (const {spec} of bundles) assert.deepEqual(spec.actions.map(({id,description})=>[id,description]),menu);
  assert.ok(bundles[0].builds.candidate.plugin);
  assert.equal(bundles[2].builds.candidate.plugin,undefined);
});

test('documented page error needs the exact one-error signature and ordinary controls stay strict',()=>{
  const action = suite(631).spec.actions.find(a=>a.id==='keys');
  const states = [{active:'field',open:false,uiErrorNames:[]},{open:false,uiErrorNames:['TypeError']}];
  const sample = {states,errors:[],pageErrors:[{name:'TypeError'}]};
  assert.equal(assess(action,sample).outcome,'known-failure');
  assert.equal(assess(action,{...sample,pageErrors:[{name:'RangeError'}]}).outcome,'error');
  assert.equal(assess(action,{...sample,pageErrors:[{name:'TypeError'},{name:'TypeError'}]}).outcome,'error');
  assert.equal(assess({...action,documentedPageError:undefined},sample).outcome,'error');
  assert.equal(assess(action,{...sample,errors:['timeout']}).outcome,'error');
  assert.equal(assess(action,{...sample,pageErrors:[],states:[states[0],{...states[1],uiErrorNames:[]}]}).outcome,'pass');
});

test('a disappearing target failure rejects the panel',async ()=>{
  const {spec} = suite(631);
  const result = await accept(spec.actions,async (role,action,phase)=>
    observed(action,role==='candidate' && action.id==='keys' && phase!=='confirmation'?'known-failure':'pass'));
  assert.equal(result.status,'inconclusive');
  assert.deepEqual(result.confirmed,[]);
  assert.equal(result.confirmations.length,1);
});

test('counterfactual replacement can lose coverage, without dropping BM25 top1',async ()=>{
  const {spec} = suite(1943);
  const ranked = plan(spec);
  assert.equal(ranked.displaced,'month');
  const acceptance = {status:'regression',confirmed:['month']};
  const result = await compare(spec,ranked,acceptance,async (role,action)=>
    observed(action,action.id==='month'?'known-failure':'pass'));
  assert.equal(result.bm25.firstHit,3);
  assert.equal(result.keyboard.firstHit,null);
  assert.equal(result.bm25.scheduled[1],result.keyboard.scheduled[1]);
});

test('each of the eight browser archives verifies its own PNG and data digests',()=>{
  for (const round of ['initial','repeat']) for (const id of [1943,2342,654,631]) {
    assert.equal(verify(path.join(__dirname,'../runs',round,String(id))).status,'regression');
  }
});
