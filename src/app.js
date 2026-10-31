(() => {
  'use strict';
  const C=window.R6Core, $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=value=>new Intl.NumberFormat('id-ID').format(value);
  const pct=value=>value==null?'—':`${(100*value).toFixed(1)}%`;
  const date=(value,short=false)=>new Intl.DateTimeFormat('id-ID',{timeZone:'UTC',day:'2-digit',month:short?'short':'long',year:'numeric',...(short?{}:{hour:'2-digit',minute:'2-digit'})}).format(new Date(value));
  const operators=JSON.parse($('operator-dataset').textContent),icons=JSON.parse($('visual-assets').textContent);
  const operatorIcon=(name,extra='')=>icons[name]?`<span class="operator-icon ${extra}"><img src="${icons[name]}" alt="" width="48" height="48"></span>`:`<span class="operator-icon operator-fallback ${extra}" aria-hidden="true">${esc(name.slice(0,2).toUpperCase())}</span>`;
  let data, page=0, filtered=[], model, reloadBusy=false, started=false,selectedMap='',selectedWeek='',guideStep=0,operatorDetail=null,toastTimer=null,forecastShown=false;
  const pageSize=20;
  const filters=()=>({event:$('event-filter').value,team:$('team-filter').value,search:$('search').value.trim(),map:selectedMap,week:selectedWeek});
  const terms={
    series:['Pertandingan (series)','Satu pertemuan dua tim. Satu pertandingan dapat berisi beberapa peta. Skor 2 : 1 berarti tim menang pada dua peta dan kalah pada satu peta, bukan berarti hanya ada tiga ronde.'],
    map:['Peta','Arena tempat permainan berlangsung. Satu peta berisi beberapa ronde. Filter peta menampilkan pertandingan yang memuat peta tersebut; hitungan peta, ronde, dan statistik pemain hanya memakai peta yang dipilih.'],
    round:['Ronde','Satu babak kecil dalam sebuah peta. Setiap ronde memiliki pemenang. Jumlah kemenangan ronde berbeda dengan jumlah pertandingan yang dimenangkan.'],
    operator:['Operator','Karakter yang dipilih pemain. “Operator favorit” di sini berarti paling sering dipilih pada data yang tersedia, bukan karakter yang pasti paling kuat.'],
    side:['Menyerang dan bertahan','Dalam satu ronde ada tim penyerang dan tim bertahan. Grafik peta menghitung seberapa sering penyerang menang dari ronde yang tercatat. Tim dapat berganti sisi selama permainan.'],
    winRate:['Win rate: bagian yang berakhir menang','Dihitung dari jumlah ronde menang dibagi jumlah pemilihan operator. Contoh dari data akan ditampilkan saat Anda membuka operator. Win rate tinggi pada sedikit pemilihan belum tentu lebih meyakinkan daripada angka lebih rendah pada banyak pemilihan.'],
    sample:['Minimum pemilihan: ukuran sampel','Ini batas jumlah pemilihan sebelum operator ditampilkan. Pilih minimum yang lebih besar untuk menyembunyikan operator yang jarang tercatat. Batas ini menyaring tampilan, tidak mengubah data atau menjamin operator terbaik.'],
    elo:['Elo: angka ringkasan riwayat tim','Semua tim mulai dari angka 1500 dalam data ini. Angkanya berubah setelah menang atau kalah, dengan memperhitungkan rating lawan. Angka lebih tinggi berarti lebih unggul menurut model pada riwayat yang tersedia; roster, peta, dan patch belum dimasukkan.'],
    probability:['Peluang: perkiraan, bukan kepastian','Peluang lebih besar tidak berarti pasti menang. Kedua tim tetap mungkin menang. Angka berasal dari model berdasarkan riwayat dalam data ini; ia bukan hasil baru atau jaminan untuk pertandingan berikutnya.'],
    kd:['K/D: perbandingan eliminasi dan kematian','Jumlah eliminasi pemain dibagi jumlah kematiannya. Nilai 2 berarti dua eliminasi untuk setiap satu kematian dalam data tersebut. Ini hanya salah satu ukuran, bukan penilaian lengkap kemampuan pemain.'],
    kost:['KOST: ringkasan keterlibatan per ronde','Indikator kontribusi pemain dalam ronde yang dilaporkan sumber. Angka ini menggambarkan statistik pemain, bukan peluang tim menang. Ringkasan di halaman menggunakan bobot jumlah ronde yang tersedia.'],
    brier:['Brier dan log loss: ukuran kesalahan perkiraan','Dua cara memeriksa apakah angka peluang model cocok dengan hasil pertandingan. Lebih kecil lebih baik pada sampel yang sama. Nilai ini dibandingkan dengan tebakan sederhana; perbedaan kecil belum membuktikan model kuat.'],
    snapshot:['Snapshot: salinan data pada suatu waktu','Halaman membaca salinan data yang sudah disimpan agar dapat dibuka offline. Hasil resmi diperiksa berkala, sementara data pemilihan operator tambahan memakai snapshot terpisah. Selalu lihat event, tanggal, dan jumlah pengamatan sebelum membandingkan.']
  };
  const guide=[
    ['Mulai dari satu pertanyaan','Pilih apakah Anda ingin melihat operator favorit, kemenangan operator, atau membandingkan dua tim. Tombol pertanyaan akan menyiapkan filter yang sesuai.','favorites','Coba cari operator favorit'],
    ['Baca jumlah sebelum persentase','Klik nama atau kartu operator. Anda akan melihat jumlah dipilih, ronde menang, dan ronde kalah. Bandingkan dua operator dari sisi yang sama agar konteksnya lebih jelas.','wins','Coba lihat kemenangan operator'],
    ['Klik grafik untuk menjelajah','Batang mingguan menyaring pertandingan. Nama peta membuka penjelasan, lalu Anda bisa melihat pertandingan di peta itu. Filter yang aktif selalu terlihat dan dapat dihapus satu per satu.','overview','Buka grafik ringkasan'],
    ['Bedakan hasil dan perkiraan','Skor pertandingan adalah data yang sudah tercatat. Peluang dua tim adalah perkiraan model. Bagian teknis dapat dibuka jika ingin mengetahui cara pengujiannya.','forecast','Coba bandingkan dua tim']
  ];
  function toast(message){clearTimeout(toastTimer);$('live-toast').textContent=message;$('live-toast').hidden=false;toastTimer=setTimeout(()=>$('live-toast').hidden=true,5500);}
  function resetMain(){for(const id of ['event-filter','team-filter','search'])$(id).value='';selectedMap='';selectedWeek='';page=0;}
  function navigate(name){location.hash='#'+name;view();}
  function preset(name){
    if($('help-dialog').open)$('help-dialog').close();if($('explore-dialog').open)$('explore-dialog').close();
    resetMain();
    if(name==='favorites'||name==='wins'){
      $('event-filter').value=String(operators.competitionId);$('operator-side').value='';$('operator-min').value='30';$('operator-search').value='';$('operator-sort').value=name==='favorites'?'picks':'wins';render();navigate('operators');
      toast('Data operator SLC Major ditampilkan untuk semua tim. Urutan dan filter sudah disesuaikan.');
    }else if(name==='forecast'){
      const teams=Object.entries(model.counts).filter(([,n])=>n>=5).sort((a,b)=>b[1]-a[1]);
      if(teams.length>=2){$('forecast-a').value=teams[0][0];$('forecast-b').value=teams[1][0];}
      render();navigate('model');predict();toast('Dua tim dengan riwayat yang cukup dipilih sebagai awal. Anda bisa menggantinya.');
    }else{render();navigate('overview');}
  }
  function renderFilterContext(){
    const f=filters(),chips=[];
    if(f.event)chips.push(['event',data.competitions[f.event]?.name??f.event]);if(f.team)chips.push(['team',C.teamName(data,f.team)]);if(f.search)chips.push(['search','Cari: '+f.search]);if(f.map)chips.push(['map','Peta: '+f.map]);if(f.week)chips.push(['week','Minggu: '+f.week]);
    $('active-filters').innerHTML=chips.map(([key,label])=>`<button class="filter-chip" data-remove-filter="${key}" aria-label="Hapus filter ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`).join('');
    $('active-filters').hidden=!chips.length;
    $('filter-context').textContent=chips.length?`${num(filtered.length)} pertandingan sesuai pilihan Anda${f.map?'; hitungan peta, ronde, dan pemain dibatasi ke '+f.map:''}. Hapus label di atas untuk memperluas tampilan.`:'Menampilkan seluruh cakupan data tersimpan. Pilih kompetisi atau tim untuk mempersempit tampilan.';
  }
  function renderPlainSummary(s){
    const total=s.maps.reduce((n,m)=>n+m.rounds,0),wins=s.maps.reduce((n,m)=>n+m.attackWins,0);
    $('plain-summary').innerHTML=s.played?`<p>Ada <strong>${num(s.played)} pertandingan selesai</strong> dalam pilihan ini, berisi <strong>${num(s.games)} peta</strong> yang selesai dimainkan.${s.upcoming?` Ada ${num(s.upcoming)} pertandingan lain yang belum selesai.`:''}</p><p>${total?`Dari ${num(total)} ronde yang memiliki informasi sisi dan pemenang, penyerang menang <strong>${num(wins)} kali (${pct(wins/total)})</strong>. Persentase ini menggambarkan data yang tercatat, bukan jaminan untuk ronde berikutnya.`:'Informasi ronde belum tersedia pada pilihan ini. Jumlah kosong tidak berarti peluang menang 0%.'}</p>`:`<p>Belum ada pertandingan selesai untuk pilihan ini.${s.upcoming?` Ada ${num(s.upcoming)} pertandingan yang belum selesai.`:''} <button class="text-link" data-reset-main>Hapus filter dan lihat seluruh data →</button></p>`;
  }
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
    const s=C.summarize(data,filtered,filters());
    const cards=[['Pertandingan selesai',s.played,`${num(s.upcoming)} pertandingan belum selesai`,'series'],['Peta selesai',s.games,'Arena yang selesai dimainkan','map'],['Detail tersedia',s.detailed,`${pct(s.played?s.detailed/s.played:null)} dari pertandingan selesai`,'snapshot'],['Ronde tercatat',s.rounds,'Babak kecil dalam setiap peta','round']];
    $('kpis').innerHTML=cards.map(([label,value,note,term])=>`<article class="kpi"><span>${label} <button class="term-help" data-term="${term}" aria-label="Penjelasan ${label}">?</button></span><strong>${num(value)}</strong><small>${esc(note)}</small></article>`).join('');
    const max=Math.max(1,...s.weekly.map(w=>w[1]));
    $('timeline').innerHTML=s.weekly.length?s.weekly.map(([week,count])=>`<button type="button" class="week ${selectedWeek===week?'selected':''}" data-week="${week}" style="height:${count?Math.max(4,count/max*100):0}%" aria-label="Minggu ${week}: ${count} pertandingan. Klik untuk menyaring." aria-pressed="${selectedWeek===week}" ${count?'':'disabled'} title="Minggu ${week}: ${count} pertandingan"></button>`).join(''):'<div class="empty">Tidak ada pertandingan selesai dalam filter.</div>';
    $('timeline').setAttribute('aria-label','Pilih minggu. '+(s.weekly.map(([w,n])=>`${w}: ${n} pertandingan`).join('; ')||'Tidak ada data'));
    $('timeline-readout').textContent=selectedWeek?`Minggu ${selectedWeek} dipilih. Hapus label minggu di atas untuk melihat periode lain.`:'Klik satu batang untuk menyaring pertandingan pada minggu tersebut.';
    $('timeline').nextElementSibling?.classList.contains('timeline-axis') && $('timeline').nextElementSibling.remove();
    if(s.weekly.length) $('timeline').insertAdjacentHTML('afterend',`<div class="timeline-axis"><span>${s.weekly[0][0]}</span><span>${s.weekly.at(-1)[0]}</span></div>`);
    $('map-chart').innerHTML=s.maps.length?s.maps.map(m=>`<button type="button" class="map-row map-button" data-open-map="${esc(m.name)}" aria-label="Jelaskan peta ${esc(m.name)}"><span class="map-meta"><b>${esc(m.name)} ↗</b><span>${m.rounds?pct(m.attackWins/m.rounds):'—'} · ${num(m.rounds)} ronde</span></span><span class="bar-track"><span class="bar-fill" style="width:${m.rounds?100*m.attackWins/m.rounds:0}%"></span><span class="bar-mid"></span></span></button>`).join(''):'<p class="empty">Detail peta belum tersedia untuk pilihan ini.</p>';
    const ranks=Object.entries(model.ratings).sort((a,b)=>b[1]-a[1]).slice(0,10);
    $('rankings').innerHTML=ranks.map(([id,r],i)=>`<tr><td><span class="rank-no">${String(i+1).padStart(2,'0')}</span><button class="table-link" data-team-history="${id}">${esc(C.teamName(data,id))} ↗</button></td><td class="elo">${r.toFixed(0)}</td><td>${model.counts[id]}</td><td>${model.wins[id]??0}</td></tr>`).join('');
    const players=C.playerLeaders(data,filtered,filters());
    $('players').innerHTML=players.length?players.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths?(p.kills/p.deaths).toFixed(2):p.kills?'∞':'—'}</td><td>${p.kostRounds?pct(p.kostSum/p.kostRounds):'—'}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">Statistik pemain belum tersedia untuk pilihan ini.</td></tr>';
    renderMatches();
    renderOperators();
    renderFilterContext();renderPlainSummary(s);
  }
  function operatorFilter(extra={}) {
    const main=filters();
    return {event:main.event,team:main.team?C.teamName(data,main.team):null,side:$('operator-side').value,minPicks:Number($('operator-min').value),search:$('operator-search').value.trim(),sort:$('operator-sort').value,...extra};
  }
  function operatorHighlight(row,label,note,accent='teal') {
    return `<article class="operator-highlight ${accent}"><p class="eyebrow">${esc(label)}</p><div class="operator-highlight-main">${operatorIcon(row.operator,'large')}<div><h3>${esc(row.operator)}</h3><span class="side-label ${row.side==='Attack'?'attack':'defense'}">${row.side==='Attack'?'Menyerang':'Bertahan'}</span></div></div><strong>${esc(note)}</strong><small>${num(row.wins)} menang dari ${num(row.picks)} pemilihan · ${pct(row.winRate)}</small><button class="text-link explain-operator" data-open-operator="${esc(row.operator)}" data-operator-side="${row.side}" data-operator-team="${esc(row.team??'')}">Pahami angka ini →</button></article>`;
  }
  function renderOperators() {
    const rows=C.operatorStats(operators,operatorFilter());
    const total=C.operatorStats(operators,operatorFilter({minPicks:0,search:''})).length;
    const favorites=C.operatorStats(operators,operatorFilter({sort:'picks'}));
    const winners=C.operatorStats(operators,operatorFilter({sort:'wins'}));
    const rates=C.operatorStats(operators,operatorFilter({sort:'winRate'}));
    const team=filters().team?C.teamName(data,filters().team):null;
    const unavailable=filters().event && filters().event!==String(operators.competitionId);
    const empty=unavailable?'Snapshot pemilihan operator tersedia untuk Salt Lake City Major 2026.':team&&!operators.rows.some(r=>r.team===team)?`Belum ada statistik pemilihan operator untuk ${team} pada snapshot ini.`:'Tidak ada operator yang memenuhi filter. Kurangi minimum pemilihan atau ubah pencarian.';
    const recovery='<button class="text-link" data-preset="favorites">Tampilkan data operator yang tersedia →</button>';
    $('operator-insights').innerHTML=rows.length?operatorHighlight(favorites[0],'Paling sering dipilih',`${num(favorites[0].picks)} kali dipilih`,'teal')+operatorHighlight(winners[0],'Kemenangan terbanyak',`${num(winners[0].wins)} ronde menang`,'amber')+operatorHighlight(rates[0],`Win rate tertinggi · min. ${$('operator-min').value} pilihan`,pct(rates[0].winRate),'blue'):`<div class="empty operator-empty">${esc(empty)} ${recovery}</div>`;
    $('operator-count').textContent=`${rows.length} dari ${total} operator · ${team??'Semua tim dalam snapshot SLC'} · minimum ${$('operator-min').value} pemilihan. Operator mengikuti filter kompetisi dan tim; filter peta, minggu, serta pencarian pertandingan tidak diterapkan ke snapshot agregat ini.`;
    $('operator-rows').innerHTML=rows.length?rows.map((r,i)=>`<tr><td><div class="operator-name"><span class="rank-no">${String(i+1).padStart(2,'0')}</span>${operatorIcon(r.operator)}<button class="table-link" data-open-operator="${esc(r.operator)}" data-operator-side="${r.side}" data-operator-team="${esc(r.team??'')}">${esc(r.operator)} ↗</button></div></td><td><span class="side-label ${r.side==='Attack'?'attack':'defense'}">${r.side==='Attack'?'Menyerang':'Bertahan'}</span></td><td>${num(r.picks)}</td><td class="win-count">${num(r.wins)}</td><td title="Interval Wilson 95% indikatif: ${pct(r.intervalLow)}–${pct(r.intervalHigh)}; ronde dapat berkorelasi"><div class="win-rate-cell"><b>${pct(r.winRate)}</b><span class="rate-track"><i style="width:${(r.winRate??0)*100}%"></i></span></div></td><td>${pct(r.presence)}<small class="cell-note">${num(r.sideRounds)} ronde sisi tercatat</small></td></tr>`).join(''):`<tr><td colspan="6" class="empty">${esc(empty)} ${recovery}</td></tr>`;
    $('export-operators').disabled=!rows.length;
    const spotlight=C.operatorStats(operators,operatorFilter({sort:'picks',side:'',search:'',minPicks:30}));
    const attack=spotlight.find(r=>r.side==='Attack'),defense=spotlight.find(r=>r.side==='Defense');
    $('operator-preview').innerHTML=attack&&defense?[attack,defense].map(r=>`<article class="spotlight-card ${r.side==='Attack'?'attack':'defense'}">${operatorIcon(r.operator,'spotlight-icon')}<div><p class="eyebrow">Favorit ${r.side==='Attack'?'menyerang':'bertahan'}</p><h3>${esc(r.operator)}</h3><p><b>${num(r.picks)}</b> pemilihan <span>·</span> <b>${num(r.wins)}</b> ronde menang</p><button class="text-link" data-open-operator="${esc(r.operator)}" data-operator-side="${r.side}" data-operator-team="${esc(r.team??'')}">Apa artinya? →</button></div><div class="spotlight-rate"><strong>${pct(r.winRate)}</strong><span>win rate ronde</span></div></article>`).join(''):`<p class="empty">${esc(empty)} ${recovery}</p>`;
    const bans=C.banLeaders(data,filtered,filters().team||null,selectedMap||null),max=Math.max(1,...bans.map(b=>b.maps));
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
    $('match-count').textContent=`${num(filtered.length)} pertandingan dalam pilihan Anda. Skor utama menunjukkan jumlah peta yang dimenangkan.${selectedMap?' Buka detail untuk melihat peta '+selectedMap+'.':''}`;
    $('match-rows').innerHTML=filtered.slice(page*pageSize,(page+1)*pageSize).map(m=>`<tr><td class="match-date">${esc(date(m.date,true))}<br>${new Date(m.date).toISOString().slice(11,16)} ${m.isTimeTBD?'(TBD)':''}</td><td>${esc(C.teamName(data,m.teamA))}<span class="score">${m.completed?`${m.scoreA??'—'} : ${m.scoreB??'—'}`:'vs'}</span>${esc(C.teamName(data,m.teamB))}</td><td>${esc(data.competitions[m.competitionId]?.name??'—')}</td><td><span class="status-tag ${!m.detailed?'missing':''}">${!m.completed?'TERJADWAL':m.detailed?'DETAIL':'SKOR'}</span>${m.forfeit?' · forfeit':''}</td><td><button class="subtle detail-button" data-id="${m.id}">Lihat ↗</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">Tidak ada pertandingan yang cocok.</td></tr>';
    $('page-label').textContent=`${page+1} / ${pages}`; $('prev').disabled=page===0; $('next').disabled=page>=pages-1;
  }
  function renderModel() {
    const e=model.evaluation;
    const correct=e.accuracy==null?null:Math.round(e.accuracy*e.decisive);
    $('evaluation').innerHTML=`<div class="evaluation-explained"><strong>${pct(e.accuracy)}</strong><p>${correct==null?'Belum cukup data untuk membaca ketepatan model.':`Pilihan tim yang lebih diunggulkan model tepat pada <b>${num(correct)} dari ${num(e.decisive)} pertandingan</b> yang diuji.`}</p><p>Untuk pembanding, selalu memilih tim pertama pada catatan sumber menghasilkan <b>${pct(e.alwaysAAccuracy)}</b>. Selisih ini kecil; model belum terbukti kuat untuk pertandingan berikutnya.</p></div><details class="technical-details"><summary>Lihat ukuran teknis model <span aria-hidden="true">+</span></summary><div class="eval-grid"><div class="eval-cell"><span>Brier · lebih kecil lebih baik</span><strong>${e.brier==null?'—':e.brier.toFixed(3)}</strong><span>Tebakan 50%: 0.250</span></div><div class="eval-cell"><span>Log loss · lebih kecil lebih baik</span><strong>${e.logLoss==null?'—':e.logLoss.toFixed(3)}</strong><span>Tebakan 50%: 0.693</span></div></div><p class="chart-note">${e.n} pertandingan dievaluasi dari ${e.total} pertandingan yang memenuhi syarat. Masing-masing tim harus memiliki minimal 3 pertandingan sebelumnya. Skor pembanding proporsi historis tim pertama: Brier ${e.priorBrier?.toFixed(3)??'—'}, log loss ${e.priorLogLoss?.toFixed(3)??'—'}.</p><button class="term-help wide" data-term="brier">? Cara membaca ukuran ini</button></details>`;
    $('coverage').textContent=`${num(data.matches.length)} series, ${num(data.games.length)} peta, ${num(data.rounds.length)} ronde, ${num(data.players.length)} baris pemain-peta. Cakupan: event global musim ${data.meta.season.name} serta stage regional yang ditampilkan sebagai default oleh halaman resmi. Ini bukan arsip lengkap seluruh musim. ${num(data.meta.warnings.length)} slot/record tidak lengkap dicatat pada metadata, bukan diisi dengan tim buatan.`;
    $('sources-title').textContent=`Manifest ${num(data.sources.length)} halaman sumber · HTTP, waktu unduh, dan SHA-256`;
    $('source-list').innerHTML=data.sources.map(s=>`<div class="source-record"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.route)} ↗</a><small>HTTP ${s.httpStatus} · diunduh ${esc(s.retrievedAt)}<br>SHA-256 ekstrak: ${esc(s.sha256)}</small></div>`).join('');
    $('data-digest').textContent=`SHA-256 konten data: ${data.meta.dataSha256} · Skema v${data.schemaVersion}`;
  }
  function showMap(name){
    const record=C.summarize(data,filtered,filters()).maps.find(m=>m.name===name);if(!record)return;
    $('explore-content').innerHTML=`<p class="eyebrow">Peta pertandingan</p><h2 id="explore-title">Membaca peta ${esc(name)}</h2><p class="detail-lead">${record.rounds?`Penyerang menang <strong>${num(record.attackWins)} dari ${num(record.rounds)} ronde</strong> yang memiliki informasi sisi dan pemenang (${pct(record.attackWins/record.rounds)}).`:'Informasi kemenangan ronde belum tersedia. Ini bukan berarti penyerang memiliki peluang 0%.'}</p>${record.rounds?`<div class="outcome-bar" role="img" aria-label="${record.attackWins} ronde dimenangkan penyerang, ${record.rounds-record.attackWins} dimenangkan pihak bertahan"><span style="width:${100*record.attackWins/record.rounds}%"></span></div><div class="outcome-labels"><span>Menyerang: ${num(record.attackWins)} menang</span><span>Bertahan: ${num(record.rounds-record.attackWins)} menang</span></div>`:''}<p class="muted">Angka berasal dari ${num(record.games)} peta selesai dalam filter saat ini. Ini catatan pertandingan, bukan perkiraan untuk permainan Anda.</p><button class="primary" data-apply-map="${esc(name)}">Lihat pertandingan di peta ini ↗</button>`;
    $('explore-dialog').showModal();
  }
  function showOperator(name,side,team){
    operatorDetail={name,side,team:team||null};
    const rows=C.operatorStats(operators,{team:operatorDetail.team,side,minPicks:0,sort:'picks'}),r=rows.find(row=>row.operator===name);if(!r)return;
    const peer=rows.find(row=>row.operator!==name&&row.picks>=30)??rows.find(row=>row.operator!==name);
    $('explore-content').innerHTML=`<div class="detail-operator-heading">${operatorIcon(name,'large')}<div><p class="eyebrow">${side==='Attack'?'Menyerang':'Bertahan'} · ${esc(team||'Semua tim')}</p><h2 id="explore-title">Apa arti angka ${esc(name)}?</h2></div></div><p class="detail-lead">Dari <strong>${num(r.picks)} kali dipilih</strong>, sisi ${esc(name)} memenangkan <strong>${num(r.wins)} ronde</strong> dan kalah pada <strong>${num(r.picks-r.wins)} ronde</strong>.</p><div class="outcome-bar" role="img" aria-label="${num(r.wins)} ronde menang, ${num(r.picks-r.wins)} ronde kalah"><span style="width:${100*(r.winRate??0)}%"></span></div><div class="outcome-labels"><span>Menang: ${num(r.wins)}</span><span>Kalah: ${num(r.picks-r.wins)}</span></div><p><strong>Win rate ${pct(r.winRate)}</strong> berarti bagian pemilihan yang berakhir menang pada data ini. ${r.picks<30?'Jumlah pemilihannya masih kecil, jadi persentase ini mudah berubah.':'Angka ini tetap perlu dibaca bersama jumlah pemilihannya.'}</p><div class="compare-box"><label>Bandingkan dengan operator pada sisi yang sama<select id="operator-peer">${rows.filter(row=>row.operator!==name).map(row=>`<option value="${esc(row.operator)}" ${peer?.operator===row.operator?'selected':''}>${esc(row.operator)} · ${num(row.picks)} pemilihan</option>`).join('')}</select></label><div id="operator-comparison" aria-live="polite"></div></div><p class="chart-note">Hanya snapshot replay Salt Lake City Major 2026 dari r6tv, ditangkap ${esc(date(operators.source.capturedAt,true))} UTC. Kemenangan dihitung per ronde, bukan per pertandingan. Statistik ini tidak membuktikan bahwa karakter menyebabkan kemenangan.</p><a class="text-link" href="${esc(operators.source.url)}" target="_blank" rel="noopener noreferrer">Periksa sumber angka ↗</a>`;
    renderComparison();$('explore-dialog').showModal();
  }
  function renderComparison(){
    if(!operatorDetail||!$('operator-peer'))return;
    const rows=C.operatorStats(operators,{team:operatorDetail.team,side:operatorDetail.side,minPicks:0});
    const a=rows.find(r=>r.operator===operatorDetail.name),b=rows.find(r=>r.operator===$('operator-peer').value);
    if(!a||!b){$('operator-comparison').textContent='Belum ada operator pembanding pada sisi ini.';return;}
    const difference=a.winRate==null||b.winRate==null?null:Math.abs(a.winRate-b.winRate)*100;
    $('operator-comparison').innerHTML=`<div class="comparison-pair"><div><strong>${esc(a.operator)}</strong><b>${pct(a.winRate)}</b><span>${num(a.wins)} menang / ${num(a.picks)} pilihan</span></div><div><strong>${esc(b.operator)}</strong><b>${pct(b.winRate)}</b><span>${num(b.wins)} menang / ${num(b.picks)} pilihan</span></div></div><p>${difference==null?'Belum cukup nilai untuk menghitung selisih.':`Selisih tingkat kemenangan: <strong>${difference.toFixed(1)} poin persentase</strong>.`} Jumlah pemilihan berbeda dapat memengaruhi perbandingan; persentase lebih tinggi tidak otomatis berarti operator lebih baik.</p>`;
  }
  function predict(){
    forecastShown=true;
    try{
      const a=$('forecast-a').value,b=$('forecast-b').value,p=C.forecast(data,a,b);
      $('forecast-result').innerHTML=p.ready?`<div class="forecast-pair"><div><span>${esc(C.teamName(data,a))}</span><strong>${pct(p.p)}</strong></div><div><span>${esc(C.teamName(data,b))}</span><strong>${pct(1-p.p)}</strong></div></div><div class="outcome-bar forecast-bar" role="img" aria-label="Peluang ${esc(C.teamName(data,a))} ${pct(p.p)}, ${esc(C.teamName(data,b))} ${pct(1-p.p)}"><span style="width:${100*p.p}%"></span></div><p class="prediction-reading">${Math.abs(p.p-.5)<.1?'Peluang kedua tim masih berdekatan.':'Model lebih mengunggulkan salah satu tim pada riwayat yang tersedia.'} <strong>Kedua tim tetap bisa menang.</strong> Angka ini perkiraan model, bukan pertandingan baru atau kepastian hasil.</p><p class="chart-note">Dihitung dari ${p.na} pertandingan sebelumnya untuk ${esc(C.teamName(data,a))} dan ${p.nb} untuk ${esc(C.teamName(data,b))} dalam data ini.</p><div class="history-actions"><button class="text-link" data-team-history="${esc(a)}">Lihat riwayat ${esc(C.teamName(data,a))} ↗</button><button class="text-link" data-team-history="${esc(b)}">Lihat riwayat ${esc(C.teamName(data,b))} ↗</button></div>`:`<p class="coverage-note">Data belum cukup. Masing-masing tim perlu sedikitnya 5 pertandingan selesai yang memenuhi syarat. Saat ini tersedia ${p.na} dan ${p.nb}; halaman tidak mengarang peluang pengganti.</p>`;
    }catch(e){$('forecast-result').textContent=e.message;}
  }
  function helpTab(tab){
    const glossary=tab==='glossary';$('guide-panel').hidden=glossary;$('glossary-panel').hidden=!glossary;
    $('help-guide-tab').setAttribute('aria-selected',String(!glossary));$('help-glossary-tab').setAttribute('aria-selected',String(glossary));
    $('help-guide-tab').tabIndex=glossary?-1:0;$('help-glossary-tab').tabIndex=glossary?0:-1;
  }
  function renderGuide(){const [title,body,action,label]=guide[guideStep];$('guide-content').innerHTML=`<p class="eyebrow">Langkah ${guideStep+1} dari ${guide.length}</p><h3>${title}</h3><p>${body}</p><button class="text-link" data-preset="${action}">${label} ↗</button>`;$('guide-progress').textContent=`${guideStep+1} / ${guide.length}`;$('guide-prev').disabled=guideStep===0;$('guide-next').textContent=guideStep===guide.length-1?'Selesai ✓':'Lanjut →';}
  function renderGlossary(){const search=$('glossary-search').value.trim().toLocaleLowerCase();const entries=Object.entries(terms).filter(([,v])=>v.join(' ').toLocaleLowerCase().includes(search));$('glossary-list').innerHTML=entries.map(([key,[title,text]])=>`<article class="glossary-entry" data-glossary="${key}"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('')||'<p class="empty">Istilah belum ditemukan. Coba kata yang lebih singkat.</p>';}
  function openHelp(term=null){if($('explore-dialog').open)$('explore-dialog').close();if($('match-dialog').open)$('match-dialog').close();helpTab(term?'glossary':'guide');if(term){$('glossary-search').value=terms[term]?.[0]??term;renderGlossary();}else{guideStep=0;renderGuide();}$('help-dialog').showModal();}
  function showDetail(id) {
    const m=data.matches.find(m=>m.id===id); if(!m)return;
    const games=data.games.filter(g=>g.matchId===id);
    $('detail-content').innerHTML=`<h2>${esc(C.teamName(data,m.teamA))} <span class="elo">${m.completed?`${m.scoreA} : ${m.scoreB}`:'vs'}</span> ${esc(C.teamName(data,m.teamB))}</h2><p class="muted">${esc(date(m.date))} UTC · ${esc(data.competitions[m.competitionId]?.name)} · BO${m.bestOf??'?'}${m.forfeit?' · Forfeit':''}</p><a class="subtle" href="${data.meta.sourceBase}match/${m.id}" target="_blank" rel="noopener noreferrer">Buka catatan resmi ↗</a><p class="chart-note">Skor utama adalah jumlah peta yang dimenangkan. Di dalam kartu peta, skor menunjukkan jumlah ronde yang dimenangkan.${m.forfeit?' Pertandingan ini ditandai forfeit: pemenang mengikuti catatan resmi, bukan disimpulkan hanya dari skor.':''}</p>${!m.detailed?'<p class="coverage-note">Detail ronde dan pemain belum diunduh. Hanya data skor yang tersedia; statistik tidak diperkirakan.</p>':''}${games.map((g,i)=>{
      const rounds=data.rounds.filter(r=>r.gameId===g.id), players=data.players.filter(p=>p.gameId===g.id), bans=data.bans.filter(b=>b.gameId===g.id);
      return `<div class="game-card"><div class="game-heading"><b>${i+1}. ${esc(g.map??'Nama peta belum tersedia')}</b><b>${g.scoreA??'—'} : ${g.scoreB??'—'}</b></div><small class="muted">${esc(C.teamName(data,g.teamA))} / ${esc(C.teamName(data,g.teamB))}</small>${rounds.length?`<div class="round-strip">${rounds.map(r=>`<button type="button" class="round-cell ${r.winnerId!==r.attackerId?'defense':''}" data-round-info="${r.id}" title="Ronde ${r.index}: ${esc(C.teamName(data,r.winnerId))}" aria-label="Jelaskan ronde ${r.index}">${r.index}</button>`).join('')}</div><div class="round-key">Teal: penyerang menang · biru: bertahan menang · ${rounds.length} ronde tercatat</div><p class="round-readout" id="round-readout-${g.id}" aria-live="polite">Klik nomor ronde untuk melihat pemenang dan tim yang menyerang.</p>`:''}${players.length?`<div class="table-wrap"><table><thead><tr><th>Pemain</th><th>Tim</th><th>K / D</th><th>KOST</th></tr></thead><tbody>${players.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(C.teamName(data,p.teamId))}</td><td>${p.kills??'—'} / ${p.deaths??'—'}</td><td>${pct(p.kost)}</td></tr>`).join('')}</tbody></table></div>`:''}${bans.length?`<p class="chart-note">Operator ban (sumber): ${bans.map(b=>esc(b.operator)).join(', ')}. Baris ban memiliki teamId dan roundIndex pada dataset.</p>`:''}</div>`;
    }).join('')}${!games.length?'<p class="empty">Belum ada peta selesai yang tercatat.</p>':''}`;
    $('match-dialog').showModal();
  }
  function accept(next,initial=false) {
    C.validate(next);
    if(!initial && next.meta.generatedAt===data.meta.generatedAt && next.meta.dataSha256===data.meta.dataSha256)return;
    data=next; model=C.elo(data); forecastShown=false; populate(); render(); renderModel(); renderOperatorSource();
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
  $('reset').addEventListener('click',()=>{resetMain();render();toast('Filter utama dihapus. Menampilkan seluruh cakupan data.');});
  $('prev').addEventListener('click',()=>{page--;renderMatches();});$('next').addEventListener('click',()=>{page++;renderMatches();});
  $('match-rows').addEventListener('click',e=>{const b=e.target.closest('.detail-button');if(b)showDetail(Number(b.dataset.id));});
  $('close-dialog').addEventListener('click',()=>$('match-dialog').close());
  $('detail-content').addEventListener('click',e=>{const button=e.target.closest('[data-round-info]');if(!button)return;const r=data.rounds.find(row=>row.id===Number(button.dataset.roundInfo));if(!r)return;const readout=$('round-readout-'+r.gameId);if(readout)readout.textContent=`Ronde ${r.index}: ${C.teamName(data,r.winnerId)} menang. Penyerang: ${C.teamName(data,r.attackerId)}. Bertahan: ${C.teamName(data,r.defenderId)}.`;});
  $('predict').addEventListener('click',predict);
  $('swap-teams').addEventListener('click',()=>{const a=$('forecast-a').value;$('forecast-a').value=$('forecast-b').value;$('forecast-b').value=a;if(forecastShown)predict();});
  for(const id of ['forecast-a','forecast-b'])$(id).addEventListener('change',()=>{if(forecastShown)predict();});
  $('export').addEventListener('click',()=>{const rows=filtered.map(m=>({match_id:m.id,date_utc:m.date,competition:data.competitions[m.competitionId]?.name,team_a:C.teamName(data,m.teamA),team_b:C.teamName(data,m.teamB),score_a:m.scoreA,score_b:m.scoreB,completed:m.completed,winner:m.winnerId?C.teamName(data,m.winnerId):null,detailed:m.detailed,source_url:data.meta.sourceBase+m.source}));const blob=new Blob([C.csv(rows)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`r6-official-matches-${new Date(data.meta.generatedAt).toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('check-cache').addEventListener('click',loadCache);
  for(const id of ['operator-side','operator-sort','operator-min'])$(id).addEventListener('change',renderOperators);
  $('operator-search').addEventListener('input',renderOperators);
  $('reset-operators').addEventListener('click',()=>{$('operator-side').value='';$('operator-sort').value='wins';$('operator-min').value='30';$('operator-search').value='';renderOperators();toast('Filter khusus operator dikembalikan ke pengaturan awal.');});
  $('close-explore').addEventListener('click',()=>$('explore-dialog').close());
  $('close-help').addEventListener('click',()=>$('help-dialog').close());
  $('open-help').addEventListener('click',()=>openHelp());
  $('help-guide-tab').addEventListener('click',()=>{helpTab('guide');renderGuide();});
  $('help-glossary-tab').addEventListener('click',()=>{helpTab('glossary');$('glossary-search').value='';renderGlossary();});
  document.querySelector('.help-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const target=e.key==='Home'?'help-guide-tab':e.key==='End'?'help-glossary-tab':e.target.id==='help-guide-tab'?'help-glossary-tab':'help-guide-tab';$(target).click();$(target).focus();});
  $('glossary-search').addEventListener('input',renderGlossary);
  $('guide-prev').addEventListener('click',()=>{guideStep=Math.max(0,guideStep-1);renderGuide();});
  $('guide-next').addEventListener('click',()=>{if(guideStep===guide.length-1){$('help-dialog').close();return;}guideStep++;renderGuide();});
  $('explore-content').addEventListener('change',e=>{if(e.target.id==='operator-peer')renderComparison();});
  $('timeline').addEventListener('click',e=>{const b=e.target.closest('[data-week]');if(!b||b.disabled)return;selectedWeek=selectedWeek===b.dataset.week?'':b.dataset.week;page=0;render();navigate('matches');toast(selectedWeek?'Pertandingan disaring ke minggu '+selectedWeek+'.':'Filter minggu dihapus.');});
  for(const event of ['mouseover','focusin'])$('timeline').addEventListener(event,e=>{const b=e.target.closest('[data-week]');if(b&&!b.disabled)$('timeline-readout').textContent=b.getAttribute('aria-label');});
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-preset],[data-term],[data-start-guide],[data-open-operator],[data-open-map],[data-apply-map],[data-remove-filter],[data-reset-main],[data-team-history]');if(!button)return;
    if(button.hasAttribute('data-preset')){preset(button.dataset.preset);return;}
    if(button.hasAttribute('data-start-guide')){openHelp();return;}
    if(button.hasAttribute('data-term')){openHelp(button.dataset.term);return;}
    if(button.hasAttribute('data-open-operator')){showOperator(button.dataset.openOperator,button.dataset.operatorSide,button.dataset.operatorTeam);return;}
    if(button.hasAttribute('data-open-map')){showMap(button.dataset.openMap);return;}
    if(button.hasAttribute('data-apply-map')){selectedMap=button.dataset.applyMap;page=0;$('explore-dialog').close();render();navigate('matches');toast('Menampilkan pertandingan yang memuat peta '+selectedMap+'.');return;}
    if(button.hasAttribute('data-remove-filter')){const key=button.dataset.removeFilter;if(key==='map')selectedMap='';else if(key==='week')selectedWeek='';else $(key==='search'?'search':key+'-filter').value='';page=0;render();return;}
    if(button.hasAttribute('data-reset-main')){resetMain();render();toast('Semua filter utama dihapus.');return;}
    if(button.hasAttribute('data-team-history')){const id=button.dataset.teamHistory;if(!data.teams[id])return;resetMain();$('team-filter').value=id;render();navigate('matches');toast('Riwayat '+C.teamName(data,id)+' ditampilkan dari seluruh data tersimpan.');}
  });
  $('export-operators').addEventListener('click',()=>{const rows=C.operatorStats(operators,operatorFilter()).map(r=>({operator:r.operator,side:r.side,team:r.team,picks:r.picks,round_wins:r.wins,round_win_rate:r.winRate,side_rounds:r.sideRounds,presence:r.presence,source_url:operators.source.url,captured_at:operators.source.capturedAt}));const url=URL.createObjectURL(new Blob([C.csv(rows)],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='r6-operators-slc-2026.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  window.addEventListener('r6-update',()=>{try{accept(window.R6_LATEST);}catch(e){$('sync-status').textContent=`Cache baru ditolak: ${e.message}`;$('sync-status').className='error';}});
  window.addEventListener('r6-status',()=>{if(started)updateStatus();});
  try{C.validateOperators(operators);accept(JSON.parse($('dataset').textContent),true);started=true;view();loadCache();setInterval(loadCache,60000);setInterval(updateStatus,60000);}catch(e){$('fatal').hidden=false;$('fatal').textContent=`Snapshot tidak dapat ditampilkan: ${e.message}`;}
})();
