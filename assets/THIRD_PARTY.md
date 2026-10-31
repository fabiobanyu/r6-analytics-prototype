# Aset pihak ketiga

Antarmuka menggunakan komposisi panel, pola garis taktis, ikon navigasi SVG, dan palet sendiri; bukan salinan UI Rainbow Six Siege.

- **Manrope**, font variabel: [Google Fonts](https://github.com/google/fonts/tree/main/ofl/manrope). File lokal `fonts/Manrope-Variable.ttf`. Lisensi SIL Open Font License tersedia di `fonts/manrope-OFL.txt`.
- **Barlow Condensed Bold**: [Google Fonts](https://github.com/google/fonts/tree/main/ofl/barlowcondensed). File lokal `fonts/Barlow-Condensed-Bold.ttf`. Lisensi tersedia di `fonts/barlowcondensed-OFL.txt`.
- **Ikon operator Rainbow Six Siege**: Ubisoft. Sebanyak 56 ikon diunduh dari URL `logoUrl` yang benar-benar tercantum dalam sumber pertandingan resmi yang sudah tersimpan. [Manifest aset](operator_icons.json) mencatat URL asli, tanggal unduh, SHA-256, dan nama file. Ikon tidak mengubah atau membuktikan statistik operator. Operator tanpa ikon tersimpan memakai singkatan teks, bukan gambar palsu.

Font dan ikon ditanam sebagai data URI saat build sehingga demo tetap mandiri dan tidak meminta CDN ketika dibuka. Merek dan artwork operator terkait tetap milik Ubisoft; prototype ini independen dan tidak berafiliasi dengan Ubisoft.
