(function (global) {
  'use strict';
  const teamName = (d, id) => d.teams[String(id)]?.name ?? `Team ${id}`;
  function validate(d) {
    if (d.schemaVersion !== 1 || !Array.isArray(d.matches) || !d.meta?.generatedAt) throw Error('Skema snapshot tidak sesuai');
    const seen = new Set();
    for (const m of d.matches) {
      if (seen.has(m.id) || m.teamA === m.teamB || !d.teams[m.teamA] || !d.teams[m.teamB] || !Number.isFinite(Date.parse(m.date))) throw Error('Identitas pertandingan tidak valid');
      seen.add(m.id);
      if (m.winnerId != null && (!m.completed || ![m.teamA,m.teamB].includes(m.winnerId))) throw Error('Label pemenang tidak valid');
      if (!d.sources.some(s => s.route === m.source && s.httpStatus === 200)) throw Error('Provenance pertandingan hilang');
    }
    for (const g of d.games) if (!seen.has(g.matchId)) throw Error('Peta tanpa pertandingan');
    return true;
  }
  const probability = (a, b) => 1 / (1 + 10 ** ((b-a)/400));
  const eligible = (m, cutoff) => m.completed && m.winnerId != null && !m.forfeit && Date.parse(m.date) < cutoff;
  function elo(d, cutoff = Date.parse(d.meta.generatedAt)) {
    const ratings = {}, counts = {}, wins = {}, predictions = [];
    let previousOutcomes=0, previousAWins=0;
    const input = d.matches.filter(m => eligible(m, cutoff)).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date) || a.id-b.id);
    // Predict an entire timestamp batch before updating ANY result in it.
    for (let i=0; i<input.length;) {
      let j=i; const deltas = {}, batchCounts = {}, batchWins = {};
      while (j<input.length && Date.parse(input[j].date) === Date.parse(input[i].date)) j++;
      for (const m of input.slice(i,j)) {
        const a=m.teamA, b=m.teamB, ra=ratings[a]??1500, rb=ratings[b]??1500;
        const p=probability(ra,rb), actual=Number(m.winnerId===a);
        predictions.push({matchId:m.id,date:m.date,p,actual,priorProbability:(previousAWins+1)/(previousOutcomes+2),priorA:counts[a]??0,priorB:counts[b]??0});
        deltas[a]=(deltas[a]??0)+24*(actual-p); deltas[b]=(deltas[b]??0)-24*(actual-p);
        for (const t of [a,b]) batchCounts[t]=(batchCounts[t]??0)+1;
        batchWins[m.winnerId]=(batchWins[m.winnerId]??0)+1;
      }
      for (const [t,v] of Object.entries(deltas)) ratings[t]=(ratings[t]??1500)+v;
      for (const [t,v] of Object.entries(batchCounts)) counts[t]=(counts[t]??0)+v;
      for (const [t,v] of Object.entries(batchWins)) wins[t]=(wins[t]??0)+v;
      for (const m of input.slice(i,j)) {previousOutcomes++;previousAWins+=Number(m.winnerId===m.teamA);}
      i=j;
    }
    const tested=predictions.filter(p=>p.priorA>=3 && p.priorB>=3);
    const brier=tested.length ? tested.reduce((s,x)=>s+(x.p-x.actual)**2,0)/tested.length : null;
    const logLoss=tested.length ? -tested.reduce((s,x)=>s+x.actual*Math.log(x.p)+(1-x.actual)*Math.log(1-x.p),0)/tested.length : null;
    const decisive=tested.filter(x=>Math.abs(x.p-.5)>1e-12);
    const accuracy=decisive.length ? decisive.filter(x=>Number(x.p>.5)===x.actual).length/decisive.length : null;
    const priorBrier=tested.length ? tested.reduce((s,x)=>s+(x.priorProbability-x.actual)**2,0)/tested.length : null;
    const priorLogLoss=tested.length ? -tested.reduce((s,x)=>s+x.actual*Math.log(x.priorProbability)+(1-x.actual)*Math.log(1-x.priorProbability),0)/tested.length : null;
    const alwaysAAccuracy=tested.length ? tested.reduce((s,x)=>s+x.actual,0)/tested.length : null;
    const bins=Array.from({length:5},(_,i)=>{
      const rows=tested.filter(x=>Math.min(4,Math.floor(x.p*5))===i);
      return {low:i/5,high:(i+1)/5,n:rows.length,p:rows.length?rows.reduce((s,x)=>s+x.p,0)/rows.length:null,actual:rows.length?rows.reduce((s,x)=>s+x.actual,0)/rows.length:null};
    });
    return {ratings,counts,wins,predictions,evaluation:{n:tested.length,total:predictions.length,brier,logLoss,accuracy,decisive:decisive.length,baselineBrier:.25,baselineLogLoss:Math.log(2),priorBrier,priorLogLoss,alwaysAAccuracy,bins}};
  }
  function forecast(d,a,b) {
    if (String(a)===String(b)) throw Error('Pilih dua tim yang berbeda');
    const model=elo(d), na=model.counts[a]??0, nb=model.counts[b]??0;
    if (na<5 || nb<5) return {ready:false,na,nb};
    return {ready:true,na,nb,p:probability(model.ratings[a]??1500,model.ratings[b]??1500)};
  }
  function subset(d,filter={}) {
    return d.matches.filter(m=>(!filter.event || String(m.competitionId)===filter.event) && (!filter.team || [m.teamA,m.teamB].map(String).includes(filter.team)) &&
      (!filter.search || `${teamName(d,m.teamA)} ${teamName(d,m.teamB)} ${d.competitions[m.competitionId]?.name??''}`.toLowerCase().includes(filter.search.toLowerCase())));
  }
  function summarize(d, matches) {
    const ids=new Set(matches.map(m=>m.id)), played=matches.filter(m=>m.completed);
    const games=d.games.filter(g=>ids.has(g.matchId)), rounds=d.rounds.filter(r=>ids.has(r.matchId));
    const mapByGame=new Map(games.map(g=>[g.id,g.map]));
    const maps={};
    for (const g of games) if (g.map) { maps[g.map]??={name:g.map,games:0,rounds:0,attackWins:0}; maps[g.map].games++; }
    for (const r of rounds) {
      const name=mapByGame.get(r.gameId);
      if (name && r.winnerId && r.attackerId && r.defenderId && [r.attackerId,r.defenderId].includes(r.winnerId)) {
        maps[name].rounds++; maps[name].attackWins+=Number(r.winnerId===r.attackerId);
      }
    }
    const weekly={};
    for (const m of played) {
      const dt=new Date(m.date); dt.setUTCDate(dt.getUTCDate()-((dt.getUTCDay()+6)%7));
      const key=dt.toISOString().slice(0,10); weekly[key]=(weekly[key]??0)+1;
    }
    const observedWeeks=Object.keys(weekly).sort();
    if(observedWeeks.length) for(let t=Date.parse(observedWeeks[0]);t<=Date.parse(observedWeeks.at(-1));t+=7*86400000){const key=new Date(t).toISOString().slice(0,10);weekly[key]??=0;}
    return {played:played.length,upcoming:matches.filter(m=>!m.completed).length,detailed:played.filter(m=>m.detailed).length,games:games.length,rounds:rounds.length,
      maps:Object.values(maps).sort((a,b)=>b.games-a.games),weekly:Object.entries(weekly).sort((a,b)=>a[0].localeCompare(b[0]))};
  }
  function playerLeaders(d,matches) {
    const ids=new Set(matches.map(m=>m.id)), players={};
    for (const row of d.players.filter(p=>ids.has(p.matchId))) {
      // Incomplete kill/death rows cannot silently become zero.
      if (row.kills==null || row.deaths==null) continue;
      const key=String(row.playerId), p=players[key]??={id:row.playerId,name:row.name,kills:0,deaths:0,games:0,kostSum:0,kostRounds:0};
      p.kills+=row.kills; p.deaths+=row.deaths; p.games++;
      if (row.kost!=null && row.roundsPlayed>0) {p.kostSum+=row.kost*row.roundsPlayed;p.kostRounds+=row.roundsPlayed;}
    }
    return Object.values(players).sort((a,b)=>b.kills-a.kills).slice(0,10);
  }
  function csv(rows) {
    if (!rows.length) return '';
    const columns=Object.keys(rows[0]);
    const cell=value=>{
      let text=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);
      if (/^[\s]*[=+@-]/.test(text)) text="'"+text;
      return '"'+text.replace(/"/g,'""')+'"';
    };
    return '\uFEFF'+[columns.map(cell).join(','),...rows.map(r=>columns.map(k=>cell(r[k])).join(','))].join('\r\n');
  }
  const api={validate,teamName,probability,elo,forecast,subset,summarize,playerLeaders,csv};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  global.R6Core=api;
})(typeof globalThis!=='undefined'?globalThis:this);
