'use strict';
// The optional reference catalogue contains pre-change screenshots only. Action
// outcomes, measurements and new-build future frames are intentionally omitted.
function attach(trials,oldName) {
  for(const t of trials) {
    const old=trials.find(a=>a.id===t.id && a.variant===oldName);
    if(!old) throw Error('Missing old release for '+t.id);
    t.ctx.reference=Object.fromEntries(old.rows.map(r=>[r.probe,{tile:r.tile,pre:r.pre}]));
  }
  return trials;
}
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const rgbDistance=(a,b)=>a.map((tile,i)=>sum(tile.slice(0,3).map((v,j)=>Math.abs(v-b[i][j])))/3);
const edges=a=>a.map(tile=>tile[3]+tile[4]);
const cosine=(a,b)=>sum(a.map((v,i)=>v*b[i]))/Math.max(1e-9,Math.sqrt(sum(a.map(v=>v*v))*sum(b.map(v=>v*v))));
function evidence(hist,action,ref) {
  const proposed=ref[action];
  const active=proposed.pre?rgbDistance(proposed.tile,proposed.pre):edges(proposed.tile);
  const impacts=hist.map(r=>rgbDistance(r.tile,ref[r.probe].tile));
  const impact=impacts[0].map((_,i)=>Math.max(...impacts.map(a=>a[i])));
  const pastActions=hist.map(r=>ref[r.probe]);
  const novelty=Math.min(...pastActions.map(a=>1-cosine(active,a.pre?rgbDistance(a.tile,a.pre):edges(a.tile))));
  const diff=Math.min(...pastActions.map(a=>sum(rgbDistance(a.tile,proposed.tile))/proposed.tile.length));
  return [cosine(impact,active),cosine(impact,edges(proposed.tile)),novelty,Math.tanh(diff*20),
    Math.tanh(sum(active)/active.length*20),Math.tanh(sum(impact)/impact.length*20)];
}
module.exports={attach,evidence};
