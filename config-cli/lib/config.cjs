'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const sha = data => createHash('sha256').update(data).digest('hex');
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1000;
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
function ensure(test, label) {
  if (!test) throw new Error('配置无效 · ' + label);
}
function fields(value, keys, label) {
  ensure(isObject(value) && Object.keys(value).every(key => keys.includes(key)), label);
}
function list(value, min, max, label) {
  ensure(Array.isArray(value) && integer(value.length, min, max), label);
}
const identifier = /^[a-z0-9][a-z0-9-]{0,47}$/;
const digest = /^[a-f0-9]{64}$/;
const localPath = /^(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/;
const keyPattern = /^(?:(?:Shift|Control|Alt|Meta)\+){0,3}(?:Arrow(?:Up|Down|Left|Right)|Tab|Enter|Escape|Home|End|Space|Backspace|Delete|PageUp|PageDown|[0-9a-zA-Z])$/;
const readable = /^(?:open|year|month|value|days|hours|active|withinPicker|otherValue|selectionStart|selectionEnd|events\.length|events\.\d+\.(?:key|target|prevented))$/;

function checkAsset(spec, root, extension, label) {
  fields(spec, ['path', 'sha256'], label);
  const relative = spec.path;
  ensure(typeof relative === 'string' && localPath.test(relative) && !relative.split('/').some(s => s === '..' || s === '.') &&
    path.extname(relative) === extension && typeof spec.sha256 === 'string' && digest.test(spec.sha256), label);
  const actual = fs.realpathSync(path.join(root, relative));
  const rel = path.relative(root, actual);
  ensure(!rel.startsWith('..'+path.sep) && rel !== '..' && !path.isAbsolute(rel), label + ' 必须在套件目录内');
  const stat = fs.statSync(actual);
  ensure(stat.isFile() && stat.size <= 2_000_000, label + ' 文件或大小');
  const content = fs.readFileSync(actual);
  ensure(sha(content) === spec.sha256, label + ' SHA-256 不匹配');
  return content.toString('utf8');
}

function checkStep(step, label, setup) {
  const stepFields = {
    click:['selector','text'], focus:['selector'], fill:['selector','value'],
    press:['key','selector'], selectText:['selector','start','end']
  };
  ensure(isObject(step) && Object.hasOwn(stepFields, step.op), label + ' 动作类型');
  fields(step, ['op', ...stepFields[step.op]], label);
  ensure(step.op !== 'selectText' || setup, label + ' selectText 仅用于初始化');
  if (step.op !== 'press' || Object.hasOwn(step, 'selector')) ensure(isText(step.selector), label + ' selector');
  if (Object.hasOwn(step, 'text')) ensure(isText(step.text), label + ' text');
  if (step.op === 'fill') ensure(typeof step.value === 'string' && step.value.length <= 1000, label + ' value');
  if (step.op === 'press') ensure(typeof step.key === 'string' && keyPattern.test(step.key), label + ' key');
  if (step.op === 'selectText') ensure(integer(step.start, 0, 1000) && integer(step.end, step.start, 1000), label + ' text selection');
}

function checkAssertions(rows, steps, label) {
  list(rows, 1, 80, label);
  for (const [index, row] of rows.entries()) {
    const at = label + '[' + index + ']';
    fields(row, ['at','field','equals'], at);
    ensure(row.at === 'last' || integer(row.at, 0, steps), at + ' checkpoint');
    ensure(typeof row.field === 'string' && readable.test(row.field), at + ' field');
    ensure(Object.hasOwn(row, 'equals'), at + ' equals');
  }
}

function checkScenario(action, label) {
  fields(action.scenario, ['options','open','setup'], label + ' scenario');
  const {options, open, setup} = action.scenario;
  const bool = ['allowInput','altInput','enableTime','time_24hr','disableMobile'];
  const text = ['defaultDate','dateFormat','appendTo'];
  fields(options, [...bool,...text,'mode','disable'], label + ' options');
  for (const [key, value] of Object.entries(options)) {
    if (bool.includes(key)) ensure(typeof value === 'boolean', label + ' ' + key);
    if (text.includes(key)) ensure(isText(value) || key === 'defaultDate' && value === null, label + ' ' + key);
    if (key === 'mode') ensure(['single','range','multiple'].includes(value), label + ' mode');
    if (key === 'disable') ensure(Array.isArray(value) && value.length <= 100 && value.every(isText), label + ' disable');
  }
  ensure(typeof open === 'boolean', label + ' open');
  list(setup, 0, 8, label + ' setup');
  setup.forEach((step, i) => checkStep(step, label + ' setup['+i+']', true));
  list(action.steps, 1, 12, label + ' steps');
  action.steps.forEach((step, i) => checkStep(step, label + ' steps['+i+']', false));
  checkAssertions(action.expect, action.steps.length, label + ' expect');
  if (Object.hasOwn(action, 'failure')) checkAssertions(action.failure, action.steps.length, label + ' failure');
}

function loadConfig(file) {
  const fullPath = fs.realpathSync(file);
  const root = path.dirname(fullPath);
  const stat = fs.statSync(fullPath);
  ensure(stat.isFile() && stat.size <= 400_000, '配置文件大小');
  const raw = fs.readFileSync(fullPath);
  const spec = JSON.parse(raw);
  fields(spec, ['schema','id','ticket','budget','fixture','builds','keyboardAction','actions'], '套件');
  ensure(spec.schema === 1 && typeof spec.id === 'string' && identifier.test(spec.id), 'schema / id');
  fields(spec.ticket, ['title','issue','repair'], '工单');
  ensure(isText(spec.ticket.title), '工单名称');
  for (const key of ['issue','repair']) {
    ensure(isText(spec.ticket[key]) && /^https:\/\//.test(spec.ticket[key]) && new URL(spec.ticket[key]).hostname, key);
  }
  fields(spec.fixture, ['adapter','html','css','input','other','clock'], '本地页面');
  const fixture = spec.fixture;
  ensure(fixture.adapter === 'flatpickr' && isText(fixture.input) && isText(fixture.other), '页面适配器和输入选择器');
  ensure(typeof fixture.clock === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(fixture.clock) &&
    Number.isFinite(Date.parse(fixture.clock)), '固定时钟');
  const container = {html:checkAsset(fixture.html, root, '.html', '本地 HTML'),
    css:checkAsset(fixture.css, root, '.css', '本地 CSS')};
  fields(spec.builds, ['reference','candidate'], '版本');
  const builds = {};
  for (const role of ['reference','candidate']) {
    const build = spec.builds[role];
    fields(build, ['version','script','style'], role);
    ensure(isText(build.version), role + ' version');
    builds[role] = {script:checkAsset(build.script, root, '.js', role + ' JS'),
      style:checkAsset(build.style, root, '.css', role + ' CSS')};
  }
  ensure(spec.builds.reference.version !== spec.builds.candidate.version, '版本标签必须不同');
  list(spec.actions, 3, 30, '动作菜单');
  ensure(spec.actions[0]?.id === 'ordinary', '首项须为 ordinary');
  ensure(integer(spec.budget, 2, spec.actions.length), '三策略共用预算');
  const ids = new Set();
  for (const action of spec.actions) {
    fields(action, ['id','description','scenario','steps','expect','failure'], '动作');
    ensure(typeof action.id === 'string' && identifier.test(action.id) && !ids.has(action.id) && isText(action.description), '动作名称或重复 ID');
    ids.add(action.id);
    ensure(action.id !== 'ordinary' || !Object.hasOwn(action, 'failure'), '冒烟动作不接受已知失败签名');
    checkScenario(action, action.id);
  }
  ensure(spec.keyboardAction === null || spec.keyboardAction !== 'ordinary' && ids.has(spec.keyboardAction), 'keyboardAction');
  return {spec, container, builds, configSha256:sha(raw)};
}
module.exports = {loadConfig, sha};
