// Supabase Edge Function: scrape-jkt48
// Deploy: supabase functions deploy scrape-jkt48 --no-verify-jwt
// Schedule via Supabase Dashboard > Edge Functions > Cron (e.g. every hour).
//
// SOURCE: jkt48.com's own internal JSON API (confirmed via a real HAR network
// capture from the site — not guessed). The site itself is a Nuxt.js app that
// fetches its news from here client-side, so we call the same endpoint directly
// instead of scraping rendered HTML (which is empty/JS-only on first load and
// would need a headless browser to render — much more fragile).
//
//   GET https://jkt48.com/api/v1/news?lang=id&limit=20
//
// Confirmed response shape:
// {
//   "message": "Berhasil mendapatkan data",
//   "status": true,
//   "data": [
//     {
//       "title": "...",
//       "category": "Theater",
//       "link": "pengumuman-mengenai-xxx",       <- slug, needs /news/ prefix
//       "background_image": "" | "https://...",   <- often empty in the list endpoint
//       "valid_date_from": "2026-07-13T17:00:00.000Z",
//       "news_id": 1846
//     },
//     ...
//   ],
//   "_meta": { "page": 1, "limit_per_page": 20, "total_page": ..., "count_total": 1832 }
// }
//
// No HTML parsing, no CSS selectors, no deno_dom dependency needed — just JSON.
// This should be far more reliable than the previous HTML-scraping approach,
// since it will only break if jkt48.com changes their API response shape
// (much rarer than them changing CSS classes/markup).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (_req) => {
  try {
    const res = await fetch("https://jkt48.com/api/v1/news?lang=id&limit=20", {
      headers: {
        // Some APIs behind a JS-app frontend reject requests without a normal
        // browser-like User-Agent / Accept header — set them defensively.
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; 48STFanHubBot/1.0)",
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `jkt48.com API returned ${res.status}` }), { status: 502 });
    }

    const json = await res.json();
    const items = Array.isArray(json?.data) ? json.data : [];

    const newsItems = items
      .map((n: any) => ({
        title: n.title?.trim() || "",
        excerpt: "",
        image_url: n.background_image || "",
        category: n.category || "Berita",
        source_url: n.link ? `https://jkt48.com/news/${n.link}` : "",
        published_at: n.valid_date_from || new Date().toISOString(),
      }))
      .filter((n) => n.title && n.source_url);

    if (newsItems.length) {
      await supabase.from("news").upsert(newsItems, { onConflict: "source_url" });
    }

    return new Response(JSON.stringify({ ok: true, news: newsItems.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});