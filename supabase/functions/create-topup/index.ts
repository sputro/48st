// Supabase Edge Function: create-topup
// Deploy: supabase functions deploy create-topup

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getB2BToken, buildSignedHeaders, doku, isDokuConfigured } from "../_shared/doku.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS headers dipakai di semua response (termasuk error)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // bisa diganti ke "https://48showtime.my.id" biar lebih ketat
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // WAJIB: tangani preflight OPTIONS SEBELUM cek auth apapun
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const scoped = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await scoped.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  const { amount } = await req.json();
  if (!amount || amount < 10000) {
    return new Response(JSON.stringify({ error: "Nominal top up minimal Rp 10.000" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isDokuConfigured()) {
    return new Response(
      JSON.stringify({ message: "Top up otomatis belum dikonfigurasi. Hubungi admin untuk top up manual." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const partnerReferenceNo = `TOPUP-${userId.slice(0, 8)}-${Date.now()}`;

  try {
    const accessToken = await getB2BToken();

    const path = "/snap-adapter/b2b/v1.0/qr/qr-mpm-generate";
    const requestBody = {
      partnerReferenceNo,
      amount: { value: Number(amount).toFixed(2), currency: "IDR" },
      merchantId: doku.merchantId,
      terminalId: doku.terminalId,
      additionalInfo: {
        postalCode: "12345", // TODO: ganti dengan kode pos merchant kamu yang sebenarnya
        feeType: "1",
      },
    };

    const headers = await buildSignedHeaders("POST", path, accessToken, requestBody);
    const dokuRes = await fetch(`${doku.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });
    const dokuJson = await dokuRes.json();

    if (!dokuRes.ok || !dokuJson.qrContent) {
      await admin.from("topup_requests").insert({
        user_id: userId, partner_reference_no: partnerReferenceNo, amount, status: "failed",
      });
      return new Response(JSON.stringify({ error: "Gagal membuat QRIS: " + (dokuJson.responseMessage || "unknown") }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("topup_requests").insert({
      user_id: userId,
      partner_reference_no: partnerReferenceNo,
      doku_reference_no: dokuJson.referenceNo,
      amount,
      qr_content: dokuJson.qrContent,
      status: "pending",
    });

    return new Response(
      JSON.stringify({ partner_reference_no: partnerReferenceNo, qr_content: dokuJson.qrContent, amount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Gagal terhubung ke DOKU: " + String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});