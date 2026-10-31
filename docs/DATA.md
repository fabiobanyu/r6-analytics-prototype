# Data dan provenance

Sumber tunggal hasil pertandingan: halaman publik [Ubisoft R6 Esports](https://www.ubisoft.com/en-us/esports/rainbow-six/siege/competition/502). Pembaru membaca JSON `__NEXT_DATA__` yang sudah disertakan dalam HTML resmi, tanpa autentikasi atau endpoint privat. Jika struktur itu berubah, pembaru harus ditinjau; tidak ada jaminan stabilitas skema publik tersebut.

## Cakupan penemuan

1. Buka seed resmi `competition/502` dan cari satu musim `current=true` dalam `layoutData.seasons`.
2. Ikuti event global dan halaman championship regional pada musim itu.
3. Ikuti kompetisi regional yang ditampilkan halaman default championship dan seluruh fase publiknya.
4. Gabungkan series menggunakan ID sumber. Tim TBD/tidak lengkap dikeluarkan dengan alasan pada `meta.warnings`.
5. Unduh detail series selesai, terbaru terlebih dahulu, maksimal 80 halaman baru per siklus. Detail yang sudah ada dipakai ulang dan diperiksa ulang setelah 7 hari.

Kompetisi yang sudah ditemukan pada snapshot musim yang sama tetap diikuti ketika default stage berubah. Penurunan cakupan series selesai menghentikan publikasi dan memerlukan peninjauan, agar hasil yang menghilang tidak dianggap nol. Pergantian musim membuat cakupan baru; versi lama tetap tersedia melalui histori repository jika di-commit manual.

Snapshot pertama: 31 Oktober 2026 UTC, 414 series; 410 selesai, 4 terjadwal. Detail 410 series tersedia. Ini bukan seluruh season 2026–2027, seluruh sejarah, ataupun data ranked/publik. Event/fase yang belum memiliki tim diketahui tidak diberi tim atau skor pengganti.

## Waktu dan integritas

| Field | Arti |
|---|---|
| `meta.generatedAt` | Waktu UTC snapshot dirakit; bukan tanggal pertandingan atau jaminan semua halaman baru diunduh pada waktu itu |
| `meta.latestCompletedMatch` | Timestamp jadwal series selesai terbaru dalam cakupan |
| `sources[].retrievedAt` | Waktu UTC halaman sumber tersebut benar-benar berhasil diunduh |
| `sources[].httpStatus` | Status respons pengunduhan, harus 200 |
| `sources[].sha256` | SHA-256 byte UTF-8 ekstrak JSON sebelum kompresi gzip |
| `sources[].htmlSha256` | SHA-256 respons HTML asli saat pengunduhan; HTML lengkap tidak disertakan |
| `sources[].file` | Ekstrak tersimpan di `data/raw/<sha256>.json.gz` |
| `meta.dataSha256` | Hash konten tabel termasuk referensi route; tidak mencakup timestamp snapshot |
| `data/update_status.json` | Status percobaan pembaruan terakhir, terpisah dari snapshot terakhir yang valid |

Ekstrak menyimpan `pageProps.pageData` dan `layoutData.seasons`. Checksum HTML merupakan metadata unduhan; hanya checksum ekstrak dapat dihitung ulang dari file yang disertakan. Bukti ini membuktikan konsistensi cache terhadap manifest, bukan tanda tangan kriptografis Ubisoft. Respons baru dapat diverifikasi ulang dengan URL resmi.

## Grain dan kamus data

| Tabel | Satu baris | Kunci | Nilai utama |
|---|---|---|---|
| `matches` | Satu series | `id` | `date` UTC, `competitionId`, `teamA/B`, `scoreA/B`, `winnerId`, `bestOf`, `completed`, `forfeit`, `detailed`, `gameIds` |
| `games` | Satu peta yang selesai | `id` | `matchId`, `mapId`, `map`, `teamA/B`, skor ronde, `winnerId` |
| `rounds` | Satu ronde tercatat | `id` | `gameId`, `matchId`, `index`, `winnerId`, `attackerId`, `defenderId`, `overtime`, `winMethodCode` |
| `players` | Satu pemain × peta × tim | `gameId, teamId, playerId` | `kills`, `deaths`, `kost`, `eps`, `roundsPlayed`, `name` |
| `bans` | Satu pencatatan ban sumber | `gameId, teamId, operatorId, roundIndex` | `operator`, `attacker`, `roundIndex` |
| `teams` | Satu ID tim sumber | object key = `id` | `name`, `country`, `source` |
| `competitions` | Satu kompetisi | object key = `id` | `name`, `startDate`, `endDate`, `seasonYear`, `source` |

Setiap baris hasil/statistik menyertakan `source`, route yang terhubung ke manifest. Nama tim bukan kunci join. Sumber dapat menampilkan nama organisasi terkini pada pertandingan sebelumnya; ID tidak menjamin roster tetap sama.

`status` menyimpan kode sumber; parser menganggap kode 3 selesai karena dicocokkan dengan halaman skor resmi. `completed=false` berarti belum selesai menurut sumber, bukan otomatis jadwal masa depan. Series tanpa dua tim diketahui tidak dimasukkan. `winnerId` berasal dari flag `result=1`; tidak ditebak hanya dari skor. Dua forfeit dalam snapshot awal memiliki skor numerik yang tidak sejalan dengan flag pemenang; nilai sumber dipertahankan dan series dikeluarkan dari Elo.

Peta status selain 3 tidak dihitung sebagai peta yang dimainkan, termasuk placeholder 0:0. Kode `winMethodCode` dan `roundIndex` ban dipertahankan tanpa menebak arti enum yang tidak diverifikasi. Baris ban bukan otomatis jumlah peta unik atau tingkat pemakaian operator.

KOST bernilai 0–1, ditampilkan sebagai persentase; nilai EPS dipertahankan dari sumber tanpa mendefinisikan ulang formulanya. Kill/death merupakan hitungan. Ringkasan KOST memakai bobot `roundsPlayed` hanya pada baris yang memiliki kedua nilai. K/D tak terdefinisi ketika tidak ada kill maupun death; death=0 dan kill>0 ditampilkan ∞. Kill tidak dipaksakan sama dengan death lawan.

## Data kosong, CSV, dan asumsi

- Nilai tidak tersedia menjadi `null` atau tidak memiliki baris, tidak diisi rata-rata, nol, atau hasil acak.
- Nol nyata tetap nol. Rasio tanpa penyebut ditampilkan `—`.
- CSV memakai UTF-8 BOM, header, nilai kosong untuk null, boolean lowercase, dan JSON untuk array. Teks yang berpotensi menjadi formula spreadsheet diawali apostrof saat ekspor.
- Angka Elo dan probabilitas merupakan **hasil perhitungan**, bukan kolom statistik yang diklaim berasal dari Ubisoft. Parameter model didokumentasikan terpisah dalam metode.
- Pengujian negatif sengaja memakai salinan rusak, perubahan label, field kosong, atau pesan kegagalan bertanda TEST ONLY. Salinan pengujian tidak dipublikasikan sebagai dataset pertandingan.

## Ketahanan pembaruan

Cache indeks 6 jam, detail 7 hari; 3 koneksi, timeout 35 detik, maksimal 3 percobaan. `--force` menyegarkan indeks, tetap menghormati cache detail. `--offline` membangun ulang dari cache terverifikasi tanpa mengunduh; timestamp snapshot dapat berubah tetapi `retrievedAt` sumber tetap waktu unduhan asli.

Unduhan indeks/fase gagal, checksum gagal, skema berubah, referensi tidak valid, statistik tidak cocok dengan sumber, atau series selesai hilang: snapshot sebelumnya dipertahankan. Halaman detail yang gagal diunduh boleh tetap tidak tersedia, dengan kegagalan dicatat. Pembaru menyiapkan kandidat dan membangun HTML sebelum mengganti snapshot. Penulisan file snapshot dilakukan secara atomik per file; ini bukan transaksi database lintas seluruh file.
