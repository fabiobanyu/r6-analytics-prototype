'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {JSDOM,VirtualConsole}=require('jsdom');
const file=path.join(__dirname,'../index.html'), html=fs.readFileSync(file,'utf8');
test('standalone HTML: navigation, real filters, details, prediction, CSV and cache refresh',async()=>{
  const errors=[],downloads=[];const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(html,{url:pathToFileURL(file).href,runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:console,beforeParse(w){w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){downloads.push({filename:this.download,url:this.href});};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};}});
  const w=dom.window;const $=id=>w.document.getElementById(id);
  try{
    await new Promise(resolve=>w.addEventListener('load',resolve,{once:true}));
    assert.equal($('fatal').hidden,true);assert.equal($('kpis').children.length,4);assert.match($('sync-status').textContent,/terverifikasi|Cache berusia/);assert.equal($('check-cache').disabled,false);
    const data=JSON.parse($('dataset').textContent), c=w.R6Core;
    assert.equal($('kpis').children[0].querySelector('strong').textContent,new Intl.NumberFormat('id-ID').format(data.matches.filter(m=>m.completed).length));
    const event=$('event-filter');event.value=event.options[1].value;event.dispatchEvent(new w.Event('change'));
    const selected=data.matches.filter(m=>String(m.competitionId)===event.value&&m.completed).length;
    assert.equal($('kpis').children[0].querySelector('strong').textContent,new Intl.NumberFormat('id-ID').format(selected));
    $('search').value='no real team matches this filter';$('search').dispatchEvent(new w.Event('input'));assert.equal($('kpis').children[0].querySelector('strong').textContent,'0');assert.match($('map-chart').textContent,/belum tersedia/);
    $('reset').click();assert.equal(event.value,'');assert.equal($('search').value,'');
    w.location.hash='#operators';await new Promise(resolve=>w.setTimeout(resolve,5));
    assert.equal($('operators').hidden,false);assert.equal($('view-label').textContent,'Operator intel');assert.match($('operator-scope').textContent,/886.*887/);
    assert.equal($('operator-insights').children.length,3);assert.ok($('operator-rows').children.length>0);assert.ok($('operator-rows').querySelector('img').src.startsWith('data:image/png;base64,'));
    $('operator-sort').value='winRate';$('operator-sort').dispatchEvent(new w.Event('change'));assert.match($('operator-rows').firstElementChild.textContent,/Pulse/);
    $('operator-min').value='100';$('operator-min').dispatchEvent(new w.Event('change'));assert.ok(!$('operator-rows').textContent.includes('Pulse'));
    $('operator-min').value='30';$('operator-min').dispatchEvent(new w.Event('change'));$('operator-search').value='Smoke';$('operator-search').dispatchEvent(new w.Event('input'));assert.equal($('operator-rows').children.length,1);assert.match($('operator-rows').textContent,/198/);
    $('export-operators').click();assert.equal(downloads.at(-1).filename,'r6-operators-slc-2026.csv');downloads.length=0;
    $('operator-search').value='';$('operator-search').dispatchEvent(new w.Event('input'));
    event.value='513';event.dispatchEvent(new w.Event('change'));assert.match($('operator-rows').textContent,/Snapshot pemilihan operator tersedia/);assert.equal($('export-operators').disabled,true);$('reset').click();
    w.location.hash='#matches';await new Promise(resolve=>w.setTimeout(resolve,5));assert.equal($('matches').hidden,false);assert.equal($('overview').hidden,true);
    const next=$('next');assert.equal(next.disabled,false);next.click();assert.equal($('page-label').textContent.split(' / ')[0],'2');$('prev').click();
    const button=w.document.querySelector('.detail-button');const mid=Number(button.dataset.id);button.click();assert.equal($('match-dialog').open,true);assert.ok($('detail-content').textContent.includes(c.teamName(data,data.matches.find(m=>m.id===mid).teamA)));$('close-dialog').click();assert.equal($('match-dialog').open,false);
    const detailed=data.matches.find(m=>m.detailed), select=$('team-filter');select.value=String(detailed.teamA);select.dispatchEvent(new w.Event('change'));const detailButtons=[...w.document.querySelectorAll('.detail-button')];const db=detailButtons.find(b=>data.matches.find(m=>m.id===Number(b.dataset.id)).detailed);assert.ok(db);db.click();assert.ok($('detail-content').querySelector('.round-strip'));assert.ok($('detail-content').querySelector('table'));$('close-dialog').click();
    $('export').click();assert.equal(downloads.length,1);assert.match(downloads[0].filename,/r6-official-matches.*\.csv/);
    w.location.hash='#model';await new Promise(resolve=>w.setTimeout(resolve,5));assert.equal($('model').hidden,false);assert.match($('evaluation').textContent,/BRIER/i);
    const model=c.elo(data), ready=Object.keys(model.counts).filter(id=>model.counts[id]>=5);$('forecast-a').value=ready[0];$('forecast-b').value=ready[1];$('predict').click();assert.match($('forecast-result').textContent,/peluang/);assert.ok($('forecast-result').textContent.includes((100*c.forecast(data,ready[0],ready[1]).p).toFixed(1)));
    $('forecast-b').value=ready[0];$('predict').click();assert.match($('forecast-result').textContent,/berbeda/);
    const refreshed=structuredClone(data);refreshed.meta.generatedAt=new Date(Date.parse(data.meta.generatedAt)+1000).toISOString();w.R6_LATEST=refreshed;w.dispatchEvent(new w.Event('r6-update'));assert.equal($('team-filter').value,String(detailed.teamA));
    const invalid=structuredClone(data);invalid.matches.push(invalid.matches[0]);w.R6_LATEST=invalid;w.dispatchEvent(new w.Event('r6-update'));assert.match($('sync-status').textContent,/ditolak/);
    w.R6_STATUS={ok:false,message:'Simulated network failure in TEST ONLY'};w.dispatchEvent(new w.Event('r6-status'));assert.match($('sync-status').textContent,/gagal/);assert.ok($('kpis').textContent.includes('Series selesai'));
    assert.deepEqual(errors,[]);
  }finally{w.close();}
});
test('single-file copy renders even without a sibling data folder',async()=>{
  // Resource loading omitted intentionally: embedded real snapshot must be sufficient.
  const dom=new JSDOM(html,{url:'file:///standalone/index.html',runScripts:'dangerously',pretendToBeVisual:true});
  try{assert.equal(dom.window.document.getElementById('fatal').hidden,true);assert.equal(dom.window.document.querySelectorAll('.kpi').length,4);assert.ok(dom.window.document.querySelectorAll('#rankings tr').length>0);}finally{dom.window.close();}
});
