# Cara Masukin & Setting Video Show

## 1. Buat bucket private di Supabase Storage
Dashboard → **Storage** → **New bucket**
- Nama: `private-streams`
- **Public bucket: OFF** (WAJIB dimatikan, ini kuncinya biar link asli tidak bisa diakses sembarang orang)

## 2. Upload video
- Buka bucket `private-streams` → Upload file (mp4/HLS .m3u8, dsb)
- Catat **path**-nya, contoh: `itadaki-love-10-juli-2026.mp4`
  (path ini BUKAN URL publik — cuma nama file di dalam bucket private)

## 3. Upload poster/thumbnail
Poster boleh ditaruh di bucket **public** terpisah (misal `public-assets`) karena
gambar thumbnail memang boleh terlihat semua orang — yang perlu disembunyikan cuma
video aslinya.

## 4. Isi data show ke tabel `streams`
Lewat **Table Editor → streams → Insert row**, atau SQL Editor:

```sql
insert into public.streams (title, tags, poster_url, stream_url, status, price, show_date, show_time)
values (
  'ITADAKI♥LOVE',
  array['Show', 'Love'],
  'https://YOUR-PROJECT-REF.supabase.co/storage/v1/object/public/public-assets/itadaki-love-poster.jpg',
  'itadaki-love-10-juli-2026.mp4',   -- <== ini PATH di bucket private, bukan link publik
  'replay',                           -- 'live' | 'upcoming' | 'replay'
  15000,                              -- harga (0 = gratis)
  '2026-07-10',
  '19:00'
);
```

**Kolom penting:**
| Kolom | Isi |
|---|---|
| `stream_url` | path file di bucket private (bukan URL lengkap!) |
| `status` | `live` / `upcoming` / `replay` — nentuin muncul di tab mana |
| `price` | 0 = gratis langsung nonton, >0 = butuh beli tiket / token dulu |
| `poster_url` | boleh URL publik biasa, ini yang tampil di kartu |

## 5. Update Edge Function biar generate signed URL dari bucket ini
Buka `supabase/functions/get-stream-url/index.ts`, cari baris ini (sudah ada, tinggal di-uncomment):
```ts
const { data: signed } = await admin.storage
  .from("private-streams")
  .createSignedUrl(stream.stream_url, 60 * 30); // link valid 30 menit
return new Response(JSON.stringify({ url: signed?.signedUrl }));
```
Deploy ulang: `supabase functions deploy get-stream-url`

Sekarang alurnya: **poster publik → boleh keliatan. Video asli → cuma bisa diakses
lewat link sementara (30 menit) yang cuma dikeluarkan setelah Edge Function ngecek
kamu punya tiket/token/gratis.**
