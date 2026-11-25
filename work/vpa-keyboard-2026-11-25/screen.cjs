'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {menu} = require('../vpa-low-margin-2026-11-18/screen.cjs');
const {plan} = require('./route.cjs');
const previous = path.join(__dirname,'../vpa-substantive-2026-11-18');
const load = file=>JSON.parse(fs.readFileSync(path.join(previous,file)));

function queue() {
  const used = new Set(load('sources/used.json').map(row=>row.family+'/'+row.number));
  for (const row of load('intake.json')) {
    if (['previous-screen','historical-reference'].includes(row.exclusion)) used.add(row.family+'/'+row.number);
  }
  for (const id of ['flatpickr/594','flatpickr/1724','bootstrap-date/2266','bootstrap-date/2058']) used.add(id);
  return load('screen-extension.json').rows.flatMap((row,index)=>{
    if (!['flatpickr','air','bootstrap-date','vanilla'].includes(row.family) ||
        used.has(row.family+'/'+row.number) || row.exclusion) return [];
    const result = plan(row.title,menu(row.panel));
    return result.cues.length ? [{position:index+1,family:row.family,panel:row.panel,number:row.number,
      title:row.title,url:row.url,promoted:result.promoted,cues:result.cues,bm25:result.orders.bm25}] : [];
  });
}

function development() {
  const records = [['2266','official-a/2266'],['2058','official-a/2058'],['594-inner','official-a/594-inner'],
    ['594','official-a/594'],['1724','diagnosis/new-a/1724']];
  return records.map(([id,directory])=>{
    const ranking = load(directory+'/order.json');
    const audit = load(directory+'/acceptance.json');
    const routing = plan(ranking.query,menu(audit.config.panel));
    const hits = Object.fromEntries(Object.entries(routing.orders).map(([method,order])=>{
      const pos = order.slice(0,2).findIndex(id=>!audit.candidate.find(row=>row.action===id).pass);
      return [method,pos<0?null:pos+2];
    }));
    return {id,routing,hits};
  });
}

if (require.main === module) {
  const command = process.argv[2];
  if (command !== 'queue' && command !== 'development') throw Error('Use queue or development');
  console.log(JSON.stringify(command === 'queue' ? queue() : development(),null,2));
}
