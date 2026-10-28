# Checklist Gladi Presentasi — Smart Tree 3D

Pakai checklist ini saat gladi (H-1) dan sebelum tampil (Hari H). Semua langkah bisa dijalankan **tanpa internet**, kecuali `npm ci` pertama kali.

## Persiapan sekali (H-2 atau lebih awal)
- [ ] Salin folder proyek ke laptop presentasi, lalu jalankan `npm ci`. Hanya langkah ini yang butuh internet.
- [ ] `npm run build`, lalu `npm run preview`, kemudian buka `http://localhost:4173`.
- [ ] Rekam layar satu putaran tur otomatis sebagai video cadangan terakhir.

## Gladi (H-1)
- [ ] **Matikan Wi-Fi**, lalu muat ulang halaman. Model, font Arab, dan semua bab harus tetap tampil.
- [ ] Buka `http://localhost:4173/?debug=1` dan lihat folder **Quality** di panel kanan:
  - Pindah ke **Bab 4 (Sirkulasi Air)**, bab terberat. Angka *fps* harus ≥ 55 (atau mendekati refresh rate layar).
  - Jika tier turun sendiri ke `low`, presentasikan dengan `?quality=low` (lihat di bawah).
- [ ] **Laptop dev (Intel HD 4000):** pilih **Lancar** di menu kualitas (ikon meteran di bar atas), atau buka `http://localhost:4173/?quality=low`. Pilihan menu tersimpan di browser itu.
- [ ] Coba ketiga bahasa (ID / EN / ع). Pilihan tersimpan, jadi **pilih bahasa presentasi sebelum mulai**.
- [ ] Sambungkan ke proyektor: resolusi native, dan zoom browser 100% (`Ctrl+0`).
- [ ] Tes clicker: tombol maju harus pindah ke bab berikutnya, termasuk saat bahasa Arab aktif.
- [ ] Jalankan tur otomatis (`T`) satu putaran penuh (± 1 menit).
- [ ] Klik beberapa modul. Panel info harus muncul, dan `Esc` mengembalikan kamera.

## Hari H (± 30 menit sebelum tampil)
- [ ] Laptop **dicolok ke listrik**, mode daya *Best performance*, dan layar tidak tidur (*sleep*: Never).
- [ ] Tutup aplikasi dan tab lain. Aktifkan *Do Not Disturb / Focus assist* agar notifikasi tidak muncul.
- [ ] `npm run preview`, buka URL presentasi, tekan **F** (fullscreen), lalu `Home` ke Bab 1.
- [ ] Biarkan layar loading selesai. Cabang dan kanopi menyusul di latar belakang dalam beberapa detik.

## Kontrol saat presentasi
| Aksi | Tombol |
|---|---|
| Bab berikutnya / sebelumnya | `→` / `←`, `PageDown` / `PageUp` (clicker), tombol ‹ › |
| Bab pertama / terakhir | `Home` / `End` |
| Tur otomatis mulai / jeda | `T` atau tombol ▶ di bar navigasi |
| Fullscreen | `F` |
| Tutup panel info | `Esc` atau × |
| Detail modul | Klik / ketuk modul |
| Bongkar / rakit (Bab 3) | Tombol "Bongkar modul / Rakit kembali" |
| Pompa ON/OFF (Bab 5) | Saklar di kartu Pompa; aliran air ikut berhenti |

## Jika ada masalah
| Gejala | Tindakan |
|---|---|
| Tampilan 3D hilang dan muncul "Memulihkan tampilan 3D…" | Tunggu. Biasanya pulih sendiri dalam 1–2 detik. Jika muncul tombol **Muat ulang**, klik; bab yang sama akan terbuka kembali. |
| Tidak sengaja menekan F5 / reload | Halaman kembali ke bab yang sama. |
| Gerakan tersendat | Menu kualitas (ikon meteran) → **Lancar**. Halaman dimuat ulang di bab yang sama. |
| Muncul gambar poster "Tampilan 3D tidak tersedia" | Browser atau GPU tidak mendukung WebGL. Pindah ke Chrome atau Edge terbaru, atau ke laptop lain. Poster tetap bisa dipakai menjelaskan produk. |
| Halaman tidak terbuka sama sekali | Server preview mati: jalankan lagi `npm run preview`. |
| Semua gagal | Putar video rekaman tur (cadangan). |

## Mode booth / pameran
- Buka `http://localhost:4173/?tour=1` (tambahkan `&quality=low` di laptop lemah). Tur berjalan otomatis dan berulang.
- Sentuhan atau klik pengunjung menjeda tur. Tekan `T` untuk melanjutkan.
- Selama tur, layar dijaga tetap menyala (Screen Wake Lock, Chrome/Edge). Tetap atur *sleep* laptop ke Never.

## Catatan konten yang perlu disampaikan lisan
- Semua angka di **Dashboard IoT adalah simulasi**; label "Data demo" selalu tampil.
- **AWG / Penangkap Embun** dan **Water Recovery & Transpirasi** masih **Tahap R&D**, belum fitur yang berjalan.
- Terjemahan Arab adalah draf MSA dan **belum diperiksa penutur asli**.
