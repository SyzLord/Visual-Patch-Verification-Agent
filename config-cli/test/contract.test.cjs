'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadConfig} = require('../lib/config.cjs');
const {plan} = require('../lib/ranking.cjs');
const {assess,accept,compare} = require('../lib/acceptance.cjs');
const evidence = require('../lib/evidence.cjs');

const root = path.resolve(__dirname,'..');
const read = filename=>JSON.parse(fs.readFileSync(path.join(root,filename)));
const example = ticket=>loadConfig(path.join(root,'examples',ticket+'.json')).spec;

function scratch(t) {
  const dir = fs.mkdtempSync(path.join(__dirname,'temporary-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  return dir;
}

test('两个 JSON 样例保留原始标题、版本与 BM25 分数',()=>{
  for (const id of ['2376','1661']) {
    const config = example(id);
    const archived = read('migration/source/'+id+'-inputs.json');
    const current = plan(config);
    assert.equal(config.ticket.title,archived.source.title);
    assert.equal(config.builds.reference.version,archived.config.fixed);
    assert.equal(config.builds.candidate.version,archived.config.old);
    assert.deepEqual(current.ranking,archived.routing.ranking);
    assert.deepEqual(current.orders.bm25,archived.routing.orders.bm25);
    assert.deepEqual(current.orders.keyboard,archived.routing.orders.keyboard);
    const lock = read('migration/source/release-lock.json');
    for (const role of ['candidate','reference']) {
      const build = config.builds[role];
      const prior = lock['flatpickr-'+build.version];
      assert.equal(build.script.sha256,prior.assets.js);
      assert.equal(build.style.sha256,prior.assets.css);
    }
  }
});

test('预算为三时只替换最后一步，保留首选；两步时保持原顺序',()=>{
  const spec = example('2376');
  const current = plan(spec);
  assert.deepEqual(current.orders.keyboard.slice(0,2),['manual','keys']);
  assert.equal(current.displaced,'time');
  spec.budget = 2;
  assert.deepEqual(plan(spec).orders.keyboard,plan(spec).orders.bm25);
  spec.budget = 4;
  assert.deepEqual(plan(spec).orders.keyboard.slice(0,3),['manual','time','keys']);
  assert.equal(plan(spec).displaced,'month');
  spec.ticket.title = 'Selection in a month grid';
  assert.deepEqual(plan(spec).orders.keyboard,plan(spec).orders.bm25);
});

test('配置拒绝越界断言、重复动作、未知操作和损坏文件',t=>{
  const dir = scratch(t);
  fs.cpSync(path.join(root,'examples'),dir,{recursive:true});
  const file = path.join(dir,'2376.json');
  const bad = [
    [spec=>spec.actions[0].expect[0].at=20,/checkpoint/],
    [spec=>spec.actions[1].id='ordinary',/重复/],
    [spec=>spec.actions[1].steps[0].op='goto',/动作类型/],
    [spec=>spec.builds.reference.script.path='../remote.js',/reference JS/],
    [spec=>spec.builds.reference.script.sha256='0'.repeat(64),/SHA-256/]
  ];
  for (const [mutate,error] of bad) {
    const fresh = example('2376');
    mutate(fresh);
    fs.writeFileSync(file,JSON.stringify(fresh));
    assert.throws(()=>loadConfig(file),error);
  }
});

test('断言区分已知失败、未知失败、缺失读数和执行错误',()=>{
  const action = {steps:[{}],expect:[{at:1,field:'selectionStart',equals:5}],
    failure:[{at:'last',field:'selectionStart',equals:6}]};
  const row = value=>({states:[{},value],errors:[]});
  assert.equal(assess(action,row({selectionStart:5})).outcome,'pass');
  assert.equal(assess(action,row({selectionStart:6})).outcome,'known-failure');
  assert.equal(assess(action,row({selectionStart:7})).outcome,'unexpected');
  assert.equal(assess(action,row({})).outcome,'error');
  assert.equal(assess(action,{...row({selectionStart:6}),errors:['page error']}).outcome,'error');
  assert.equal(assess({...action,failure:action.expect},row({selectionStart:5})).outcome,'error');
});

test('只有参考通过、待测出现签名并重复出现时才确认',async ()=>{
  const actions = [{id:'ordinary'},{id:'keys'}];
  const sample = async (options={})=>accept(actions,async (role,action,phase)=>({
    action:action.id,
    outcome:action.id === 'ordinary' ? 'pass' : options[phase] || (role==='candidate' ? 'known-failure' : 'pass')
  }));
  assert.deepEqual((await sample()).confirmed,['keys']);
  const unstable = await sample({confirmation:'pass'});
  assert.equal(unstable.status,'inconclusive');
  assert.deepEqual(unstable.confirmed,[]);
  assert.equal((await sample({reference:'unexpected'})).status,'inconclusive');
  assert.equal((await sample({candidate:'unexpected'})).status,'inconclusive');
  assert.equal((await sample({candidate:'pass'})).status,'pass');
});

test('公平比较遵守预算、首错停止和轨迹一致性',async ()=>{
  const spec = example('2376');
  const result = {status:'regression',confirmed:['keys']};
  const run = async (role,action)=>({action:action.id,performed:1,outcome:action.id==='keys'?'known-failure':'pass'});
  const rows = await compare(spec,plan(spec),result,run);
  assert.equal(rows.fixed.firstHit,3);
  assert.equal(rows.bm25.firstHit,null);
  assert.equal(rows.keyboard.firstHit,3);
  const early = await compare(example('1661'),plan(example('1661')),result,run);
  assert.equal(early.bm25.steps,2);
  assert.equal(early.keyboard.firstHit,2);
  const drift = await compare(spec,plan(spec),result,async()=>({outcome:'error',performed:0}));
  assert.equal(drift.keyboard.consistent,false);
  assert.equal(drift.keyboard.firstHit,null);
  assert.deepEqual(await compare(spec,plan(spec),{status:'inconclusive'},run),{});
});

test('证据防止覆盖，报告转义标题和错误，校验拒绝篡改', t=>{
  const dir = path.join(scratch(t),'run');
  const config = example('2376');
  config.ticket.title = '<img src=x onerror=alert(1)>';
  const routes = plan(config);
  const inputs = evidence.start(dir,config,'sample',routes);
  assert.throws(()=>evidence.start(dir,config,'sample',routes),/EEXIST/);
  const save = evidence.capture(dir,'reference','keys');
  const frame = save('before',Buffer.from('frame'));
  const row = {action:'keys',outcome:'pass',frames:[frame],expect:[],failure:[],errors:[],states:[]};
  evidence.finish(dir,{...inputs,status:'pass',error:'<b>value</b>',browser:null,comparisons:{},
    acceptance:{reference:[row],candidate:[],confirmations:[]}});
  const report = fs.readFileSync(path.join(dir,'report.html'),'utf8');
  assert.ok(report.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(report.includes('&lt;b&gt;value&lt;/b&gt;'));
  assert.equal(evidence.verify(dir).files,4);
  fs.writeFileSync(path.join(dir,frame.path),'changed');
  assert.throws(()=>evidence.verify(dir),/证据校验失败.*reference-keys-before/);
});
