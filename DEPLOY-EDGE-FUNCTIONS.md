# Cara Deploy & Jalankan Edge Functions

## 1. Install Supabase CLI (sekali saja)
```bash
npm install -g supabase
```
(Kalau di Windows tanpa WSL, pakai `scoop install supabase` — lihat docs.supabase.com kalau npm gagal)

## 2. Login & hubungkan ke project kamu
```bash
supabase login
```
Ini akan buka browser buat login. Setelah itu:
```bash
supabase link --project-ref YOUR-PROJECT-REF
```
`YOUR-PROJECT-REF` dilihat di URL dashboard Supabase kamu, contoh:
`https://supabase.com/dashboard/project/abcdxyzref` → ref-nya `abcdxyzref`

## 3. Set secrets (kunci rahasia yang dipakai function, BUKAN untuk frontend)
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=isi-service-role-key-kamu
```
Service role key dilihat di **Project Settings → API → service_role**.
⚠️ Jangan pernah taruh ini di `config.js` atau file frontend manapun.

## 4. Deploy function-nya
Dari folder root project (yang ada folder `supabase/`):
```bash
supabase functions deploy get-stream-url
supabase functions deploy redeem-token
supabase functions deploy scrape-jkt48
supabase functions deploy create-topup
```
Tiap kali kamu edit file `.ts` di `supabase/functions/xxx/index.ts`, jalankan lagi
`supabase functions deploy xxx` biar perubahannya ke-upload.

## 5. Cek function sudah jalan
```bash
supabase functions list
```
URL function-nya otomatis jadi:
`https://YOUR-PROJECT-REF.supabase.co/functions/v1/nama-function`
Ini yang dipanggil dari `fetch(...)` di file JS (sudah otomatis lewat `window.APP_CONFIG.SUPABASE_URL`).

## 6. Jadwalkan scraper otomatis (opsional, buat scrape-jkt48)
Buka **Dashboard Supabase → Edge Functions → scrape-jkt48 → Cron**, atur misal
`*/30 * * * *` (tiap 30 menit).

## 7. Lihat log kalau error
```bash
supabase functions logs get-stream-url
```
Ini paling penting buat debug — semua `console.log`/error di dalam function muncul di sini.
