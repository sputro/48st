# Halaman Profil — 48ST Fan Hub

## Yang sudah jadi
- `profile.html` + `js/profile.js` — halaman profil lengkap:
  - Avatar 1–10 (pilih dari modal, tersimpan ke `profiles.avatar_url` di Supabase)
  - Ganti nama tampilan
  - Ganti password (lewat Supabase Auth `updateUser`, password mentah tidak pernah disimpan sendiri oleh aplikasi)
  - Kartu saldo dompet + tombol Top Up (placeholder, lihat bagian DOKU di bawah) + Riwayat transaksi
  - Daftar tiket/akses konten yang sudah dimiliki
  - Tombol Keluar (logout)
- `js/icons.js` — otomatis kasih class `.active` ke menu yang sesuai halaman saat ini,
  jadi navbar/bottom-nav di semua halaman (index, profile, dst) selalu konsisten tanpa
  edit manual tiap file.
- `assets/profile/1.png` sampai `10.png` — **placeholder warna solid**. Ganti dengan
  foto/avatar asli kamu (ukuran persegi, misal 400x400px), nama file harus tetap
  `1.png` ... `10.png` supaya otomatis kebaca oleh `AVATAR_PRESET_COUNT` di `js/config.js`.

## Ganti jumlah/avatar preset
Edit `js/config.js`:
```js
AVATAR_PRESET_COUNT: 10,          // ubah kalau mau lebih/kurang dari 10
AVATAR_PRESET_PATH: "assets/profile/",
```

## Integrasi QRIS/DOKU (top up saldo)
Saat ini tombol "Top Up" di profil sudah terhubung ke Edge Function
`supabase/functions/create-topup`, tapi isinya masih placeholder ("belum dikonfigurasi").

Langkah supaya beneran jalan otomatis via DOKU:
1. Daftar/dapatkan **DOKU merchant credentials** (Client ID + Secret Key) dari DOKU
2. `supabase secrets set DOKU_CLIENT_ID=xxx DOKU_SECRET_KEY=xxx`
3. Isi bagian "Real DOKU integration" di `create-topup/index.ts` sesuai dokumentasi
   API DOKU (checkout/QRIS) — function ini akan mengembalikan `qris_url` yang dipakai
   frontend untuk redirect user ke halaman pembayaran
4. Buat Edge Function baru `doku-webhook` yang menerima notifikasi pembayaran sukses
   dari DOKU, verifikasi signature-nya, lalu insert ke `wallet_transactions` +
   update `profiles.wallet_balance` — **ini WAJIB dilakukan server-side** (bukan dari
   client) supaya saldo tidak bisa dipalsukan dengan cara memanggil endpoint dari luar

Karena saya (Claude) tidak punya akses internet untuk uji coba API DOKU secara langsung,
bagian signature/format request perlu kamu sesuaikan dengan dokumentasi resmi DOKU
saat implementasi — tapi arsitektur keamanannya (secret di server, saldo diupdate lewat
webhook bukan dari client) sudah benar dari awal.

## Masih ditunggu dari kamu
- File `replay.html` yang sudah kamu buat, supaya tombol bottom nav di `index.html`
  bisa disamakan persis dengan punya `replay.html`.
