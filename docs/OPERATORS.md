# Operator favorit dan kemenangan ronde

Panel Operator intel memakai **snapshot tambahan r6tv**, bukan mengarang pilihan operator dari data ban. [Halaman event r6tv](https://r6tv.online/event/salt-lake-city-major) memublikasikan tabel operator beserta pemilihan dan ronde menang. Menurut [penjelasan r6tv](https://r6tv.online/how-it-works), statistik operator berasal dari analisis replay. r6tv merupakan proyek pihak ketiga, bukan sumber resmi Ubisoft.

## Cakupan yang sebenarnya

- Event: Salt Lake City Major 2026, 8–17 Mei 2026; pemetaan event resmi Ubisoft adalah ID 502.
- Snapshot halaman ditangkap pada 31 Oktober 2026 UTC. Timestamp lengkap, URL, hash HTML, serta hash ekstrak terdapat pada `data/operators.json`.
- Terdapat 73 kombinasi operator/sisi agregat dan total 1.179 baris termasuk cohort tiap tim. Cohort semua tim tidak dijumlahkan lagi bersama cohort per tim.
- Sumber tambahan mencatat 886 pengamatan ronde sisi serang dan 887 sisi bertahan. Data hasil resmi event memuat 925 ronde. Cakupan ini berbeda; denominator tidak dicampur, dan tidak dinyatakan sebagai statistik lengkap seluruh event atau seluruh musim.
- Tidak tersedia ID series/ronde individual pada board agregat ini. Data tidak di-join secara spekulatif ke ID pertandingan Ubisoft.

Ekstrak JSON `opsData` disimpan tanpa perubahan pada `data/operator_sources/<sha256>.json.gz`. Setiap angka ternormalisasi dicocokkan kembali ke board tersebut oleh `scripts/validate_operators.py`. Checksum membuktikan konsistensi file terhadap manifest, bukan autentikasi kriptografis r6tv atau pembuktian independen setiap replay.

## Definisi

| Metrik | Makna |
|---|---|
| Dipilih | Jumlah pengamatan operator terpilih dalam ronde pada cohort sumber |
| Ronde menang | Jumlah pengamatan terpilih ketika sisi operator memenangkan ronde |
| Win rate | Ronde menang dibagi jumlah pemilihan; bukan kemenangan series |
| Pemakaian / ronde sisi | Pemilihan dibagi jumlah ronde sisi yang tercatat pada cohort; bukan pick rate yang dikondisikan pada operator tidak diban |
| Favorit | Pemilihan terbanyak, bukan penilaian skill atau penyebab kemenangan |
| Ban pressure | Metrik terpisah dari sumber resmi Ubisoft: jumlah peta unik yang mencatat operator diban |

Urutan awal leaderboard berdasarkan jumlah ronde menang. Pengguna dapat beralih ke pemilihan atau win rate. Minimum sampel awal 30 pemilihan, dengan opsi 10, 30, 50, atau 100. Minimum ini merupakan parameter analisis, bukan data dari provider.

Tooltip win rate memuat interval Wilson 95% sebagai indikator deskriptif. Pengamatan ronde dapat berkorelasi menurut pertandingan/tim; interval ini tidak membuktikan signifikansi atau keunggulan kausal. Nilai 0% dipertahankan jika sumber mencatat nol kemenangan. Tidak ada imputasi.

Nama operator dan tim dipertahankan dari sumber, termasuk aksen. Filter tim memakai nama yang cocok persis dengan sumber; jika tidak cocok, panel kosong. Tidak ada fuzzy join atau pemaksaan alias. Filter kompetisi dan tim utama diterapkan pada panel operator; pencarian pertandingan tetap hanya untuk pertandingan. Panel mempunyai pencarian operator sendiri. Header visual menampilkan favorit event sebagai ilustrasi berbasis data dan selalu diberi label eventnya.

## Hasil snapshot

| Kategori | Operator | Angka |
|---|---|---|
| Favorit menyerang | Deimos | 308 pemilihan; 150 ronde menang; 48,7% |
| Favorit bertahan | Smoke | 382 pemilihan; 198 ronde menang; 51,8% |
| Ronde menang terbanyak | Smoke | 198 |
| Win rate tertinggi, minimum 30 pemilihan | Pulse | 35/52 = 67,3% |

Hasil dapat berubah saat cohort/filter diubah. Pulse mempunyai sampel lebih kecil daripada Smoke; perbedaan win rate tidak berarti Pulse pasti lebih kuat.

## Pembaruan dan reproduksi

Pengunduhan otomatis Ubisoft tetap berlangsung setiap 6 jam dan memperbarui data hasil serta ban. **Snapshot pemilihan operator ini bersifat statis**, diimpor dari satu halaman publik yang sudah ditangkap dalam riset. Pembaru tidak melakukan scraping berkala ke r6tv. Ini mengikuti batas penggunaan sumber dan tidak menyamarkan snapshot operator sebagai feed langsung.

Untuk memperbarui snapshot tambahan, gunakan hasil ekspor/tangkapan yang diperoleh secara sah dan verifikasi cakupan serta tanggalnya terlebih dahulu:

```powershell
python scripts/import_operator_snapshot.py --input PATH_KE_HTML --captured-at TIMESTAMP_ISO_ASLI
python scripts/validate_operators.py
python scripts/build.py
```

Importer tidak mengirim permintaan jaringan. Ia khusus untuk format board Salt Lake City Major ini; sumber/event lain memerlukan pemetaan dan validasi baru. Buka ulang/refresh HTML setelah impor baru. Ekspor operator CSV pada antarmuka menyertakan URL dan timestamp sumber.
