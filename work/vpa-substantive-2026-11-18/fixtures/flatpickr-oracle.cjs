'use strict';
const same=(actual,expected)=>JSON.stringify(actual)===JSON.stringify(expected);
function judge({action,initial,trace}) {
  const last=trace.at(-1);
  let pass=false,publicFailure=false;
  if(action==='ordinary'||action==='keys') pass=same(last.days,[16]);
  if(action==='month') pass=initial.month===10 && trace[0].month===11 && last.month===10 && last.year===2017;
  if(action==='manual') pass=same(last.days,[18])&&last.value==='2017-10-18';
  if(action==='time') pass=same(last.hours,[14]);
  if(action==='range') {
    const anchored=initial.open && initial.disabled22 && initial.days.length===0 && trace[0].target?.element==='travel-range';
    pass=anchored && trace[0].open && same(trace[0].days,[16]) && same(last.days,[16,18]);
    publicFailure=anchored && !trace[0].open && trace[0].days.length===0;
  }
  return {pass,publicFailure};
}
module.exports={judge};
