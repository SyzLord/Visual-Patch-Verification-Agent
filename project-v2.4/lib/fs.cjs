'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {sha, InputError} = require('./manifest.cjs');

function json(file, value, {create = false} = {}) {
  const data = JSON.stringify(value, null, 2) + '\n';
  if (create) return fs.writeFileSync(file, data, {flag: 'wx'});
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readable(relative) {
  return relative.split('/').map(encodeURIComponent).join('/');
}

function inside(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') ||
    relative.includes(':') || relative.split('/').some(p => p === '..' || p === '.' || !p)) {
    throw new InputError('无效的证据路径：' + relative);
  }
  const result = path.resolve(root, relative);
  if (!result.startsWith(path.resolve(root) + path.sep)) throw new InputError('无效的证据路径');
  return result;
}

function pinned(directory, spec, max = 12 * 1024 * 1024) {
  const source = inside(directory, spec.path);
  const bytes = fs.readFileSync(source);
  if (bytes.length > max || sha(bytes) !== spec.sha256) throw new InputError('文件指纹不匹配：' + spec.path);
  return bytes;
}

function snapshot(job, input) {
  const paths = {suite: 'inputs/suite/suite.json', builds: {}};
  const index = [];
  function copy(target, bytes) {
    const file = inside(job, target);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    if (fs.existsSync(file)) {
      if (sha(fs.readFileSync(file)) !== sha(bytes)) throw new InputError('输入快照中出现同路径冲突：' + target);
      return;
    }
    fs.writeFileSync(file, bytes, {flag: 'wx'});
    index.push({path: target, sha256: sha(bytes), bytes: bytes.length});
  }
  copy(paths.suite, input.suite.bytes);
  for (const c of input.suite.value.cases) {
    copy('inputs/suite/' + c.fixture.path, pinned(input.suite.root, c.fixture, 512 * 1024));
  }
  for (const b of [input.reference, ...input.candidates]) {
    const dir = 'inputs/builds/' + b.value.id;
    const file = dir + '/build.json';
    paths.builds[b.value.id] = file;
    copy(file, b.bytes);
    for (const f of b.value.families) {
      for (const asset of f.assets) copy(dir + '/' + asset.path, pinned(b.root, asset));
    }
  }
  return {paths, index};
}

module.exports = {json, readJson, inside, readable, pinned, snapshot};
