// Supabase Edge Function: scrape-ex-members
// Deploy: supabase functions deploy scrape-ex-members --no-verify-jwt
//
// Dijalankan SEKALI aja buat backfill (member yang udah lulus gak nambah
// tiap hari). Ini bukan cuma nyimpen link, tapi beneran DOWNLOAD foto dari
// sumber pihak ketiga terus UPLOAD ULANG ke Supabase Storage kita sendiri,
// biar gak gantung ke situs luar itu selamanya. Nama file di-generate pakai
// hash, gak ada referensi ke sumbernya sama sekali.
//
// ⚠️ Data lineup (nama, isEx, jkt48Id) masih dari pihak ketiga
// (michie.teras48.com), karena jkt48.com resmi gak nyediain data alumni.
// Cuma FOTO-nya yang di-mirror ke storage kita; kalau butuh ganti sumber
// data nanti, cukup ubah bagian fetch-nya di sini.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const STORAGE_BUCKET = "public-assets";
const STORAGE_FOLDER = "alumni"; // nama folder netral, gak nyebut sumbernya

async function hashString(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function mirrorPhoto(originalUrl: string, jkt48Id: number): Promise<string | null> {
  try {
    const imgRes = await fetch(originalUrl);
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") || "image/webp";
    const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "webp";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());

    // Nama file: hash dari ID member, TIDAK ada kata "teras" atau nama sumber apapun.
    const hash = await hashString(`member-${jkt48Id}-v1`);
    const path = `${STORAGE_FOLDER}/${hash}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, bytes, { contentType, upsert: true });

    if (uploadError) return null;

    const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return publicUrlData?.publicUrl || null;
  } catch {
    return null;
  }
}

Deno.serve(async (_req) => {
  try {
    let allItems: any[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const res = await fetch(`https://michie.teras48.com/jkt48/members?page=${page}&limit=100&search=&status=ex`, {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; 48STFanHubBot/1.0)" },
      });
      if (!res.ok) break;
      const json = await res.json();
      const items = json?.data?.items || [];
      allItems = allItems.concat(items);
      totalPages = json?.data?.pagination?.totalPages || 1;
      page++;
    } while (page <= totalPages);

    const exMembers = allItems.filter((m: any) => m.isEx && m.jkt48Id && m.name);

    let mirrored = 0;
    let failed = 0;
    const toUpsert: any[] = [];

    for (const m of exMembers) {
      let photoUrl: string | null = null;
      if (m.image) {
        photoUrl = await mirrorPhoto(m.image, m.jkt48Id);
        if (photoUrl) mirrored++; else failed++;
      }
      toUpsert.push({
        jkt48_member_id: m.jkt48Id,
        code: null,
        name: m.name.trim(),
        nickname: m.nickname || null,
        photo_url: photoUrl, // null kalau gagal di-mirror, bukan link luar
        type: m.type || null,
      });
    }

    if (toUpsert.length === 0) {
      return new Response(JSON.stringify({ ok: true, members: 0 }), { headers: { "Content-Type": "application/json" } });
    }

    const { error: dbError, data: dbData } = await supabase
      .from("members")
      .upsert(toUpsert, { onConflict: "jkt48_member_id", ignoreDuplicates: true })
      .select();

    if (dbError) {
      return new Response(
        JSON.stringify({ ok: false, error: "Supabase insert failed: " + dbError.message, attempted: toUpsert.length }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, members: dbData?.length ?? toUpsert.length, photosMirrored: mirrored, photosFailed: failed }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
