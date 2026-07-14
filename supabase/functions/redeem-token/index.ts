// Supabase Edge Function: redeem-token
// Deploy: supabase functions deploy redeem-token
//
// Prerequisite: enable "Anonymous Sign-ins" in Supabase Dashboard
// (Authentication > Providers > Anonymous Sign-In > Enable).
//
// Client flow: sb.auth.signInAnonymously() first if no session, then call this
// with { token }. Token is hashed and checked against `access_tokens`, a table
// with NO client-readable policy at all — invisible from the frontend entirely.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Butuh sesi aktif (masuk anonim dulu di client)" }), { status: 401 });
    }

    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token wajib diisi" }), { status: 400 });
    }

    const scoped = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await scoped.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sesi tidak valid" }), { status: 401 });
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const tokenHash = await sha256(token.trim());

    const { data: tokenRow, error: tokenErr } = await admin
      .from("access_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return new Response(JSON.stringify({ error: "Token tidak valid" }), { status: 404 });
    }
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Token sudah kedaluwarsa" }), { status: 410 });
    }
    if (tokenRow.used_count >= tokenRow.max_uses) {
      return new Response(JSON.stringify({ error: "Token sudah mencapai batas pemakaian" }), { status: 410 });
    }

    await admin.from("access_grants").insert({
      user_id: userId,
      scope: tokenRow.scope,
      stream_id: tokenRow.stream_id,
      source_token_id: tokenRow.id,
      expires_at: tokenRow.expires_at,
    });

    await admin.from("access_tokens").update({ used_count: tokenRow.used_count + 1 }).eq("id", tokenRow.id);

    return new Response(JSON.stringify({ success: true, scope: tokenRow.scope }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
