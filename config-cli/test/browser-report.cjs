'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const {launch} = require('../lib/browser.cjs');
const {verify} = require('../lib/evidence.cjs');

async function main() {
  const suite = path.resolve(process.argv[2]);
  const output = path.resolve(process.argv[3]);
  fs.mkdirSync(output);
  const {browser} = await launch();
  try {
    const page = await browser.newPage({viewport:{width:1150,height:870}});
    await page.goto(pathToFileURL(path.join(suite,'index.html')).href);
    assert.equal(await page.locator('tbody tr').count(),2);
    await page.getByRole('link',{name:'flatpickr-2376'}).click();
    assert.match(page.url(),/2376\/report\.html$/);
    assert.match(await page.locator('section').first().innerText(),/预算内未中/);
    const firstEvidence = page.locator('details').filter({has:page.locator('summary').getByText('keys',{exact:false})}).first();
    await firstEvidence.locator('summary').click();
    assert.ok(await firstEvidence.getByText('逐步读数',{exact:true}).isVisible());
    await firstEvidence.locator('img').first().scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>[...document.querySelectorAll('details[open] img')].every(img=>img.complete && img.naturalWidth>0));
    await page.screenshot({path:path.join(output,'report-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
    const mode = await page.locator('.strategy td').first().evaluate(cell=>({
      display:getComputedStyle(cell).display,label:getComputedStyle(cell,'::before').content
    }));
    assert.deepEqual(mode,{display:'grid',label:'"首次命中"'});
    await page.locator('header').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,'report-mobile.png')});
    await page.goto(pathToFileURL(path.join(suite,'index.html')).href);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
    await page.getByRole('link',{name:'flatpickr-1661'}).click();
    assert.match(page.url(),/1661\/report\.html$/);
    assert.equal(verify(path.join(suite,'2376')).status,'regression');
    assert.equal(verify(path.join(suite,'1661')).status,'regression');
    console.log('PASS · report links, evidence details, PNG loading, mobile overflow');
  } finally {
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
