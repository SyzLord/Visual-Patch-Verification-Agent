'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const projectRoot = path.resolve(__dirname, '..');
const idPattern = /^[a-z][a-z0-9-]{0,47}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const limits = {cases: 24, actions: 8, steps: 18, candidates: 16, assets: 18};
const operations = new Set(['click', 'fill', 'press', 'select', 'check', 'uncheck', 'focus', 'waitFor']);
const measurements = new Set(['text', 'texts', 'value', 'values', 'attribute', 'visible', 'count']);
const ops = new Set(['equals', 'contains', 'atLeast', 'atMost']);
const tags = new Set(['parameter', 'composition', 'order', 'simplify', 'default', 'disable', 'context', 'reported']);
const sha = value => createHash('sha256').update(value).digest('hex');

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputError';
  }
}

function requireValue(condition, field, message) {
  if (!condition) throw new InputError(field + '：' + message);
}

function object(value, field, keys) {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), field, '需要对象');
  for (const key of Object.keys(value)) {
    requireValue(keys.includes(key), field + '.' + key, '未知字段');
  }
}

function string(value, field, max = 200) {
  requireValue(typeof value === 'string' && value.length > 0 && value.length <= max,
    field, '需要 1–' + max + ' 个字符');
}

function identifier(value, field) {
  requireValue(typeof value === 'string' && idPattern.test(value), field, '使用小写字母、数字和连字符');
}

function array(value, field, min, max) {
  requireValue(Array.isArray(value) && value.length >= min && value.length <= max,
    field, '需要 ' + min + '–' + max + ' 项');
}

function unique(items, field) {
  requireValue(new Set(items).size === items.length, field, '包含重复项');
}

function readObject(file) {
  const absolute = path.resolve(file);
  let bytes;
  try {
    requireValue(fs.statSync(absolute).isFile(), absolute, '需要普通文件');
    requireValue(fs.statSync(absolute).size <= 512 * 1024, absolute, '清单过大');
    bytes = fs.readFileSync(absolute);
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError('无法读取清单 ' + absolute + '：' + error.code);
  }
  try {
    return {file: fs.realpathSync(absolute), bytes, value: JSON.parse(bytes)};
  } catch {
    throw new InputError('无效 JSON：' + absolute);
  }
}

function localFile(root, value, field, ext, maxBytes) {
  string(value, field, 400);
  requireValue(!path.isAbsolute(value) && !value.includes('\\') && !value.includes(':') &&
    !value.split('/').some(part => !part || part === '.' || part === '..') && path.extname(value).toLowerCase() === ext,
  field, '需要目录内的 ' + ext + ' 相对路径');
  let actual;
  try {
    actual = fs.realpathSync(path.resolve(root, value));
    requireValue(!path.relative(root, actual).startsWith('..') && !path.isAbsolute(path.relative(root, actual)),
      field, '文件须位于清单目录内');
    const stat = fs.statSync(actual);
    requireValue(stat.isFile() && stat.size <= maxBytes, field, '文件不存在或过大');
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError(field + '：无法打开 ' + value);
  }
  return actual;
}

function fixture(root, spec, field, verify) {
  object(spec, field, ['path', 'sha256']);
  requireValue(typeof spec.sha256 === 'string' && digestPattern.test(spec.sha256), field + '.sha256', '需要 SHA-256');
  const file = localFile(root, spec.path, field + '.path', '.html', 512 * 1024);
  if (verify) requireValue(sha(fs.readFileSync(file)) === spec.sha256, field, '夹具指纹不匹配');
}

function steps(value, field, min) {
  array(value, field, min, limits.steps);
  for (const [i, step] of value.entries()) {
    const at = field + '[' + i + ']';
    object(step, at, ['op', 'selector', 'value', 'key', 'position', 'state']);
    requireValue(operations.has(step.op), at + '.op', '不支持的操作');
    string(step.selector, at + '.selector', 450);
    const fields = ['op', 'selector'];
    if (['fill', 'select'].includes(step.op)) {
      requireValue(typeof step.value === 'string' && step.value.length <= 2000, at + '.value', '需要短字符串');
      fields.push('value');
    }
    if (step.op === 'press') {
      string(step.key, at + '.key', 35);
      fields.push('key');
    }
    if (step.op === 'click' && step.position !== undefined) {
      object(step.position, at + '.position', ['x', 'y']);
      for (const k of ['x', 'y']) {
        requireValue(Number.isFinite(step.position[k]) && step.position[k] >= 0 && step.position[k] <= 4096,
          at + '.position.' + k, '需要 0–4096 的坐标');
      }
      fields.push('position');
    }
    if (step.op === 'waitFor') {
      requireValue(['visible', 'hidden', 'attached', 'detached'].includes(step.state), at + '.state', '不支持的等待状态');
      fields.push('state');
    }
    object(step, at, fields);
  }
}

function check(value, field) {
  object(value, field, ['id', 'read', 'op', 'expected']);
  identifier(value.id, field + '.id');
  object(value.read, field + '.read', ['kind', 'selector', 'name']);
  requireValue(measurements.has(value.read.kind), field + '.read.kind', '不支持的读数类型');
  string(value.read.selector, field + '.read.selector', 450);
  if (value.read.kind === 'attribute') {
    string(value.read.name, field + '.read.name', 90);
  } else {
    requireValue(value.read.name === undefined, field + '.read.name', '只适用于 attribute');
  }
  requireValue(ops.has(value.op), field + '.op', '不支持的判据');
  const type = {text: 'string', texts: 'array', value: 'string', values: 'array', attribute: 'nullable-string',
    visible: 'boolean', count: 'number'}[value.read.kind];
  const expected = value.expected;
  if (value.op === 'equals') {
    const matches = type === 'array' ? Array.isArray(expected) && expected.length <= 80 &&
      expected.every(e => typeof e === 'string' && e.length <= 2000)
      : type === 'nullable-string' ? expected === null || (typeof expected === 'string' && expected.length <= 2000)
        : type === 'number' ? Number.isInteger(expected) && expected >= 0
          : typeof expected === type && (type !== 'string' || expected.length <= 2000);
    requireValue(matches, field + '.expected', '与读数类型不匹配');
  } else if (value.op === 'contains') {
    requireValue(['array', 'nullable-string', 'string'].includes(type), field + '.op', '只能检查文字或列表');
    string(expected, field + '.expected', 2000);
  } else {
    requireValue(type === 'number' && Number.isInteger(expected) && expected >= 0, field + '.expected', '需要非负计数');
  }
}

function loadSuite(file, {verify = true} = {}) {
  const {file: actual, bytes, value} = readObject(file);
  const root = path.dirname(actual);
  object(value, 'suite', ['schema', 'id', 'title', 'cases']);
  requireValue(value.schema === 1, 'suite.schema', '需要版本 1');
  identifier(value.id, 'suite.id');
  string(value.title, 'suite.title');
  array(value.cases, 'suite.cases', 1, limits.cases);
  for (const [i, c] of value.cases.entries()) {
    const field = 'suite.cases[' + i + ']';
    object(c, field, ['id', 'family', 'title', 'issue', 'source', 'fixture', 'setup', 'first', 'actions']);
    identifier(c.id, field + '.id');
    identifier(c.family, field + '.family');
    string(c.title, field + '.title');
    string(c.issue, field + '.issue', 2000);
    if (c.source !== undefined) {
      string(c.source, field + '.source', 350);
      requireValue(/^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/issues\/\d+$/.test(c.source),
        field + '.source', '需要上游 GitHub 工单链接');
    }
    fixture(root, c.fixture, field + '.fixture', verify);
    steps(c.setup, field + '.setup', 0);
    identifier(c.first, field + '.first');
    array(c.actions, field + '.actions', 1, limits.actions);
    for (const [j, a] of c.actions.entries()) {
      const at = field + '.actions[' + j + ']';
      object(a, at, ['id', 'description', 'tags', 'steps', 'checks', 'region']);
      identifier(a.id, at + '.id');
      string(a.description, at + '.description', 400);
      if (a.region !== undefined) {
        array(a.region, at + '.region', 4, 4);
        const [left, top, right, bottom] = a.region;
        requireValue(a.region.every(n => Number.isFinite(n) && n >= 0 && n <= 1) &&
          left < right && top < bottom, at + '.region', '需要归一化的左、上、右、下坐标');
      }
      array(a.tags, at + '.tags', 1, 7);
      requireValue(a.tags.every(tag => tags.has(tag)), at + '.tags', '不支持的动作标签');
      unique(a.tags, at + '.tags');
      steps(a.steps, at + '.steps', 0);
      array(a.checks, at + '.checks', 1, 8);
      a.checks.forEach((item, k) => check(item, at + '.checks[' + k + ']'));
      unique(a.checks.map(item => item.id), at + '.checks');
    }
    unique(c.actions.map(a => a.id), field + '.actions');
    requireValue(c.actions.some(a => a.id === c.first), field + '.first', '必须是已声明的动作');
  }
  unique(value.cases.map(c => c.id), 'suite.cases');
  return {file: actual, root, bytes, sha256: sha(bytes), value};
}

function loadBuild(file, {verify = true} = {}) {
  const {file: actual, bytes, value} = readObject(file);
  const root = path.dirname(actual);
  object(value, 'build', ['schema', 'id', 'title', 'families']);
  requireValue(value.schema === 1, 'build.schema', '需要版本 1');
  identifier(value.id, 'build.id');
  string(value.title, 'build.title');
  array(value.families, 'build.families', 1, 12);
  for (const [i, f] of value.families.entries()) {
    const field = 'build.families[' + i + ']';
    object(f, field, ['id', 'version', 'assets']);
    identifier(f.id, field + '.id');
    string(f.version, field + '.version', 80);
    array(f.assets, field + '.assets', 1, limits.assets);
    for (const [j, a] of f.assets.entries()) {
      const at = field + '.assets[' + j + ']';
      object(a, at, ['type', 'path', 'sha256']);
      requireValue(['script', 'style'].includes(a.type), at + '.type', '需要 script 或 style');
      requireValue(typeof a.sha256 === 'string' && digestPattern.test(a.sha256), at + '.sha256', '需要 SHA-256');
      const file = localFile(root, a.path, at + '.path', a.type === 'script' ? '.js' : '.css', 12 * 1024 * 1024);
      if (verify) requireValue(sha(fs.readFileSync(file)) === a.sha256, at, '构建文件指纹不匹配');
    }
    unique(f.assets.map(a => a.path), field + '.assets');
  }
  unique(value.families.map(f => f.id), 'build.families');
  return {file: actual, root, bytes, sha256: sha(bytes), value};
}

function option(value = {}) {
  object(value, 'options', ['mode', 'pairs', 'steps', 'seed', 'concurrency']);
  const {mode = 'blind', pairs = 1, steps: budget = 3, seed = 'demo', concurrency = 2} = value;
  requireValue(['blind', 'bm25', 'capped', 'fixed', 'regional', 'residual', 'registered'].includes(mode), 'options.mode', '需要 blind、bm25、capped、fixed、regional、residual 或 registered');
  requireValue(Number.isInteger(pairs) && pairs >= 0 && pairs <= 2, 'options.pairs', '需要 0–2');
  requireValue(Number.isInteger(budget) && budget >= 1 && budget <= 3, 'options.steps', '需要 1–3');
  requireValue(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 4, 'options.concurrency', '需要 1–4');
  string(seed, 'options.seed', 100);
  requireValue(seed.trim().length > 0, 'options.seed', '不可全为空白');
  return {mode, pairs: ['capped', 'regional', 'residual', 'registered'].includes(mode) ? pairs : 0, steps: budget, seed, concurrency};
}

function loadPlan(file, overrides = {}) {
  const plan = readObject(file);
  const root = path.dirname(plan.file);
  const v = plan.value;
  object(v, 'plan', ['schema', 'suite', 'reference', 'candidates', 'options']);
  requireValue(v.schema === 1, 'plan.schema', '需要版本 1');
  const readPath = (item, field) => {
    string(item, field, 400);
    requireValue(!item.includes('\\') && path.extname(item) === '.json', field, '需要 JSON 文件路径');
    return path.resolve(root, item);
  };
  array(v.candidates, 'plan.candidates', 1, limits.candidates);
  const suite = loadSuite(readPath(v.suite, 'plan.suite'));
  const reference = loadBuild(readPath(v.reference, 'plan.reference'));
  const candidates = v.candidates.map((item, i) => loadBuild(readPath(item, 'plan.candidates[' + i + ']')));
  unique([reference, ...candidates].map(b => b.value.id), 'plan.builds');
  for (const b of [reference, ...candidates]) {
    for (const c of suite.value.cases) {
      requireValue(b.value.families.some(f => f.id === c.family), b.value.id, '缺少 ' + c.family + ' 构建');
    }
  }
  if (v.options !== undefined) object(v.options, 'plan.options', ['mode', 'pairs', 'steps', 'seed', 'concurrency']);
  const options = option({...v.options, ...overrides});
  return {suite, reference, candidates, options, sha256: sha(plan.bytes)};
}

module.exports = {InputError, idPattern, limits, sha, projectRoot, loadPlan, loadBuild, loadSuite, option, readObject};
