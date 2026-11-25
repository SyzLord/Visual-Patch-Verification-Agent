'use strict';
const {describe}=require('./pixels.cjs');
const {evidence}=require('./reference.cjs');
const stop=new Set('the a an on or is of its it then to after while with in at from will and by as for are into has that this when using use one over be as does'.split(' '));
function tokens(s) {
  return String(s).toLowerCase().match(/[a-z0-9]+/g)?.map(w=>w.length>4?w.replace(/(?:ing|ed|s)$/,''):w).filter(w=>!stop.has(w)) || [];
}
const groups=[
 /scroll|pan|drag|zoom|viewport|container|position/, /pointer|mouse|hover|click|focus|keyboard|tooltip|touch/,
 /stack|group|dataset|list|nested|multipl|consecutive|series/, /render|paint|draw|color|fill|stroke|border/,
 /default|none|disable|zero|empty|blank|single/, /axis|horizont|vertic|revers|order|orient|align/,
 /value|number|radius|size|width|height|range|scale/, /text|code|label|line|block|fence|head/
];
const tags=['parameter','composition','order','simplify','default','disable','context'];
function bm25(query,docs) {
  const q=[...new Set(tokens(query))], words=docs.map(tokens);
  const avg=words.reduce((a,w)=>a+w.length,0)/Math.max(words.length,1)||1;
  return words.map(doc=>q.reduce((s,w)=>{
    const f=doc.filter(t=>t===w).length,df=words.filter(d=>d.includes(w)).length;
    const idf=Math.log(1+(docs.length-df+0.5)/(df+0.5));
    return s+(f?idf*2.2*f/(f+1.2*(0.25+0.75*doc.length/avg)):0);
  },0));
}
function semantics(s) {return groups.map(g=>Number(g.test(s.toLowerCase())));}
function makeContext(issue,actions,descriptions,probes) {
  if(typeof issue!=='string'||!issue.trim()) throw Error('An initial issue description is required');
  if (probes.length<2 || probes.some(p=>typeof descriptions[p]!=='string' || !Array.isArray(actions[p]))) throw Error('Missing public probe metadata');
  const lexical=bm25(issue,probes.slice(1).map(p=>descriptions[p]));
  return {probes,issue,actions,descriptions,lex:Object.fromEntries(probes.slice(1).map((p,i)=>[p,lexical[i]]))};
}
function feature(ctx,state,p,mode) {
  const words=mode!=='noText', pixels=mode!=='noPixels', role=ctx.actions[p];
  const sem=words?semantics(ctx.descriptions[p]):groups.map(()=>0);
  const prev=ctx.actions[state.at(-1).probe];
  const unseen=1-Math.max(...state.map(r=>role.filter(t=>ctx.actions[r.probe].includes(t)).length/new Set([...role,...ctx.actions[r.probe]]).size));
  const action=[1,...tags.map(t=>Number(role.includes(t))),...sem,unseen];
  const issue=words?semantics(ctx.issue):groups.map(()=>0);
  const last=state.at(-1), prior=state.length>1?state.at(-2).tile:null;
  const visual=pixels?describe(last.tile,last.pre || prior).features:Array(10).fill(0);
  const context=[1,...tags.map(t=>Number(prev.includes(t))),...issue,...visual];
  const base=[words?Math.tanh(ctx.lex[p]||0):0,...action.flatMap(a=>context.map(s=>a*s))];
  if(mode==='cards') {
    const extra=evidence(state,p,ctx.reference);
    base.push(...action.flatMap(a=>extra.map(e=>a*e)));
  }
  return base;
}
const dot=(x,y)=>x.reduce((sum,v,i)=>sum+v*y[i],0);
function fit(examples,mode) {
  const grouped=new Map();let stateCount=0;
  for(const t of examples) {
    const [first,...others]=t.rows;
    if(!first.pass) continue;
    const ctx=t.ctx, family=t.family;
    for(const state of [[first],...others.filter(r=>r.pass).map(r=>[first,r])]) {
      const future=others.filter(r=>!state.includes(r));
      const fail=future.filter(r=>!r.pass),pass=future.filter(r=>r.pass);
      if(!fail.length||!pass.length)continue;
      stateCount++;
      const pairs=grouped.get(family)||[];
      for(const a of fail)for(const b of pass){
        const ax=feature(ctx,state,a.probe,mode),bx=feature(ctx,state,b.probe,mode);
        pairs.push(ax.map((v,i)=>v-bx[i]));
      }
      grouped.set(family,pairs);
    }
  }
  if(!grouped.size)throw Error('No informative action pairs');
  const weights=grouped.values().next().value[0].map(()=>0);
  const epochs=120,l2=0.09;
  let loss;
  for(let step=0;step<=epochs;step++) {
    const grad=weights.map(w=>l2*w);loss=l2*dot(weights,weights)/2;
    for(const batch of grouped.values())for(const x of batch) {
      const scale=1/(grouped.size*batch.length),z=dot(x,weights);
      loss+=scale*(Math.max(0,-z)+Math.log1p(Math.exp(-Math.abs(z))));
      const error=scale/(1+Math.exp(z));
      for(let i=0;i<grad.length;i++)grad[i]-=x[i]*error;
    }
    if(step<epochs)for(let i=0;i<grad.length;i++)weights[i]-=0.5*grad[i];
  }
  return {mode,weights,loss,stateCount,pairs:Object.fromEntries([...grouped].map(([k,v])=>[k,v.length]))};
}
function ranking(model,ctx,state,method='combined',priorWeight=0) {
  if(!state.length)return [{probe:ctx.probes[0],score:0}];
  const pending=ctx.probes.filter(p=>!state.some(r=>r.probe===p));
  const scored=pending.map(p=>{
    const i=ctx.probes.indexOf(p), prior=-(i-1)/Math.max(1,ctx.probes.length-2);
    const learned=['ordered','bm25'].includes(method)?0:dot(feature(ctx,state,p,model.mode),model.weights);
    const textScore=ctx.lex[p]||0;
    const score=method==='ordered'?prior:method==='bm25'?textScore:learned+priorWeight*prior;
    return {probe:p,score,learned,prior,textScore};
  });
  return scored.sort((a,b)=>b.score-a.score);
}
module.exports={makeContext,bm25,fit,ranking};
