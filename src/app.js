(() => {
  'use strict';
  const C=window.R6Core, $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=value=>new Intl.NumberFormat('id-ID').format(value);
  const pct=value=>value==null?'—':`${(100*value).toFixed(1)}%`;
  const date=(value,short=false)=>new Intl.DateTimeFormat('id-ID',{timeZone:'UTC',day:'2-digit',month:short?'short':'long',year:'numeric',...(short?{}:{hour:'2-digit',minute:'2-digit'})}).format(new Date(value));
  const operators=JSON.parse($('operator-dataset').textContent),icons=JSON.parse($('visual-assets').textContent);
  const operatorIcon=(name,extra='')=>icons[name]?`<span class="operator-icon ${extra}"><img src="${icons[name]}" alt="" width="48" height="48"></span>`:`<span class="operator-icon operator-fallback ${extra}" aria-hidden="true">${esc(name.slice(0,2).toUpperCase())}</span>`;
  let data, page=0, filtered=[], model, reloadBusy=false, started=false;
  const pageSize=20;
  const filters=()=>({event:$('event-filter').value,team:$('team-filter').value,search:$('search').value.trim()});
  const options=items=>items.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');
  function populate() {
    const previous=Object.fromEntries(['event-filter','team-filter','forecast-a','forecast-b'].map(id=>[id,$(id).value]));
    const eventItems=Object.values(data.competitions).filter(c=>data.matches.some(m=>m.competitionId===c.id)).map(c=>[c.id,c.name]);
    const ids=new Set(data.matches.flatMap(m=>[m.teamA,m.teamB]));
    const teamItems=Object.values(data.teams).filter(t=>ids.has(t.id)).sort((a,b)=>a.name.localeCompare(b.name)).map(t=>[t.id,t.name]);
    $('event-filter').innerHTML='<option value="">Semua kompetisi</option>'+options(eventItems);
    $('team-filter').innerHTML='<option value="">Semua tim</option>'+options(teamItems);
    for (const id of ['forecast-a','forecast-b']) $(id).innerHTML=options(teamItems);
    $('forecast-b').selectedIndex=Math.min(1,teamItems.length-1);
    for (const [id,value] of Object.entries(previous)) if ([...$(id).options].some(o=>o.value===value)) $(id).value=value;
  }
  function render() {
    filtered=C.subset(data,filters()).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||b.id-a.id);
    const s=C.summarize(data,filtered);
    const cards=[['Series selesai',s.played,`${num(s.upcoming)} jadwal dengan tim diketahui`],['Peta selesai',s.games,'Hanya peta yang selesai dimainkan'],['Detail series',s.detailed,`${pct(s.played?s.detailed/s.played:null)} dari series dalam filter`],['Ronde tercatat',s.rounds,'Dari halaman detail terunduh']];
    $('kpis').innerHTML=cards.map(([label,value,note])=>`<article class="kpi"><span>${label}</span><strong>${num(value)}</strong><small>${esc(note)}</small></article>`).join('');
    const max=Math.max(1,...s.weekly.map(w=>w[1]));
    $('timeline').innerHTML=s.weekly.length?s.weekly.map(([week,count])=>`<div class="week" style="height:${count?Math.max(2,count/max*100):0}%" title="Minggu ${week}: ${count} series"></div>`).join(''):'<div class="empty">Tidak ada series selesai dalam filter.</div>';
    $('timeline').setAttribute('aria-label',s.weekly.map(([w,n])=>`${w}: ${n} series`).join('; ')||'Tidak ada data');
    $('timeline').nextElementSibling?.classList.contains('timeline-axis') && $('timeline').nextElementSibling.remove();
    if(s.weekly.length) $('timeline').insertAdjacentHTML('afterend',`<div class="timeline-axis"><span>${s.weekly[0][0]}</span><span>${s.weekly.at(-1)[0]}</span></div>`);
    $('map-chart').innerHTML=s.maps.length?s.maps.map(m=>`<div class="map-row"><div class="map-meta"><b>${esc(m.name)}</b><span>${m.rounds?pct(m.attackWins/m.rounds):'—'} · ${num(m.rounds)} ronde / ${m.games} peta</span></div><div class="bar-track"><div class="bar-fill" style="width:${m.rounds?100*m.attackWins/m.rounds:0}%"></div><div class="bar-mid"></div></div></div>`).join(''):'<p class="empty">Detail peta belum tersedia untuk pilihan ini.</p>';
    const ranks=Object.entries(model.ratings).sort((a,b)=>b[1]-a[1]).slice(0,10);
    $('rankings').innerHTML=ranks.map(([id,r],i)=>`<tr><td><span class="rank-no">${String(i+1).padStart(2,'0')}</span>${esc(C.teamName(data,id))}</td><td class="elo">${r.toFixed(0)}</td><td>${model.counts[id]}</td><td>${model.wins[id]??0}</td></tr>`).join('');
    const players=C.playerLeaders(data,filtered);
    $('players').innerHTML=players.length?players.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths?(p.kills/p.deaths).toFixed(2):p.kills?'∞':'—'}</td><td>${p.kostRounds?pct(p.kostSum/p.kostRounds):'—'}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">Statistik pemain belum tersedia untuk pilihan ini.</td></tr>';
    renderMatches();
    renderOperators();
  }
  function operatorFilter(extra={}) {
    const main=filters();
    return {event:main.event,team:main.team?C.teamName(data,main.team):null,side:$('operator-side').value,minPicks:Number($('operator-min').value),search:$('operator-search').value.trim(),sort:$('operator-sort').value,...extra};
  }
  function operatorHighlight(row,label,note,accent='teal') {
    return `<article class="operator-highlight ${accent}"><p class="eyebrow">${esc(label)}</p><div class="operator-highlight-main">${operatorIcon(row.operator,'large')}<div><h3>${esc(row.operator)}</h3><span class="side-label ${row.side==='Attack'?'attack':'defense'}">${row.side==='Attack'?'Menyerang':'Bertahan'}</span></div></div><strong>${esc(note)}</strong><small>${num(row.wins)} menang dari ${num(row.picks)} pemilihan · ${pct(row.winRate)}</small></article>`;
  }
  function renderOperators() {
    const rows=C.operatorStats(operators,operatorFilter());
    const total=C.operatorStats(operators,operatorFilter({minPicks:0,search:''})).length;
    const favorites=C.operatorStats(operators,operatorFilter({sort:'picks'}));
    const winners=C.operatorStats(operators,operatorFilter({sort:'wins'}));
    const rates=C.operatorStats(operators,operatorFilter({sort:'winRate'}));
    const team=filters().team?C.teamName(data,filters().team):null;
    const unavailable=filters().event && filters().event!==String(operators.competitionId);
    const empty=unavailable?'Snapshot pemilihan operator tersedia untuk Salt Lake City Major 2026. Pilih event tersebut atau “Semua kompetisi”.':team&&!operators.rows.some(r=>r.team===team)?`Belum ada statistik pemilihan operator untuk ${team} pada snapshot ini.`:'Tidak ada operator yang memenuhi filter. Kurangi minimum pemilihan atau ubah pencarian.';
    $('operator-insights').innerHTML=rows.length?operatorHighlight(favorites[0],'Paling sering dipilih',`${num(favorites[0].picks)} kali dipilih`,'teal')+operatorHighlight(winners[0],'Kemenangan terbanyak',`${num(winners[0].wins)} ronde menang`,'amber')+operatorHighlight(rates[0],`Win rate tertinggi · min. ${$('operator-min').value} pilihan`,pct(rates[0].winRate),'blue'):`<div class="empty operator-empty">${esc(empty)}</div>`;
    $('operator-count').textContent=`${rows.length} dari ${total} operator · ${team??'Semua tim dalam snapshot SLC'} · minimum ${$('operator-min').value} pemilihan. Filter kompetisi dan tim mengikuti filter utama.`;
    $('operator-rows').innerHTML=rows.length?rows.map((r,i)=>`<tr><td><div class="operator-name"><span class="rank-no">${String(i+1).padStart(2,'0')}</span>${operatorIcon(r.operator)}<strong>${esc(r.operator)}</strong></div></td><td><span class="side-label ${r.side==='Attack'?'attack':'defense'}">${r.side==='Attack'?'Menyerang':'Bertahan'}</span></td><td>${num(r.picks)}</td><td class="win-count">${num(r.wins)}</td><td title="Interval Wilson 95% indikatif: ${pct(r.intervalLow)}–${pct(r.intervalHigh)}; ronde dapat berkorelasi"><div class="win-rate-cell"><b>${pct(r.winRate)}</b><span class="rate-track"><i style="width:${(r.winRate??0)*100}%"></i></span></div></td><td>${pct(r.presence)}<small class="cell-note">${num(r.sideRounds)} ronde sisi tercatat</small></td></tr>`).join(''):`<tr><td colspan="6" class="empty">${esc(empty)}</td></tr>`;
    $('export-operators').disabled=!rows.length;
    const spotlight=C.operatorStats(operators,operatorFilter({sort:'picks',side:'',search:'',minPicks:30}));
    const attack=spotlight.find(r=>r.side==='Attack'),defense=spotlight.find(r=>r.side==='Defense');
    $('operator-preview').innerHTML=attack&&defense?[attack,defense].map(r=>`<article class="spotlight-card ${r.side==='Attack'?'attack':'defense'}">${operatorIcon(r.operator,'spotlight-icon')}<div><p class="eyebrow">Favorit ${r.side==='Attack'?'menyerang':'bertahan'}</p><h3>${esc(r.operator)}</h3><p><b>${num(r.picks)}</b> pemilihan <span>·</span> <b>${num(r.wins)}</b> ronde menang</p></div><div class="spotlight-rate"><strong>${pct(r.winRate)}</strong><span>win rate ronde</span></div></article>`).join(''):`<p class="empty">${esc(empty)}</p>`;
    const bans=C.banLeaders(data,filtered,filters().team||null),max=Math.max(1,...bans.map(b=>b.maps));
    $('ban-chart').innerHTML=bans.length?bans.map(b=>`<div class="ban-item">${operatorIcon(b.operator)}<div><div class="map-meta"><b>${esc(b.operator)}</b><span>${num(b.maps)} peta</span></div><div class="bar-track"><div class="bar-fill" style="width:${b.maps/max*100}%"></div></div></div></div>`).join(''):'<p class="empty">Tidak ada operator ban dalam cakupan filter.</p>';
  }
  function renderOperatorSource() {
    const all=C.operatorStats(operators,{sort:'picks',minPicks:0});
    const featured=[all.find(r=>r.side==='Attack'),all.find(r=>r.side==='Defense')].filter(Boolean);
    $('hero-operators').innerHTML=featured.map(r=>`<div class="hero-operator ${r.side==='Attack'?'attack':'defense'}">${operatorIcon(r.operator,'hero-icon')}<span class="hero-op-role">${r.side==='Attack'?'ATK':'DEF'}</span><h3>${esc(r.operator)}</h3><p>${num(r.picks)} pilihan <span>/${pct(r.winRate)}</span></p></div>`).join('');
    const matchIds=new Set(data.matches.filter(m=>m.competitionId===operators.competitionId).map(m=>m.id));
    const officialRounds=data.rounds.filter(r=>matchIds.has(r.matchId)).length;
    $('operator-scope').textContent=`Cakupan replay sumber tambahan: ${num(operators.sideRounds.Attack)} ronde sisi serang dan ${num(operators.sideRounds.Defense)} sisi bertahan, dibanding ${num(officialRounds)} ronde pada hasil resmi event. Snapshot ${date(operators.source.capturedAt,true)} UTC; tidak mencakup semua event.`;
    $('operator-provenance').textContent=`Snapshot sumber ditangkap ${operators.source.capturedAt}. SHA-256 ekstrak: ${operators.source.sha256}. Statistik menunjukkan hasil ronde ketika operator dipilih, bukan kemenangan series atau efek kausal operator.`;
  }
  function renderMatches() {
    const pages=Math.max(1,Math.ceil(filtered.length/pageSize)); page=Math.max(0,Math.min(page,pages-1));
    $('match-count').textContent=`${num(filtered.length)} series dalam filter · skor series, bukan skor ronde`;
    $('match-rows').innerHTML=filtered.slice(page*pageSize,(page+1)*pageSize).map(m=>`<tr><td class="match-date">${esc(date(m.date,true))}<br>${new Date(m.date).toISOString().slice(11,16)} ${m.isTimeTBD?'(TBD)':''}</td><td>${esc(C.teamName(data,m.teamA))}<span class="score">${m.completed?`${m.scoreA??'—'} : ${m.scoreB??'—'}`:'vs'}</span>${esc(C.teamName(data,m.teamB))}</td><td>${esc(data.competitions[m.competitionId]?.name??'—')}</td><td><span class="status-tag ${!m.detailed?'missing':''}">${!m.completed?'TERJADWAL':m.detailed?'DETAIL':'SKOR'}</span>${m.forfeit?' · forfeit':''}</td><td><button class="subtle detail-button" data-id="${m.id}">Lihat ↗</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">Tidak ada pertandingan yang cocok.</td></tr>';
    $('page-label').textContent=`${page+1} / ${pages}`; $('prev').disabled=page===0; $('next').disabled=page>=pages-1;
  }
  function renderModel() {
    const e=model.evaluation;
    $('evaluation').innerHTML=`<div class="eval-grid"><div class="eval-cell"><span>BRIER · LEBIH KECIL LEBIH BAIK</span><strong>${e.brier==null?'—':e.brier.toFixed(3)}</strong><span>Baseline 50%: 0.250</span></div><div class="eval-cell"><span>LOG LOSS · LEBIH KECIL LEBIH BAIK</span><strong>${e.logLoss==null?'—':e.logLoss.toFixed(3)}</strong><span>Baseline 50%: 0.693</span></div><div class="eval-cell"><span>SERIES DIEVALUASI</span><strong>${e.n}</strong><span>Dari ${e.total} series eligible</span></div><div class="eval-cell"><span>AKURASI FAVORIT HISTORIS</span><strong>${pct(e.accuracy)}</strong><span>${e.decisive} prediksi dengan p ≠ 50%</span></div></div><p class="coverage-note">${e.n<30?'Sampel evaluasi masih kecil.':e.brier<.25?'Brier lebih baik dari tebakan 50% pada cakupan ini.':'Brier belum mengalahkan tebakan 50% pada cakupan ini.'} Tidak ada jaminan hasil berikutnya.</p>`;
    $('evaluation').insertAdjacentHTML('beforeend',`<p class="chart-note">Pembanding proporsi historis tim A (dihitung hanya dari hasil sebelumnya): Brier ${e.priorBrier?.toFixed(3)??'—'}, log loss ${e.priorLogLoss?.toFixed(3)??'—'}. Selalu memilih tim A menghasilkan akurasi ${pct(e.alwaysAAccuracy)} pada sampel evaluasi yang sama. Urutan tim pada sumber dapat mengandung bias.</p>`);
    $('coverage').textContent=`${num(data.matches.length)} series, ${num(data.games.length)} peta, ${num(data.rounds.length)} ronde, ${num(data.players.length)} baris pemain-peta. Cakupan: event global musim ${data.meta.season.name} serta stage regional yang ditampilkan sebagai default oleh halaman resmi. Ini bukan arsip lengkap seluruh musim. ${num(data.meta.warnings.length)} slot/record tidak lengkap dicatat pada metadata, bukan diisi dengan tim buatan.`;
    $('sources-title').textContent=`Manifest ${num(data.sources.length)} halaman sumber · HTTP, waktu unduh, dan SHA-256`;
    $('source-list').innerHTML=data.sources.map(s=>`<div class="source-record"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.route)} ↗</a><small>HTTP ${s.httpStatus} · diunduh ${esc(s.retrievedAt)}<br>SHA-256 ekstrak: ${esc(s.sha256)}</small></div>`).join('');
    $('data-digest').textContent=`SHA-256 konten data: ${data.meta.dataSha256} · Skema v${data.schemaVersion}`;
  }
  function showDetail(id) {
    const m=data.matches.find(m=>m.id===id); if(!m)return;
    const games=data.games.filter(g=>g.matchId===id);
    $('detail-content').innerHTML=`<h2>${esc(C.teamName(data,m.teamA))} <span class="elo">${m.completed?`${m.scoreA} : ${m.scoreB}`:'vs'}</span> ${esc(C.teamName(data,m.teamB))}</h2><p class="muted">${esc(date(m.date))} UTC · ${esc(data.competitions[m.competitionId]?.name)} · BO${m.bestOf??'?'}${m.forfeit?' · Forfeit':''}</p><a class="subtle" href="${data.meta.sourceBase}match/${m.id}" target="_blank" rel="noopener noreferrer">Buka catatan resmi ↗</a>${!m.detailed?'<p class="coverage-note">Detail ronde dan pemain belum diunduh. Hanya data skor yang tersedia; statistik tidak diperkirakan.</p>':''}${games.map((g,i)=>{
      const rounds=data.rounds.filter(r=>r.gameId===g.id), players=data.players.filter(p=>p.gameId===g.id), bans=data.bans.filter(b=>b.gameId===g.id);
      return `<div class="game-card"><div class="game-heading"><b>${i+1}. ${esc(g.map??'Nama peta belum tersedia')}</b><b>${g.scoreA??'—'} : ${g.scoreB??'—'}</b></div><small class="muted">${esc(C.teamName(data,g.teamA))} / ${esc(C.teamName(data,g.teamB))}</small>${rounds.length?`<div class="round-strip">${rounds.map(r=>`<span class="round-cell ${r.winnerId!==r.attackerId?'defense':''}" title="Ronde ${r.index}: ${esc(C.teamName(data,r.winnerId))}">${r.index}</span>`).join('')}</div><div class="round-key">Hijau: serang menang · biru: bertahan menang · ${rounds.length} ronde tercatat</div>`:''}${players.length?`<div class="table-wrap"><table><thead><tr><th>Pemain</th><th>Tim</th><th>K / D</th><th>KOST</th></tr></thead><tbody>${players.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(C.teamName(data,p.teamId))}</td><td>${p.kills??'—'} / ${p.deaths??'—'}</td><td>${pct(p.kost)}</td></tr>`).join('')}</tbody></table></div>`:''}${bans.length?`<p class="chart-note">Operator ban (sumber): ${bans.map(b=>esc(b.operator)).join(', ')}. Baris ban memiliki teamId dan roundIndex pada dataset.</p>`:''}</div>`;
    }).join('')}${!games.length?'<p class="empty">Belum ada peta selesai yang tercatat.</p>':''}`;
    $('match-dialog').showModal();
  }
  function accept(next,initial=false) {
    C.validate(next);
    if(!initial && next.meta.generatedAt===data.meta.generatedAt && next.meta.dataSha256===data.meta.dataSha256)return;
    data=next; model=C.elo(data); populate(); render(); renderModel(); renderOperatorSource();
    $('season-label').textContent=`MUSIM ${data.meta.season.name}`;
    $('snapshot-date').textContent=`${date(data.meta.generatedAt)} UTC`;
    $('source-latest').textContent=`Laga selesai terbaru: ${data.meta.latestCompletedMatch?date(data.meta.latestCompletedMatch,true):'—'} UTC`;
    $('forecast-result').textContent='Pilih dua tim untuk melihat estimasi berdasarkan snapshot ini.';
    updateStatus();
  }
  function updateStatus() {
    const status=window.R6_STATUS;
    const age=(Date.now()-Date.parse(data.meta.generatedAt))/3600000;
    $('sync-status').className='';
    if(status && !status.ok){$('sync-status').textContent='Pembaruan gagal · cache terakhir dipertahankan';$('sync-status').className='error';$('sync-status').title=status.message;}
    else if(status?.errors?.length || data.meta.downloadErrors?.length){$('sync-status').textContent='Snapshot tersedia · sebagian detail gagal diunduh';$('sync-status').className='warning';}
    else if(age>12){$('sync-status').textContent=`Cache berusia ${Math.floor(age)} jam · jalankan pembaru`; $('sync-status').className='warning';}
    else {$('sync-status').textContent=`Cache terverifikasi${data.meta.offlineRebuild?' · rebuild offline':''} · bukan feed langsung`;}
  }
  function loadCache() {
    if(reloadBusy)return; reloadBusy=true; $('check-cache').disabled=true;
    let remaining=2, failed=false;
    for(const file of ['latest.js','status.js']){
      const script=document.createElement('script'); script.src=`data/${file}?t=${Date.now()}`;
      const finish=()=>{script.remove(); if(--remaining===0){reloadBusy=false;$('check-cache').disabled=false;if(failed){$('sync-status').textContent='Snapshot tertanam aktif · folder cache tidak dapat dibaca';$('sync-status').className='warning';}}};
      script.onload=finish;script.onerror=()=>{failed=true;finish();};document.body.append(script);
    }
  }
  for(const link of document.querySelectorAll('nav a'))link.addEventListener('click',()=>setTimeout(view,0));
  function view(){const name=['overview','operators','matches','model'].includes(location.hash.slice(1))?location.hash.slice(1):'overview'; for(const node of document.querySelectorAll('.view'))node.hidden=node.id!==name;for(const a of document.querySelectorAll('nav a')){a.classList.toggle('active',a.dataset.view===name);a.setAttribute('aria-current',a.dataset.view===name?'page':'false');}$('view-label').textContent=({overview:'Ringkasan',operators:'Operator intel',matches:'Pertandingan',model:'Model & sumber'})[name];$('hero-banner').hidden=name!=='overview';$('main-content').dataset.view=name;}
  window.addEventListener('hashchange',view);
  for(const id of ['event-filter','team-filter'])$(id).addEventListener('change',()=>{page=0;render();});
  $('search').addEventListener('input',()=>{page=0;render();});
  $('reset').addEventListener('click',()=>{for(const id of ['event-filter','team-filter','search'])$(id).value='';page=0;render();});
  $('prev').addEventListener('click',()=>{page--;renderMatches();});$('next').addEventListener('click',()=>{page++;renderMatches();});
  $('match-rows').addEventListener('click',e=>{const b=e.target.closest('.detail-button');if(b)showDetail(Number(b.dataset.id));});
  $('close-dialog').addEventListener('click',()=>$('match-dialog').close());
  $('predict').addEventListener('click',()=>{try{const a=$('forecast-a').value,b=$('forecast-b').value,p=C.forecast(data,a,b);$('forecast-result').innerHTML=p.ready?`<div class="forecast-number">${pct(p.p)} <small>peluang ${esc(C.teamName(data,a))}</small></div><p class="muted">${esc(C.teamName(data,b))}: ${pct(1-p.p)} · Riwayat: ${p.na} / ${p.nb} series. Prediksi ini tidak menambahkan pertandingan atau hasil ke dataset.</p>`:`<p class="coverage-note">Data belum cukup: masing-masing tim memerlukan 5 series eligible. Riwayat tersedia: ${p.na} / ${p.nb}.</p>`;}catch(e){$('forecast-result').textContent=e.message;}});
  $('export').addEventListener('click',()=>{const rows=filtered.map(m=>({match_id:m.id,date_utc:m.date,competition:data.competitions[m.competitionId]?.name,team_a:C.teamName(data,m.teamA),team_b:C.teamName(data,m.teamB),score_a:m.scoreA,score_b:m.scoreB,completed:m.completed,winner:m.winnerId?C.teamName(data,m.winnerId):null,detailed:m.detailed,source_url:data.meta.sourceBase+m.source}));const blob=new Blob([C.csv(rows)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`r6-official-matches-${new Date(data.meta.generatedAt).toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('check-cache').addEventListener('click',loadCache);
  for(const id of ['operator-side','operator-sort','operator-min'])$(id).addEventListener('change',renderOperators);
  $('operator-search').addEventListener('input',renderOperators);
  $('export-operators').addEventListener('click',()=>{const rows=C.operatorStats(operators,operatorFilter()).map(r=>({operator:r.operator,side:r.side,team:r.team,picks:r.picks,round_wins:r.wins,round_win_rate:r.winRate,side_rounds:r.sideRounds,presence:r.presence,source_url:operators.source.url,captured_at:operators.source.capturedAt}));const url=URL.createObjectURL(new Blob([C.csv(rows)],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='r6-operators-slc-2026.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  window.addEventListener('r6-update',()=>{try{accept(window.R6_LATEST);}catch(e){$('sync-status').textContent=`Cache baru ditolak: ${e.message}`;$('sync-status').className='error';}});
  window.addEventListener('r6-status',()=>{if(started)updateStatus();});
  try{C.validateOperators(operators);accept(JSON.parse($('dataset').textContent),true);started=true;view();loadCache();setInterval(loadCache,60000);setInterval(updateStatus,60000);}catch(e){$('fatal').hidden=false;$('fatal').textContent=`Snapshot tidak dapat ditampilkan: ${e.message}`;}
})();
