# CLAUDE.md — Smart Tree 3D Showcase

Panduan proyek untuk siapa pun (manusia atau model) yang melanjutkan pekerjaan ini. **Baca seluruh file ini sebelum menulis kode**, lalu perbarui tabel **Status Tahap** setiap kali sebuah tahap selesai.

## Ringkasan proyek
Web 3D showcase untuk produk **Smart Tree**, dipakai untuk pitching kompetisi startup. Smart Tree adalah pohon modular cerdas berbasis IoT dan hidroponik untuk penghijauan daerah panas dan kering, dengan visi *Arafah Green Legacy* dan tagline *"Smart Tree: Green Arafah, Brighter Tomorrow"*. Rumus produknya: **Living Plant + Modular Structure + Smart Technology**.

- Stack: **Vite + Three.js (vanilla JS, ES modules)**, tanpa framework UI dan tanpa TypeScript.
- Target utama laptop untuk presentasi; tetap harus lancar di HP.
- Bahasa: Indonesia, Inggris, Arab (RTL).
- Sumber konten: `docs/business_plan.md`. **Ini satu-satunya sumber angka dan klaim produk.**

### Alur narasi (bab)
(a) Pembuka Arafah Green Legacy, (b) pohon muncul, (c) exploded view dan perakitan, (d) sistem air closed-loop dengan animasi aliran (tandon → pompa → akar → kembali ke tandon), (e) dashboard IoT (simulasi), (f) roadmap.

## Aset 3D
Web mengikuti **11 aset** berikut, bukan angka "7 modul" di business plan. ID modul di bawah dipakai di semua kode dan kunci i18n:

| ID modul | File asli | Peran |
|---|---|---|
| `trunk_base` | trunk_base.glb | Batang berongga (cutaway), wadah semua modul internal |
| `green_tank` | new_green_tank_opt.glb (sejak 2026-10-28) | Tandon hijau di dasar batang (pompa dan kontrol) |
| `distribution_pipe` | distribution_pipe.glb | Pipa distribusi di atas green_tank |
| `nutrient_tank` | new_nutrient_tank_opt.glb (sejak 2026-10-28) | Tandon nutrisi A (biru) dan B (merah) beserta pompa |
| `battery` | new_battery_opt.glb (sejak 2026-10-28; sebelumnya opt_battery.glb) | Baterai dan charge controller kuning |
| `tree_crown` | tree_crown.glb | Kanopi |
| `solar_panel` | new_solar_panel_opt.glb (sejak 2026-10-28) | Panel surya di puncak |
| `branch_apple` | branch_apple.glb | Cabang kiri atas |
| `branch_mango` | branch_mango.glb | Cabang kanan atas |
| `branch_grape` | branch_grape.glb | Cabang kiri bawah |
| `branch_orange` | branch_orange.glb | Cabang kanan bawah |

Urutan vertikal (bawah → atas): green_tank → distribution_pipe → nutrient_tank → battery → tree_crown → solar_panel. Cabang menempel di sisi batang.

### Temuan inspeksi awal (2026-10-27)
- Total file **~66 MB** dan **~8,2 juta segitiga**. Tiap cabang 1,3–1,5 jt segitiga, tree_crown 1,23 jt, modul internal 150–300 rb. File asli **tidak layak dipakai langsung**.
- Ekstensi: `EXT_meshopt_compression`, `KHR_mesh_quantization`, `EXT_texture_webp`.
- Tekstur WebP 1024² (crown 2048²), 3 map per model (baseColor, metallicRoughness, normal). Ukuran tekstur kecil; yang membengkak adalah geometri.
- Semua model sudah **dinormalisasi oleh Meshy**: sumbu terpanjang ±0,95 dan pivot di tengah bbox, sehingga **ukuran relatif antarmodul hilang**. Skala nyata diberikan lewat `assembly.json`.
- Hasil Tahap 1 (`reports/models.report.json`): tiap file berisi **1 node, 1 mesh, 1 primitive, 1 material**. Semua material **OPAQUE** (daun berupa geometri, bukan alpha), sehingga risiko sorting alpha tidak ada. Semua material **doubleSided = true**; nonaktifkan untuk modul tertutup demi menghemat fragment, tapi pertahankan di trunk_base (cutaway). Faktor metallic/roughness 1/1, dengan nilai sebenarnya berasal dari tekstur.
- Orientasi tampak sudah Y-up dan konsisten: modul tegak (trunk, tandon, baterai) memiliki sumbu terpanjang Y, sedangkan cabang, panel surya, pipa distribusi, dan crown memiliki sumbu terpanjang horizontal. Pivot semua model di tengah bbox (pivotRel ≈ 0,5/0,5/0,5). Konfirmasi visual dilakukan di Tahap 4.

### Pipeline optimasi (Tahap 2)
- `scripts/optimize-models.mjs`: dedup → dequantize → weld → **simplify permissive** → prune → meshopt level `high`. Target segitiga per modul dan varian ditulis di tabel `MODULES` di skrip ini.
- `simplify()` bawaan @gltf-transform macet di tree_crown (863 rb segitiga), karena Meshy memecah vertex di hampir setiap seam UV. Skrip ini memanggil `MeshoptSimplifier.simplifyWithAttributes` langsung dengan flag `Permissive` dan bobot UV 0,5 / normal 0,1 agar seam tidak rusak. **Jangan kembali ke `simplify()` bawaan.**
- Output diberi nama sesuai **ID modul** (mis. `battery.glb`, bukan `opt_battery.glb`). Laporan sesudah optimasi: `reports/models.{desktop,mobile}.report.json`.
- Tekstur belum diubah (crown versi mobile masih 2048²). Penurunan resolusi butuh `sharp` (dependensi baru, perlu persetujuan); lakukan hanya jika memori GPU di HP bermasalah di Tahap 14.
- Alat dev `tools/compare.html` (tidak ikut build) menampilkan original/desktop/mobile berdampingan: `npm run dev` lalu buka `/tools/compare.html?m=<id>`. Alat dev di `tools/` dikecualikan dari aturan i18n.

### Pembaruan model dari pemilik proyek (2026-10-28)
- Empat sumber baru di `models_src/`: `new_{green_tank,nutrient_tank,battery,solar_panel}_opt.glb`. File lama tetap ada (tidak diubah), tetapi tidak lagi dipakai `optimize-models.mjs`.
- Model baru sudah low-poly (16–28 rb segitiga) dan **tanpa normal map** (hanya baseColor + metallicRoughness).
  - Desktop: diteruskan tanpa simplify.
  - Mobile: dibatasi 20 rb (nutrient_tank 28 rb → 20 rb).
- Bounds praktis identik dengan versi lama (selisih < 0,3 %), sehingga `assembly.json` tidak diubah. Manifest dan `proxies.glb` sudah dibangun ulang.
- Total sesudahnya: desktop 10,99 MB / 733 rb segitiga; mobile 7,65 MB / 354 rb.
- Diuji: close-up keempat modul di tier high, regresi idempoten 30/30 di tier low, build bersih.

### Anggaran setelah optimasi
| Varian | Ukuran total | Segitiga total | Per modul (perkiraan) |
|---|---|---|---|
| desktop | < 15 MB | < 1 jt | cabang ~100 rb, crown ~150 rb, internal 30–60 rb |
| mobile | < 8 MB | < 400 rb | sekitar separuh desktop; tekstur crown 1024² |

## Arsitektur

### Prinsip
1. **Pipeline aset offline → manifest data → runtime yang digerakkan data.** Posisi, skala, dan urutan modul tidak pernah di-hardcode di kode.
2. **1 unit = 1 meter.** Tinggi pohon standar 1,8 m.
3. **Semua teks di HTML overlay** (CSS2DRenderer untuk label 3D, DOM untuk panel). Tidak ada teks di dalam Three.js, karena huruf Arab bersambung.
4. **Event bus dan state terpusat** (`src/app/state.js`). Modul UI dan 3D tidak saling import langsung. Event yang dipakai: `module:hover`, `module:select`, `chapter:go` (permintaan), `chapter:change`, `view:inset`, `lang:change`, `pump:state`, `quality:change`, `assembly:go` (permintaan), `assembly:state`, `assembly:snap`, `modules:highlight`, `tour:toggle`, `tour:interrupt`, `tour:state`, `tour:end`, `load:progress`, `load:phase`, `modules:loaded`.
5. **Navigasi berbasis bab (step-based), bukan scroll.** Kontrolnya tombol Next/Prev, keyboard (← → PageUp/PageDown untuk clicker), dan swipe. Tur otomatis memakai mesin bab yang sama.
6. **State tiap bab idempoten**: masuk ke bab N dari bab mana pun harus menghasilkan tampilan yang sama.

### Struktur folder
```
smart-tree-web/
├─ CLAUDE.md
├─ docs/business_plan.md         sumber konten
├─ docs/checklist-gladi.md       checklist gladi & hari H presentasi (Tahap 15)
├─ models_src/                   GLB ASLI dari Meshy (jangan diubah, tidak disajikan)
├─ scripts/
│  ├─ inspect-models.mjs         laporan bbox/ukuran/pivot/segitiga/MB → reports/models.report.json
│  ├─ optimize-models.mjs        weld → simplify → quantize → meshopt → public/models/{desktop,mobile}/
│  ├─ build-manifest.mjs         normalisasi otomatis → src/data/models.manifest.json
│  ├─ build-proxies.mjs          proxy pick low-poly → public/models/proxies.glb
│  └─ check-i18n.mjs             kunci id/en/ar identik dan tidak kosong (abaikan _meta)
├─ reports/                      hasil inspeksi sebelum/sesudah
├─ public/models/desktop/        GLB teroptimasi untuk laptop
├─ public/models/mobile/         GLB LOD rendah untuk HP
├─ public/fallback/poster.webp   cadangan jika WebGL gagal (render asli, dibuat ulang dengan tools/screenshot.mjs, lihat Perintah)
├─ public/art/                   hero.svg (ilustrasi Arafah bab intro), girih.svg (tile pola khatam); dibuat oleh tools/build-art.mjs
├─ art_src/prompts.md            prompt gambar untuk Codex image generation (opsional, lihat Sistem desain)
├─ tools/                        alat dev, tidak ikut build: compare.html (bandingkan model), screenshot.mjs (screenshot headless via CDP),
│                                build-art.mjs (ilustrasi SVG ber-seed → public/art/)
├─ vite.config.js                plugin dev-only: POST /__debug/assembly → menulis src/data/assembly.json
└─ src/
   ├─ main.js
   ├─ app/          App.js, state.js, config.js, qualityPreference.js (pilihan menu kualitas)
   ├─ core/         renderer.js, scene.js, camera.js, controls.js, loop.js, quality.js, cameraFlight.js, viewport.js,
   │                pipeline.js (FXAA), contextGuard.js (WebGL context lost/restored)
   ├─ assets/       loader.js, fonts/{cairo,reem-kufi}-*.woff2 (+ lisensi OFL)
   ├─ modules/      SmartModule.js, ModuleRegistry.js
   ├─ assembly/     AssemblyController.js, tween.js
   ├─ interaction/  picker.js, focus.js
   ├─ story/        StoryController.js, tour.js, chapters/{index,intro,reveal,assembly,water,dashboard,roadmap}.js
   ├─ water/        WaterFlow.js
   ├─ ui/           loadingScreen.js, labels.js, infoPanel.js, dashboard.js, roadmap.js,
   │                langSwitcher.js, chapterNav.js, demoBadge.js, shell.js (menghubungkan markup overlay di index.html),
   │                motion.js (preset animasi Motion), backdrop.js (langit CSS + hero intro), glow.js (cahaya border panel),
   │                qualitySwitch.js (menu Otomatis / Lancar / HD)
   ├─ i18n/         i18n.js, locales/{id,en,ar}.json
   ├─ data/         models.manifest.json (GENERATED), assembly.json (MANUAL), modules.js,
   │                waterPath.json, roadmap.js, sim.js, tour.js (skrip tur), chapters.js (urutan bab)
   ├─ debug/        debugPanel.js (lil-gui, hanya di-import dinamis saat ?debug=1), formatJson.js (JSON rapi, array angka satu baris)
   └─ styles/       tokens.css, base.css, fonts.css, overlay.css
```

### Manifest: dua file, dua pemilik
- `src/data/models.manifest.json` **dibuat otomatis** oleh `build-manifest.mjs` dan boleh ditimpa. Isinya per ID: `desktop {url, bytes, tris}`, `mobile {url, bytes, tris}`, `bounds {min, max, size}` dalam unit mentah model, dan `pivotOffset` (translasi yang memindahkan pivot ke **tengah-bawah**, diterapkan sebelum skala). **Bounds desktop dipakai untuk kedua varian**, sehingga skala dan posisi identik di semua tier. Rotasi tidak perlu dikoreksi, karena orientasi semua model sudah Y-up (Tahap 1).
- `src/data/assembly.json` **disetel manual** (lewat debug panel `?debug=1` lalu Export) dan **tidak boleh ditimpa skrip**; `build-manifest.mjs` hanya memvalidasinya (semua ID ada, `size.axis` valid). Isinya: `tree.height` dan per ID `group` (`structure` | `internal` | `exterior` | `branch`), `order`, `size {axis, meters}`, `slot {position, rotation}`, `explode {position, approach, clear}`, dan `focus {distance, direction}`. Satuan meter, rotasi dalam derajat (urutan XYZ). Posisi = pivot modul (tengah-bawah) dalam ruang pohon, dengan origin di tanah tepat di pusat batang.
- Skala runtime (seragam): `size.meters / manifest.bounds.size[size.axis]`. Pakai sumbu yang paling mudah diukur secara nyata (Y untuk modul tegak, X untuk cabang, crown, pipa, dan panel).

### Sistem perakitan ala Lego
- State: `assembled` | `exploded` | `transit`. Implementasinya di `src/assembly/AssemblyController.js` (berjalan dengan `tween.js`, yang digerakkan loop render). Permintaan lewat event `assembly:go {target?, instant?}`, di mana target kosong berarti toggle. Status dipancarkan sebagai `assembly:state {state, target}` dan `assembly:snap {id}` (kait untuk suara opsional, default mati).
- Assemble mengikuti `order` dengan jeda mulai `config.assembly.assembleStagger` (0,45 detik), total sekitar 5 detik. Jalurnya: posisi explode → [clear point] → hover point (slot + `approach` × 2,5 cm) → jeda → snap (ease-in-back) ke slot, lalu pulse emissive. Explode berjalan dengan urutan terbalik.
- Data jalur ada di `assembly.json` → `explode {position, approach, clear}`. `approach` adalah arah masuk ke slot (internal `[0,0,1]` dari depan, crown dan solar `[0,1,0]` dari atas, cabang ±X dari samping). `clear` adalah jarak lurus sepanjang `approach` sebelum modul berbelok (internal 0,3 m, supaya keluar dari kompartemen tanpa menembus dinding). Modul yang `explode.position` sama dengan slotnya (trunk_base) tidak pernah bergerak.
- Tween selalu berangkat dari posisi saat ini, sehingga animasi bisa dibalik di tengah jalan. Jalur dihitung ulang dari posisi itu: modul yang masih berada di dalam jalur slot meneruskan gerak sepanjang sumbu. Di akhir jalur posisi diset persis ke array slot atau explode.
- `go(target, {instant: true})` menaruh modul tanpa animasi; bab Tahap 9 memakainya agar state bab idempoten. Panel debug ("pose (instant)" dan "explode / assemble (animated)") juga lewat controller.
- Posisi explode cabang x ±0,95, y 1,14 (atas) dan 0,36 (bawah); didekatkan dari ±1,3 setelah cabang dikecilkan (2026-10-28).
- Posisi explode crown y 1,4 dan solar y 2,35 (diturunkan dari 1,75/2,75 di Tahap 7). Tumpukan explode setinggi ~2,5 m tidak muat di kamera default, jadi **kamera bab (c) di Tahap 9 harus mundur**. Acuan yang sudah diuji: posisi `[0.9, 1.55, 5.4]`, target `[0, 1.2, 0]`.
- **Rongga batang = 4 kompartemen** yang menghadap depan (+Z), diukur dari geometri trunk_base (batang 1,1 m). Satu modul internal per kompartemen:
  | Kompartemen | Lantai → plafon (m) | Tinggi | Lebar dalam | Modul |
  |---|---|---|---|---|
  | C1 | 0,18 → 0,39 | 21 cm | ~20 cm | green_tank |
  | C2 | 0,415 → 0,58 | 16 cm | ~13 cm | distribution_pipe |
  | C3 | 0,63 → 0,80 | 17 cm | ~13 cm | nutrient_tank |
  | C4 | 0,87 → 1,02 | 15 cm | ~13 cm | battery |
  Jika ukuran batang diubah, ukur ulang kompartemen dan skalakan posisi modul internal secara proporsional.
- tree_crown punya potongan batang sendiri di bagian bawah. Pangkalnya harus berada di atas rak teratas (y ≥ 1,02); kalau lebih rendah, potongan itu menutupi C4 dan baterai tidak terlihat.
- Semua modul adalah anak dari satu grup `tree` (bukan anak `trunk_base`, supaya skala batang tidak ikut mempengaruhi modul lain). `group: internal` menandai modul di dalam rongga batang. Batang tetap diam.

### Cerita dan bab (Tahap 9)
- **`story/StoryController.js`** adalah pemilik bab. Ia menjawab `chapter:go {index}` dengan `chapter:change {index, id, ui}`. Setiap bab di `story/chapters/<id>.js` mendeklarasikan **state target**:
  - `tree`: tumbuh atau tersembunyi
  - `assembly`: `assembled` atau `exploded`
  - `interactive`: picking boleh atau tidak
  - `ui`: kunci i18n kartu cerita, plus `assemblyToggle`
  - `enter`/`exit` opsional untuk Tahap 10–12

  Saat masuk, semua target itu diterapkan dari kondisi scene saat ini, sehingga hasilnya idempoten, bahkan jika perpindahan diinterupsi di tengah. Tambahkan bab baru dengan mengisi file definisinya, bukan dengan percabangan di controller.
- **Urutan saat masuk bab:** `exit` bab lama → `module:select {id: null, reason: 'chapter'}` (panel tertutup, pose fokus dilupakan tanpa terbang) → `chapter:change` → picker → kamera → pohon → perakitan → `enter`.
- **Pohon tersembunyi selalu disimpan dalam keadaan terakit**, agar saat tumbuh tidak tampil setengah terbongkar. Bab (a) menyembunyikan pohon. Bab (b) menumbuhkannya dari tanah (skala grup `tree` 0→1, `outBack` 1,6 detik). Bab (c) masuk dalam keadaan terbongkar, lalu presenter menekan "Rakit kembali".
- **Kamera:** semua gerakan lewat `core/cameraFlight.js` (satu pemilik; penerbangan baru membatalkan yang lama). `controls.update()` dilewati selama terbang supaya clamp OrbitControls tidak melawan tween. Shot per bab ada di `assembly.json` → `shots.<id> {position, target, fit?}`.
- **`core/viewport.js`:** UI melaporkan sisi layar yang tertutup panel lewat `view:inset {top,right,bottom,left}` (px fisik; dikirim oleh `ui/storyCard.js`). Pusat proyeksi digeser ke area bebas dengan `camera.setViewOffset`, sehingga pohon menjauh dari kartu di LTR maupun RTL dan berada di bawah kartu di HP. `fit [w, h]` pada shot membuat kamera mundur sampai subjek muat di area bebas, dibatasi `config.story.maxShotDistance` (12 m); `controls.maxDistance` ikut dinaikkan untuk bab itu. Raycast dan CSS2D otomatis benar karena keduanya memakai matriks proyeksi yang sama.
- **Navigasi:** tombol, keyboard (PageDown/PageUp untuk clicker, → / ←, Home/End), dan swipe sentuh di kartu cerita dan bar navigasi. Kanvas tidak dipakai untuk swipe karena drag satu jari = orbit.
  - **Panah tidak dicerminkan di RTL:** clicker yang mengirim → harus selalu maju, seperti software slide.
  - **Swipe dicerminkan:** di RTL, swipe ke kanan = maju.
  - Keyboard diabaikan selama layar loading.
- **Kartu cerita:** `ui/storyCard.js` dengan teks `story.<bab>.*`. Placeholder `{height}` diisi `facts` lewat `ui/richText.js`; rentang angka dibungkus `<bdi>` agar "150–180" tidak terbalik di Arab. Di HP (≤ 600 px), kartu hanya menampilkan judul dan paragraf pertama, dengan tombol "Selengkapnya". Kartu intro tampil sebagai hero di tengah tanpa panel dan tanpa inset.
- Bab d–f sementara memakai placeholder (pohon terakit, shot overview, tanpa kartu) sampai Tahap 10–12.

### Interaksi
- Hover (pointer non-sentuh) menampilkan label CSS2D dan highlight. Tap di HP langsung memilih modul.
- **HP: satu penjelasan pada satu waktu** (2026-10-28). Saat panel info modul terbuka, `body[data-module-open]` menyembunyikan kartu bab, dashboard, roadmap, dan tombol rakit.
  - Sheet info melaporkan inset **bawah** (`reportInset(..., 'bottom')`), sehingga modul terpusat di atas sheet.
  - Panel yang tidak dirender melaporkan inset kosong (`inset.js` memeriksa `getClientRects`). Saat ditutup, semuanya kembali.
  - Di HP, sheet hanya di-fade (tanpa transform), karena bounds-nya dibaca untuk inset.
- Klik memicu fly-to kamera ke `focus` dan membuka panel info (teks dari i18n). Esc atau tombol × mengembalikan kamera.
- Raycast **hanya ke proxy low-poly tak terlihat**, tidak pernah ke mesh asli.
- Implementasi (Tahap 8):
  - **Proxy:** `npm run models:proxies` (`scripts/build-proxies.mjs`) membuat `public/models/proxies.glb`, berisi 1 node per ID dari GLB desktop: posisi saja, di-weld, lalu di-simplify (total ~13,6 rb segitiga, 233 KB). Jalankan ulang setelah `models:optimize`. File ini dimuat bersamaan dengan fase 0 (`config.loading.proxies`). Proxy ada di `PICK_LAYER` (1), yang tidak dirender kamera.
  - **`interaction/picker.js`:** paling banyak 1 raycast per frame. Klik dihitung jika gerakan ≤ 6 px dan durasi < 500 ms (sisanya dianggap drag orbit). Event `module:hover {id}` dan `module:select {id}`. `picker.setEnabled(false)` untuk tur.
  - **`interaction/focus.js`:** target = pusat bounds modul, kamera = target + `normalize(focus.direction)` × jarak. Jarak minimal sebesar yang membuat lebar modul muat di FOV horizontal (penting untuk layar potret). Pose sebelum pilihan pertama disimpan, lalu `module:select {id: null}` mengembalikannya. Controls nonaktif selama terbang, dan `minDistance` diturunkan sementara.
  - **Highlight:** lewat `SmartModule.setGlow(channel, color, amount)`. Channel `hover` dan `pulse` (perakitan) digabung dengan aturan yang terkuat menang. Jangan menulis `material.emissive` langsung.
  - **`ui/labels.js`:** satu label CSS2D di scene kecil tersendiri. `.label-layer` sengaja diberi `direction: ltr` (CSS2DRenderer memakai transform fisik) dan teks label memakai `unicode-bidi: plaintext`.
  - **`ui/infoPanel.js`:** nama dan deskripsi dari `modules.<id>.{name,desc}`, chip pilar dari `pillars.*` (nama rumus dibiarkan berbahasa Inggris di ketiga locale, seperti tagline). Angka diisi dari `src/data/modules.js` (`facts`, hanya angka yang ada di business plan) dan dibungkus `<bdi dir="ltr">`; DOM dibangun tanpa innerHTML. Tampil sebagai panel samping di sisi inline-end, dan bottom sheet di layar ≤ 600 px.
  - **Tahap 9:** perpindahan bab harus mengirim `module:select {id: null}` agar panel tertutup dan kamera kembali.
- OrbitControls dibatasi: jarak min/max, polar min/max (tidak bisa melihat dari bawah tanah), `enablePan=false`, damping aktif, dan dinonaktifkan selama tween atau tur.
- Tur otomatis berjalan dari langkah `{chapter, cameraShot, action, durasi}`. Interaksi user apa pun menjedanya; tombol `T` untuk toggle.
- Implementasi tur (Tahap 13):
  - **Skrip `src/data/tour.js`:** langkah `{chapter, action?, duration}`. Aksi yang tersedia: `select`, `assembly`, `pump`. `duration` adalah waktu diam yang **dihitung setelah story settled**, sehingga animasi tidak pernah terpotong. Ada juga `loop` (default true untuk booth) dan `autoRotateSpeed`. Satu putaran sekitar 59 detik dalam waktu nyata.
  - **Mesin `story/tour.js`:** hanya mengirim event bus yang sama dengan UI (`chapter:go`, `module:select`, `assembly:go`, `pump:state`). Mendengarkan `tour:toggle {play?}` dan `tour:interrupt`, lalu mengirim `tour:state` dan `tour:end`.
    - Auto-rotate menyala selama tur.
    - Saat dijeda, pompa yang dimatikan tur dinyalakan kembali.
    - Dilanjutkan pada langkah yang sama jika user tetap di bab itu; jika tidak, mulai dari langkah pertama bab yang sedang tampil.
  - **`ui/tourButton.js`:** tombol play/pause di ujung bar navigasi (ikon saja di HP) dan tombol T. Pointerdown, wheel, touchstart, dan keydown (fase capture) di luar tombol mengirim `tour:interrupt`; pointermove sengaja tidak dihitung.
  - **`?tour=1`** memulai tur otomatis begitu layar loading hilang (mode kiosk/booth).
  - **`core/cameraFlight.js` membuang momentum damping OrbitControls** (dari drag atau auto-rotate) di awal setiap penerbangan, sehingga kamera tidak bergeser lagi setelah mendarat.

### Loading dan performa
- Prioritas muat: (1) trunk dan modul internal, yang menjadi syarat layar loading selesai, lalu (2) tree_crown dan solar_panel, lalu (3) 4 cabang di latar belakang. Fase ditentukan dari `group` di `assembly.json` lewat `config.loading.phases` (bukan daftar ID). Modul dalam satu fase dimuat paralel, sedangkan antarfase berurutan.
- `ModuleRegistry.loadStaged()` melaporkan progres berbobot byte manifest: 90% untuk unduhan dan sisanya setelah parse. App meneruskannya sebagai event `load:progress {phase, phaseRatio, ratio, backgroundRatio}`, `load:phase {phase, last, failed}`, dan `modules:loaded`. Modul tersembunyi (`root.visible=false`) sampai modelnya siap, sehingga **bab mana pun harus memeriksa `module.model` sebelum memakai modul fase 2/3**.
- Gagal di fase 0 membuat layar loading menampilkan pesan dan tombol muat ulang. Gagal di fase berikutnya hanya menampilkan pill "Sebagian model gagal dimuat", dan modul itu dilewati. Setiap file dicoba ulang `config.loading.retries` kali.
- **Tier kualitas (`config.quality`, sejak Tahap 14):**
  | Tier | Kapan | DPR | File | AA | Lighting | Tekstur |
  |---|---|---|---|---|---|---|
  | `high` | default laptop/desktop | ≤ 2 | desktop | FXAA (jika DPR ≤ 1,5) | `env` (PMREM) | asli |
  | `low` | pointer coarse + layar kecil, atau `deviceMemory` ≤ 4 | ≤ 1,5 | mobile | tidak ada | `probe` (LightProbe) | × 0,5 |

  Override URL: `?quality=low|high` (memaksa tier dan mematikan penurunan otomatis), `?aa=fxaa|msaa|none`, `?lighting=env|probe`.
- **Menu kualitas untuk penonton** (2026-10-28, `ui/qualitySwitch.js`): tombol ikon di bar atas dengan pilihan **Otomatis / Lancar (low) / HD (high)**.
  - Pilihan disimpan di `localStorage['smarttree.quality']` (`app/qualityPreference.js`). Urutan prioritas: URL `?quality=`, lalu pilihan menu, lalu deteksi.
  - Lancar/HD dianggap *forced*, sehingga penurunan otomatis mati.
  - Mengganti pilihan memuat ulang halaman (parameter `?quality` dihapus) dan kembali ke bab yang sama, karena pindah ke HD perlu mengunduh file model desktop.
  - Label tombol menampilkan tier yang benar-benar dipakai (`quality:change`), termasuk setelah turun otomatis.
- **Temuan Tahap 14 di Intel HD 4000** (1280×800, biaya frame tersinkron): fill-rate bound.
  - MSAA ≈ 11 ms per frame, sehingga diganti FXAA (`core/pipeline.js`; ±5 ms di HD 4000, tetapi bisa dimatikan saat runtime).
  - Sampling PMREM ≈ 6 ms di tier low, sehingga diganti probe.
  - **Jangan kembali ke MSAA default** tanpa mengukur ulang.
- **Penurunan otomatis bertangga** (`watchFps` + `downgrade()` di App):
  - Tangga: high → low (file mobile diganti satu per satu, FXAA off, lighting `probe`, tekstur ×0,5), lalu skala resolusi 0,85, lalu 0,7.
  - Ambang = min(50, 85% refresh tertinggi yang teramati); render on demand membuat jendela idle = refresh rate panel, sehingga layar 48–50 Hz tidak dianggap lambat.
  - Setelah tiap langkah ada jeda 3 jendela. Berjalan juga di tier low (HP), tetapi tidak saat tier dipaksa.
  - MSAA (hanya lewat `?aa=msaa`) tidak bisa dimatikan tanpa context baru.
- **Render on demand (`core/loop.js`):** `update()` berjalan setiap frame, tetapi `render()` hanya dipanggil jika ada `invalidate()` atau activity aktif.
  - **Pemicu `invalidate()`:** setiap event bus (`onAny`), event `change` OrbitControls, resize, dan lompatan kamera.
  - **Activity:** tween berjalan, air mengalir (flow > 0), dan auto-rotate tur.
  - Scene diam tidak memakai GPU, sehingga laptop tidak panas dan tidak throttle selama presentasi.
  - Perubahan scene baru yang tidak lewat event bus **harus** memanggil `loop.invalidate()`. Panel debug sudah memakai `gui.onChange`.
- **Tekstur tier low** diperkecil di browser lewat canvas sebelum di-upload (`downscaleTextures` di `assets/loader.js`, tanpa `sharp`): crown 2048² → 1024², lainnya 1024² → 512². Memori tekstur ≈ 75 MB, dibanding ≈ 300 MB di high. Ini mitigasi utama untuk iOS Safari.
- **Debug (`?debug=1`):** `window.__smartTree` = objek app, ditambah `emit`/`on` dari bus milik app. Test **harus** memakai ini, bukan `import('/src/app/state.js')`, karena setelah HMR Vite bisa memuat salinan modul lain.
  - Panel lil-gui punya folder Quality, termasuk tombol "downgrade (one step)".
  - `tools/screenshot.mjs` punya `VIEWPORT=390x844` (emulasi sentuh dan pointer coarse) dan `REQUESTS=1` (audit host request).
- **Tanpa shadow map.** Pakai blob shadow, dengan pencahayaan `RoomEnvironment` (PMREM atau probe sesuai tier).
- Loop berhenti saat tab tersembunyi; saat idle, render hanya bila ada perubahan.
- **Presentasi offline:** `npm run build && npm run preview` (atau `npx vite preview --host` untuk HP di jaringan lokal). Membuka `dist/index.html` langsung dari file (`file://`) **tidak** didukung, karena module script dan fetch GLB diblokir browser.
- Tangani `webglcontextlost`/`restored`; jika WebGL tidak tersedia, tampilkan poster fallback.
- Implementasi ketahanan (Tahap 15):
  - **Tanpa WebGL 2** (`WebGL.isWebGL2Available()` di `main.js`) atau `startApp` gagal → event `webgl:unavailable`. `ui/fallback.js` lalu menampilkan `public/fallback/poster.webp` beserta pesan 3 bahasa (`fallback.*`), menyembunyikan UI khusus 3D, dan top bar tetap berfungsi.
  - **Context lost** (`core/contextGuard.js`): three.js meng-upload ulang geometri dan tekstur sendiri. App membangun ulang yang hanya ada di GPU, yaitu PMREM (`setLighting(..., {force})`) dan buffer FXAA (`pipeline.rebuild()`), lalu mengirim `webgl:lost` / `webgl:restored`. `ui/contextNotice.js` menampilkan "Memulihkan tampilan 3D…", dan tombol muat ulang muncul setelah 6 detik. **Data CPU (ImageBitmap, array geometri) tidak boleh dibuang**; restore membutuhkannya.
  - **Bab bertahan saat reload:** `sessionStorage['smarttree.chapter']` (App). Ini aman karena bab idempoten.
  - **`ui/presenter.js`:** tombol `F` untuk fullscreen, dan Screen Wake Lock selama tur berjalan. Tombol `F` dan `T` tidak menjeda tur.
  - **Background dan FXAA:** sejak Tahap 16 kanvas transparan (`alpha: true`, tanpa `scene.background`); langit adalah lapisan CSS di belakangnya, jadi tampil sama di semua tier tanpa kompensasi tone mapping. Pass Output dan FXAA meneruskan alpha. Restore setelah context loss tetap transparan (diuji).

### Sistem air (bab d)
- Jalur air di `waterPath.json` (titik kurva dalam ruang rakitan): green_tank → pompa → distribution_pipe → naik di batang → akar di tiap cabang → return → green_tank.
- Visual: `TubeGeometry` dengan shader dash bergerak ditambah partikel instanced. Batang memakai material x-ray selama bab ini.
- Status pompa dari dashboard mengendalikan aliran (event `pump:state`).
- Implementasi (Tahap 10):
  - **`src/data/waterPath.json` (MANUAL)**: `segments` berupa polyline bernama, dihaluskan dengan Catmull-Rom centripetal. `routes` adalah urutan segmen yang dilalui setetes air dari tandon kembali ke tandon, satu rute per cabang. Ujung satu segmen harus sama dengan awal segmen berikutnya; jika selisihnya > 1 mm, WaterFlow memberi peringatan di konsol.
  - **Koordinat** diukur dari geometri:
    - Batang selebar ±0,13 m di ketinggian kompartemen; dinding belakang z −0,07…−0,13.
    - Cabang (sejak 2026-10-28, permintaan pemilik proyek: 50 % lebih kecil, slot 20 % lebih tinggi): lebar 0,3 m, slot x ±0,27 dengan y 0,48 (bawah) dan 0,90 (atas). Ujung sisi batang tetap di |x| 0,12.
    - Akar cabang di x ±0,18 dengan y ≈ 0,58 (bawah) dan ≈ 0,97 (atas), dipetakan dengan transformasi yang sama dari titik Tahap 10.
    - Riser di x ±0,085 (ujung atas y 0,96), kolom return di z −0,085 (drain atas masuk di y 0,91).
    - Jika posisi modul atau cabang di `assembly.json` diubah, jalur ini harus disesuaikan.
  - **`water/WaterFlow.js`**:
    - Satu tube per segmen, memakai satu ShaderMaterial bersama; atribut `aDist` = jarak dalam meter, sehingga jarak antar-pulse sama di semua segmen.
    - Tetesan berupa `InstancedMesh` yang mengikuti rute dari tabel sampel per 1 cm (high 120, low 48).
    - Berada di grup `tree`, sehingga ikut tumbuh dan berskala bersama pohon.
    - Tidak di-update selama tersembunyi.
    - Pompa OFF membuat aliran melambat dengan halus sampai 0 (`config.water.pumpResponse`).
  - **X-ray**: `SmartModule.setOpacity()`. Di bawah 1, material dibuat transparan tanpa depth write dengan `renderOrder` 1; air memakai `renderOrder` 2, sehingga terlihat menembus batang tetapi tetap terhalang modul opak. Fade dilakukan lewat `water/xray.js`.
  - **Bab `water`**: `enter`/`exit` menyalakan dan mematikan air serta x-ray. Keduanya diteruskan ke bab sebagai `services { water, xray }` di StoryController; `settled` ikut menunggu fade selesai.

### Dashboard IoT (bab e)
- Parameter: suhu, kelembapan, pH, EC, level air, baterai, daya panel (maks. 120 W), status pompa, status tanaman.
- `sim.js` memakai random walk halus; pH berpusat di 6,2 dan EC di 1,8 mS/cm; daya panel mengikuti kurva siang hari.
- **Badge "Data demo" WAJIB** lewat `demoBadge.js`, di header dashboard dan di setiap kartu. Tidak boleh ada opsi untuk mematikannya.
- Implementasi (Tahap 11):
  - **`src/data/sim.js` (simulasi murni, tanpa DOM):**
    - `METRICS` menentukan urutan, satuan, dan jumlah desimal. Desimal sengaja cukup halus agar nilai terlihat bergerak dalam beberapa detik.
    - `createSim({seed})` memakai PRNG ber-seed (hasil demo bisa diulang) dan langkah Ornstein-Uhlenbeck.
    - Jam simulasi mulai 10.00 dan berjalan 1 menit per detik nyata. Daya panel = 120 × kurva siang × awan, sehingga tidak pernah > 120 W.
    - Baterai terisi dari panel dan terkuras oleh pompa; level air sedikit turun saat pompa ON. Status tanaman diturunkan dari pH, EC, dan level air (aturan demo).
    - **Hanya pH 6,2, EC 1,8, dan 120 W yang berasal dari business plan**; konstanta lain hanya untuk demo (dijelaskan di header file).
  - **`ui/dashboard.js`:**
    - Kartu dibangun dari `METRICS`, dengan sparkline SVG 48 sampel. Saklar pompa memakai `role="switch"` dan mengirim `pump:state {on}`; WaterFlow dan sim sama-sama mendengarkannya. Status pompa bertahan saat pindah bab.
    - Sim hanya berjalan (4 Hz, render 2 Hz) selama dashboard terlihat.
    - Ada catatan teks "semua nilai simulasi" di bawah grid.
  - **Bab `dashboard`:** `ui.dashboard: true`. Air dan x-ray tetap tampil, sehingga saklar pompa terlihat langsung menghentikan aliran.
  - **`view:inset` kini per sumber** (`{source, ...}`; story dan dashboard), dan `core/viewport.js` mengambil nilai terbesar per sisi.
  - **Token warna `--demo`** (amber) dipakai untuk badge demo dan, nanti, R&D.

### Roadmap (bab f)
- **AWG / Penangkap Embun** berstatus `rnd` dengan badge "Tahap R&D / Under R&D", tanpa model 3D. Tidak boleh tampil seolah fitur yang sudah berjalan.
- "Water Recovery & Transpirasi" juga berstatus `rnd` (dikonfirmasi pemilik proyek, 2026-10-27).
- Implementasi (Tahap 12):
  - **`src/data/roadmap.js`:** business plan tidak punya linimasa, jadi kelompoknya **berdasarkan status, bukan tanggal**:
    - `core`: desain yang tampil di model ini.
    - `app`: "Fitur Tambahan Apps"; judul saja (`brief`).
    - `rnd`: AWG dan Water Recovery.
    - Item boleh punya `modules` (ikut menyala saat hover/focus) dan `facts` (angka business plan). **Item `rnd` dilarang punya `modules`**: modul data melempar error, sehingga R&D tidak pernah tampil terhubung ke model 3D.
    - Jangan menambah status seperti "selesai" atau "berjalan" tanpa konfirmasi pemilik proyek.
  - **`ui/roadmap.js`:** panel dua kolom (core | app di atas rnd), sehingga R&D terlihat tanpa scroll di desktop; di HP satu kolom yang bisa di-scroll. Item R&D memakai `createRndBadge()` (`ui/demoBadge.js`, tidak bisa disembunyikan), bingkai putus-putus amber, dan tidak bisa difokus. Penutupnya adalah visi dan tagline.
  - **`interaction/highlight.js`:** event `modules:highlight {ids}` memakai glow channel `highlight`. Highlight dibersihkan saat panel disembunyikan.
  - **`ui/inset.js`:** helper bersama `reportInset(source, panel, covering)` untuk story card, dashboard, dan roadmap.

### Sistem desain (Tahap 16): "Senja Gurun Arafah"
- **Token** hanya di `src/styles/tokens.css`:
  - langit `--sky-top` #12131f → `--sky-mid` #2a1f2e;
  - kaca gelap hangat (`--surface*`) dengan hairline emas `--hairline`;
  - teks krem `--text` #f4ead8;
  - emas `--gold` #c9a45c untuk merek, struktur, dan kicker;
  - hijau daun `--leaf` #8fc46a untuk aksi dan "hidup";
  - amber `--demo` tetap khusus badge Data demo/R&D, selalu dengan ikon cincin putus-putus, bukan hanya warna.

  Komponen tidak boleh menulis warna langsung.
- **Font:** Reem Kufi (kufi, variable 400–700) untuk judul, kicker, dan brand (`--font-display`); Cairo untuk teks. Keduanya lokal (OFL).
  - **Bahasa Arab:** `letter-spacing` selalu 0, karena spasi huruf memutus sambungan aksara Arab; `line-height` lebih longgar.
- **Ornamen:** SVG inline, tanpa gambar raster:
  - bintang khatam 8 sudut (`#khatam` di sprite `index.html`) untuk logo, loading, dan segel roadmap;
  - bullet khatam (clip-path) di poin cerita dan judul grup roadmap;
  - lengkung mihrab tipis di atas kartu cerita;
  - tile girih (`public/art/girih.svg`) di layar loading.
- **Langit dan hero:** `ui/backdrop.js` + `.backdrop` di `index.html`: gradasi senja CSS, bintang, dan vinyet.
  - Di bab intro, `public/art/hero.svg` tampil (dataran Arafah, Jabal Rahmah, barisan pohon muda yang makin rapat ke satu sisi), dengan parallax pointer halus. Kanvas 3D disembunyikan (opacity) lalu muncul saat pohon tumbuh.
  - Kartu intro menjadi hero dengan tombol "Mulai jelajah" (`story.start` → bab 2).
- **Tanah 3D:** piringan pasir prosedural (canvas, tanpa file) dengan alphaMap yang memudar di tepi ke langit CSS. Pencahayaan senja diatur di `config.scene.light`.
- **Gerak:** `src/ui/motion.js` adalah satu-satunya pintu ke Motion (`motion`, versi terkunci). Preset:
  - `enterStagger` untuk isi kartu saat ganti bab, kartu dashboard, dan item roadmap;
  - `enterPanel` untuk panel info (dari sisi inline-end, sheet bawah di HP);
  - `fadeIn`;
  - `slideTo` untuk pill bahasa.

  Aturan gerak:
  - Animasi hanya `transform` dan `opacity`.
  - **Panel yang melaporkan `view:inset` (dashboard, roadmap) tidak boleh di-transform**, karena rect-nya ikut bergeser. Pakai `fadeIn` di panel dan stagger di anaknya.
  - **Jangan tween teks per frame**: tween angka dashboard di HD 4000 menaikkan biaya frame dari ~15 ke ~48 ms (raster ulang panel tiap frame).
  - State kecil (rel bab, saklar pompa, hover) memakai transisi CSS.
- **Biaya compositor:** `backdrop-filter` dihitung ulang setiap frame selama 3D beranimasi di bawahnya.
  - Panel besar (dashboard, roadmap, info) memakai `--surface-solid` tanpa blur.
  - Tier low (`body[data-quality=low]`, dari `quality:change`) mematikan semua blur, cahaya pointer (`ui/glow.js`), dan area gradien sparkline.
- **Reduced motion:** `transition: none` / `animation: none` (bukan durasi 0,01 ms; lihat komentar di `overlay.css`), dan semua preset Motion langsung ke state akhir.
- **Gambar via Codex (opsional):** `art_src/prompts.md` berisi prompt hero, langit, pasir, dan ornamen.
  - Di Tahap 16, `codex exec` (CLI 0.164, login ChatGPT) **tidak** menyediakan tool image generation secara non-interaktif: tool bawaannya tidak muncul, model lain ditolak, dan app Canva butuh persetujuan.
  - Cara regenerasi: jalankan `codex` interaktif, minta gambar dari prompt itu, simpan PNG ke `art_src/`, ubah ke WebP ≤ 300 KB, lalu ganti `src` `.backdrop__hero`.
  - Ilustrasi tidak boleh diklaim sebagai foto lokasi.

### i18n dan RTL
- `t(key, vars)`; elemen dengan `data-i18n` diperbarui otomatis saat `lang:change`.
- `<html lang dir>` diatur otomatis (`ar` → `rtl`). Pilihan bahasa disimpan di `localStorage` (dibungkus try/catch). Default dari `navigator.languages`, fallback `id`.
- **Angka selalu Latin 0-9** di ketiga bahasa: `Intl.NumberFormat(lang + '-u-nu-latn')`. Nilai beserta satuan dibungkus `<bdi dir="ltr">`.
- **CSS hanya memakai logical properties**: `margin-inline`, `padding-inline`, `inset-inline-start/end`, `text-align: start/end`. Dilarang memakai `left`, `right`, `margin-left`, dan sejenisnya untuk layout. Ikon arah dicerminkan lewat `:dir(rtl)`.
- Font **Cairo** (woff2 variable, subset Arabic dan Latin) di-bundle lokal di `src/assets/fonts/`, `font-display: swap`. **Tanpa CDN.**
- `ar.json` memakai Modern Standard Arabic dan berisi kunci `_meta.translationStatus` yang menandai **perlu diperiksa penutur asli**.
- **Acuan kunci adalah `id.json`.** Kunci baru ditambahkan ke ketiga file sekaligus, lalu jalankan `npm run i18n:check`. Skrip ini memeriksa kesamaan kunci, string kosong, kesamaan `{placeholder}`, dan larangan digit Arab-Indic.
- Markup statis berada di `index.html` tanpa teks: `data-i18n="kunci"` untuk teks dan `data-i18n-attr="aria-label:kunci;title:kunci"` untuk atribut. Teks dinamis dari JS memakai `t()` dan dirender ulang saat event `lang:change`.
- Tagline *"Smart Tree: Green Arafah, Brighter Tomorrow"* sengaja dibiarkan dalam bahasa Inggris di ketiga locale karena berfungsi sebagai baris merek. Ubah di file locale jika pemilik proyek menginginkan versi terjemahan.
- Overlay: hanya elemen `.panel` yang menangkap pointer (`pointer-events: auto`); sisanya meneruskan drag ke kanvas 3D.

## Konvensi kode
- ES modules, satu tanggung jawab per file, nama file mengikuti struktur di atas.
- Dependensi runtime **hanya `three`** (import dari `three/addons/...`) **dan `motion`** (versi terkunci, disetujui pemilik proyek di Tahap 16; dipakai hanya lewat `src/ui/motion.js`). Dev dependency yang diizinkan: `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`, `meshoptimizer`, `lil-gui`. Tambah dependensi lain hanya dengan persetujuan pemilik proyek.
- **Tidak ada string UI di kode.** Semua teks lewat `t()` dan ketiga file locale.
- **Tidak ada angka atau klaim produk** selain yang tertulis di `docs/business_plan.md`. Data simulasi selalu berlabel demo.
- Nilai posisi, skala, rotasi, dan kamera ditulis di `assembly.json`, tidak di kode.
- Resource Three.js (geometry, material, texture) di-`dispose()` oleh modul yang membuatnya.
- File asli di `models_src/` tidak boleh diubah. Semua output skrip ditulis ke `public/models/`, `reports/`, atau `src/data/models.manifest.json`.
- Jangan mengerjakan tahap berikutnya sebelum kriteria selesai tahap sekarang terpenuhi dan diverifikasi.

## Perintah
```
npm run dev                 # server dev (tambah -- --host untuk uji di HP)
npm run build && npm run preview
npm run models:inspect      # laporan GLB
npm run models:optimize     # decimate → public/models/{desktop,mobile} (argumen opsional: ID modul)
# perbandingan visual: npm run dev → http://localhost:5173/tools/compare.html
npm run models:manifest     # bangun models.manifest.json
npm run models:proxies      # proxy pick → public/models/proxies.glb (jalankan ulang setelah models:optimize)
npm run i18n:check          # validasi kunci locale (dibuat di Tahap 5)
# debug rakitan: npm run dev → http://localhost:5173/?debug=1 (panel lil-gui: Save menulis src/data/assembly.json)
# poster fallback (perlu dev server): SIZE=1600x1000 FORMAT=webp GL=gpu node tools/screenshot.mjs "http://localhost:5173/?debug=1&quality=high" public/fallback 'poster=document.getElementById("ui").style.display="none";document.querySelector(".lil-gui")?.style.setProperty("display","none");window.__smartTree.emit("chapter:go",{index:1});await new Promise(r=>setTimeout(r,6000))'
node tools/build-art.mjs    # ilustrasi hero + tile girih → public/art/ (deterministik)
# screenshot headless (perlu dev server): node tools/screenshot.mjs "http://localhost:5173/?debug=1" <outDir> <nama>[=<js>]
#   opsi env: THROTTLE=fast4g|slow4g, WAIT=all|core|none, TRACE=1 (timeline loading), QUALITY_TRACE=1,
#   BLOCK=file.glb (uji error), VIEWPORT=390x844 (HP), REDUCED=1 (prefers-reduced-motion), NOWEBGL=1, REQUESTS=1, GL=gpu (GPU asli; SwiftShader membuat FPS dan kecepatan unduh tidak realistis)
#   uji loading sebaiknya pada build: npm run build && npx vite preview (dev server memuat ratusan modul terpisah)
```

## Status tahap
Status: `todo` | `wip` | `done` | `blocked`. Perbarui kolom ini, beserta catatan singkat, setiap kali tahap berubah.

| # | Tahap | Kriteria selesai | Status |
|---|---|---|---|
| — | Perencanaan dan CLAUDE.md | Rencana disetujui pemilik proyek | done |
| 0 | Setup: salin GLB asli ke `models_src/`, bersihkan template Vite, devDeps, script npm | `npm run dev` menampilkan halaman kosong tanpa template; `models_src/` berisi 11 file identik | done (2026-10-27): SHA-256 11 file cocok, GLB asli dihapus dari `public/models/`, template dihapus, kerangka folder dibuat, build bersih |
| 1 | Inspeksi (`inspect-models.mjs`, gltf-transform, dekode meshopt) | Tabel 11 baris + `reports/models.report.json`; jumlah segitiga sesuai temuan (±1%); `alphaMode` tercatat | done (2026-10-27): 11 file, 63,53 MB, 8.183.948 segitiga (sama persis); semua OPAQUE |
| 2 | Optimasi (`optimize-models.mjs`, desktop dan mobile) | Memenuhi anggaran; file terbuka tanpa error di glTF viewer; cek visual sebelum/sesudah | done (2026-10-27): desktop 11,26 MB / 817.964 segitiga, mobile 7,39 MB / 358.232; perubahan bbox ≤ 1,06%; cek visual disetujui pemilik proyek |
| 3 | Manifest (`build-manifest.mjs` dan `assembly.json` awal) | JSON valid; menjalankan ulang skrip tidak menyentuh `assembly.json` | done (2026-10-27): manifest 11 modul dengan output deterministik (hash sama saat dijalankan ulang), hash `assembly.json` tidak berubah. Nilai awal: batang 1,1 m, total 1,81 m. Helper bersama di `scripts/lib/gltf.mjs` |
| 4 | Scene inti dan viewer rakitan dan debug panel (`?debug=1`, export) | Pohon terakit dengan proporsi benar, internal di dalam rongga; **dikonfirmasi visual oleh pemilik proyek** | done (2026-10-27): scene, loader, SmartModule, registry, debug panel (Save langsung ke file, section cut, trunk opacity, bounds) selesai; modul internal dipasang ke 4 kompartemen; crown y 1,03, total ~1,82 m; tanpa error konsol. dikonfirmasi visual oleh pemilik proyek |
| 5 | Shell UI, i18n, font Cairo lokal, RTL, `check-i18n` | Ganti bahasa tanpa reload, `dir` berbalik, pilihan tersimpan, check lulus, font jalan offline | done (2026-10-27): diverifikasi via `tools/screenshot.mjs` (layout tercermin, pilihan bertahan setelah reload, 0 request eksternal); `check-i18n` lulus dengan 33 kunci dan uji negatif mendeteksi 5 jenis kesalahan; Cairo 81 KB lokal |
| 6 | Loading bertahap dan tier kualitas | Progres akurat pada throttling Fast 4G; bab (a) bisa dibuka sebelum cabang selesai; `?quality=low` berfungsi | done (2026-10-27): build + Fast 4G memuat modul inti dalam 5,2 detik dan pohon penuh dalam 15,5 detik, dengan progres naik linear sesuai byte; navigasi bab berfungsi saat 0/4 cabang termuat; `?quality=low` memuat 11 file mobile; uji BLOCK untuk error fase 0 dan cabang lulus. **GPU dev = Intel HD 4000**: pada 1280×800 DPR 1, high 35 FPS dan low 50 FPS (headless tampaknya dibatasi sekitar 50); penurunan otomatis terpicu dan menaikkan FPS dari ~34 ke ~45. Target ≥ 55 FPS di Tahap 14 perlu perhatian di laptop ini |
| 7 | Sistem perakitan (explode/assemble/snap) | Berurutan, bisa dibalik di tengah jalan, tanpa tumpang tindih, posisi akhir tepat di slot | done (2026-10-27): diuji otomatis lewat `tools/screenshot.mjs` di GPU. Urutan snap sesuai `order` (green_tank → … → branch_orange, 4,9 detik); 0 bbox tumpang tindih di pose explode; setelah serangkaian pembalikan di tengah animasi, galat posisi akhir = 0 (slot dan explode). Tombol Bongkar/Rakit (`ui/assemblyToggle.js`) hanya tampil di bab "assembly". Cek visual oleh pemilik proyek masih perlu |
| 8 | Interaksi: hover, klik fokus, panel info, orbit terbatas | 11 modul bisa dipilih; tampil benar di 3 bahasa; raycast < 1 ms | done (2026-10-27): ke-11 modul bisa di-pick dari kamera default (hit rate sampel 53–95% per modul); alur pointer asli hover → label → klik → panel → fly-to → Esc → kamera kembali (selisih 0) lulus; raycast rata-rata 0,07 ms, p99 0,5 ms, maks 0,9 ms (HD 4000). Screenshot ID/EN/AR desktop dan potret 390×844 diperiksa; bug label CSS2D bergeser di RTL sudah diperbaiki. Regresi Tahap 7 lulus. `tools/screenshot.mjs` sekarang punya opsi `VIEWPORT=390x844` |
| 9 | StoryController dan bab a–c, navigasi tombol, keyboard, swipe | Maju/mundur dari bab mana pun konsisten | done (2026-10-27): diuji otomatis (tween 4× lebih cepat). Semua 30 pasangan bab M→N menghasilkan state identik dengan masuk langsung ke N (kamera, pohon, perakitan dengan galat 0, picker, kartu, toggle, panel); interupsi beruntun lulus; berpindah bab dengan modul terbuka lulus; keyboard (Home, →, PageDown, PageUp, End, batas akhir) dan swipe LTR/RTL lulus. Screenshot desktop ID/AR dan HP 390×844 untuk bab a–c sudah diperiksa. Bug sisa jarak < 1e-4 di AssemblyController ditemukan dan diperbaiki |
| 10 | Bab d: aliran air closed-loop | Jalur benar, batang x-ray, ≥ 30 FPS di tier low | done (2026-10-27): jalur diperiksa dari depan, belakang, dan HP (AR), tanpa peringatan sambungan; 4 rute 1,17–1,74 m; pompa OFF → flow 0 dan tetesan berhenti, ON → kembali dalam 3 detik; uji idempoten 30 pasangan bab (termasuk status air dan x-ray) lulus. **FPS bab d di HD 4000, 1280×800: low 44–48 (target ≥ 30 terpenuhi); high hanya 22–24** (close-up dan batang transparan membebani fill-rate; penurunan otomatis akan pindah ke low). Catat untuk Tahap 14 |
| 11 | Bab e: dashboard IoT (simulasi) | 9 parameter bergerak; badge "Data demo" di 3 bahasa; pompa OFF menghentikan aliran | done (2026-10-27): ke-7 nilai numerik berubah tampil dalam 8 detik dan sparkline bergerak (pompa dan tanaman adalah status); simulasi 30 jam: solar 0–119,7 W, pH 6,09–6,31, EC 1,73–1,86; badge 10/10 terlihat di ID/EN/AR; pompa OFF → flow 0, tetesan dan dash diam, bertahan di bab d, ON pulih; jam sim berhenti saat dashboard tersembunyi; uji idempoten 30 pasangan lulus. Screenshot desktop ID/AR dan HP sudah diperiksa |
| 12 | Bab f: roadmap (AWG = R&D) | Kartu AWG berlabel R&D di 3 bahasa | done (2026-10-27): AWG dan Water Recovery berbadge "Tahap R&D" / "Under R&D" / "قيد البحث والتطوير", terlihat tanpa scroll di desktop ID/EN/AR; badge hanya ada di kedua item itu; item R&D tidak bisa difokus dan tanpa tautan 3D (dijaga di data); highlight modul saat hover/focus menyala dan bersih kembali (termasuk saat pindah bab); uji idempoten 30 pasangan lulus; HP: panel bisa di-scroll sampai R&D |
| 13 | Tur otomatis | Berjalan penuh, berhenti saat interaksi, bisa dilanjutkan | done (2026-10-27): berjalan penuh tanpa sentuhan, 59 detik waktu nyata, urutan bab dan aksi sesuai skrip, tanpa error; jeda lewat klik kanvas, panah, wheel; T melanjutkan dari langkah yang sama atau dari bab yang sedang tampil; pompa pulih saat dijeda di tengah langkah pompa OFF; tombol tur tidak dihitung sebagai interupsi; uji idempoten 30 pasangan lulus setelah tur berjalan (bug momentum kamera ditemukan dan diperbaiki) |
| 14 | Uji performa dan perangkat | Laptop ≥ 55 FPS, HP menengah ≥ 30 FPS, iOS Safari tidak crash, build berjalan offline | wip (2026-10-27): **terukur di laptop dev (Intel HD 4000), 1280×800, biaya frame tersinkron per bab:**<br>• tier low 11–15,5 ms ≈ 65–88 FPS (≥ 55 ✓); sebelumnya high + MSAA 24–37 ms<br>• tangga otomatis high → low terpicu dalam ±3 detik di bab air; setelah itu stabil<br>• emulasi HP 390×844 (tier low, DPR 1,5) di GPU yang sama: 8–16 ms<br>• memori tekstur low 75 MB (high 300 MB)<br>• render on demand: 0 frame saat diam<br>• build produksi: 0 request ke internet, tur penuh berjalan; regresi Tahap 7–13 lulus<br>**Belum: uji di HP fisik (Android menengah dan iPhone/iOS Safari) oleh pemilik proyek**; lihat item terbuka |
| 15 | Ketahanan presentasi (context lost, fallback, checklist gladi) | Context lost pulih; build berjalan offline dari laptop | done (2026-10-27): `WEBGL_lose_context` lose → notice → restore, dan render pulih di tier high dan low (env, FXAA, picking, bab, air); tanpa restore, tombol muat ulang muncul setelah 6 detik, lalu restore terlambat juga pulih. Chrome dengan `--disable-webgl` menampilkan poster dan pesan di ID/EN/AR dan HP. Reload kembali ke bab yang sama (bab air, x-ray aktif). Build produksi: tur penuh, context loss, dan fallback lulus dengan 0 request ke internet. Regresi idempoten dan tur lulus. Bug background FXAA (lebih gelap dari tier low sejak Tahap 14) ditemukan dan diperbaiki. `docs/checklist-gladi.md` dibuat |
| 16 | Redesain visual "Senja Gurun Arafah" (tema Arab, Motion, Reem Kufi, ilustrasi) | Tidak terlihat generik; 3 bahasa dan HP rapi; performa tidak turun > 10%; regresi lulus; **dikonfirmasi visual oleh pemilik proyek** | done (2026-10-28): **dikonfirmasi visual oleh pemilik proyek** (termasuk cabang 50 % lebih kecil dan 20 % lebih tinggi, menu kualitas Otomatis/Lancar/HD, dan satu popup penjelasan di HP).<br>**Desain:** sistem desain di atas; langit CSS + kanvas transparan; hero intro SVG; Reem Kufi; Motion 14.2.0.<br>**Diuji (build, HD 4000):**<br>• 30/30 pasangan bab idempoten (normal dan reduced motion), dengan cek UI: opacity akhir 1, rel bab, pill bahasa, kanvas tersembunyi di intro, CTA hanya di intro<br>• tur penuh, lalu dijeda oleh wheel<br>• context lost → notice → pulih, kanvas tetap transparan<br>• fallback NOWEBGL ID/AR<br>• 0 request ke internet<br>• screenshot desktop ID/EN/AR dan HP 390×844 diperiksa<br>**Biaya frame tier low** (loop diam): 11,8–15,8 ms di bab 1–3 dan 5 (baseline Tahap 14: 11–15,5); bab dashboard 17,5 ms.<br>**Bug yang ditemukan dan diperbaiki:**<br>• tween angka per frame (48 ms)<br>• blur panel besar di atas 3D beranimasi<br>• reduced-motion `0.01ms` membuat geometri kartu basi, sehingga `fit` kamera salah<br>• `[hidden]` kalah oleh `display:flex`<br>**Codex image generation tidak tersedia non-interaktif:** ilustrasi dibuat sebagai SVG ber-seed |

## Risiko utama dan mitigasi
| Risiko | Mitigasi |
|---|---|
| Geometri 8,2 jt segitiga | Decimation offline, LOD mobile, prioritas loading |
| Simplify merusak siluet daun dan buah | Simplify berbasis error + `lockBorder`, rasio per modul, cek visual; cadangan: `meshy_remesh` khusus modul yang rusak (berbayar kredit, minta izin dulu) |
| Skala, pivot, orientasi tidak konsisten | Manifest otomatis + `assembly.json` manual + debug panel |
| Modul internal tembus dinding batang | Ukur rongga di Tahap 4, skala relatif ke rongga, x-ray batang |
| Sorting dan overdraw alpha daun di HP | Tidak berlaku: semua material OPAQUE (Tahap 1). Pantau overdraw akibat doubleSided |
| Raycast mesh berat | Proxy low-poly |
| Bidi Arab (angka dan satuan terbalik) | `<bdi dir="ltr">`, logical properties, uji RTL tiap tahap UI |
| Internet di lokasi bermasalah | Semua aset dan font lokal; presentasi dari build lokal |
| GPU lemah atau context lost | FPS adaptif, handler pemulihan, poster fallback, `?quality=low` |
| Memori GPU iOS Safari | File mobile, tekstur 1K, `dispose()` disiplin |
| Data simulasi atau fitur R&D dikira nyata | Badge demo wajib; AWG hanya sebagai kartu roadmap `rnd` |
| Kualitas terjemahan Arab | MSA + penanda `_meta`; tinjauan penutur asli (lihat di bawah) |

## Item terbuka yang perlu ditinjau manusia
- [ ] **Uji perangkat fisik (Tahap 14).** `npm run build && npx vite preview --host`, lalu buka alamat LAN laptop di HP (Wi-Fi yang sama).
  - Android kelas menengah: bab d (air) adalah bab terberat; target ≥ 30 FPS.
  - iPhone/iPad di Safari: jalankan tur penuh 2×, harus tanpa reload atau crash.
  - Laptop presentasi yang sebenarnya, jika bukan laptop dev: buka `?debug=1` dan lihat folder Quality (tier dan fps).
- [x] **Konfirmasi visual redesain Tahap 16** (desktop dan HP, ketiga bahasa). Jika ingin ilustrasi raster dari Codex, lihat "Sistem desain → Gambar via Codex".
- [ ] Terjemahan Arab (`src/i18n/locales/ar.json`) diperiksa penutur asli, termasuk teks baru `story.start` ("ابدأ الجولة").
- [x] Konfirmasi visual rakitan dan proporsi (Tahap 4, dikonfirmasi pemilik proyek).
- [x] Status roadmap "Water Recovery & Transpirasi" = `rnd` (dikonfirmasi).
- [ ] Konten panel info untuk modul yang tidak dijelaskan rinci di business plan (battery, nutrient_tank, distribution_pipe) ditinjau tim, agar tidak ada klaim teknis yang dikarang (`modules.<id>.desc` di locale).
- [ ] Teks cerita bab a–d (`story.*`) ditinjau tim; gaya kalimat seperti "Visi kami: …" adalah rumusan pengembang.
- [ ] Rentang simulasi dashboard selain pH 6,2, EC 1,8, dan 120 W (suhu, kelembapan, baterai, level air) ditinjau tim (`src/data/sim.js`); semuanya sudah berlabel demo.
- [ ] Jalur pipa air (`src/data/waterPath.json`) adalah ilustrasi yang diukur dari model 3D; sesuaikan jika tim punya desain pipa sebenarnya.
- [ ] Pengelompokan roadmap (Desain inti / Fitur aplikasi / R&D) dan deskripsi singkat AWG ditinjau tim; jangan menambah status "selesai" tanpa konfirmasi.
- [ ] Nama pilar rumus dan tagline dibiarkan berbahasa Inggris di ketiga bahasa (keputusan sementara; ubah di locale jika diinginkan).
