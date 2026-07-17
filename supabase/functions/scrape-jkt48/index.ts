// Supabase Edge Function: scrape-jkt48
// Deploy: supabase functions deploy scrape-jkt48
// Schedule via Supabase Dashboard > Edge Functions > Cron (e.g. every 30 minutes).
//
// Source: https://setlistjkt48.com/news — an unofficial JKT48 fan aggregator site
// (not jkt48.com directly). Its markup was confirmed from a real page-source dump,
// so the selectors below are accurate as of when that dump was taken. If the site
// changes its HTML later, only this file needs updating.
//
// Real markup structure (confirmed):
//   <a href="https://jkt48.com/news/xxx" class="news-item">
//     <div class="news-content"><div>
//       <div class="news-title">
//         Title text here
//         <div class="news-meta">
//           <span class="news-badge">Category</span>
//           &nbsp;
//           23 Jun 2026
//         </div>
//       </div>
//     </div></div>
//   </a>
// No article image is present in the news list markup, so image_url is left blank
// (news.html/landing.js already fall back to a placeholder when image_url is empty).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseNewsDate(text: string): string {
  // e.g. "23 Jun 2026" -> ISO timestamp. Falls back to now() if unparseable.
  const m = text.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return new Date().toISOString();
  const [, day, monAbbr, year] = m;
  const month = MONTHS[monAbbr.toLowerCase()];
  if (month === undefined) return new Date().toISOString();
  return new Date(Number(year), month, Number(day)).toISOString();
}

Deno.serve(async (_req) => {
  try {
    const res = await fetch("https://setlistjkt48.com/news");
    const html = await res.text();

    const { DOMParser } = await import("https://deno.land/x/deno_dom/deno-dom-wasm.ts");
    const doc = new DOMParser().parseFromString(html, "text/html");

    const items = [...(doc?.querySelectorAll("a.news-item") ?? [])];

    const newsItems = items.map((el: any) => {
      const href = el.getAttribute("href") || "";

      const titleEl = el.querySelector(".news-title");
      // The title text sits directly inside .news-title, with the .news-meta
      // block nested right after it — so take only the direct text nodes,
      // not the nested meta text, to avoid grabbing the category/date too.
      let title = "";
      if (titleEl) {
        title = [...titleEl.childNodes]
          .filter((n: any) => n.nodeType === 3) // TEXT_NODE
          .map((n: any) => n.textContent)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
      }

      const badgeEl = el.querySelector(".news-badge");
      const category = badgeEl ? badgeEl.textContent.trim() : "Berita";

      const metaEl = el.querySelector(".news-meta");
      const metaText = metaEl ? metaEl.textContent : "";
      const published_at = parseNewsDate(metaText);

      return {
        title,
        excerpt: "",
        image_url: "",
        category,
        source_url: href,
        published_at,
      };
    }).filter((n) => n.title && n.source_url);

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
