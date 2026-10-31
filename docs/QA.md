# QA prototype

Status snapshot awal 31 Oktober 2026: **validasi sumber lulus, 13 tes otomatis lulus; QA visual browser masih terbuka**. Ini prototype yang bisa ditinjau, belum pernyataan kesiapan produksi.

## Yang teruji

`python scripts/validate_data.py` mencocokkan seluruh hasil dan statistik ternormalisasi dengan file sumber terunduh, termasuk hash gzip yang diekstrak, label hasil, ID tim, skor, peta, ronde, statistik pemain, ban, dan grain. Dua forfeit dipertahankan sesuai sumber dan ditandai agar tidak melatih model.

`npm test` mencakup:

1. ID series unik dan route sumber tercatat.
2. Grain series, peta, dan ronde tidak terpengaruh jumlah baris pemain.
3. Jadwal tidak memiliki hasil palsu dan tidak melatih model.
4. Perubahan label tidak bocor ke prediksi series itu sendiri atau timestamp sebelumnya/sama.
5. Urutan input tidak mengubah hasil batch timestamp.
6. Metrik dihitung ulang dari label asli; baseline hanya memakai riwayat sebelumnya.
7. Kemenangan sisi serang dihitung dari ronde sumber; 0 dipertahankan.
8. Field peta kosong tidak diisi dan forecast tidak menulis hasil pertandingan.
9. CSV aman terhadap injeksi formula, kutip, baris baru, nol, dan null.
10. Snapshot duplikat ditolak; mesin tidak memiliki generator acak.
11. DOM: navigasi, filter, pencarian kosong, pagination, detail, forecast, ekspor, refresh, dan penolakan cache rusak.
12. Snapshot tertanam dapat dirender tanpa folder data.
13. Pembaru diuji dari salinan cache asli: rebuild offline, jaringan gagal, sumber rusak, snapshot/HTML terakhir tidak berubah pada kegagalan.

Uji DOM memakai jsdom; implementasi dialog dan objek URL unduhan diganti stub hanya dalam tes. Tes ini tidak membuktikan tampilan, perilaku dialog native, unduhan file nyata, atau kebijakan pemuatan script lokal setiap browser. Kegagalan jaringan/cache pada tes sengaja dibuat pada folder sementara, bukan dataset utama.

## Yang perlu diuji manual

Browser pengujian menolak URL `file://`; tidak dilakukan pengujian visual melalui browser lain sebagai jalan memutar. Checklist ini tetap terbuka dan tidak diberi status lulus tanpa bukti:

- Buka `index.html` di Chrome/Edge/Brave/Firefox; verifikasi tampilan desktop dan lebar sekitar 390 px.
- Periksa keterbacaan label, table scroll horizontal pada layar kecil, focus keyboard, dialog Escape/Tutup, dan source link.
- Ubah filter, buka series, verifikasi warna kemenangan ronde dan skor terhadap URL resmi.
- Ekspor CSV lalu pastikan browser mengunduh file dan Excel membaca encoding serta nilai nol/kosong dengan benar.
- Jalankan pembaru; pastikan HTML yang tetap terbuka membaca snapshot baru dalam 60 detik. Jika browser memblokir script lokal, refresh HTML setelah pembaruan; snapshot tertanam selalu diperbarui pembaru.
- Tutup internet ketika memaksa refresh pada salinan proyek, lalu pastikan status gagal dan snapshot terakhir masih tampil.

## Perintah

```powershell
python scripts/validate_data.py
python scripts/build.py
npm ci --ignore-scripts
npm test
node scripts/analyze.cjs
```

CI hanya validasi, build, dan tes. Tidak ada deployment, PostgreSQL, kredensial aplikasi, atau simulator dalam alur utama. Backup skrip lama disimpan di luar repository kerja.
