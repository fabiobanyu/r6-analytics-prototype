'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const C=require('../src/engine.js'), d=require('../data/snapshot.json');
test('official snapshot has unique series and traceable source references',()=>{assert.equal(C.validate(d),true);assert.equal(new Set(d.matches.map(m=>m.id)).size,d.matches.length);assert.ok(d.sources.every(s=>s.httpStatus===200 && /^[a-f0-9]{64}$/.test(s.sha256)));});
test('counts use series/map/round grains; player rows never inflate series',()=>{const summary=C.summarize(d,d.matches);assert.equal(summary.played,d.matches.filter(m=>m.completed).length);assert.equal(summary.games,d.games.length);assert.equal(summary.rounds,d.rounds.length);const expanded=structuredClone(d);expanded.players.push(...d.players);assert.equal(C.summarize(expanded,expanded.matches).played,summary.played);});
test('scheduled games never have fabricated outcomes and never train Elo',()=>{for(const m of d.matches.filter(m=>!m.completed)){assert.equal(m.winnerId,null);assert.equal(m.scoreA,null);assert.equal(m.scoreB,null);}const model=C.elo(d);assert.ok(model.predictions.every(p=>d.matches.find(m=>m.id===p.matchId).completed));assert.ok(model.predictions.every(p=>!d.matches.find(m=>m.id===p.matchId).forfeit));});
test('changing a real outcome cannot affect the prediction of that same series or earlier ones',()=>{const original=C.elo(d), p=original.predictions[Math.floor(original.predictions.length/2)];const changed=structuredClone(d), m=changed.matches.find(m=>m.id===p.matchId);m.winnerId=m.winnerId===m.teamA?m.teamB:m.teamA;const after=C.elo(changed);for(const before of original.predictions.filter(x=>Date.parse(x.date)<=Date.parse(p.date))){const other=after.predictions.find(x=>x.matchId===before.matchId);assert.equal(other.p,before.p);assert.equal(other.priorProbability,before.priorProbability);}});
test('same-timestamp batch is independent of input ordering',()=>{const reversed=structuredClone(d);reversed.matches.reverse();assert.deepEqual(C.elo(reversed),C.elo(d));});
test('evaluation metrics recompute from true outcomes; baseline uses only earlier labels',()=>{const {predictions,evaluation:e}=C.elo(d);const tested=predictions.filter(x=>x.priorA>=3&&x.priorB>=3);assert.equal(e.n,tested.length);assert.equal(e.brier,tested.reduce((s,x)=>s+(x.p-x.actual)**2,0)/tested.length);for(const x of predictions){const earlier=predictions.filter(p=>Date.parse(p.date)<Date.parse(x.date));assert.equal(x.priorProbability,(1+earlier.reduce((s,p)=>s+p.actual,0))/(earlier.length+2));}assert.ok(e.brier>=0&&e.brier<=1);});
test('map attack rates are computed from actual round side IDs, including zero',()=>{const m=d.matches.find(m=>d.rounds.some(r=>r.matchId===m.id));const summary=C.summarize(d,[m]);for(const map of summary.maps){const ids=new Set(d.games.filter(g=>g.matchId===m.id&&g.map===map.name).map(g=>g.id));const rounds=d.rounds.filter(r=>ids.has(r.gameId)&&[r.attackerId,r.defenderId].includes(r.winnerId));assert.equal(map.attackWins,rounds.filter(r=>r.winnerId===r.attackerId).length);}assert.ok(d.players.some(p=>p.kost===0));});
test('unavailable map names are not filled and future forecasts do not write data',()=>{
  // Missing-field negative test only. The production dataset is never modified.
  const missing=structuredClone(d);missing.games=missing.games.map(g=>({...g,map:null}));assert.deepEqual(C.summarize(missing,missing.matches).maps,[]);
  const before=JSON.stringify(d),model=C.elo(d);const top=Object.keys(model.counts).filter(id=>model.counts[id]>=5);const p=C.forecast(d,top[0],top[1]);assert.ok(p.ready&&p.p>0&&p.p<1);assert.equal(JSON.stringify(d),before);assert.throws(()=>C.forecast(d,top[0],top[0]));
});
test('CSV escapes spreadsheets and preserves real zero and null',()=>{const output=C.csv([{name:'=not a source record',score:0,missing:null},{name:'"a,b"\nnext',score:1,missing:null}]);assert.ok(output.includes('"\'=not a source record"'));assert.ok(output.includes('"0",""'));assert.ok(output.includes('""a,b""'));});
test('corrupt snapshot is rejected and JavaScript contains no synthetic generator',()=>{const bad=structuredClone(d);bad.matches.push(bad.matches[0]);assert.throws(()=>C.validate(bad));const engine=fs.readFileSync(path.join(__dirname,'../src/engine.js'),'utf8');assert.doesNotMatch(engine,/Math\.random|syntheticStrength|makeFixtures|forced_prediction/);assert.doesNotThrow(()=>new vm.Script(engine));});
test('map drill-down preserves series grain while restricting map, round, player and ban statistics',()=>{
  const name=d.games.find(g=>g.map)?.map,filter={map:name},matches=C.subset(d,filter),ids=new Set(matches.map(m=>m.id));
  const games=d.games.filter(g=>g.map===name&&ids.has(g.matchId)),gameIds=new Set(games.map(g=>g.id));
  assert.equal(matches.length,new Set(d.games.filter(g=>g.map===name).map(g=>g.matchId)).size);
  const summary=C.summarize(d,matches,filter);assert.equal(summary.games,games.length);assert.equal(summary.rounds,d.rounds.filter(r=>gameIds.has(r.gameId)).length);assert.ok(summary.maps.every(m=>m.name===name));
  for(const p of C.playerLeaders(d,matches,filter))assert.equal(p.kills,d.players.filter(r=>gameIds.has(r.gameId)&&r.playerId===p.id&&r.kills!=null&&r.deaths!=null).reduce((s,r)=>s+r.kills,0));
  for(const b of C.banLeaders(d,matches,null,name))assert.equal(b.maps,new Set(d.bans.filter(r=>gameIds.has(r.gameId)&&r.operator===b.operator).map(r=>r.gameId)).size);
});
test('week and compound filters select only real source dates within a seven-day UTC interval',()=>{
  const actual=d.matches.find(m=>m.completed&&d.games.some(g=>g.matchId===m.id&&g.map)),dt=new Date(actual.date);dt.setUTCDate(dt.getUTCDate()-((dt.getUTCDay()+6)%7));
  const week=dt.toISOString().slice(0,10),start=Date.parse(week+'T00:00:00Z'),end=start+7*86400000;
  const all=C.subset(d,{week});assert.ok(all.length>0);assert.deepEqual(all,d.matches.filter(m=>Date.parse(m.date)>=start&&Date.parse(m.date)<end));
  const map=d.games.find(g=>g.matchId===actual.id&&g.map).map,filter={week,map,team:String(actual.teamA),event:String(actual.competitionId)};
  const expected=d.matches.filter(m=>Date.parse(m.date)>=start&&Date.parse(m.date)<end&&[m.teamA,m.teamB].includes(actual.teamA)&&m.competitionId===actual.competitionId&&d.games.some(g=>g.matchId===m.id&&g.map===map));
  assert.deepEqual(C.subset(d,filter),expected);assert.ok(C.subset(d,filter).some(m=>m.id===actual.id));assert.deepEqual(C.subset(d,{week:'1900-01-01'}),[]);
});
