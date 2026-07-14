// Supabase Edge Function: doku-webhook
// Deploy: supabase functions deploy doku-webhook --no-verify-jwt
//
// This is a PUBLIC endpoint (no user JWT — DOKU calls it directly, not your
// frontend), so it must verify DOKU's own signature instead of a Supabase
// session. Register this function's URL in your DOKU dashboard as the QRIS
// "Notification URL":
//   https://YOUR-PROJECT-REF.supabase.co/functions/v1/doku-webhook
//
// ⚠️ The exact notification payload shape & signature scheme for DOKU's QRIS
// callback wasn't in the doc you gave me (that doc only covered the
// Generate/Query/Refund/Decode/Payment/Cancel *request* APIs, not the
// asynchronous notification). Verify the field names below — particularly
// `originalPartnerReferenceNo`, `latestTransactionStatus`, and the signature
// header — against DOKU's "Payment Notification" page before going live.
// Until then, `check-topup-status` (polling) is the more reliable path.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const body = await req.json();

    // TODO: verify DOKU's notification signature here before trusting the body
    // (typically an X-SIGNATURE header computed the same way as outgoing
    // requests, but check DOKU's notification doc for the exact formula).

    const partnerReferenceNo = body.originalPartnerReferenceNo || body.partnerReferenceNo;
    const status = body.latestTransactionStatus || body.transactionStatusDesc;
    const referenceNo = body.originalReferenceNo || body.referenceNo;
    const approvalCode = body.additionalInfo?.approvalCode;

    if (!partnerReferenceNo) {
      return new Response(JSON.stringify({ error: "Missing reference number" }), { status: 400 });
    }

    const isPaid = status === "00" || status === "PAID" || status === "SUCCESS";
    if (!isPaid) {
      return new Response(JSON.stringify({ received: true, note: "Status bukan sukses, tidak diproses." }), { status: 200 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error } = await admin.rpc("confirm_topup", {
      p_partner_reference_no: partnerReferenceNo,
      p_doku_reference_no: referenceNo || null,
      p_approval_code: approvalCode || null,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
