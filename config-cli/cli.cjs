'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {loadConfig} = require('./lib/config.cjs');
const {plan} = require('./lib/ranking.cjs');
const {assess,accept,compare} = require('./lib/acceptance.cjs');
const evidence = require('./lib/evidence.cjs');
const {renderIndex} = require('./lib/report.cjs');
const {launch,probe} = require('./lib/browser.cjs');

const help = '用法\n  node cli.cjs validate <case.json>\n  node cli.cjs plan <case.json>\n  node cli.cjs run <case.json> <新输出目录>\n  node cli.cjs verify <输出目录>\n  node cli.cjs index <新 HTML 文件> <输出目录> [...]';

async function run(bundle, output, routes) {
  const spec = bundle.spec;
  const inputs = evidence.start(output,spec,bundle.configSha256,routes);
  const result = {...inputs,browser:null,status:'inconclusive',
    acceptance:{reference:[],candidate:[],confirmations:[],confirmed:[],status:'inconclusive'},comparisons:{}};
  let browser;
  try {
    const runtime = await launch();
    ({browser} = runtime);
    result.browser = {chrome:browser.version(),playwright:runtime.playwright};
    const execute = async (role,action,phase)=>{
      const save = phase && action.failure ? evidence.capture(output,phase,action.id) : null;
      return assess(action,await probe(browser,bundle,role,action,save));
    };
    result.acceptance = await accept(spec.actions,execute);
    result.comparisons = await compare(spec,routes,result.acceptance,execute);
    result.status = Object.values(result.comparisons).every(row=>row.consistent) ? result.acceptance.status : 'inconclusive';
  } catch (error) {
    result.error = error.message;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (error) {
        result.status = 'inconclusive';
        result.error ??= error.message;
      }
    }
  }
  evidence.finish(output,result);
  const hits = Object.fromEntries(Object.entries(result.comparisons).map(([method,row])=>[method,row.firstHit]));
  console.log(JSON.stringify({id:spec.id,status:result.status,hits,report:path.join(output,'report.html')},null,2));
  return {pass:0,regression:1,inconclusive:2}[result.status];
}

async function main(args) {
  const [command,file,output] = args;
  if (!command || command==='--help') {
    console.log(help);
    return 0;
  }
  if (command==='index' && args.length>=3) {
    if (path.extname(file)!=='.html') throw Error('索引路径须以 .html 结尾');
    const root = path.dirname(path.resolve(file));
    const runs = args.slice(2).map(directory=>{
      evidence.verify(directory);
      const run = JSON.parse(fs.readFileSync(path.join(directory,'result.json')));
      const href = path.relative(root,path.resolve(directory,'report.html')).split(path.sep).map(encodeURIComponent).join('/');
      return {run,href};
    });
    fs.writeFileSync(file,renderIndex(runs),{flag:'wx'});
    console.log(file);
    return 0;
  }
  const arity = {validate:2,plan:2,run:3,verify:2};
  if (!Object.hasOwn(arity,command) || args.length!==arity[command]) throw Error(help);
  if (command==='verify') {
    console.log(JSON.stringify(evidence.verify(file),null,2));
    return 0;
  }
  const bundle = loadConfig(file);
  if (command==='validate') {
    console.log(JSON.stringify({id:bundle.spec.id,actions:bundle.spec.actions.length,configSha256:bundle.configSha256},null,2));
    return 0;
  }
  const routes = plan(bundle.spec);
  if (command==='plan') {
    console.log(JSON.stringify(routes,null,2));
    return 0;
  }
  return run(bundle,path.resolve(output),routes);
}
main(process.argv.slice(2)).then(code=>{process.exitCode=code;}).catch(error=>{
  console.error(error.message);
  process.exitCode=2;
});
