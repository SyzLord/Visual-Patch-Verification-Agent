'use strict';
const fs = require('node:fs');
const path = require('node:path');
const html='<main><section id="plain"><label for="field">Travel date</label><input id="field"></section></main>';
const css='body{margin:0;color:#253241;background:white;font:16px Arial}main{margin:32px;width:328px}label,input{font:16px Arial;display:block}input{padding:4px}.flatpickr-calendar.open{position:relative!important;top:auto!important;left:0!important;animation:none!important}travel-range{display:block}';
async function setup(page,action,assets,ticket,config) {
  const shadowCSS=fs.readFileSync(path.join(assets,'style.css'),'utf8')+'\n'+css;
  await page.evaluate(({action,variant,shadowCSS})=>{
    const options={dateFormat:'Y-m-d',defaultDate:'2017-10-15',disableMobile:true};
    let field=document.querySelector('#field');
    if (action==='range') {
      document.querySelector('#plain').remove();
      class TravelRange extends HTMLElement {
        connectedCallback() {
          const root=this.attachShadow({mode:'open'});
          root.innerHTML='<style></style><label>Travel dates<input></label><div id="popup"></div>';
          root.querySelector('style').textContent=shadowCSS;
          const popup=root.querySelector('#popup');
          if (variant==='host') {
            this.projection=new MutationObserver(()=>{
              for (const child of [...this.children]) popup.append(child);
            });
            this.projection.observe(this,{childList:true});
          }
        }
      }
      customElements.define('travel-range',TravelRange);
      const host=document.createElement('travel-range');
      document.querySelector('main').append(host);
      field=host.shadowRoot.querySelector('input');
      Object.assign(options,{mode:'range',defaultDate:null,disable:['2017-10-22'],
        appendTo:variant==='host'?host:host.shadowRoot.querySelector('#popup')});
      document.addEventListener('click',event=>{
        window.targetInfo={element:event.target.localName,insideAppend:options.appendTo.contains(event.target)};
      },true);
    }
    if (action==='manual') options.allowInput=true;
    if (action==='time') Object.assign(options,{enableTime:true,time_24hr:true,dateFormat:'Y-m-d H:i',defaultDate:'2017-10-15 12:00'});
    window.control=field.flatpickr(options);
    window.control.open();
  },{action,variant:config.variant,shadowCSS});
}
const day=(page,number)=>page.locator('.flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)').filter({hasText:new RegExp('^'+number+'$')});
async function act(page,action,perform) {
  if (action==='ordinary') await perform('choose day 16',()=>day(page,16).click());
  if (action==='month') {
    for(const side of ['next','prev']) await perform(side+' month',()=>page.locator('.flatpickr-'+side+'-month').click());
  }
  if (action==='keys') {
    await perform('focus day 16',()=>day(page,16).focus());
    await perform('Enter',()=>page.keyboard.press('Enter'));
  }
  if (action==='manual') {
    await perform('replace date',()=>page.locator('#field').fill('2017-10-18'));
    await perform('commit with Enter',()=>page.locator('#field').press('Enter'));
  }
  if (action==='time') await perform('edit hour',()=>page.locator('.flatpickr-hour').fill('14'));
  if (action==='range') {
    const boxes = [];
    for (const value of [16,18]) {
      const rect=await day(page,value).boundingBox();
      if (!rect) throw Error('Initial range calendar was not visible');
      boxes.push({value,x:rect.x+rect.width/2,y:rect.y+rect.height/2});
    }
    for(const point of boxes) await perform('click endpoint '+point.value,()=>page.mouse.click(point.x,point.y));
  }
}
async function observe(page) {
  return page.evaluate(()=>{
    const api=window.control;
    return {open:api.isOpen,month:api.currentMonth+1,year:api.currentYear,value:api.input.value,
      days:api.selectedDates.map(date=>date.getDate()),hours:api.selectedDates.map(date=>date.getHours()),
      disabled22:[...api.calendarContainer.querySelectorAll('.flatpickr-day')].some(day=>
        day.dateObj?.getDate()===22 && day.classList.contains('disabled')),target:window.targetInfo??null};
  });
}
module.exports={html,css,setup,act,observe};
