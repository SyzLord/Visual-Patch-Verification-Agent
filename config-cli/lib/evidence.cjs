'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {sha} = require('./config.cjs');
const {render} = require('./report.cjs');
const {isDeepStrictEqual} = require('node:util');

const json = value => JSON.stringify(value,null,2)+'\n';
const save = (output,file,data)=>fs.writeFileSync(path.join(output,file),data,{flag:'wx'});
const describe = (file,data)=>({path:file,bytes:data.length,sha256:sha(data)});
const allowedFile = /^(?:inputs\.json|result\.json|report\.html|(?:reference|candidate|confirmation)-[a-z0-9][a-z0-9-]{0,47}-(?:before|after)\.png)$/;

function start(output, config, configSha256, plan) {
  fs.mkdirSync(output);
  const inputs = {config,configSha256,plan};
  save(output,'inputs.json',json(inputs));
  return inputs;
}

function capture(output, phase, action) {
  return (stage,buffer)=>{
    const file = phase+'-'+action+'-'+stage+'.png';
    save(output,file,buffer);
    return {stage,...describe(file,buffer)};
  };
}

function finish(output, result) {
  save(output,'result.json',json(result));
  save(output,'report.html',render(result));
  const files = fs.readdirSync(output).filter(name=>allowedFile.test(name)).sort()
    .map(name=>describe(name,fs.readFileSync(path.join(output,name))));
  save(output,'manifest.json',json({schema:1,files}));
}

function verify(output) {
  const read = name=>fs.readFileSync(path.join(output,name));
  const manifest = JSON.parse(read('manifest.json'));
  const required = ['inputs.json','result.json','report.html'];
  if (manifest.schema!==1 || !Array.isArray(manifest.files)) throw Error('证据清单版本无效');
  const names = new Set();
  for (const file of manifest.files) {
    const name = file.path;
    if (typeof name !== 'string' || !allowedFile.test(name) || names.has(name) ||
        !fs.lstatSync(path.join(output,name)).isFile() || !isDeepStrictEqual(describe(name,read(name)),file)) {
      throw Error('证据校验失败 · '+name);
    }
    names.add(name);
  }
  if (required.some(name=>!names.has(name)) || fs.readdirSync(output).some(name=>name!=='manifest.json' && !names.has(name))) {
    throw Error('证据文件与清单不一致');
  }
  const inputs = JSON.parse(read('inputs.json'));
  const result = JSON.parse(read('result.json'));
  for (const key of ['config','configSha256','plan']) {
    if (!isDeepStrictEqual(inputs[key],result[key])) throw Error('运行输入与结果不一致 · '+key);
  }
  const records = [...result.acceptance.reference,...result.acceptance.candidate,...result.acceptance.confirmations];
  const linked = new Set(required);
  const indexed = new Map(manifest.files.map(file=>[file.path,file]));
  for (const row of records) {
    for (const {stage,...file} of row.frames) {
      if (linked.has(file.path) || !isDeepStrictEqual(indexed.get(file.path),file)) {
        throw Error('截图索引与证据清单不一致 · '+file.path);
      }
      linked.add(file.path);
    }
  }
  if (linked.size!==names.size) throw Error('存在未索引的证据文件');
  return {files:names.size,status:result.status};
}

module.exports = {start,capture,finish,verify};
