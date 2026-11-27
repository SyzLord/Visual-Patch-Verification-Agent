'use strict';
const esc = value=>String(value).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const labels = {pass:'验收通过',regression:'已确认回归',inconclusive:'本次验收无结论',
  error:'执行异常',unexpected:'非预期失败','known-failure':'已知失败签名'};
const names = {fixed:'固定顺序',bm25:'BM25',keyboard:'保留键盘步骤',
  reference:'修复版',candidate:'待测版',confirmations:'待测版复核'};
const numeral = value => esc(value ?? '—');
const code = data => '<pre>'+esc(JSON.stringify(data,null,2))+'</pre>';
const bytes = value=>new Intl.NumberFormat('en-US').format(value)+' B';

function render(result) {
  const {config,browser,plan,acceptance,comparisons} = result;
  const title = config.ticket.title;
  const comparisonRows = Object.entries(comparisons).map(([method,row])=>`<tr>
    <th scope="row">${names[method]}</th>
    <td data-label="首次命中">${row.consistent ? row.firstHit ?? '预算内未中' : '轨迹不一致'}</td>
    <td data-label="动作">${row.steps} / ${config.budget}</td><td data-label="手势">${row.gestures}</td>
    <td data-label="参考图">${row.referenceImages}</td>
    <td data-label="实际顺序">${esc(row.trace.map(check=>check.action).join(' → '))}</td></tr>`).join('');
  const ranking = plan.ranking.map(row=>`<tr><th scope="row">${esc(row.id)}</th><td>${row.score.toFixed(6)}</td>
    <td>${esc(row.description)}</td></tr>`).join('');
  const sections = ['reference','candidate','confirmations'].map(role=>{
    const rows = acceptance[role].map(item=>{
      const figures = item.frames.map(frame=>`<figure><a href="${esc(frame.path)}"><img loading="lazy" src="${esc(frame.path)}"
        alt="${esc(names[role])} ${esc(item.action)} ${esc(frame.stage)}"></a>
        <figcaption>${esc(frame.stage)} · ${bytes(frame.bytes)}<br><code>${esc(frame.sha256)}</code></figcaption></figure>`).join('');
      return `<details><summary>${esc(item.action)} <span class="state ${esc(item.outcome)}">${labels[item.outcome]}</span></summary>
        ${figures ? '<div class="figures">'+figures+'</div>' : ''}
        <h4>断言</h4>${code({expect:item.expect,failure:item.failure,errors:item.errors,pageErrors:item.pageErrors})}
        <h4>逐步读数</h4>${code(item.states)}</details>`;
    }).join('');
    return '<h3>'+names[role]+'</h3>'+(rows || '<p>无复核记录</p>');
  }).join('');
  return `<!doctype html>
  <html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(config.id)} · Visual Patch Agent</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f5f7f6;color:#1d2e29;font:15px/1.6 system-ui,sans-serif}
  main{max-width:1040px;margin:auto;padding:32px 20px 70px}header,section{background:white;border:1px solid #dce6e0;
  border-radius:12px;padding:22px;margin-bottom:16px}h1{font-size:clamp(22px,4vw,36px);line-height:1.2;margin:6px 0 12px}
  h2,h3{line-height:1.3}h2{margin-top:0}a{color:#165943;text-underline-offset:3px}a:focus-visible,summary:focus-visible{outline:2px solid #165943;outline-offset:3px}
  .links,.chips{display:flex;flex-wrap:wrap;gap:8px 18px}.state{background:#edf3ef;padding:2px 8px;border-radius:5px}
  .regression,.known-failure{color:#772f13;background:#fff0dc}.inconclusive,.error,.unexpected{color:#8a1635;background:#fbeaf0}
  .scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;text-align:left}th,td{border-bottom:1px solid #dce6e0;padding:8px 10px;vertical-align:top}
  details{border-top:1px solid #dce6e0;padding:10px 0}summary{cursor:pointer}pre{padding:12px;background:#f1f5f3;overflow:auto;max-height:360px;font-size:12px}
  .figures{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px;margin-top:12px}
  figure{margin:0}img{display:block;max-width:100%;height:auto;border:1px solid #c6d8cd}figcaption,code{overflow-wrap:anywhere;font-size:12px}
  @media(max-width:640px){
    .strategy thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
    .strategy,.strategy tbody,.strategy tr{display:block}.strategy tr{border-bottom:1px solid #dce6e0;padding:10px 0}
    .strategy th,.strategy td{border:0;display:block;padding:3px 0}
    .strategy td{display:grid;grid-template-columns:74px 1fr;gap:8px;overflow-wrap:anywhere}
    .strategy td::before{content:attr(data-label);color:#4b5e57}
  }
  </style></head><body><main>
  <header><div>Visual Patch Agent · ${esc(config.id)}</div><h1>${esc(title)}</h1>
    <div class="chips"><strong class="state ${esc(result.status)}">${labels[result.status]}</strong>
    <span>待测 ${esc(config.builds.candidate.version)} · 修复 ${esc(config.builds.reference.version)}</span>
    <span>Chrome ${numeral(browser?.chrome)} · Playwright ${numeral(browser?.playwright)}</span></div>
    <p class="links"><a href="${esc(config.ticket.issue)}">上游工单</a><a href="${esc(config.ticket.repair)}">上游修复</a>
    <a href="inputs.json">运行配置</a><a href="result.json">完整 JSON</a><a href="manifest.json">证据校验值</a></p>
    ${result.error ? '<p>'+esc(result.error)+'</p>' : ''}</header>
  <section><h2>同预算策略对照</h2><p>每种策略最多 ${config.budget} 个动作，包含冒烟，命中后结束。</p>
    ${comparisonRows ? `<div class="scroll"><table class="strategy"><thead><tr><th>策略</th><th>首次命中</th><th>动作</th><th>手势</th>
    <th>搜索读取参考图</th><th>实际顺序</th></tr></thead><tbody>${comparisonRows}</tbody></table></div>` : '<p>完整验收未满足策略对照条件。</p>'}
    <details><summary>排序分数与计划</summary>
    <p>匹配词 ${esc(plan.cues.join(', ') || '—')} · 挤出本轮预算的动作 ${numeral(plan.displaced)}</p>
    <div class="scroll"><table><thead><tr><th>动作</th><th>BM25</th><th>描述</th></tr></thead><tbody>${ranking}</tbody></table></div>
    ${code(plan.orders)}</details></section>
  <section><h2>双版本验收与复核</h2>${sections}</section></main></body></html>\n`;
}

function renderIndex(runs) {
  const cell = (run,method) => {
    const policy = run.comparisons[method];
    return !policy ? '—' : !policy.consistent ? '轨迹不一致' : policy.firstHit ?? '预算内未中';
  };
  const rows = runs.map(({run,href})=>`<tr><th scope="row"><a href="${esc(href)}">${esc(run.config.id)}</a><br>
    <small>${esc(run.config.ticket.title)}</small></th>
    <td>${esc(run.config.builds.candidate.version)} → ${esc(run.config.builds.reference.version)}</td>
    <td>${labels[run.status]}</td><td>${run.config.budget}</td>
    <td>${cell(run,'fixed')}</td><td>${cell(run,'bm25')}</td><td>${cell(run,'keyboard')}</td></tr>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"><title>本地回归验收 · Visual Patch Agent</title>
  <style>body{margin:0;background:#f5f7f6;color:#1d2e29;font:15px/1.6 system-ui,sans-serif}
  main{max-width:1040px;margin:auto;padding:40px 18px}h1{font-size:clamp(24px,4vw,36px);line-height:1.2}
  a{color:#165943;text-underline-offset:3px}a:focus-visible{outline:2px solid #165943;outline-offset:3px}
  .table{overflow-x:auto;background:white;border:1px solid #dce6e0;border-radius:12px}
  table{width:100%;min-width:690px;border-collapse:collapse;text-align:left}td,th{padding:12px 10px;border-bottom:1px solid #dce6e0;vertical-align:top}
  small{color:#4b5e57;font-weight:450}</style></head><body><main>
  <div>Visual Patch Agent</div><h1>本地回归验收</h1>
  <p>命中步数包含冒烟。打开工单可查看逐步断言、复核、截图和文件校验值。</p>
  <div class="table"><table><thead><tr><th scope="col">工单</th><th scope="col">待测 → 修复</th>
  <th scope="col">验收</th><th scope="col">预算</th><th scope="col">固定顺序</th><th scope="col">BM25</th>
  <th scope="col">保留键盘步骤</th></tr></thead><tbody>${rows}</tbody></table></div></main></body></html>\n`;
}
module.exports = {render,renderIndex};
