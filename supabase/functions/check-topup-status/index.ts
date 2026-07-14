// Supabase Edge Function: check-topup-status
// Deploy: supabase functions deploy check-topup-status
//
// Client polls this every few seconds while the QR code modal is open.
// It calls DOKU's "Query QRIS" API to check the real payment status, and if
// paid, confirms it via the same `confirm_topup` RPC the webhook uses — so
// whichever path notices the payment first "wins", with no double-crediting
// (confirm_topup is idempotent: it checks `status = 'paid'` before applying).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getB2BToken, buildSignedHeaders, doku } from "../_shared/doku.ts";

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

  const { partner_reference_no } = await req.json();
  if (!partner_reference_no) {
    return new Response(JSON.stringify({ error: "partner_reference_no required" }), { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: reqRow } = await admin
    .from("topup_requests")
    .select("*")
    .eq("partner_reference_no", partner_reference_no)
    .eq("user_id", userData.user.id) // users can only poll their own topups
    .maybeSingle();

  if (!reqRow) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

  if (reqRow.status === "paid") {
    return new Response(JSON.stringify({ status: "paid" }), { headers: { "Content-Type": "application/json" } });
  }

  try {
    const accessToken = await getB2BToken();
    const path = "/snap-adapter/b2b/v1.0/qr/qr-mpm-query";
    const requestBody = {
      originalReferenceNo: reqRow.doku_reference_no,
      originalPartnerReferenceNo: reqRow.partner_reference_no,
      serviceCode: "47",
      merchantId: doku.merchantId,
    };
    const headers = await buildSignedHeaders("POST", path, accessToken, requestBody);
    const dokuRes = await fetch(`${doku.baseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(requestBody) });
    const dokuJson = await dokuRes.json();

    const isPaid = dokuJson.latestTransactionStatus === "00" || dokuJson.latestTransactionStatus === "PAID";

    if (isPaid) {
      await admin.rpc("confirm_topup", {
        p_partner_reference_no: reqRow.partner_reference_no,
        p_doku_reference_no: dokuJson.originalReferenceNo || reqRow.doku_reference_no,
        p_approval_code: dokuJson.additionalInfo?.approvalCode || null,
      });
      return new Response(JSON.stringify({ status: "paid" }), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ status: "pending" }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ status: "pending", warning: String(err) }), { headers: { "Content-Type": "application/json" } });
  }
});
