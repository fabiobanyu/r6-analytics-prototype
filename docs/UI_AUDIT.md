# Audit perilaku antarmuka — 31 Oktober 2026

Pemicu audit: pengguna melaporkan bahwa peluang muncul sebelum **Lihat perkiraan peluang** ditekan. Penelusuran kode dan tes interaksi mengonfirmasi bahwa pintasan memang langsung memanggil penghitungan; screenshot sesuai perilaku tersebut.

## Temuan dan perbaikan

| Temuan yang dapat direproduksi | Perilaku setelah diperbaiki |
|---|---|
| Pintasan perbandingan tim dan tindakan dalam panduan langsung memanggil penghitungan | Hanya menyiapkan pilihan. Peluang baru dihitung melalui tombol eksplisit |
| Mengubah dropdown atau menukar tim otomatis menghitung ulang setelah hasil pernah muncul | Hasil lama dihapus; pesan meminta pengguna menekan tombol lagi |
| Pesan penolakan cache rusak tertimpa event status sukses berikutnya | Penolakan disimpan sebagai keadaan terpisah dan diprioritaskan sampai snapshot valid diterima |
| Snapshot lebih lama dapat menggantikan data yang lebih baru | Timestamp dibandingkan; snapshot lama ditolak. Metadata tanggal tidak valid juga ditolak |
| Permintaan script cache yang tidak selesai membuat tombol terus nonaktif | Timeout 15 detik per file, penyelesaian satu kali, dan tombol aktif kembali setelah semua permintaan selesai/gagal |
| Status sukses dapat menutupi kegagalan pembacaan salah satu file cache | Kegagalan dicatat per file dan baru dihapus setelah file terkait berhasil dibaca |
| Pratinjau favorit memakai minimum 30 tersembunyi, sehingga tim dengan pemilihan sedikit terlihat tidak punya data | Pratinjau frekuensi memakai pengamatan yang tersedia, menampilkan jumlahnya, dan dapat menampilkan satu sisi jika sisi lainnya kosong. Batas minimum pada leaderboard tetap mengikuti kontrol pengguna |
| Tombol ekspor pertandingan tetap aktif saat filter tidak menghasilkan data | Tombol dinonaktifkan sehingga tidak mengunduh CSV kosong |

Pemeriksaan tambahan menemukan launcher Windows memakai `py -3`, sementara perintah tersebut tidak mengenali Python yang terpasang pada lingkungan pengguna. Launcher pembaruan diganti memakai `python`; Python 3.14 dan bantuan CLI pembaru berhasil dijalankan. Ini tidak mengunduh data baru atau mengubah asumsi model.

## Aturan hasil peluang

1. Masuk halaman langsung, melalui navigasi, pintasan, atau panduan: belum ada angka peluang.
2. Klik tombol: hitung pasangan yang sedang dipilih. Tim sama atau riwayat tidak cukup menampilkan penjelasan tanpa angka pengganti.
3. Ubah salah satu tim atau tukar pasangan: hapus hasil sebelumnya, tanpa penghitungan otomatis.
4. Cache identik datang: pertahankan hasil yang sudah diminta.
5. Snapshot baru yang valid datang: hapus hasil lama dan minta klik ulang.
6. Cache rusak/lama datang: pertahankan data valid serta tampilkan penolakan; respons status sukses tidak menghapus pesan ini.

Perubahan filter pertandingan tidak membatasi riwayat model; cakupan ini dijelaskan di panel. Karena pasangan dan data model tidak berubah akibat filter tersebut, hasil yang sudah diminta tidak dihitung ulang.

## Bukti pengujian dan batasnya

`tests/ui_state.test.cjs` menguji pemanggilan penghitungan, placeholder/hasil/error, snapshot identik/baru/lama/rusak, balapan pesan status, timeout dan pemulihan, ekspor kosong, serta pratinjau tim dengan sampel kecil menggunakan salinan dataset asli. Tes yang sebelumnya menganggap penghitungan otomatis sebagai perilaku benar telah diperbarui.

Total suite: **26 tes otomatis**. Ini audit logika dan interaksi DOM dengan jsdom; bukan klaim bahwa semua kemungkinan bug telah hilang. Layout browser nyata, dialog native, serta sambungan HP melalui Wi-Fi masih memerlukan pengujian perangkat secara langsung. Tidak ada server jaringan atau deployment yang dijalankan untuk audit ini.
