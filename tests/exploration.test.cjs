'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
test('beginner journey: guided help, glossary, operator comparison, map/week drill-down and team history',async()=>{
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const dom=new JSDOM(html,{url:'file:///standalone/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};}});
  const w=dom.window,$=id=>w.document.getElementById(id),tick=()=>new Promise(resolve=>w.setTimeout(resolve,5));
  try{
    const d=JSON.parse($('dataset').textContent),original=JSON.stringify(d),C=w.R6Core;
    assert.equal($('fatal').hidden,true);assert.match($('plain-summary').textContent,/pertandingan selesai/);
    $('open-help').click();assert.equal($('help-dialog').open,true);assert.equal($('guide-progress').textContent,'1 / 4');$('guide-next').click();assert.equal($('guide-progress').textContent,'2 / 4');$('guide-prev').click();
    $('help-guide-tab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal($('glossary-panel').hidden,false);assert.equal($('help-glossary-tab').getAttribute('aria-selected'),'true');
    $('glossary-search').value='win rate';$('glossary-search').dispatchEvent(new w.Event('input'));assert.match($('glossary-list').textContent,/ronde menang/);
    $('glossary-search').value='no matching dictionary word';$('glossary-search').dispatchEvent(new w.Event('input'));assert.match($('glossary-list').textContent,/belum ditemukan/);
    $('close-help').click();assert.equal($('help-dialog').open,false);
    $('event-filter').value='513';$('event-filter').dispatchEvent(new w.Event('change'));
    w.document.querySelector('[data-preset="wins"]').click();await tick();assert.equal($('operators').hidden,false);assert.equal($('event-filter').value,'502');assert.equal($('operator-sort').value,'wins');
    const smoke=[...w.document.querySelectorAll('#operator-rows [data-open-operator]')].find(b=>b.dataset.openOperator==='Smoke');assert.ok(smoke);smoke.click();
    assert.equal($('explore-dialog').open,true);assert.match($('explore-content').textContent,/382 kali dipilih/);assert.match($('explore-content').textContent,/198 ronde/);assert.match($('explore-content').textContent,/184 ronde/);
    $('operator-peer').value='Pulse';$('operator-peer').dispatchEvent(new w.Event('change',{bubbles:true}));assert.match($('operator-comparison').textContent,/Pulse/);assert.match($('operator-comparison').textContent,/35 menang \/ 52 pilihan/);$('close-explore').click();
    $('reset').click();w.location.hash='#overview';await tick();
    const mapButton=w.document.querySelector('[data-open-map]'),map=mapButton.dataset.openMap;mapButton.click();assert.equal($('explore-dialog').open,true);assert.match($('explore-title').textContent,new RegExp(map.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    w.document.querySelector('[data-apply-map]').click();await tick();assert.equal($('matches').hidden,false);assert.equal($('explore-dialog').open,false);assert.ok($('active-filters').querySelector('[data-remove-filter="map"]'));
    const expected=C.subset(d,{map});assert.match($('match-count').textContent,new RegExp(new Intl.NumberFormat('id-ID').format(expected.length)+' pertandingan'));
    for(const b of w.document.querySelectorAll('#match-rows .detail-button'))assert.ok(expected.some(m=>m.id===Number(b.dataset.id)));
    $('active-filters').querySelector('[data-remove-filter="map"]').click();assert.equal($('active-filters').hidden,true);
    w.location.hash='#overview';await tick();const week=w.document.querySelector('.week:not(:disabled)');const key=week.dataset.week;week.click();await tick();assert.equal($('matches').hidden,false);assert.ok($('active-filters').querySelector('[data-remove-filter="week"]'));
    const weekIds=new Set(C.subset(d,{week:key}).map(m=>m.id));for(const b of w.document.querySelectorAll('#match-rows .detail-button'))assert.ok(weekIds.has(Number(b.dataset.id)));
    $('reset').click();assert.equal($('active-filters').hidden,true);
    w.document.querySelector('[data-preset="forecast"]').click();await tick();assert.equal($('model').hidden,false);assert.equal($('forecast-result').querySelector('.forecast-pair'),null);$('predict').click();assert.ok($('forecast-result').querySelector('.forecast-pair'));
    const a=$('forecast-a').value,b=$('forecast-b').value,prob=C.forecast(d,a,b).p;$('swap-teams').click();assert.equal($('forecast-a').value,b);assert.equal($('forecast-result').querySelector('.forecast-pair'),null);$('predict').click();assert.ok($('forecast-result').textContent.includes(((1-prob)*100).toFixed(1)));
    const history=$('forecast-result').querySelector('[data-team-history]'),team=history.dataset.teamHistory;history.click();await tick();assert.equal($('matches').hidden,false);assert.equal($('team-filter').value,team);assert.equal($('active-filters').querySelector('[data-remove-filter="week"]'),null);
    w.document.querySelector('[data-term="series"]').click();assert.equal($('help-dialog').open,true);assert.match($('glossary-list').textContent,/beberapa peta/);$('close-help').click();
    $('open-help').click();for(let i=0;i<3;i++)$('guide-next').click();assert.equal($('guide-progress').textContent,'4 / 4');$('guide-next').click();assert.equal($('help-dialog').open,false);
    assert.equal(JSON.stringify(JSON.parse($('dataset').textContent)),original);assert.deepEqual(errors,[]);
  }finally{w.close();}
});
