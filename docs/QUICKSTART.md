# Mulai dari satu pertanyaan

Buka `index.html` atau `Buka Demo.cmd`. Demo memakai salinan data tersimpan dan dapat dibaca tanpa internet. Jika halaman sudah terbuka sebelum pembaruan desain, refresh agar perubahan antarmuka terlihat.

## Baru pertama kali?

Klik **Baru pertama kali? Mulai di sini** atau **Panduan & istilah**. Panduan berisi empat langkah singkat. Kamus dapat dicari dan dibuka dari tombol **?** di dekat angka atau istilah.

Di Ringkasan, pilih salah satu pertanyaan:

- **Operator mana yang paling sering dipilih?** Menyiapkan data operator event yang tersedia, semua tim, dan urutan pemilihan terbanyak.
- **Operator mana yang paling sering menang?** Membuka sumber yang sama, diurutkan menurut jumlah ronde menang.
- **Bagaimana peluang dua tim?** Memilih dua tim yang punya cukup riwayat sebagai awal. Tim dapat diganti atau ditukar.

Tombol pertanyaan membersihkan filter utama sebelumnya agar tidak menghasilkan tampilan kosong yang membingungkan. Pemberitahuan menjelaskan perubahan filter tersebut.

## Pahami angka operator

Klik nama operator dalam tabel atau **Pahami angka ini** pada kartu. Dialog menunjukkan jumlah dipilih, ronde menang, dan sisanya yang kalah, beserta batang perbandingan. Pilih operator lain dari sisi yang sama untuk membandingkan angka dan jumlah pemilihannya.

“Paling sering dipilih”, “kemenangan terbanyak”, dan “win rate tertinggi” adalah tiga urutan yang berbeda. Win rate tinggi dengan sedikit pengamatan belum membuktikan operator lebih kuat. Snapshot operator hanya mencakup replay SLC Major 2026 dari r6tv; bukan semua event, dan tidak ikut polling hasil Ubisoft.

## Klik grafik, lalu periksa pertandingan

- **Grafik mingguan:** klik batang untuk membuka pertandingan pada minggu itu, berdasarkan timestamp sumber dalam UTC.
- **Grafik peta:** klik nama peta untuk membaca jumlah ronde yang dimenangkan penyerang dan pihak bertahan. Tombol dalam dialog membuka pertandingan terkait.
- **Peringkat tim:** klik nama tim untuk melihat riwayatnya dalam seluruh cakupan data.
- **Detail pertandingan:** skor utama adalah jumlah peta yang dimenangkan. Skor di kartu peta adalah jumlah ronde yang dimenangkan. Klik nomor ronde untuk membaca siapa menang dan siapa yang menyerang/bertahan.

Label filter aktif terlihat di atas konten. Klik **×** pada satu label untuk menghapus filter itu, atau **Reset** untuk membersihkan semua filter utama. Jika satu peta dipilih, jumlah peta, ronde, pemain, dan peta ban hanya dihitung dari peta tersebut; satu pertandingan tetap dihitung sekali. Ekspor pertandingan berisi satu baris per pertandingan yang cocok, dengan skor series lengkap; filter peta tidak mengubah skor series menjadi skor peta.

Filter pemilihan operator hanya mengikuti kompetisi dan tim. Filter peta/minggu serta pencarian pertandingan tidak diterapkan ke board operator agregat karena sumber operator tidak menyediakan ID pertandingan per pengamatan. Panel menyebutkan batas ini secara langsung. Filter khusus operator dapat dihapus dengan **Reset filter operator**.

## Membaca peluang tim

Batang peluang menunjukkan perkiraan model untuk dua tim, bukan hasil pertandingan baru. Keduanya tetap bisa menang. Masing-masing tim perlu minimal lima pertandingan eligible dalam data. Jika belum cukup, peluang tetap tidak ditampilkan.

Pintasan **Bagaimana peluang dua tim?** hanya memilih pasangan awal dan membuka panel; ia tidak menghitung peluang. Angka baru muncul setelah **Lihat perkiraan peluang** ditekan. Mengganti atau menukar tim menghapus hasil sebelumnya. Tekan tombol lagi untuk menghitung pilihan baru. Jika data pertandingan berubah, hasil lama juga dihapus; membaca cache yang isinya sama tidak menghapus hasil yang sudah diminta.

Klik **Lihat riwayat** untuk memeriksa pertandingan tim. Filter utama dihapus agar seluruh riwayat tim pada dataset terlihat. Model memakai seluruh riwayat eligible dalam snapshot, bukan hanya filter halaman. Nilai teknis seperti Brier dan log loss tersedia di bagian **Lihat ukuran teknis model**; penjelasan awal menampilkan ketepatan historis dan pembanding sederhana.

Seluruh interaksi ini membaca data yang tersedia. Tidak ada hasil acak atau pertandingan baru yang ditambahkan saat tombol diklik.
