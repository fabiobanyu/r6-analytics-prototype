'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const C=require('../src/engine.js'),d=require('../data/operators.json'),matches=require('../data/snapshot.json');
test('operator cohort values match the captured source board and never mix aggregate with team rows',()=>{
  assert.equal(C.validateOperators(d),true);
  const raw=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../data',d.source.file)));
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),d.source.sha256);
  const source=JSON.parse(raw),key='standalone/salt-lake-city-major';
  for(const row of d.rows){const ops=row.team===null?source.ops:source.opsTeam[row.team];assert.deepEqual([row.picks,row.wins],ops[`${row.operator}|${row.side}`][key]);}
  for(const side of ['Attack','Defense'])assert.equal(C.operatorStats(d,{side,minPicks:0}).reduce((s,r)=>s+r.picks,0),5*d.sideRounds[side]);
});
test('favorites, most wins and highest rate are distinct calculations using true round outcomes',()=>{
  const picks=C.operatorStats(d,{sort:'picks'}),wins=C.operatorStats(d,{sort:'wins'}),rates=C.operatorStats(d,{sort:'winRate'});
  assert.equal(picks[0].operator,'Smoke');assert.equal(picks[0].picks,382);assert.equal(wins[0].wins,198);assert.equal(rates[0].operator,'Pulse');assert.equal(rates[0].winRate,35/52);
  assert.ok(wins.findIndex(r=>r.operator==='Deimos')<wins.findIndex(r=>r.operator==='Brava'));
  assert.ok(rates.findIndex(r=>r.operator==='Brava')<rates.findIndex(r=>r.operator==='Deimos'));
});
test('operator minimum sample, side, team, search and unavailable event scopes are enforced',()=>{
  const rows=C.operatorStats(d,{team:'DarkZero',side:'Attack',minPicks:10,sort:'winRate'});
  assert.ok(rows.length>0&&rows.every(r=>r.team==='DarkZero'&&r.side==='Attack'&&r.picks>=10));
  assert.ok(C.operatorStats(d,{minPicks:100}).every(r=>r.picks>=100));
  assert.deepEqual(C.operatorStats(d,{event:'513'}),[]);
  assert.deepEqual(C.operatorStats(d,{team:'TEST ONLY unknown team'}),[]);
  assert.equal(C.operatorStats(d,{search:'smoke'})[0].operator,'Smoke');
  for(const r of rows){assert.ok(r.intervalLow<=r.winRate&&r.intervalHigh>=r.winRate);assert.ok(r.presence<=1);}
});
test('real zero wins remain zero and corrupted/duplicate operator rows are rejected',()=>{
  const zeros=C.operatorStats(d,{team:'All Gamers',minPicks:0}).filter(r=>r.wins===0&&r.picks>0);assert.ok(zeros.length);assert.ok(zeros.every(r=>r.winRate===0));
  const bad=structuredClone(d);bad.rows[0].wins=bad.rows[0].picks+1;assert.throws(()=>C.validateOperators(bad));
  const duplicated=structuredClone(d);duplicated.rows.push(duplicated.rows[0]);assert.throws(()=>C.validateOperators(duplicated));
});
test('operator ban chart counts unique maps independently of pick and win metrics',()=>{
  const leaders=C.banLeaders(matches,matches.matches);
  for(const row of leaders){const unique=new Set(matches.bans.filter(b=>b.operator===row.operator).map(b=>b.gameId));assert.equal(row.maps,unique.size);}
  const before=JSON.stringify(d);C.banLeaders(matches,matches.matches);assert.equal(JSON.stringify(d),before);
});
