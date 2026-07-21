// Supabase Edge Function: get-show-lineup
// Deploy: supabase functions deploy get-show-lineup --no-verify-jwt
//
// This is a thin CORS-friendly PROXY: the browser can't call jkt48.com's API
// directly from client-side JS (CORS), so show-card.js calls this function
// instead, which fetches server-side (no CORS restriction) and passes the
// JSON straight through.
//
// SOURCE: https://jkt48.com/api/v1/theater-shows/{reference_code}?lang=id
// (confirmed via real HAR network capture). Response includes the EXACT
// members performing at that specific show (jkt48_member[]), the real
// birthday member names for that day (birthday_member_name[]), and the
// real end_time — much more precise than guessing from team roster + 2hr.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return new Response(JSON.stringify({ error: "code (reference_code) required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`https://jkt48.com/api/v1/theater-shows/${code}?lang=id`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; 48STFanHubBot/1.0)",
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `jkt48.com API returned ${res.status}` }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();

    return new Response(JSON.stringify(json), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
