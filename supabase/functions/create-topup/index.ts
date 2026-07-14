// Supabase Edge Function: create-topup
// Deploy: supabase functions deploy create-topup
//
// Flow:
// 1. Client (logged in) calls this with { amount }.
// 2. We create a `topup_requests` row (status=pending) with our own unique
//    partnerReferenceNo.
// 3. We get a DOKU B2B token, then call DOKU's "Generate QRIS" API
//    (POST /snap-adapter/b2b/v1.0/qr/qr-mpm-generate) with that amount.
// 4. We store the returned qrContent on the topup_requests row and return it
//    to the client, which renders it as a scannable QR code (see js/profile.js).
// 5. Payment confirmation happens LATER, either via `doku-webhook` (DOKU calls
//    us when the user pays) or `check-topup-status` (client polls DOKU's Query
//    QRIS API as a fallback). Either path calls the `confirm_topup` RPC, which
//    is the ONLY place wallet_balance actually increases — never from this
//    function and never from the client directly.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getB2BToken, buildSignedHeaders, doku, isDokuConfigured } from "../_shared/doku.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });

  const scoped = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await scoped.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
  }
  const userId = userData.user.id;

  const { amount } = await req.json();
  if (!amount || amount < 10000) {
    return new Response(JSON.stringify({ error: "Nominal top up minimal Rp 10.000" }), { status: 400 });
  }

  if (!isDokuConfigured()) {
    return new Response(
      JSON.stringify({ message: "Top up otomatis belum dikonfigurasi. Hubungi admin untuk top up manual." }),
      { status: 200 }
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
        feeType: "1",        // 1 = No Tips
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
      return new Response(JSON.stringify({ error: "Gagal membuat QRIS: " + (dokuJson.responseMessage || "unknown") }), { status: 502 });
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
      JSON.stringify({
        partner_reference_no: partnerReferenceNo,
        qr_content: dokuJson.qrContent,
        amount,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Gagal terhubung ke DOKU: " + String(err) }), { status: 500 });
  }
});
