# Menyiapkan admin Porto Studio

Situs ini dihosting sebagai halaman statis. Supabase menyediakan login, aturan akses server, penyimpanan media, serta statistik pengunjung tanpa menaruh kunci rahasia di website.

## Menggunakan admin lokal tanpa Supabase

Jika Supabase belum dikonfigurasi, pilih **Login** di header website. Pada penggunaan pertama, pilih **Atur login pertama kali di perangkat ini** untuk membuat kata sandi; setelah itu, halaman login hanya meminta kata sandi dan pengaturan tidak dapat diulang. Gunakan dashboard untuk menambah, mengedit, menghapus, atau mengimpor konten. Saat menambah/mengedit video, unggah thumbnail opsional untuk gambar cover kartu video. Data teks dan media disimpan di IndexedDB; konten terlihat di website hanya pada browser/origin yang sama.

Untuk membuat thumbnail dari video, buka **Edit** atau **Tambah konten** pada jenis **Video**, putar atau geser pemutar ke frame yang diinginkan, lalu pilih **Ambil frame saat ini** sebelum menyimpan. Pemilih frame juga menerima file video yang baru dipilih. URL video jarak jauh harus mengizinkan pemuatan lintas situs agar frame dapat disimpan.

Saat mencoba situs dari komputer, jangan membuka `index.html` dengan protokol `file://`; browser dapat memblokir pemutaran video. Jalankan server lokal dari folder proyek, misalnya `python3 -m http.server 8000`, lalu buka `http://localhost:8000/halaman%201/`. Mode konten lokal terpisah untuk setiap alamat (origin), jadi gunakan alamat yang sama untuk halaman publik dan login.

Mode ini untuk pratinjau pribadi, bukan login aman: pemeriksaan terjadi di browser, dapat dilewati oleh orang yang menguasai perangkat, dan perubahan tidak dipublikasikan ke pengunjung lain. Jangan mengandalkannya untuk melindungi konten website publik. Untuk pengelolaan bersama/publik, gunakan konfigurasi Supabase di bawah.

## Konfigurasi satu kali

1. Buat proyek Supabase.
2. Di **Authentication → Users**, buat satu pengguna admin dengan email dan kata sandi Anda. Jangan menyimpan kata sandi di file website atau repositori. Nonaktifkan pendaftaran publik (**Authentication → Settings → User Signups**) agar orang lain tidak dapat membuat akun.
3. Salin **User UID** akun tersebut. Ganti `REPLACE_WITH_ADMIN_USER_UUID` pada `supabase-setup.sql` dengan UID itu, lalu jalankan seluruh SQL tersebut satu kali di **SQL Editor**. Jangan bagikan UID pengganti atau kata sandi ke publik.
4. Di **Project Settings → API**, salin **Project URL** dan **anon/public key** ke `PORTFOLIO_SUPABASE_CONFIG` dalam [halaman 1/supabase-config.js](./halaman%201/supabase-config.js). Anon key memang digunakan oleh situs publik; jangan pernah menaruh `service_role` key di file website.
5. Publikasikan perubahan website. Buka login dari tombol **Login** di header website atau kunjungi `/admin/` langsung dengan akun yang dibuat tadi. Login hanya aktif setelah URL dan anon key Supabase diisi dan SQL sudah dijalankan. Pilih **Impor konten bawaan website** untuk memulai, lalu gunakan filter **Video**, **Poster**, dan **Tautan** untuk mengelola tiap jenis konten.

Admin dibatasi dua kali: dashboard memverifikasi UID melalui fungsi database dan kebijakan RLS membatasi perubahan tabel serta upload/hapus media ke UID yang sama. Jangan menambahkan kebijakan admin lain yang lebih longgar.

## Statistik dan konten

Pemutar utama dan setiap kartu video menyediakan tombol layar penuh. Browser/perangkat yang tidak mendukung API layar penuh tetap dapat memutar video dengan kontrol bawaan.

Statistik mencatat satu pengunjung anonim per browser per hari (menggunakan ID acak di penyimpanan browser). Tidak ada nama, email, atau alamat IP yang disimpan oleh fitur ini. Angka adalah perkiraan pengunjung harian; pengunjung yang menghapus penyimpanan browser atau memakai perangkat berbeda dapat dihitung lagi.

Konten bawaan tetap digunakan hingga konten poster/video diimpor atau ditambahkan melalui dashboard. Jika semua konten dalam satu jenis dihapus sesudah dikelola, galeri jenis itu tetap kosong dan konten lama tidak muncul kembali. File bawaan yang sudah ada di repository tidak ikut dihapus; file yang diunggah ke bucket Supabase akan dihapus saat konten terkait dihapus.

File upload dibatasi hingga 100 MB dan tipe gambar/video yang diizinkan di kebijakan bucket. Pastikan pengaturan autentikasi Supabase menggunakan HTTPS saat situs dipublikasikan.
