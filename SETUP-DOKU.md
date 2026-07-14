# Setup Pembayaran Otomatis DOKU QRIS

## Yang sudah jadi
- `supabase/functions/_shared/doku.ts` — helper ambil token B2B + bikin signature (dipakai bareng)
- `supabase/functions/create-topup` — generate QRIS asli lewat API DOKU
- `supabase/functions/check-topup-status` — polling status bayar (dipanggil otomatis tiap 4 detik dari `profile.js` selama modal QR terbuka)
- `supabase/functions/doku-webhook` — terima notifikasi push dari DOKU pas user selesai bayar
- `js/profile.js` — tombol Top Up sekarang munculkan **modal QR code asli** yang bisa di-scan e-wallet apapun, otomatis update saldo begitu terbayar
- `topup_requests` table + fungsi `confirm_topup()` di `schema.sql` — satu-satunya jalur saldo bisa nambah, dan **idempotent** (aman dipanggil dobel dari webhook + polling, tidak akan nambah saldo 2x)

## ⚠️ Satu hal yang perlu kamu cek sendiri
Dokumentasi yang kamu kasih ke saya cuma cover API **Generate/Query/Refund/Decode/Payment/Cancel QRIS**.
Dua hal ini **tidak ada** di dokumen itu, jadi saya isi berdasarkan standar SNAP (format umum yang dipakai
DOKU & bank-bank lain di Indonesia) — **wajib kamu cocokkan lagi ke dokumentasi resmi DOKU** punya kamu
sebelum production:
1. **Endpoint "Get Token B2B"** — di `_shared/doku.ts`, fungsi `getB2BToken()`. Saya asumsikan
   `POST /authorization/v1/access-token/b2b` pakai signature RSA-SHA256.
2. **Format notifikasi webhook DOKU** — di `doku-webhook/index.ts`, field `originalPartnerReferenceNo` /
   `latestTransactionStatus` itu tebakan berdasarkan pola response Query QRIS. Kalau field aslinya beda,
   tinggal disesuaikan di file itu saja (satu tempat).

Kalau kamu punya link dokumentasi "Get Token B2B" atau "Payment Notification" dari DOKU, kirim ke saya —
saya bisa langsung samakan persis.

## Cara isi credentials

### 1. Dapatkan dari dashboard DOKU
- **Client ID** (`X-CLIENT-ID` / `X-PARTNER-ID`)
- **Secret Key** (dipakai untuk HMAC signature)
- **Private Key** (RSA, format PEM — biasanya file `.pem`, dipakai buat sign request token)
- **Merchant ID**
- **Terminal ID** (kalau ada, default boleh `"01"`)

### 2. Set sebagai secrets (BUKAN di file manapun)
```bash
supabase secrets set DOKU_CLIENT_ID=isi-client-id
supabase secrets set DOKU_CLIENT_SECRET=isi-secret-key
supabase secrets set DOKU_MERCHANT_ID=isi-merchant-id
supabase secrets set DOKU_TERMINAL_ID=01
supabase secrets set DOKU_ENV=sandbox
```

Private key agak beda karena isinya multi-baris. Cara paling aman:
```bash
supabase secrets set DOKU_PRIVATE_KEY="$(cat path/ke/private-key.pem)"
```

### 3. Deploy semua function terkait
```bash
supabase functions deploy create-topup
supabase functions deploy check-topup-status
supabase functions deploy doku-webhook --no-verify-jwt
```
`--no-verify-jwt` **WAJIB** khusus buat `doku-webhook`, karena yang manggil itu server DOKU langsung
(bukan user yang login), jadi tidak ada Supabase session/JWT untuk diverifikasi lewat cara biasa.

### 4. Daftarkan Notification URL di dashboard DOKU
```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/doku-webhook
```

### 5. Jalankan schema SQL terbaru
Buka SQL Editor Supabase, jalankan ulang `supabase/schema.sql` (aman dijalankan berkali-kali,
semua pakai `create table if not exists`).

## Cara testing
1. Set `DOKU_ENV=sandbox` dulu (jangan langsung production)
2. Login ke web, buka Profil → Top Up → masukin nominal
3. Modal QR code muncul — pakai simulator sandbox DOKU (biasanya ada di dashboard mereka) buat simulasi bayar
4. Saldo di halaman Profil harus otomatis update dalam beberapa detik (lewat polling `check-topup-status`)
5. Kalau webhook sudah didaftarkan, saldo malah bisa update lebih cepat dari situ

## Kalau belum sempat setup DOKU dulu
Tidak masalah — selama secrets `DOKU_CLIENT_ID` dkk belum diisi, tombol Top Up otomatis kasih pesan
"belum dikonfigurasi, hubungi admin untuk top up manual" (tidak error/crash), jadi web tetap jalan normal.
