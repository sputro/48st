// Supabase Edge Function: get-stream-url
// Deploy: supabase functions deploy get-stream-url
//
// The real video file lives in a PRIVATE Supabase Storage bucket (see
// CARA-SETTING-VIDEO.md). The client NEVER receives that permanent path —
// it only ever gets a signed URL that expires in 30 minutes, and only after
// this function verifies (server-side, with the service role key) that the
// user is allowed to watch: either the stream is free, they bought a ticket,
// or they redeemed an access token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORAGE_BUCKET = "private-streams"; // must match the bucket you created

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401 });
  }

  const scoped = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await scoped.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
  }

  const { stream_id } = await req.json();
  if (!stream_id) {
    return new Response(JSON.stringify({ error: "stream_id required" }), { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: stream } = await admin.from("streams").select("*").eq("id", stream_id).single();
  if (!stream) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

  if (stream.price > 0) {
    const { data: ticket } = await admin
      .from("tickets")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("stream_id", stream_id)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const { data: grant } = await admin
      .from("access_grants")
      .select("id")
      .eq("user_id", userData.user.id)
      .or(`scope.eq.all,stream_id.eq.${stream_id}`)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .maybeSingle();

    if (!ticket && !grant) {
      return new Response(JSON.stringify({ error: "Ticket or access token required" }), { status: 403 });
    }
  }

  // stream.stream_url stores just the PATH inside the private bucket
  // (e.g. "itadaki-love-10-juli-2026.mp4"), never a full public URL.
  const { data: signed, error: signErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(stream.stream_url, 60 * 30); // valid 30 minutes

  if (signErr || !signed) {
    return new Response(JSON.stringify({ error: "Gagal membuat link video" }), { status: 500 });
  }

  return new Response(JSON.stringify({ url: signed.signedUrl }), {
    headers: { "Content-Type": "application/json" },
  });
});
