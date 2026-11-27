'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function resolvePlaywright() {
  if (process.env.PLAYWRIGHT_PATH) return require.resolve(process.env.PLAYWRIGHT_PATH);
  try {
    return require.resolve('playwright');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    if (fs.existsSync(bundled)) return require.resolve(bundled);
    throw error;
  }
}

async function launch() {
  const modulePath = resolvePlaywright();
  const playwright = require(modulePath);
  const {version} = require(path.join(path.dirname(modulePath), 'package.json'));
  const browser = await playwright.chromium.launch({channel:'chrome', headless:true});
  return {browser, playwright:version};
}

async function perform(page, step) {
  let element = step.selector ? page.locator(step.selector) : null;
  if (step.text !== undefined) {
    const literal = step.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    element = element.filter({hasText:new RegExp('^'+literal+'$')});
  }
  switch (step.op) {
    case 'click': return element.click();
    case 'focus': return element.focus();
    case 'fill': return element.fill(step.value);
    case 'press': return element ? element.press(step.key) : page.keyboard.press(step.key);
    case 'selectText': return element.evaluate((field, [start,end])=>field.setSelectionRange(start,end), [step.start,step.end]);
  }
  throw new Error('未知动作');
}

async function prepare(page, fixture, scenario) {
  await page.evaluate(({selector,adapter,scenario})=>{
    const options = {...scenario.options};
    if (options.appendTo) {
      const target = document.querySelector(options.appendTo);
      if (!target) throw new Error('appendTo 容器不存在');
      options.appendTo = target;
    }
    const input = document.querySelector(selector);
    if (!input) throw new Error('日期输入框不存在');
    if (options.secondInput) {
      options.plugins = [new window.rangePlugin({input:options.secondInput})];
      delete options.secondInput;
    }
    if (adapter === 'air-datepicker') {
      if (options.selectedDates) options.selectedDates = options.selectedDates.map(date=>new Date(date));
      window.control = new window.AirDatepicker(input,{startDate:new Date(),...options});
    } else {
      window.control = window.flatpickr(input,options);
    }
    window.events = [];
    document.addEventListener('keydown', event=>window.events.push({
      key:event.key, target:event.target.id || event.target.className, prevented:event.defaultPrevented
    }));
    if (scenario.open) {
      if (adapter === 'air-datepicker') window.control.show();
      else window.control.open();
    }
  }, {selector:fixture.input,adapter:fixture.adapter,scenario});
}

function observe(page, fixture, pageErrors) {
  return page.evaluate(({selector,adapter,uiErrorNames})=>{
    const ui = window.control;
    const air = adapter === 'air-datepicker';
    const picker = air ? ui.$datepicker : ui.calendarContainer;
    const input = air ? ui.$el : ui.input;
    const hour = air ? picker?.querySelector('input[name="hours"]') : ui.hourElement;
    const active = document.activeElement;
    const other = document.querySelector(selector);
    if (!other) throw new Error('观察用输入框不存在');
    return {
      open:air ? ui.visible : ui.isOpen,
      month:(air ? ui.viewDate.getMonth() : ui.currentMonth)+1, year:air ? ui.viewDate.getFullYear() : ui.currentYear, value:input.value,
      days:ui.selectedDates.map(date=>date.getDate()), hours:ui.selectedDates.map(date=>date.getHours()),
      active:active.id || (active === ui.altInput ? 'alt' : active.className || active.localName),
      withinPicker:active === input || active === ui.altInput || !!picker?.contains(active),
      otherValue:other.value, selectionStart:other.selectionStart, selectionEnd:other.selectionEnd,
      events:[...window.events], hourField:hour?.value ?? null,
      inRange:picker?.querySelectorAll('.-in-range-').length ?? 0, uiErrorNames
    };
  },{selector:fixture.other,adapter:fixture.adapter,uiErrorNames:pageErrors.map(error=>error.name)});
}

async function probe(browser, bundle, role, action, capture) {
  const errors = [], pageErrors = [], states = [], frames = [];
  let performed = 0;
  let context;
  try {
    context = await browser.newContext({viewport:{width:640,height:420}, locale:'en-US', timezoneId:'UTC',
      deviceScaleFactor:1, serviceWorkers:'block'});
    await context.route('**/*', route=>route.abort());
    await context.routeWebSocket('**/*', socket=>socket.close());
    const page = await context.newPage();
    page.on('pageerror', error=>pageErrors.push({name:error.name,message:error.message,stack:error.stack}));
    page.setDefaultTimeout(3500);
    const settle = () => page.evaluate(() => new Promise(resolve=>requestAnimationFrame(()=>
      requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
    const snapshot = () => page.screenshot({clip:{x:24,y:24,width:360,height:220}, animations:'disabled',caret:'hide'});
    const fixture = bundle.spec.fixture;
    const build = bundle.builds[role];
    await page.clock.setFixedTime(new Date(fixture.clock));
    await page.setContent(bundle.container.html, {waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:build.style});
    await page.addStyleTag({content:bundle.container.css});
    await page.addScriptTag({content:build.script});
    if (action.scenario.options.secondInput) await page.addScriptTag({content:build.plugin});
    await prepare(page, fixture, action.scenario);
    for (const step of action.scenario.setup) await perform(page,step);
    await settle();
    states.push(await observe(page,fixture,pageErrors));
    if (capture) frames.push(capture('before',await snapshot()));
    for (const step of action.steps) {
      await perform(page,step);
      performed++;
      await settle();
      states.push(await observe(page,fixture,pageErrors));
    }
    if (capture) frames.push(capture('after',await snapshot()));
  } catch (error) {
    errors.push(error.message);
  } finally {
    if (context) {
      try { await context.close(); } catch (error) { errors.push(error.message); }
    }
  }
  return {action:action.id, performed, states, errors, pageErrors, frames};
}
module.exports = {launch, probe};
