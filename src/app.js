(() => {
  'use strict';
  const C=window.R6Core, $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=value=>new Intl.NumberFormat('id-ID').format(value);
  const pct=value=>value==null?'—':`${(100*value).toFixed(1)}%`;
  const date=(value,short=false)=>new Intl.DateTimeFormat('id-ID',{timeZone:'UTC',day:'2-digit',month:short?'short':'long',year:'numeric',...(short?{}:{hour:'2-digit',minute:'2-digit'})}).format(new Date(value));
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
    const cards=[['SERIES SELESAI',s.played,`${num(s.upcoming)} terjadwal dengan tim diketahui`],['PETA SELESAI',s.games,'Tidak termasuk peta yang belum dimainkan'],['DETAIL SERIES',s.detailed,`${pct(s.played?s.detailed/s.played:null)} dari series dalam filter`],['RONDE TERCATAT',s.rounds,'Hanya dari halaman detail terunduh']];
    $('kpis').innerHTML=cards.map(([label,value,note])=>`<article class="kpi"><span>${label}</span><strong>${num(value)}</strong><small>${esc(note)}</small></article>`).join('');
    const max=Math.max(1,...s.weekly.map(w=>w[1]));
    $('timeline').innerHTML=s.weekly.length?s.weekly.map(([week,count])=>`<div class="week" style="height:${Math.max(2,count/max*100)}%" title="Minggu ${week}: ${count} series"></div>`).join(''):'<div class="empty">Tidak ada series selesai dalam filter.</div>';
    $('timeline').setAttribute('aria-label',s.weekly.map(([w,n])=>`${w}: ${n} series`).join('; ')||'Tidak ada data');
    $('timeline').nextElementSibling?.classList.contains('timeline-axis') && $('timeline').nextElementSibling.remove();
    if(s.weekly.length) $('timeline').insertAdjacentHTML('afterend',`<div class="timeline-axis"><span>${s.weekly[0][0]}</span><span>${s.weekly.at(-1)[0]}</span></div>`);
    $('map-chart').innerHTML=s.maps.length?s.maps.map(m=>`<div class="map-row"><div class="map-meta"><b>${esc(m.name)}</b><span>${m.rounds?pct(m.attackWins/m.rounds):'—'} · ${num(m.rounds)} ronde / ${m.games} peta</span></div><div class="bar-track"><div class="bar-fill" style="width:${m.rounds?100*m.attackWins/m.rounds:0}%"></div><div class="bar-mid"></div></div></div>`).join(''):'<p class="empty">Detail peta belum tersedia untuk pilihan ini.</p>';
    const ranks=Object.entries(model.ratings).sort((a,b)=>b[1]-a[1]).slice(0,10);
    $('rankings').innerHTML=ranks.map(([id,r],i)=>`<tr><td><span class="rank-no">${String(i+1).padStart(2,'0')}</span>${esc(C.teamName(data,id))}</td><td class="elo">${r.toFixed(0)}</td><td>${model.counts[id]}</td><td>${model.wins[id]??0}</td></tr>`).join('');
    const players=C.playerLeaders(data,filtered);
    $('players').innerHTML=players.length?players.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths?(p.kills/p.deaths).toFixed(2):p.kills?'∞':'—'}</td><td>${p.kostRounds?pct(p.kostSum/p.kostRounds):'—'}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">Statistik pemain belum tersedia untuk pilihan ini.</td></tr>';
    renderMatches();
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
    data=next; model=C.elo(data); populate(); render(); renderModel();
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
  function view(){const name=['overview','matches','model'].includes(location.hash.slice(1))?location.hash.slice(1):'overview'; for(const node of document.querySelectorAll('.view'))node.hidden=node.id!==name;for(const a of document.querySelectorAll('nav a')){a.classList.toggle('active',a.dataset.view===name);a.setAttribute('aria-current',a.dataset.view===name?'page':'false');}}
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
  window.addEventListener('r6-update',()=>{try{accept(window.R6_LATEST);}catch(e){$('sync-status').textContent=`Cache baru ditolak: ${e.message}`;$('sync-status').className='error';}});
  window.addEventListener('r6-status',()=>{if(started)updateStatus();});
  try{accept(JSON.parse($('dataset').textContent),true);started=true;view();loadCache();setInterval(loadCache,60000);setInterval(updateStatus,60000);}catch(e){$('fatal').hidden=false;$('fatal').textContent=`Snapshot tidak dapat ditampilkan: ${e.message}`;}
})();
