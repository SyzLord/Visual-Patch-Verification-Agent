'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {launch} = require('../../project-v2.4/lib/browser.cjs');
const {menu} = require('../vpa-low-margin-2026-11-18/screen.cjs');
const {follow} = require('../vpa-substantive-2026-11-18/diagnosis/policy.cjs');
const {plan} = require('./route.cjs');
const {runAction, assess} = require('./fixture.cjs');
const {cases} = require('./cases.json');
const queue = require('./queue.json');

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (dir,file,data) => fs.writeFileSync(path.join(dir,file),JSON.stringify(data,null,2)+'\n',{flag:'wx'});

async function main() {
  const [ticket, output] = process.argv.slice(2);
  const config = cases.find(row=>row.id===ticket);
  assert.ok(config && output, 'usage: node live.cjs TICKET NEW_RUN_DIRECTORY');
  const source = queue.find(row=>row.number===Number(ticket) && row.family===config.family);
  const actions = menu(config.panel);
  const routing = plan(source.title,actions);
  assert.equal(routing.promoted,source.promoted);
  fs.mkdirSync(output);
  const inputs = {config,source,actions,routing};
  write(output,'inputs.json',inputs);
  const {browser,playwright} = await launch();
  const audit = {browser:browser.version(),playwright,reference:[],candidate:[],repeat:[],screenshots:[]};
  const run = async (version,id,evidence) => assess(config, await runAction(browser,config,version,id,evidence));
  try {
    for (const [role,version] of [['reference',config.fixed],['candidate',config.old]]) {
      for (const {id} of actions) {
        const save = (stage,bytes) => {
          const file = role+'-'+stage+'.png';
          fs.writeFileSync(path.join(output,file),bytes,{flag:'wx'});
          audit.screenshots.push({file,bytes:bytes.length,sha256:sha(bytes)});
        };
        audit[role].push(await run(version,id,id === config.target ? save : null));
      }
    }
    const failures = audit.candidate.filter(row=>!row.pass);
    for (const row of failures) audit.repeat.push(await run(config.old,row.action));
    audit.qualified = audit.reference.every(row=>row.pass) && failures.length === 1 &&
      [...failures,...audit.repeat].every(row=>row.action === config.target && row.publicFailure && !row.pass && !row.errors.length);
    write(output,'acceptance.json',audit);
    assert.ok(audit.qualified,'Panel did not qualify; consult acceptance.json');
    const results = {};
    for (const [method, order] of Object.entries(routing.orders)) {
      results[method] = {...await follow(order,id=>run(config.old,id),[config.target]),
        referenceActions:0, referenceImages:0, referenceBytes:0};
    }
    write(output,'results.json',results);
    console.log(ticket,Object.fromEntries(Object.entries(results).map(([key,data])=>[key,data.hit])));
  } catch (error) {
    write(output,'error.json',{message:error.message});
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
