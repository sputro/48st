// Supabase Edge Function: scrape-jkt48
// Deploy: supabase functions deploy scrape-jkt48
// Schedule via Supabase Dashboard > Edge Functions > Cron (e.g. every 30 minutes).
//
// Runs server-side only, using the service role key, and writes into `news` /
// `schedules`. The public site only ever reads those tables — it never talks
// to jkt48.com directly, avoiding CORS and keeping scraping logic off the client.
//
// NOTE: the CSS selectors below are placeholders. Inspect jkt48.com's real
// markup and adjust before relying on this in production.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    const newsRes = await fetch("https://jkt48.com/news/list?lang=id");
    const newsHtml = await newsRes.text();

    const scheduleRes = await fetch("https://jkt48.com/theater/schedule?lang=id");
    const scheduleHtml = await scheduleRes.text();

    const { DOMParser } = await import("https://deno.land/x/deno_dom/deno-dom-wasm.ts");
    const newsDoc = new DOMParser().parseFromString(newsHtml, "text/html");
    const scheduleDoc = new DOMParser().parseFromString(scheduleHtml, "text/html");

    const newsItems = [...(newsDoc?.querySelectorAll(".list-news .item") ?? [])].map((el: any) => ({
      title: el.querySelector(".title")?.textContent?.trim() ?? "",
      excerpt: el.querySelector(".excerpt")?.textContent?.trim() ?? "",
      image_url: el.querySelector("img")?.getAttribute("src") ?? "",
      source_url: el.querySelector("a")?.getAttribute("href") ?? "",
      published_at: new Date().toISOString(),
    })).filter((n) => n.title);

    const scheduleItems = [...(scheduleDoc?.querySelectorAll(".schedule-list .item") ?? [])].map((el: any) => ({
      show_title: el.querySelector(".show-title")?.textContent?.trim() ?? "",
      setlist: el.querySelector(".setlist")?.textContent?.trim() ?? "",
      show_date: el.getAttribute("data-date") ?? new Date().toISOString().slice(0, 10),
      show_time: el.getAttribute("data-time") ?? "19:00",
      poster_url: el.querySelector("img")?.getAttribute("src") ?? "",
      ticket_status: el.querySelector(".ticket-status")?.textContent?.trim() ?? "Belum Tersedia",
    })).filter((s) => s.show_title);

    if (newsItems.length) await supabase.from("news").upsert(newsItems, { onConflict: "source_url" });
    if (scheduleItems.length) await supabase.from("schedules").insert(scheduleItems);

    return new Response(JSON.stringify({ ok: true, news: newsItems.length, schedules: scheduleItems.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
