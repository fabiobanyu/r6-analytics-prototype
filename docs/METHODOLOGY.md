# Metode analisis dan evaluasi

Elo merupakan baseline transparan, bukan model siap produksi. Unit belajar adalah **series**; baris pemain, ronde, dan peta tidak menjadi duplikasi sampel series.

## Aturan yang ditetapkan

Rating awal semua tim 1500, K=24, skala 400. Untuk tim A dan B:

```text
p(A menang) = 1 / (1 + 10^((rating_B - rating_A) / 400))
rating_A += 24 × (hasil_A - p)
rating_B -= 24 × (hasil_A - p)
```

`hasil_A` adalah 1 jika flag sumber menyatakan A menang, selain itu 0. Series harus selesai, memiliki satu pemenang, bertanggal sebelum cutoff snapshot, dan bukan forfeit. Margin skor dan format BO tidak memengaruhi pembaruan. Semua parameter tetap; tidak ada tuning untuk memperbesar metrik.

## Pencegahan kebocoran

Series diurutkan menurut timestamp UTC. Seluruh prediksi pada timestamp yang sama memakai rating dari timestamp sebelumnya; baru setelahnya semua hasil dalam batch dipakai memperbarui rating. Model tidak memakai skor, kill, peta, atau pemenang pertandingan yang sedang diprediksi sebagai fitur. Perubahan label pada suatu series tidak boleh memengaruhi prediksinya sendiri maupun prediksi pada timestamp sebelumnya/sama; hal ini diuji.

Evaluasi prequential memasukkan series hanya jika masing-masing tim memiliki sedikitnya 3 series eligible **sebelumnya**. Pada snapshot awal ada 408 series eligible dan 274 evaluasi. Angka yang tersisa merupakan warm-up, bukan dihapus karena prediksinya salah. Estimasi perbandingan baru hanya ditampilkan jika masing-masing tim memiliki sedikitnya 5 series eligible.

## Pembanding dan metrik

| Metrik | Definisi |
|---|---|
| Brier | Rata-rata `(p - y)^2`; lebih kecil lebih baik |
| Log loss | Rata-rata `-[y log(p) + (1-y) log(1-p)]`; lebih kecil lebih baik |
| Akurasi favorit | Proporsi benar ketika memilih tim dengan peluang >50%; prediksi tepat 50% tidak dihitung sebagai favorit |
| Kalibrasi | Rata-rata probabilitas dan proporsi hasil A menang pada 5 bin lebar 0,2; bin kosong tidak diberi proporsi palsu |

Baseline pertama adalah p=0,5: Brier 0,25 dan log loss ln(2). Baseline kedua memakai proporsi kemenangan tim A dari semua timestamp sebelumnya, dengan smoothing Beta(1,1): `(kemenangan_A_sebelumnya + 1)/(series_sebelumnya + 2)`. Baseline itu tidak melihat label masa depan, menggunakan sampel evaluasi yang sama, dan membantu mengungkap bias urutan tim pada sumber. Akurasi selalu memilih A juga ditampilkan sebagai pembanding deskriptif.

Pada snapshot awal Elo menghasilkan Brier 0,24232 versus 0,24274 baseline proporsi historis; selisih hanya 0,00042. Akurasi favorit 60,58%, sementara selalu A 59,49%. Angka deskriptif ini belum menunjukkan keunggulan yang kuat atau signifikan. Tidak dilakukan uji signifikansi yang menganggap series saling independen; pertandingan berulang tim dan turnamen dapat berkorelasi.

## Batas yang relevan

- Cakupan stage/event bukan seluruh riwayat; rating dimulai dari 1500 meskipun tim memiliki sejarah sebelum cakupan.
- Alias organisasi dan roster dapat berubah. Satu ID tim tidak berarti komposisi pemain tetap.
- Tidak ada normalisasi patch, map veto, region, roster, BO, jeda waktu, atau kekuatan jadwal.
- Statistik pemain merupakan deskripsi pertandingan, bukan fitur prediksi sebelum pertandingan.
- Evaluasi berjalan pada data historis yang sudah tersedia, bukan uji prospektif event mendatang yang dibekukan lebih dahulu.
- Perbandingan manual tim tidak dikondisikan pada peta, format, tanggal jadwal tertentu, atau perubahan roster masa depan.

Pengembangan berikutnya yang diperlukan sebelum klaim prediktif: bekukan data dan model sebelum satu event masa depan, uji prospektif, bandingkan baseline lebih kuat, audit pergantian roster, dan ukur ketidakpastian dengan ketergantungan antartim/turnamen diperhitungkan.
