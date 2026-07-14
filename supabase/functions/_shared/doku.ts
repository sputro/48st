// supabase/functions/_shared/doku.ts
//
// Shared helpers for talking to DOKU's SNAP API (QRIS). Used by create-topup,
// check-topup-status, and doku-webhook so the signature/token logic lives in
// exactly one place.
//
// ⚠️ IMPORTANT — please verify against DOKU's own docs before going live:
// The QRIS doc you gave me covers Generate/Query/Refund/Decode/Payment/Cancel,
// but NOT the "Get Token B2B" endpoint itself. The implementation below follows
// the standard SNAP (Indonesian Open API/BI-SNAP) token pattern that DOKU's SNAP
// products are built on — asymmetric RSA-SHA256 signature over `${clientId}|${timestamp}`,
// POSTed to /authorization/v1/access-token/b2b. Cross-check the exact path/field
// names against DOKU's "Authorization" page in your dashboard/docs before
// deploying — if DOKU documents something slightly different, only this file
// needs to change.

const DOKU_ENV = Deno.env.get("DOKU_ENV") || "sandbox"; // "sandbox" | "production"
const DOKU_BASE_URL = DOKU_ENV === "production" ? "https://api.doku.com" : "https://api-sandbox.doku.com";

const DOKU_CLIENT_ID = Deno.env.get("DOKU_CLIENT_ID")!;
const DOKU_CLIENT_SECRET = Deno.env.get("DOKU_CLIENT_SECRET")!; // "Secret Key", used for symmetric HMAC signature
const DOKU_PRIVATE_KEY_PEM = Deno.env.get("DOKU_PRIVATE_KEY")!; // RSA private key (PKCS8 PEM), used to sign the token request
const DOKU_MERCHANT_ID = Deno.env.get("DOKU_MERCHANT_ID")!;
const DOKU_TERMINAL_ID = Deno.env.get("DOKU_TERMINAL_ID") || "01";

export function isDokuConfigured() {
  return Boolean(DOKU_CLIENT_ID && DOKU_CLIENT_SECRET && DOKU_PRIVATE_KEY_PEM && DOKU_MERCHANT_ID);
}

function nowIsoWithOffset() {
  // DOKU expects YYYY-MM-DDTHH:mm:ssZD (with timezone offset, e.g. +07:00)
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const offH = pad(Math.floor(Math.abs(offsetMin) / 60));
  const offM = pad(Math.abs(offsetMin) % 60);
  return (
    d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) +
    sign + offH + ":" + offM
  );
}

function generateExternalId() {
  // "Numeric string, unique within the same day" per DOKU's header spec.
  return String(Date.now()) + String(Math.floor(Math.random() * 1000)).padStart(3, "0");
}

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function signRsaSha256(stringToSign: string): Promise<string> {
  const keyData = pemToArrayBuffer(DOKU_PRIVATE_KEY_PEM);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(stringToSign));
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
}

async function hmacSha512Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
}

// ---------------------------------------------------------
// 1. Get B2B access token (call once, token is short-lived — ~15-30 min typically,
//    re-fetch per invocation for simplicity; add caching later if you want to
//    reduce calls, e.g. store in a small Supabase table with an expires_at).
// ---------------------------------------------------------
export async function getB2BToken(): Promise<string> {
  const timestamp = nowIsoWithOffset();
  const stringToSign = `${DOKU_CLIENT_ID}|${timestamp}`;
  const signature = await signRsaSha256(stringToSign);

  const res = await fetch(`${DOKU_BASE_URL}/authorization/v1/access-token/b2b`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CLIENT-KEY": DOKU_CLIENT_ID,
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
    },
    body: JSON.stringify({ grantType: "client_credentials" }),
  });

  const json = await res.json();
  if (!res.ok || !json.accessToken) {
    throw new Error("Gagal ambil token DOKU: " + JSON.stringify(json));
  }
  return json.accessToken as string;
}

// ---------------------------------------------------------
// 2. Build headers for a symmetric-signed request (Generate/Query/Refund/etc)
// ---------------------------------------------------------
export async function buildSignedHeaders(method: string, path: string, accessToken: string, body: unknown) {
  const timestamp = nowIsoWithOffset();
  const minifiedBody = JSON.stringify(body);
  const bodyHash = await sha256Hex(minifiedBody);
  const stringToSign = `${method}:${path}:${accessToken}:${bodyHash.toLowerCase()}:${timestamp}`;
  const signature = await hmacSha512Base64(DOKU_CLIENT_SECRET, stringToSign);

  return {
    "Content-Type": "application/json",
    "X-PARTNER-ID": DOKU_CLIENT_ID,
    "X-EXTERNAL-ID": generateExternalId(),
    "X-TIMESTAMP": timestamp,
    "X-SIGNATURE": signature,
    "Authorization": `Bearer ${accessToken}`,
    "CHANNEL-ID": "H2H",
  };
}

export const doku = {
  baseUrl: DOKU_BASE_URL,
  merchantId: DOKU_MERCHANT_ID,
  terminalId: DOKU_TERMINAL_ID,
};
