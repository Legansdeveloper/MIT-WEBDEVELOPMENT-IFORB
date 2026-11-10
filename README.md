# Cynthia — Teman Memeriksa Pesan Mencurigakan

Cynthia membantu pengguna mengenali tanda-tanda penipuan dalam pesan dan
tautan. Pengguna dapat menempelkan isi chat atau memilih dokumen PDF untuk
diperiksa. Hasilnya berisi klasifikasi awal, pemeriksaan tautan, dan penjelasan
agar pengguna dapat mempertimbangkan langkah berikutnya.

Cynthia adalah alat bantu, bukan penentu kebenaran. Pesan yang dinilai normal
belum tentu aman, dan pesan yang mencurigakan perlu diperiksa kembali.

## Cara menggunakan Cynthia

1. Buka [Cynthia](https://cynthia.oscspace.online/).
2. Tempel pesan ke kotak yang tersedia. Tekan **Enter** untuk memeriksa atau
   **Shift+Enter** untuk membuat baris baru.
3. Untuk memeriksa dokumen, pilih **PDF** atau seret file ke halaman. PDF harus
   berisi teks, tidak terkunci, dan berukuran maksimal 20 MB. PDF hasil pindai
   berupa gambar belum dapat dibaca.
4. Pilih **Periksa pesan**, lalu baca hasil pemeriksaan, analisis tautan, dan
   penjelasannya.
5. Jika tersedia, pilih **Bacakan hasil** untuk mendengarkan ringkasan.

Jangan masukkan kata sandi, kode OTP, atau informasi pribadi. Jangan membuka
tautan mencurigakan hanya untuk mengujinya. Jika pesan meminta tindakan,
periksa kembali melalui aplikasi, situs, atau nomor resmi yang dicari sendiri.

## Alur RECOG – LEARN – ACT

Ketiga tahap ini menjelaskan cara menggunakan hasil Cynthia dengan bijak:

- **RECOG (Recognize / Mengenali):** Cynthia menandai apakah pesan memiliki
  pola yang menyerupai penipuan dan memeriksa tautan untuk menemukan tanda
  mencurigakan. Hasil ini adalah peringatan awal, bukan keputusan mutlak.
- **LEARN (Belajar):** Pengguna membaca penjelasan tentang tanda-tanda yang
  ditemukan dan alasan untuk tetap berhati-hati. Tujuannya agar pengguna makin
  mampu mengenali pesan serupa di kemudian hari.
- **ACT (Bertindak):** Pengguna menentukan langkah aman berdasarkan konteks.
  Jangan membalas atau membuka tautan yang meragukan, jangan membagikan data
  rahasia, dan konfirmasikan informasi melalui kanal resmi. Jika sudah terlanjur
  membagikan data, segera hubungi penyedia layanan terkait untuk mengamankan
  akun.

## Model dan pemeriksaan yang digunakan

- **IndoBERT untuk klasifikasi pesan:** model bahasa yang disesuaikan untuk
  mengelompokkan pesan ke kategori **normal** atau **penipuan**. Skor yang
  ditampilkan menunjukkan tingkat keyakinan model, bukan persentase kepastian
  bahwa pesan benar atau salah.
- **Model bahasa untuk penjelasan:** Groq menjalankan model
  `openai/gpt-oss-120b` untuk menyusun penjelasan pesan dan tautan dengan bahasa
  yang lebih mudah dipahami. Ketersediaannya bergantung pada konfigurasi
  layanan.
- **Google Safe Browsing:** memeriksa apakah tautan tercatat memiliki ancaman
  yang dikenal. Ini adalah layanan pemeriksaan reputasi tautan, bukan model
  klasifikasi pesan. Tidak adanya temuan bukan jaminan bahwa tautan aman.
- **Aturan heuristik tautan** (pemeriksaan pola sederhana, bukan model AI):
  Cynthia menandai tautan jika menemukan salah satu pola berikut:
  - Alamat mengandung kata seperti `login`, `verify`, `secure`, `update`,
    `reward`, `otp`, `password`, `bank`, `urgent`, atau `token`.
  - Domain menggunakan layanan pemendek tautan seperti `bit.ly`, `tinyurl.com`,
    `t.co`, `goo.gl`, atau `ow.ly`.
  - Domain memiliki pola subdomain bertingkat yang tidak biasa.
  - Alamat mengandung karakter atau pola yang dapat menyamarkan tujuan, seperti
    `@`, `%`, atau tanda pengalihan `//` tambahan.
  - Tautan menggunakan `http://`, bukan koneksi terenkripsi `https://`.

  Aturan memeriksa tautan yang diawali `http://`, `https://`, atau `www.`.
  Satu tautan dapat cocok dengan beberapa pola, tetapi hasil menampilkan alasan
  pertama yang cocok. Tautan yang tidak ditandai hanya berarti tidak ada pola
  di atas yang ditemukan—bukan bukti bahwa tautan aman. Pemeriksaan heuristik
  ini adalah petunjuk untuk ditinjau, bukan bukti penipuan.
- **ElevenLabs `eleven_multilingual_v2`:** mengubah hasil menjadi suara saat
  fitur **Bacakan hasil** tersedia.
- **Karakter Haru dari Live2D:** karakter animasi yang menemani tampilan
  Cynthia.

Beberapa pemeriksaan dan penjelasan bergantung pada layanan yang dapat
diaktifkan atau tersedia. Jika layanan tidak tersedia, hasil utama tetap perlu
ditafsirkan dengan hati-hati dan diverifikasi secara mandiri.

## Kredit aset dan lisensi

- **Model karakter Haru (receptionist sample):** ilustrasi dan pemodelan oleh
  Live2D, hak cipta © Live2D. Model berasal dari materi contoh resmi Live2D
  dan dikemas sebagai berkas runtime. Lihat
  [halaman unduhan materi contoh Live2D](https://www.live2d.com/download/sample-data/)
  dan [catatan atribusi model Haru](deteksi/static/deteksi/live2d/README.md).
  Penggunaan maupun distribusi ulang wajib mengikuti perjanjian dan ketentuan
  lisensi materi contoh Live2D yang berlaku.
- **Live2D Cubism Core for Web:** runtime karakter yang dimuat dari server
  resmi Live2D. Penggunaan tunduk pada
  [perjanjian lisensi Cubism SDK](https://www.live2d.com/en/sdk/download/web/).

 
  [DM Sans](https://fonts.google.com/specimen/DM+Sans),
  [Manrope](https://fonts.google.com/specimen/Manrope), dan
  [informasi OFL](https://openfontlicense.org/).

Lisensi aset dan pustaka pihak ketiga tetap menjadi hak pemilik masing-masing.
Pastikan membaca ketentuan resmi terbaru sebelum menyalin atau mendistribusikan
aset secara terpisah dari aplikasi.
