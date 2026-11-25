'use strict';
const {PNG}=require('./vendor/pngjs/lib/png');
const COLS=16, ROWS=12;
// Mean colour in small patches, plus fine-scale edges. The full-resolution scan
// retains narrow glyphs and borders that disappear in a resized thumbnail.
function decode(buffer) {
  const {width,height,data}=PNG.sync.read(buffer);
  const tiles=Array.from({length:COLS*ROWS},()=>[0,0,0,0,0,0]);
  const step=2;
  for(let y=0;y<height;y+=step) for(let x=0;x<width;x+=step) {
    const tile=tiles[Math.floor(y*ROWS/height)*COLS+Math.floor(x*COLS/width)];
    const idx=4*(y*width+x);
    for(let c=0;c<3;c++) {
      tile[c]+=data[idx+c]/255;
      if(x>=step) tile[3]+=Math.abs(data[idx+c]-data[idx-4*step+c])/765;
      if(y>=step) tile[4]+=Math.abs(data[idx+c]-data[idx-4*width*step+c])/765;
    }
    tile[5]++;
  }
  return tiles.map(t=>t.slice(0,5).map(v=>v/Math.max(1,t[5])));
}
function describe(after,before) {
  const tiles=after.length;
  const edges=after.map(t=>t[3]+t[4]);
  const change=after.map((t,i)=>before?t.slice(0,3).reduce((d,v,j)=>d+Math.abs(v-before[i][j]),0)/3:0);
  const largest=a=>a.reduce((best,v,i)=>v>a[best]?i:best,0);
  const peak=largest(change), edge=largest(edges), sum=arr=>arr.reduce((a,b)=>a+b,0);
  function moments(values) {
    const mass=sum(values)||1;
    return [sum(values.map((v,i)=>v*(i%COLS)/(COLS-1)))/mass,
      sum(values.map((v,i)=>v*Math.floor(i/COLS)/(ROWS-1)))/mass];
  }
  const features=[...moments(edges),Math.tanh(8*edges[edge]),Math.tanh(sum(edges)/tiles*20),
    ...moments(change),Math.tanh(10*change[peak]),Math.tanh(sum(change)/tiles*20),
    Math.tanh(sum(after.map(t=>t[3]-t[4]))/tiles*30),Number(Boolean(before))];
  return {features,roi:change[peak]>0?{column:peak%COLS,row:Math.floor(peak/COLS),cols:COLS,rows:ROWS,meanRgbDifference:change[peak]}:null};
}
module.exports={decode,describe};
