// Supabase Edge Function: scrape-members
// Deploy: supabase functions deploy scrape-members --no-verify-jwt
// Schedule via Supabase Dashboard > Edge Functions > Cron (e.g. once a week —
// member roster doesn't change often, no need to run this frequently).
//
// SOURCE: jkt48.com's own JSON API (confirmed via real HAR network capture):
//   GET https://jkt48.com/api/v1/members?lang=id
//
// Response shape:
// {
//   "status": true, "message": "Berhasil mendapatkan data",
//   "data": [
//     { "type": "LOVE", "code": "ALYA_AMANDA", "name": "Alya Amanda",
//       "nickname": "Alya", "photo": "https://jkt48.com/api/v1/storages/media/jkt48-member/alya_amanda.jpg",
//       "jkt48_member_id": 13 },
//     ...
//   ]
// }
// This one call gets ALL members with real photo URLs already included —
// no slug-guessing or manual entry needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (_req) => {
  try {
    const res = await fetch("https://jkt48.com/api/v1/members?lang=id", {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; 48STFanHubBot/1.0)",
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `jkt48.com API returned ${res.status}` }), { status: 502 });
    }

    const json = await res.json();
    const items = Array.isArray(json?.data) ? json.data : [];

    const members = items
      .map((m: any) => ({
        jkt48_member_id: m.jkt48_member_id,
        code: m.code || null,
        name: m.name?.trim() || "",
        nickname: m.nickname || null,
        photo_url: m.photo || null,
        type: m.type || null,
      }))
      .filter((m) => m.name && m.jkt48_member_id);

    if (members.length === 0) {
      return new Response(JSON.stringify({ ok: true, members: 0, note: "No members found" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error: dbError, data: dbData } = await supabase
      .from("members")
      .upsert(members, { onConflict: "jkt48_member_id" })
      .select();

    if (dbError) {
      return new Response(
        JSON.stringify({ ok: false, error: "Supabase insert failed: " + dbError.message, attempted: members.length }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true, members: dbData?.length ?? members.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
