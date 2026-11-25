'use strict';

// Copied from project-v2.0/routing/score.cjs to keep this CLI self-contained.
const stop=new Set('the a an on or is of its it then to after while with in at from will and by as for are into has that this when using use one over be as does'.split(' '));
function tokens(s) {
  return String(s).toLowerCase().match(/[a-z0-9]+/g)?.map(w=>w.length>4?w.replace(/(?:ing|ed|s)$/,''):w).filter(w=>!stop.has(w)) || [];
}
function bm25(query,docs) {
  const q=[...new Set(tokens(query))], words=docs.map(tokens);
  const avg=words.reduce((a,w)=>a+w.length,0)/Math.max(words.length,1)||1;
  return words.map(doc=>q.reduce((s,w)=>{
    const f=doc.filter(t=>t===w).length,df=words.filter(d=>d.includes(w)).length;
    const idf=Math.log(1+(docs.length-df+0.5)/(df+0.5));
    return s+(f?idf*2.2*f/(f+1.2*(0.25+0.75*doc.length/avg)):0);
  },0));
}
module.exports = {bm25};
