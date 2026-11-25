'use strict';
const path = require('node:path');
const {html, css, act:commonAction} = require('../vpa-substantive-2026-11-18/fixtures/flatpickr.cjs');
const {judge:commonJudge} = require('../vpa-substantive-2026-11-18/fixtures/flatpickr-oracle.cjs');
const {viewport,clip} = require('../vpa-substantive-2026-11-18/protocol.json');

async function runAction(browser, config, version, action, evidence) {
  const page = await browser.newPage({viewport, deviceScaleFactor:1, locale:'en-US', timezoneId:'UTC'});
  const errors = [], gestures = [], trace = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(3500);
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  const snapshot = () => page.screenshot({clip, animations:'disabled', caret:'hide'});
  const view = () => page.evaluate(() => {
    const ui = window.control;
    const active = document.activeElement;
    const other = document.querySelector('#other');
    return {open:ui.isOpen, year:ui.currentYear, month:ui.currentMonth + 1, value:ui.input.value,
      days:ui.selectedDates.map(d=>d.getDate()), hours:ui.selectedDates.map(d=>d.getHours()),
      active:active.id || (active === ui.altInput ? 'alt' : active.className || active.localName),
      otherValue:other.value, selection:other.selectionStart, end:other.selectionEnd, events:[...window.keyEvents]};
  });
  const perform = async (label, operation) => {
    await operation();
    gestures.push(label);
    await settle();
    trace.push(await view());
  };
  try {
    await page.route('**/*', route=>route.abort());
    await page.clock.setFixedTime(new Date('2017-10-15T12:00:00Z'));
    const before = '<label for="before">Previous field<input id="before" value="Before"></label>';
    const after = '<label for="other">Next field<input id="other" value="alpha beta"></label>';
    await page.setContent(html.replace('<section',before+'<section').replace('</main>',after+'</main>'));
    const assets = path.join(__dirname, 'assets', config.package + '-' + version);
    await page.addStyleTag({path:path.join(assets,'library.css')});
    await page.addStyleTag({content:css});
    await page.addScriptTag({path:path.join(assets,'library.js')});
    await page.evaluate(({config,action})=>{
      const keys = action === 'keys';
      const range = action === 'range';
      const time = action === 'time' || (keys && config.id === '1661');
      const options = {enableTime:time, time_24hr:true, disableMobile:true, allowInput:action==='manual',
        mode:range?'range':'single', disable:range?['2017-10-22']:[], dateFormat:time?'Y-m-d H:i':'Y-m-d',
        defaultDate:range?null:time?'2017-10-15 12:00':'2017-10-15'};
      if (keys && config.id === '2376') options.appendTo = document.body;
      if (keys && config.id === '1661') options.altInput = true;
      window.control = flatpickr('#field', options);
      window.keyEvents = [];
      document.addEventListener('keydown', e => window.keyEvents.push({
        key:e.key, target:e.target.id || e.target.className, prevented:e.defaultPrevented
      }));
      if (!keys) window.control.open();
    },{config,action});
    if (action === 'keys' && config.id === '2376') {
      await page.locator('#other').focus();
      await page.locator('#other').evaluate(field=>field.setSelectionRange(6,6));
    }
    if (action === 'keys' && config.id === '1661') await page.locator('#before').focus();
    await settle();
    const initial = await view();
    if (evidence) await evidence('before',await snapshot());
    if (action === 'keys' && config.id === '2376') {
      for (const key of ['ArrowLeft','ArrowRight']) await perform(key,()=>page.keyboard.press(key));
    } else if (action === 'keys' && config.id === '1661') {
      for (const key of ['Tab','ArrowRight','Enter','Tab','Tab','Tab'])
        await perform(key,()=>page.keyboard.press(key));
    } else if (action === 'time') {
      await perform('click hour',()=>page.locator('.flatpickr-hour').click());
      await perform('increment hour',()=>page.keyboard.press('ArrowUp'));
    } else {
      await commonAction(page,action,perform);
    }
    if (evidence) await evidence('after',await snapshot());
    return {action,initial,gestures,trace,errors};
  } finally {
    await page.close();
  }
}

function assess(config, row) {
  const {action, initial, trace} = row;
  const last = trace.at(-1);
  let pass, publicFailure = false;
  if (action === 'keys' && config.id === '2376') {
    const anchor = initial.active === 'other' && initial.selection === 6 && initial.end === 6 &&
      !initial.open && trace.every(s=>s.active === 'other' && s.otherValue === initial.otherValue);
    pass = anchor && trace[0].selection === 5 && trace[0].end === 5 && last.selection === 6 && last.end === 6 &&
      last.events.every(event=>!event.prevented);
    publicFailure = anchor && trace.every(s=>s.selection === 6 && s.end === 6) &&
      last.events.length === 2 && last.events.every(event=>event.target === 'other' && event.prevented);
  } else if (action === 'keys' && config.id === '1661') {
    const anchor = initial.active === 'before' && trace[0].active === 'alt' && trace[1].open && trace[2].days.includes(16);
    pass = anchor && trace.some(s=>s.active === 'other');
    publicFailure = anchor && !pass && last.active === 'before';
  } else if (action === 'range') {
    pass = trace[0].open && trace[0].days.join() === '16' && last.days.join() === '16,18';
  } else if (action === 'time') {
    pass = initial.hours[0] === 12 && last.hours[0] === 13;
  } else {
    pass = commonJudge(row).pass;
  }
  return {...row, pass:!!pass && !row.errors.length, publicFailure:!!publicFailure};
}

module.exports = {runAction,assess};
