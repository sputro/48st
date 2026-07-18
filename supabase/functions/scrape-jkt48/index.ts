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

// Query params (all optional):
//   ?limit=50      -> items per page requested from jkt48.com (default 50)
//   ?maxPages=5     -> how many pages to walk through in one run (default 5)
//   ?startPage=1    -> which page to start from (default 1)
//
// To backfill ALL ~1800+ old news once, call this manually several times with
// increasing startPage (e.g. startPage=1, then startPage=21, then startPage=41...
// with limit=50 each covers 50 articles per call), since a single Edge Function
// invocation has a time limit and pulling everything in one shot risks timing out.
// Regular cron runs can just use the defaults (latest 5 pages / 250 items) to stay
// current without needing to re-walk the whole history each time.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || "50");
    const maxPages = Number(url.searchParams.get("maxPages") || "5");
    const startPage = Number(url.searchParams.get("startPage") || "1");

    let allItems: any[] = [];
    let pagesFetched = 0;

    for (let page = startPage; page < startPage + maxPages; page++) {
      const res = await fetch(`https://jkt48.com/api/v1/news?lang=id&limit=${limit}&page=${page}`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; 48STFanHubBot/1.0)",
        },
      });

      if (!res.ok) break; // stop walking pages on first failure, keep what we already have

      const json = await res.json();
      const items = Array.isArray(json?.data) ? json.data : [];
      pagesFetched++;

      if (items.length === 0) break; // reached the end of available pages

      allItems = allItems.concat(items);

      const totalPages = json?._meta?.total_page;
      if (totalPages && page >= totalPages) break; // reached the last real page
    }

    const newsItems = allItems
      .map((n: any) => ({
        title: n.title?.trim() || "",
        excerpt: "",
        image_url: n.background_image || "",
        category: n.category || "Berita",
        source_url: n.link ? `https://jkt48.com/news/${n.link}` : "",
        published_at: n.valid_date_from || new Date().toISOString(),
      }))
      .filter((n) => n.title && n.source_url);

    if (newsItems.length === 0) {
      return new Response(JSON.stringify({ ok: true, news: 0, pagesFetched, note: "No items found for this page range" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error: dbError, data: dbData } = await supabase
      .from("news")
      .upsert(newsItems, { onConflict: "source_url" })
      .select();

    if (dbError) {
      return new Response(
        JSON.stringify({ ok: false, error: "Supabase insert failed: " + dbError.message, attempted: newsItems.length }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true, news: dbData?.length ?? newsItems.length, pagesFetched }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
