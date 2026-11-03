# Menyiapkan admin Porto Studio

Situs ini dihosting sebagai halaman statis. Supabase menyediakan login, aturan akses server, penyimpanan media, serta statistik pengunjung tanpa menaruh kunci rahasia di website.

## Menerbitkan perubahan langsung ke GitHub Pages tanpa Supabase

GitHub Pages tidak dapat menerima perubahan langsung dari browser. Untuk tetap memakai GitHub saja, jalankan publisher lokal di komputer yang memiliki repository ini dan akses GitHub yang sudah dikonfigurasi:

1. Pastikan `git push origin main` dapat berjalan dari Terminal tanpa meminta password berulang kali. Gunakan Git Credential Manager atau autentikasi SSH yang sudah tersetel; jangan masukkan token GitHub ke halaman admin.
2. Dari folder repository, jalankan `python3 publish-server.py`. Biarkan jendela Terminal berjalan.
3. Buka `http://127.0.0.1:8769/admin/` di browser. Jangan membuka admin lewat `file://`, GitHub Pages, atau server lain. Publisher hanya menerima permintaan dari alamat lokal ini.
4. Pada origin lokal pertama kali, pilih **Atur login pertama kali di perangkat ini**. Sesi admin lokal hanya berlaku pada browser/origin ini.
5. Tambahkan atau edit konten di admin. Setiap simpan/hapus mengunggah media ke folder situs, memperbarui `halaman 1/published-content.json`, lalu membuat commit khusus dan menjalankan `git push`. Tunggu deployment GitHub Pages selesai sebelum memuat ulang situs publik.
6. Untuk menghentikan publisher, tekan `Ctrl+C` pada jendela Terminal.

Jika halaman melaporkan publisher belum terhubung, pastikan server masih berjalan dan buka URL admin lokal yang tepat. Bila push gagal karena autentikasi atau branch GitHub berubah, pesan kesalahan akan tampil; siapkan akses Git atau sinkronkan branch `main`, kemudian coba simpan lagi. Hindari menjalankan beberapa publisher bersamaan.

Publisher lokal tidak mengirim kata sandi GitHub ke browser dan hanya mendengarkan pada `127.0.0.1`. Namun, file media dan konten publik disimpan di repository, sehingga jangan masukkan rahasia atau materi yang tidak ingin dipublikasikan. File yang pernah masuk commit masih dapat ada pada riwayat Git setelah dihapus dari tampilan situs.

## Admin lokal tanpa publisher

Jika hanya membuka website dengan server statis biasa, admin tetap dapat menyimpan perubahan di IndexedDB, tetapi perubahan tersebut tidak dipublikasikan ke pengunjung lain. Untuk sinkronisasi GitHub otomatis, gunakan `publish-server.py` sesuai langkah di atas.

Untuk membuat thumbnail dari video, buka **Edit** atau **Tambah konten** pada jenis **Video**, putar atau geser pemutar ke frame yang diinginkan, lalu pilih **Ambil frame saat ini** sebelum menyimpan. Pemilih frame juga menerima file video yang baru dipilih. URL video jarak jauh harus mengizinkan pemuatan lintas situs agar frame dapat disimpan.

Saat hanya meninjau file situs tanpa menerbitkan, jangan membuka `index.html` dengan protokol `file://`; browser dapat memblokir pemutaran video. Jalankan server lokal biasa dari folder proyek, misalnya `python3 -m http.server 8000`, lalu buka `http://localhost:8000/halaman%201/`. Penyimpanan browser terpisah untuk setiap alamat (origin).

Jenis konten **Video proses kreatif** dan **Foto proses kreatif** muncul terpisah dari karya portofolio di bagian **Proses Kreatif** pada halaman publik. Video proses memiliki kontrol pemutaran sendiri dan foto dapat diperbesar.

Menu **Jualan aset digital** di admin mengelola sampul, jenis aset (PSD, After Effects, Premiere Pro, preset, LUT, atau lainnya), harga Rupiah, deskripsi, preview video, dan link pembayaran. Video preview dapat diunggah (maksimal 90 MB) atau ditautkan dari YouTube. Di halaman publik, pembeli membuka detail produk, memasukkan nama, lalu diarahkan ke link pembayaran yang admin atur. Nama hanya divalidasi di browser dan tidak disimpan atau dikirim ke link pembayaran oleh situs ini.

Login perangkat lokal bukan autentikasi server. Jaga komputer dan akun sistem Anda, dan jangan mengekspos port publisher ke jaringan.

## Konfigurasi satu kali

1. Buat proyek Supabase.
2. Di **Authentication → Users**, buat satu pengguna admin dengan email dan kata sandi Anda. Jangan menyimpan kata sandi di file website atau repositori. Nonaktifkan pendaftaran publik (**Authentication → Settings → User Signups**) agar orang lain tidak dapat membuat akun.
3. Salin **User UID** akun tersebut. Ganti `REPLACE_WITH_ADMIN_USER_UUID` pada `supabase-setup.sql` dengan UID itu, lalu jalankan seluruh SQL tersebut di **SQL Editor**. Skrip dapat dijalankan kembali untuk menerapkan pembaruan skema termasuk tabel `digital_products`. Jangan bagikan UID pengganti atau kata sandi ke publik.
4. Di **Project Settings → API**, salin **Project URL** dan **anon/public key** ke `PORTFOLIO_SUPABASE_CONFIG` dalam [halaman 1/supabase-config.js](./halaman%201/supabase-config.js). Anon key memang digunakan oleh situs publik; jangan pernah menaruh `service_role` key di file website.
5. Publikasikan perubahan website. Buka login dari tombol **Login** di header website atau kunjungi `/admin/` langsung dengan akun yang dibuat tadi. Login hanya aktif setelah URL dan anon key Supabase diisi dan SQL sudah dijalankan. Pilih **Impor konten bawaan website** untuk memulai, lalu gunakan filter **Video**, **Poster**, dan **Tautan** untuk mengelola tiap jenis konten.

Admin dibatasi dua kali: dashboard memverifikasi UID melalui fungsi database dan kebijakan RLS membatasi perubahan tabel serta upload/hapus media ke UID yang sama. Jangan menambahkan kebijakan admin lain yang lebih longgar.

## Statistik dan konten

Pemutar utama dan setiap kartu video menyediakan tombol layar penuh. Browser/perangkat yang tidak mendukung API layar penuh tetap dapat memutar video dengan kontrol bawaan.

Statistik mencatat satu pengunjung anonim per browser per hari (menggunakan ID acak di penyimpanan browser). Tidak ada nama, email, atau alamat IP yang disimpan oleh fitur ini. Angka adalah perkiraan pengunjung harian; pengunjung yang menghapus penyimpanan browser atau memakai perangkat berbeda dapat dihitung lagi.

Konten bawaan tetap digunakan hingga konten poster/video diimpor atau ditambahkan melalui dashboard. Jika semua konten dalam satu jenis dihapus sesudah dikelola, galeri jenis itu tetap kosong dan konten lama tidak muncul kembali. File bawaan yang sudah ada di repository tidak ikut dihapus; file yang diunggah ke bucket Supabase akan dihapus saat konten terkait dihapus.

File upload dibatasi hingga 100 MB dan tipe gambar/video yang diizinkan di kebijakan bucket. Untuk menampilkan konten proses kreatif yang sudah dikelola di Supabase, jalankan pembaruan `supabase-setup.sql` agar jenis `process_video` dan `process_image` diterima oleh tabel. Pastikan pengaturan autentikasi Supabase menggunakan HTTPS saat situs dipublikasikan.
