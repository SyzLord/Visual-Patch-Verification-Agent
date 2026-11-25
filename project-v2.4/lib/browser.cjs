'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {isDeepStrictEqual} = require('node:util');
const {sha} = require('./manifest.cjs');
const {inside, pinned} = require('./fs.cjs');

const captureCosts = {frames: 0, bytes: 0, ms: 0};
const defaults = Object.freeze({timeout: 2600, width: 640, height: 420, locale: 'en-US', timezone: 'UTC',
  time: '2022-10-13T12:00:00Z'});

function browserRuntime() {
  const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const from = process.env.PLAYWRIGHT_PATH || (fs.existsSync(bundled) ? bundled : 'playwright');
  try {
    return {api: require(from), version: require(path.join(path.dirname(require.resolve(from)), 'package.json')).version};
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error('缺少 Playwright。可设置 PLAYWRIGHT_PATH 使用本机已有安装。', {cause: error});
    }
    throw error;
  }
}

async function launch() {
  const {api, version} = browserRuntime();
  // The task runner drains in-flight checks before closing the browser.
  const browser = await api.chromium.launch({channel: 'chrome', headless: true,
    handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false});
  return {browser, playwright: version};
}

async function perform(page, step) {
  const loc = page.locator(step.selector);
  switch (step.op) {
    case 'click': await loc.click(step.position ? {position: step.position} : {}); break;
    case 'fill': await loc.fill(step.value); break;
    case 'press': await loc.press(step.key); break;
    case 'select': await loc.selectOption({value: step.value}); break;
    case 'check': await loc.check(); break;
    case 'uncheck': await loc.uncheck(); break;
    case 'focus': await loc.focus(); break;
    case 'waitFor': await loc.waitFor({state: step.state}); break;
    default: throw new Error('未实现的操作');
  }
}

async function observe(page, spec) {
  const loc = page.locator(spec.selector);
  switch (spec.kind) {
    case 'text': return (await loc.textContent()).trim();
    case 'texts': return (await loc.allTextContents()).map(s => s.trim());
    case 'value': return loc.inputValue();
    case 'values': return loc.evaluate(el => [...el.selectedOptions].map(x => x.value));
    case 'attribute': return loc.getAttribute(spec.name);
    case 'visible': return loc.isVisible();
    case 'count': return loc.count();
    default: throw new Error('未实现的读数');
  }
}

function compare(actual, operator, expected) {
  if (operator === 'equals') return isDeepStrictEqual(actual, expected);
  if (operator === 'contains') return (typeof actual === 'string' || Array.isArray(actual)) && actual.includes(expected);
  if (operator === 'atLeast') return typeof actual === 'number' && actual >= expected;
  if (operator === 'atMost') return typeof actual === 'number' && actual <= expected;
  throw new Error('未实现的判据');
}

function errorMessage(error) {
  return String(error?.message || error).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 1600);
}

async function probe(browser, suite, build, c, action, job, prefix, capture) {
  let context;
  const errors = [];
  const row = {action: action.id, pass: null, checks: [], frames: {}};
  async function frame(page, phase) {
    const relative = prefix + '/' + action.id + '-' + phase + '.png';
    const file = inside(job, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const start = performance.now();
    const buffer = await page.screenshot({animations: 'disabled', path: file, timeout: 3500});
    captureCosts.ms += performance.now() - start;
    captureCosts.frames++;
    captureCosts.bytes += buffer.length;
    row.frames[phase] = {path: relative, sha256: sha(buffer), bytes: buffer.length};
  }
  try {
    context = await browser.newContext({
      viewport: {width: defaults.width, height: defaults.height}, deviceScaleFactor: 1,
      locale: defaults.locale, timezoneId: defaults.timezone, reducedMotion: 'reduce', serviceWorkers: 'block'
    });
    await context.route('**/*', route => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(defaults.timeout);
    await page.clock.setFixedTime(new Date(defaults.time));
    page.on('pageerror', error => errors.push(errorMessage(error)));
    await page.setContent(pinned(suite.root, c.fixture, 512 * 1024).toString('utf8'), {waitUntil: 'domcontentloaded'});
    const family = build.value.families.find(f => f.id === c.family);
    for (const asset of family.assets) {
      const content = pinned(build.root, asset).toString('utf8');
      if (asset.type === 'script') await page.addScriptTag({content});
      else await page.addStyleTag({content});
    }
    await page.evaluate(() => {
      if (typeof window.initializeFixture === 'function') window.initializeFixture();
    });
    for (const step of c.setup) await perform(page, step);
    if (capture) await frame(page, 'pre');
    for (const step of action.steps) await perform(page, step);
    for (const check of action.checks) {
      const actual = await observe(page, check.read);
      row.checks.push({id: check.id, actual, op: check.op, expected: check.expected,
        pass: compare(actual, check.op, check.expected)});
    }
    if (capture) await frame(page, 'post');
    if (errors.length) throw new Error('页面执行异常：' + errors[0]);
    row.pass = row.checks.every(c => c.pass);
  } catch (error) {
    row.error = errorMessage(error);
    row.pass = null;
  } finally {
    try {
      if (context) await context.close();
    } catch (error) {
      row.error = errorMessage(error);
      row.pass = null;
    }
  }
  return row;
}

module.exports = {captureCosts, defaults, launch, probe, compare, errorMessage};
