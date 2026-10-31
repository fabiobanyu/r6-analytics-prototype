'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function open(options={}){
  const errors=[],timeouts=[],downloads=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(html,{url:'file:///standalone/index.html#model',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
    w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
    if(options.captureTimeouts){const real=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>{if(ms===15000){timeouts.push(fn);return real(fn,1000000,...args);}return real(fn,ms,...args);};}
  }});
  return {dom,w:dom.window,$:id=>dom.window.document.getElementById(id),errors,timeouts,downloads};
}
test('forecast is computed only by its explicit button, including shortcuts, guide, changes and swap',()=>{
  const {w,$,errors}=open();
  try{
    const C=w.R6Core,original=C.forecast;let calculations=0;C.forecast=(...args)=>{calculations++;return original(...args);};
    assert.equal($('forecast-result').dataset.state,'idle');assert.equal($('forecast-result').querySelector('.forecast-pair'),null);
    w.document.querySelector('[data-preset="forecast"]').click();assert.equal(calculations,0);assert.equal($('forecast-result').dataset.state,'idle');
    $('predict').click();assert.equal(calculations,1);assert.equal($('forecast-result').dataset.state,'result');
    const first=$('forecast-a').value,second=$('forecast-b').value;
    $('swap-teams').click();assert.equal(calculations,1);assert.equal($('forecast-a').value,second);assert.equal($('forecast-result').querySelector('.forecast-pair'),null);
    $('predict').click();assert.equal(calculations,2);assert.equal($('forecast-result').dataset.state,'result');
    $('forecast-a').value=first;$('forecast-a').dispatchEvent(new w.Event('change'));assert.equal(calculations,2);assert.equal($('forecast-result').dataset.state,'idle');
    $('predict').click();assert.equal(calculations,3);assert.equal($('forecast-result').dataset.state,'error');assert.equal($('forecast-result').querySelector('.forecast-pair'),null);
    $('forecast-b').value=second;$('forecast-b').dispatchEvent(new w.Event('change'));assert.equal(calculations,3);$('predict').click();assert.equal(calculations,4);
    w.document.querySelector('[data-preset="forecast"]').click();assert.equal(calculations,4);assert.equal($('forecast-result').dataset.state,'idle');
    $('open-help').click();for(let i=0;i<3;i++)$('guide-next').click();$('guide-content').querySelector('[data-preset="forecast"]').click();assert.equal(calculations,4);assert.equal($('help-dialog').open,false);assert.equal($('forecast-result').dataset.state,'idle');
    assert.deepEqual(errors,[]);
  }finally{w.close();}
});
test('unchanged cache preserves an explicit forecast; accepted new data invalidates it without recalculating',()=>{
  const {w,$,errors}=open();
  try{
    const d=JSON.parse($('dataset').textContent);w.document.querySelector('[data-preset="forecast"]').click();$('predict').click();
    const result=$('forecast-result').textContent;
    w.R6_LATEST=structuredClone(d);w.dispatchEvent(new w.Event('r6-update'));assert.equal($('forecast-result').textContent,result);
    const refreshed=structuredClone(d);refreshed.meta.generatedAt=new Date(Date.parse(d.meta.generatedAt)+1000).toISOString();
    w.R6_LATEST=refreshed;w.dispatchEvent(new w.Event('r6-update'));assert.equal($('forecast-result').dataset.state,'idle');assert.match($('forecast-result').textContent,/Data diperbarui/);assert.equal($('forecast-result').querySelector('.forecast-pair'),null);
    assert.deepEqual(errors,[]);
  }finally{w.close();}
});
test('rejected or older cache cannot be masked by a successful status response and retains displayed data',()=>{
  const {w,$,errors}=open();
  try{
    const d=JSON.parse($('dataset').textContent),date=$('snapshot-date').textContent,count=$('kpis').textContent;
    const invalid=structuredClone(d);invalid.matches.push(invalid.matches[0]);w.R6_LATEST=invalid;w.dispatchEvent(new w.Event('r6-update'));
    w.R6_STATUS={ok:true};w.dispatchEvent(new w.Event('r6-status'));assert.match($('sync-status').textContent,/ditolak/);assert.equal($('snapshot-date').textContent,date);assert.equal($('kpis').textContent,count);
    const older=structuredClone(d);older.meta.generatedAt=new Date(Date.parse(d.meta.generatedAt)-1000).toISOString();w.R6_LATEST=older;w.dispatchEvent(new w.Event('r6-update'));assert.match($('sync-status').textContent,/lebih lama/);
    const malformed=structuredClone(d);malformed.meta.generatedAt='invalid TEST ONLY timestamp';w.R6_LATEST=malformed;w.dispatchEvent(new w.Event('r6-update'));assert.match($('sync-status').textContent,/ditolak/);assert.equal($('snapshot-date').textContent,date);
    w.R6_LATEST=d;w.dispatchEvent(new w.Event('r6-update'));assert.doesNotMatch($('sync-status').textContent,/ditolak/);assert.deepEqual(errors,[]);
  }finally{w.close();}
});
test('stalled cache reads release the button after timeout and independent successful reads recover it',()=>{
  const {w,$,errors,timeouts}=open({captureTimeouts:true});
  try{
    const before=$('kpis').textContent;assert.equal($('check-cache').disabled,true);assert.equal(timeouts.length,2);
    for(const timeout of timeouts.slice())timeout();assert.equal($('check-cache').disabled,false);assert.match($('sync-status').textContent,/tidak dapat dibaca/);assert.equal($('kpis').textContent,before);
    w.R6_STATUS={ok:true};w.dispatchEvent(new w.Event('r6-status'));assert.match($('sync-status').textContent,/tidak dapat dibaca/);
    $('check-cache').click();assert.equal($('check-cache').disabled,true);
    const latest=[...w.document.querySelectorAll('script[src]')].find(s=>s.src.includes('latest.js'));
    const status=[...w.document.querySelectorAll('script[src]')].find(s=>s.src.includes('status.js'));
    w.R6_LATEST=JSON.parse($('dataset').textContent);w.dispatchEvent(new w.Event('r6-update'));
    const loaded=latest.onload;loaded();loaded();assert.equal($('check-cache').disabled,true);assert.match($('sync-status').textContent,/status pembaruan terakhir tidak dapat dibaca/);
    status.onload();assert.equal($('check-cache').disabled,false);assert.doesNotMatch($('sync-status').textContent,/tidak dapat dibaca/);assert.deepEqual(errors,[]);
  }finally{w.close();}
});
test('empty match filters disable export and a small-sample team still has an honest favorites preview',()=>{
  const {w,$,errors,downloads}=open();
  try{
    $('search').value='No real match TEST ONLY';$('search').dispatchEvent(new w.Event('input'));assert.equal($('export').disabled,true);$('export').click();assert.equal(downloads.length,0);
    $('reset').click();assert.equal($('export').disabled,false);
    const d=JSON.parse($('dataset').textContent),operators=JSON.parse($('operator-dataset').textContent),team=Object.values(d.teams).find(t=>{
      const rows=w.R6Core.operatorStats(operators,{team:t.name,minPicks:0});return rows.length&&Math.max(...rows.map(r=>r.picks))<30;
    });assert.ok(team);
    $('event-filter').value='502';$('team-filter').value=String(team.id);$('team-filter').dispatchEvent(new w.Event('change'));
    assert.ok($('operator-preview').querySelector('.spotlight-card'));assert.match($('operator-rows').textContent,/Tidak ada operator/);assert.deepEqual(errors,[]);
  }finally{w.close();}
});
