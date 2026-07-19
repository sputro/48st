// Supabase Edge Function: scrape-schedules
// Deploy: supabase functions deploy scrape-schedules --no-verify-jwt
// Schedule via Supabase Dashboard > Edge Functions > Cron (e.g. once a day).
//
// SOURCE: jkt48.com's own JSON API (confirmed via real HAR network capture):
//   GET https://jkt48.com/api/v1/schedules?lang=id&month=7&year=2026
//
// Unlike the news API, this one is scoped per MONTH, not paginated by page
// number — so we loop across a range of months instead. Covers ALL event
// types (SHOW, EXCLUSIVE, EVENT, etc); filtering to just theater shows
// happens in the frontend/query (`type = 'SHOW'`), not here, so the general
// "Schedule" page can show everything.
//
// Query params (all optional):
//   ?monthsBack=1    -> how many months in the past to include (default 1)
//   ?monthsForward=3 -> how many months ahead to include (default 3)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const monthsBack = Number(url.searchParams.get("monthsBack") || "1");
    const monthsForward = Number(url.searchParams.get("monthsForward") || "3");

    const now = new Date();
    const monthsToFetch: { month: number; year: number }[] = [];
    for (let offset = -monthsBack; offset <= monthsForward; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      monthsToFetch.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }

    let allItems: any[] = [];

    for (const { month, year } of monthsToFetch) {
      const res = await fetch(`https://jkt48.com/api/v1/schedules?lang=id&month=${month}&year=${year}`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; 48STFanHubBot/1.0)",
        },
      });
      if (!res.ok) continue; // skip this month on failure, keep going with the rest

      const json = await res.json();
      const items = Array.isArray(json?.data) ? json.data : [];
      allItems = allItems.concat(items);
    }

    const scheduleItems = allItems
      .map((s: any) => ({
        jkt48_schedule_id: s.schedule_id,
        reference_code: s.reference_code || null,
        type: s.type || "OTHER",
        title: s.title?.trim() || "",
        link: s.link || null,
        date: s.date,
        start_time: s.start_time || null,
        end_time: s.end_time || null,
        short_description: s.short_description || null,
        member_type: s.jkt48_member_type || null,
        birthday_member: s.birthday_member || null,
      }))
      .filter((s) => s.title && s.date && s.jkt48_schedule_id);

    if (scheduleItems.length === 0) {
      return new Response(JSON.stringify({ ok: true, schedules: 0, note: "No items found for this month range" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error: dbError, data: dbData } = await supabase
      .from("schedules")
      .upsert(scheduleItems, { onConflict: "jkt48_schedule_id" })
      .select();

    if (dbError) {
      return new Response(
        JSON.stringify({ ok: false, error: "Supabase insert failed: " + dbError.message, attempted: scheduleItems.length }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true, schedules: dbData?.length ?? scheduleItems.length, monthsFetched: monthsToFetch.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
